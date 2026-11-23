// Bulk ticket emailing for one event.
//
// A batch is created from a checked-off list of registrations. The browser
// then asks the server to process a small chunk at a time so each email has an
// observable queued → sending → sent/failed/skipped state. Registration rows
// keep the final state permanently for the admin list.

import { connectDb } from '../db/index.js';
import {
  Event,
  MailAccount,
  MailBatch,
  Registration,
  User,
} from '../db/models.js';
import { assertAdminCanAccessEvent } from './event-admin-links.js';
import { getAccountForUse, sendWithAccount } from './mail-accounts.js';
import { getAppUrl, getMailRuntimeConfig } from './mail-config.js';
import { buildTicketEmail } from './mailer.js';

const TERMINAL_STATUSES = new Set(['sent', 'failed', 'skipped']);

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function assertAdmin(user) {
  if (user?.role !== 'admin') fail(403, 'You need an admin account to do that.');
}

function delay(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanRecipient(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  // CSV imports disambiguate duplicate emails as name@example.com#2. The
  // suffix is an internal marker, never part of the real recipient address.
  const email = raw.split('#')[0].trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function recount(items) {
  const counts = { total: items.length, processed: 0, sent: 0, skipped: 0, failed: 0 };
  for (const item of items) {
    if (!TERMINAL_STATUSES.has(item.status)) continue;
    counts.processed += 1;
    if (item.status === 'sent') counts.sent += 1;
    else if (item.status === 'skipped') counts.skipped += 1;
    else counts.failed += 1;
  }
  return counts;
}

function serializeBatch(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;
  return {
    id: String(obj._id),
    eventId: String(obj.event_id),
    adminId: String(obj.admin_id),
    accountId: String(obj.account_id),
    accountLabel: obj.account_label || null,
    accountEmail: obj.account_email || null,
    status: obj.status || 'running',
    processing: Boolean(obj.processing),
    error: obj.error || null,
    counts: {
      total: Number(obj.counts?.total || 0),
      processed: Number(obj.counts?.processed || 0),
      sent: Number(obj.counts?.sent || 0),
      skipped: Number(obj.counts?.skipped || 0),
      failed: Number(obj.counts?.failed || 0),
    },
    items: (obj.items || []).map((item) => ({
      registrationId: String(item.registrationId || item.registration_id || ''),
      name: item.name || 'Guest',
      email: item.email || null,
      status: item.status || 'queued',
      reason: item.reason || null,
      skipReason: item.skipReason || null,
      attempts: Number(item.attempts || 0),
    })),
    createdDate: obj.created_date || null,
    updatedDate: obj.updated_date || null,
    completedDate: obj.completed_date || null,
  };
}

async function findBatch(eventId, batchId, user) {
  assertAdmin(user);
  await connectDb();
  const doc = await MailBatch.findOne({
    _id: String(batchId || ''),
    event_id: String(eventId),
    admin_id: String(user.id),
  }).lean();
  if (!doc) fail(404, 'Email batch not found.');
  return doc;
}

async function saveBatch(doc) {
  doc.markModified('items');
  doc.updated_date = new Date();
  await doc.save();
  return doc;
}

async function setItemState(batchId, index, patch) {
  const doc = await MailBatch.findById(batchId);
  if (!doc) return null;
  if (!doc.items[index]) return doc;
  doc.items[index] = { ...doc.items[index], ...patch };
  doc.counts = recount(doc.items);
  return saveBatch(doc);
}

async function updateRegistration(registrationId, { status, error = null, accountId, countAttempt = false }) {
  if (!registrationId) return;
  const update = {
    $set: {
      email_status: status,
      email_error: error,
      email_account_id: accountId || null,
    },
  };
  if (status === 'sent') update.$set.email_sent_at = new Date();
  if (countAttempt) update.$inc = { email_attempts: 1 };
  await Registration.findByIdAndUpdate(String(registrationId), update);
}

// ---------------------------------------------------------------------------
// Public service API
// ---------------------------------------------------------------------------

export async function startBulkMail(eventId, input, user) {
  const event = await assertAdminCanAccessEvent(eventId, user);
  const accountId = String(input?.accountId || '').trim();
  if (!accountId) fail(400, 'Choose a Gmail account first.');

  const { account, remaining } = await getAccountForUse(accountId, user);

  const ids = [...new Set(
    (Array.isArray(input?.registrationIds) ? input.registrationIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];
  if (!ids.length) fail(400, 'Select at least one registration.');
  if (ids.length > 1000) fail(400, 'Select at most 1000 registrations at a time.');

  await connectDb();
  const regs = await Registration.find({ event_id: String(event._id), _id: { $in: ids } }).lean();
  if (regs.length !== ids.length) {
    fail(404, 'One or more selected registrations no longer exist.');
  }
  const byId = new Map(regs.map((reg) => [String(reg._id), reg]));

  const ownerIds = [...new Set(
    regs.map((reg) => (reg.user_id ? String(reg.user_id) : null)).filter(Boolean),
  )];
  const owners = ownerIds.length
    ? await User.find({ _id: { $in: ownerIds } }).lean()
    : [];
  const ownersById = new Map(owners.map((owner) => [String(owner._id), owner]));

  const items = ids.map((id) => {
    const reg = byId.get(id);
    const owner = reg.user_id ? ownersById.get(String(reg.user_id)) : null;
    const rawEmail = reg.guest_email || owner?.email || null;
    const email = cleanRecipient(rawEmail);

    let skipReason = null;
    if (reg.status === 'cancelled') skipReason = 'Registration cancelled.';
    else if (!rawEmail) skipReason = 'No email address.';
    else if (!email) skipReason = 'Invalid email address.';

    return {
      registrationId: id,
      name: reg.guest_name || owner?.full_name || 'Guest',
      email,
      status: 'queued',
      reason: null,
      skipReason,
      attempts: 0,
    };
  });

  const sendable = items.filter((item) => !item.skipReason).length;
  if (sendable > remaining) {
    fail(
      409,
      `This account can send ${remaining} more email${remaining === 1 ? '' : 's'} today. ` +
        `Select ${remaining} or fewer registrations.`,
    );
  }

  // A previous batch left running (e.g. the browser was closed) is abandoned.
  await MailBatch.updateMany(
    { event_id: String(event._id), admin_id: String(user.id), status: 'running' },
    {
      $set: {
        status: 'cancelled',
        cancel_requested: true,
        processing: false,
        error: 'Replaced by a newer batch.',
        completed_date: new Date(),
        updated_date: new Date(),
      },
    },
  );

  const batch = await MailBatch.create({
    event_id: String(event._id),
    admin_id: String(user.id),
    account_id: String(account._id),
    account_label: account.label || null,
    account_email: account.email || null,
    status: 'running',
    processing: false,
    cancel_requested: false,
    items,
    counts: recount(items),
    created_date: new Date(),
    updated_date: new Date(),
  });

  return serializeBatch(batch);
}

export async function getLatestBulkMail(eventId, user) {
  assertAdmin(user);
  await connectDb();
  const doc = await MailBatch.findOne({
    event_id: String(eventId),
    admin_id: String(user.id),
  })
    .sort({ created_date: -1 })
    .lean();
  return serializeBatch(doc);
}

export async function getBulkMail(eventId, batchId, user) {
  return serializeBatch(await findBatch(eventId, batchId, user));
}

export async function processBulkMail(eventId, batchId, user) {
  assertAdmin(user);
  await connectDb();

  const filter = {
    _id: String(batchId || ''),
    event_id: String(eventId),
    admin_id: String(user.id),
  };
  const claimed = await MailBatch.findOneAndUpdate(
    {
      ...filter,
      status: 'running',
      $or: [
        { processing: false },
        { updated_date: { $lt: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
      $expr: { $lt: ['$counts.processed', '$counts.total'] },
    },
    { $set: { processing: true, updated_date: new Date() } },
    { new: true },
  );

  if (!claimed) {
    const current = await MailBatch.findOne(filter).lean();
    if (!current) fail(404, 'Email batch not found.');
    return serializeBatch(current);
  }

  const config = getMailRuntimeConfig();
  const queuedIndexes = claimed.items
    .map((item, index) => (item.status === 'queued' ? index : -1))
    .filter((index) => index >= 0)
    .slice(0, config.batchChunkSize);

  let result = null;
  try {
    const event = await Event.findById(claimed.event_id).lean();
    if (!event) throw new Error('Event no longer exists.');
    const account = await MailAccount.findById(claimed.account_id).lean();
    if (!account) throw new Error('Mail account no longer exists.');

    for (let position = 0; position < queuedIndexes.length; position += 1) {
      const index = queuedIndexes[position];
      const current = await MailBatch.findById(batchId);
      if (!current || current.status !== 'running' || current.cancel_requested) break;
      const item = current.items[index];
      if (!item || item.status !== 'queued') continue;

      if (item.skipReason) {
        await setItemState(batchId, index, { status: 'skipped', reason: item.skipReason });
        await updateRegistration(item.registrationId, {
          status: 'skipped',
          error: item.skipReason,
          accountId: claimed.account_id,
        });
        continue;
      }

      await setItemState(batchId, index, { status: 'sending', reason: null });
      await updateRegistration(item.registrationId, {
        status: 'sending',
        error: null,
        accountId: claimed.account_id,
      });

      try {
        const reg = await Registration.findById(item.registrationId).lean();
        if (!reg) throw new Error('Registration no longer exists.');
        const built = await buildTicketEmail({
          registration: { ...reg, id: String(reg._id) },
          event,
          displayName: item.name,
          guestEmail: item.email,
          appUrl: getAppUrl(),
        });
        const result = await sendWithAccount({
          account,
          adminId: claimed.admin_id,
          to: item.email,
          subject: built.subject,
          text: built.text,
          html: built.html,
          attachments: [
            {
              filename: `ticket-${reg.registration_number || 'qr'}.png`,
              content: built.qrPng,
              cid: 'ticketqr',
              contentDisposition: 'inline',
            },
          ],
          registrationId: String(reg._id),
          eventId: String(event._id),
          kind: 'ticket',
        });

        if (result.sent) {
          await setItemState(batchId, index, { status: 'sent', reason: null, attempts: (item.attempts || 0) + 1 });
          await updateRegistration(item.registrationId, {
            status: 'sent',
            error: null,
            accountId: claimed.account_id,
            countAttempt: true,
          });
        } else if (result.reason === 'account-limit-reached') {
          throw Object.assign(new Error('This mail account reached its daily limit.'), {
            dailyLimitReached: true,
          });
        } else {
          const message = result.error || result.reason || 'Email could not be sent.';
          await setItemState(batchId, index, {
            status: 'failed',
            reason: message,
            attempts: (item.attempts || 0) + 1,
          });
          await updateRegistration(item.registrationId, {
            status: 'failed',
            error: message,
            accountId: claimed.account_id,
            countAttempt: true,
          });
        }
      } catch (error) {
        const message = error?.message || 'Email could not be sent.';
        await setItemState(batchId, index, {
          status: 'failed',
          reason: message,
          attempts: (item.attempts || 0) + 1,
        });
        await updateRegistration(item.registrationId, {
          status: 'failed',
          error: message,
          accountId: claimed.account_id,
          countAttempt: true,
        });

        if (error?.dailyLimitReached) {
          const stopped = await MailBatch.findById(batchId);
          for (const entry of stopped.items) {
            if (entry.status !== 'queued') continue;
            await updateRegistration(entry.registrationId, {
              status: 'failed',
              error: 'Not sent — daily limit reached.',
              accountId: claimed.account_id,
              countAttempt: false,
            });
          }
          stopped.items = stopped.items.map((entry) =>
            entry.status === 'queued'
              ? { ...entry, status: 'failed', reason: 'Not sent — daily limit reached.' }
              : entry,
          );
          stopped.counts = recount(stopped.items);
          stopped.error = message;
          stopped.status = 'failed';
          stopped.cancel_requested = true;
          await saveBatch(stopped);
          break;
        }
      }

      if (position < queuedIndexes.length - 1) await delay(config.sendIntervalMs);
    }
  } catch (error) {
    const doc = await MailBatch.findById(batchId);
    if (doc) {
      doc.error = error?.message || 'Email batch failed.';
      doc.status = 'failed';
      for (const entry of doc.items) {
        if (entry.status !== 'queued') continue;
        await updateRegistration(entry.registrationId, {
          status: 'failed',
          error: doc.error,
          accountId: doc.account_id,
          countAttempt: false,
        });
      }
      doc.items = doc.items.map((entry) =>
        entry.status === 'queued'
          ? { ...entry, status: 'failed', reason: doc.error }
          : entry,
      );
      doc.counts = recount(doc.items);
      await saveBatch(doc);
    }
  } finally {
    const doc = await MailBatch.findById(batchId);
    if (doc) {
      doc.processing = false;
      doc.counts = recount(doc.items);
      if (
        doc.status === 'running' &&
        doc.counts.processed >= doc.counts.total &&
        doc.counts.total > 0
      ) {
        doc.status = 'completed';
        doc.completed_date = new Date();
      }
      result = serializeBatch(doc);
      await saveBatch(doc);
    }
  }
  return result || serializeBatch(await MailBatch.findById(batchId).lean());
}

export async function cancelBulkMail(eventId, batchId, user) {
  const existing = await findBatch(eventId, batchId, user);
  if (existing.status !== 'running') return serializeBatch(existing);

  const doc = await MailBatch.findById(existing._id);
  if (!doc) fail(404, 'Email batch not found.');
  const queued = doc.items.filter((item) => item.status === 'queued');
  for (const item of queued) {
    await updateRegistration(item.registrationId, {
      status: 'skipped',
      error: 'Cancelled by admin.',
      accountId: doc.account_id,
    });
  }
  doc.items = doc.items.map((item) =>
    item.status === 'queued'
      ? { ...item, status: 'skipped', reason: 'Cancelled by admin.' }
      : item,
  );
  doc.status = 'cancelled';
  doc.cancel_requested = true;
  doc.processing = false;
  doc.counts = recount(doc.items);
  doc.completed_date = new Date();
  await saveBatch(doc);
  return serializeBatch(doc);
}
