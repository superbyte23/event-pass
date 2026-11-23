// Per-admin Gmail sender accounts.
//
// Passwords are App Passwords encrypted with MAIL_CREDENTIALS_KEY. Only safe
// metadata is returned to the browser; secrets never leave the server.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { connectDb } from '../db/index.js';
import { MailAccount, MailLog, User } from '../db/models.js';
import { getAppUrl, getMailCredentialsKey } from './mail-config.js';
import { buildSampleTicketEmail } from './sample-ticket-email.js';
import { sendSmtpMail } from './smtp.js';

const CIPHER_VERSION = 'v1';
const DAY_MS = 24 * 60 * 60 * 1000;

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function assertAdmin(user) {
  if (user?.role !== 'admin') fail(403, 'You need an admin account to do that.');
}

function cleanText(value, label, { required = true, max = 200 } = {}) {
  const text = String(value ?? '').trim();
  if (!text) {
    if (required) fail(400, `${label} is required.`);
    return '';
  }
  if (text.length > max) fail(400, `${label} is too long.`);
  return text;
}

function normalizeEmail(value, label) {
  const email = cleanText(value, label).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, `Enter a valid ${label.toLowerCase()}.`);
  return email;
}

function normalizePassword(value, { required = false } = {}) {
  // Gmail UI shows App Passwords with spaces; SMTP accepts them without.
  const password = String(value ?? '').replace(/\s+/g, '');
  if (!password) {
    if (required) fail(400, 'Gmail App Password is required.');
    return null;
  }
  if (password.length < 8 || password.length > 128) {
    fail(400, 'Gmail App Password must be between 8 and 128 characters.');
  }
  return password;
}

function normalizeLimit(value) {
  if (value == null || value === '') return 500;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 1 || limit > 10000) {
    fail(400, 'Daily limit must be between 1 and 10000.');
  }
  return Math.trunc(limit);
}

function encryptSecret(plain) {
  const key = getMailCredentialsKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

function encryptForStorage(plain) {
  try {
    return encryptSecret(plain);
  } catch (error) {
    fail(400, error?.message || 'MAIL_CREDENTIALS_KEY is invalid.');
  }
}

function decryptSecret(payload) {
  const parts = String(payload || '').split('.');
  if (parts.length !== 4 || parts[0] !== CIPHER_VERSION) {
    throw new Error('Stored mail credentials are invalid.');
  }
  const key = getMailCredentialsKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const encrypted = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

async function usageByAccountIds(ids) {
  const unique = [...new Set(ids.map(String))];
  if (!unique.length) return new Map();
  await connectDb();
  const since = new Date(Date.now() - DAY_MS);
  const rows = await MailLog.aggregate([
    {
      $match: {
        account_id: { $in: unique },
        status: 'sent',
        sent_at: { $gte: since },
      },
    },
    { $group: { _id: '$account_id', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

async function remainingFor(account) {
  const usage = await usageByAccountIds([account._id]);
  const used = usage.get(String(account._id)) || 0;
  return Math.max(0, Number(account.daily_limit || 500) - used);
}

function smtpConfig(account) {
  return {
    host: String(account.host || 'smtp.gmail.com'),
    port: Number(account.port || 587),
    secure: Boolean(account.secure),
    user: account.email,
    pass: decryptSecret(account.encrypted_password),
    from: account.from,
    appUrl: getAppUrl(),
  };
}

function serializeAccount(doc, { usedToday = 0, isDefault = false } = {}) {
  const dailyLimit = Number(doc.daily_limit || 500);
  const remainingToday = Math.max(0, dailyLimit - Number(usedToday || 0));
  return {
    id: String(doc._id),
    label: doc.label,
    provider: doc.provider || 'gmail',
    email: doc.email,
    from: doc.from,
    host: doc.host || 'smtp.gmail.com',
    port: Number(doc.port || 587),
    secure: Boolean(doc.secure),
    dailyLimit,
    usedToday,
    remainingToday,
    canSend: Boolean(doc.active) && remainingToday > 0,
    active: Boolean(doc.active),
    sharedWithAdmins: Boolean(doc.shared_with_admins),
    ownerAdminId: String(doc.owner_admin_id),
    isDefault,
    createdDate: doc.created_date || null,
    updatedDate: doc.updated_date || doc.created_date || null,
  };
}

async function findById(id, { lean = true } = {}) {
  await connectDb();
  const query = MailAccount.findById(String(id));
  const doc = lean ? await query.lean() : await query.exec();
  if (!doc) fail(404, 'Mail account not found.');
  return doc;
}

function assertOwner(doc, user) {
  if (String(doc.owner_admin_id) !== String(user.id)) {
    fail(403, 'You can only manage your own mail accounts.');
  }
}

function assertCanUse(doc, user) {
  if (String(doc.owner_admin_id) !== String(user.id) && !doc.shared_with_admins) {
    fail(403, 'This mail account is not available to you.');
  }
}

function mapDbError(error) {
  if (error?.code === 11000) fail(409, 'You already have a mail account with this email.');
  throw error;
}

// ---------------------------------------------------------------------------
// Public service API
// ---------------------------------------------------------------------------

export async function listMailAccounts(user) {
  assertAdmin(user);
  await connectDb();
  const docs = await MailAccount.find({
    $or: [{ owner_admin_id: String(user.id) }, { shared_with_admins: true }],
  })
    .sort({ created_date: -1 })
    .lean();
  const usage = await usageByAccountIds(docs.map((doc) => doc._id));
  const owner = await User.findById(user.id).select('default_mail_account_id').lean();
  const defaultId = String(owner?.default_mail_account_id || '');
  return docs.map((doc) =>
    serializeAccount(doc, {
      usedToday: usage.get(String(doc._id)) || 0,
      isDefault: String(doc._id) === defaultId,
    }),
  );
}

export async function createMailAccount(input, user) {
  assertAdmin(user);
  const label = cleanText(input?.label, 'Label');
  const email = normalizeEmail(input?.email, 'Gmail address');
  const from = cleanText(input?.from || `EventPass <${email}>`, 'From address');
  const password = normalizePassword(input?.password, { required: true });
  const dailyLimit = normalizeLimit(input?.daily_limit);
  await connectDb();

  let doc;
  try {
    doc = await MailAccount.create({
      owner_admin_id: String(user.id),
      label,
      provider: 'gmail',
      email,
      from,
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      encrypted_password: encryptForStorage(password),
      daily_limit: dailyLimit,
      active: true,
      shared_with_admins: input?.shared_with_admins === true,
    });
  } catch (error) {
    mapDbError(error);
  }

  const owner = await User.findById(user.id).select('default_mail_account_id').lean();
  if (!owner?.default_mail_account_id) {
    await User.findByIdAndUpdate(user.id, { default_mail_account_id: String(doc._id) });
  }
  return serializeAccount(doc, { isDefault: !owner?.default_mail_account_id });
}

export async function updateMailAccount(id, input, user) {
  assertAdmin(user);
  const doc = await findById(id, { lean: false });
  assertOwner(doc, user);

  if (input?.label != null) doc.label = cleanText(input.label, 'Label');
  if (input?.from != null) doc.from = cleanText(input.from, 'From address');
  if (input?.daily_limit != null) doc.daily_limit = normalizeLimit(input.daily_limit);
  if (input?.active != null) doc.active = Boolean(input.active);
  if (input?.shared_with_admins != null) doc.shared_with_admins = Boolean(input.shared_with_admins);
  const password = normalizePassword(input?.password);
  if (password) doc.encrypted_password = encryptForStorage(password);
  doc.updated_date = new Date();

  try {
    await doc.save();
  } catch (error) {
    mapDbError(error);
  }
  const usedToday = await remainingFor(doc);
  const owner = await User.findById(user.id).select('default_mail_account_id').lean();
  return serializeAccount(doc, {
    usedToday: Number(doc.daily_limit || 500) - usedToday,
    isDefault: String(owner?.default_mail_account_id || '') === String(doc._id),
  });
}

export async function deleteMailAccount(id, user) {
  assertAdmin(user);
  const doc = await findById(id);
  assertOwner(doc, user);
  await MailAccount.deleteOne({ _id: doc._id });
  await User.updateMany(
    { default_mail_account_id: String(doc._id) },
    { $set: { default_mail_account_id: null } },
  );
  return { deleted: true };
}

export async function setDefaultMailAccount(id, user) {
  assertAdmin(user);
  const doc = await findById(id);
  assertCanUse(doc, user);
  if (!doc.active) fail(409, 'Enable this mail account before making it the default.');
  const remaining = await remainingFor(doc);
  if (remaining <= 0) fail(409, 'This mail account has reached its daily limit.');
  await User.findByIdAndUpdate(user.id, { default_mail_account_id: String(doc._id) });
  return serializeAccount(doc, { usedToday: Number(doc.daily_limit || 500) - remaining, isDefault: true });
}

export async function findDefaultAccount(adminId) {
  if (!adminId) return null;
  await connectDb();
  const owner = await User.findById(adminId).select('default_mail_account_id').lean();
  if (owner?.default_mail_account_id) {
    const doc = await MailAccount.findById(owner.default_mail_account_id).lean();
    if (doc?.active && (await remainingFor(doc)) > 0) return doc;
  }
  const fallback = await MailAccount.findOne({ owner_admin_id: String(adminId), active: true })
    .sort({ created_date: 1 })
    .lean();
  if (fallback && (await remainingFor(fallback)) > 0) return fallback;
  return null;
}

export async function resolveAccountForAdmin(id, user, { requireOwner = false } = {}) {
  assertAdmin(user);
  const doc = await findById(id);
  if (requireOwner) assertOwner(doc, user);
  else assertCanUse(doc, user);
  if (!doc.active) fail(409, 'This mail account is disabled.');
  if ((await remainingFor(doc)) <= 0) fail(409, 'This mail account has reached its daily limit.');
  return doc;
}

// Used by the bulk sender: validates that the caller may use the account and
// returns the remaining rolling-24h quota for the whole batch.
export async function getAccountForUse(id, user) {
  const account = await resolveAccountForAdmin(id, user, { requireOwner: false });
  return { account, remaining: await remainingFor(account) };
}

export async function recordMailResult({
  account,
  adminId = null,
  registrationId = null,
  eventId = null,
  kind = 'ticket',
  sent,
  error = null,
  messageId = null,
}) {
  try {
    await connectDb();
    await MailLog.create({
      account_id: String(account?._id || account?.id || ''),
      owner_admin_id: account?.owner_admin_id ? String(account.owner_admin_id) : null,
      admin_id: adminId ? String(adminId) : null,
      registration_id: registrationId ? String(registrationId) : null,
      event_id: eventId ? String(eventId) : null,
      kind,
      status: sent ? 'sent' : 'failed',
      error: sent ? null : String(error || 'SMTP send failed.'),
      message_id: messageId || null,
      sent_at: new Date(),
    });
  } catch (logError) {
    console.error('Mail log failed:', logError?.message || logError);
  }
}

export async function sendWithAccount({
  account,
  adminId = null,
  to,
  subject,
  text,
  html,
  attachments,
  registrationId = null,
  eventId = null,
  kind = 'ticket',
}) {
  if (!String(to || '').trim()) return { sent: false, reason: 'no-recipient' };

  const remainingBefore = await remainingFor(account);
  if (remainingBefore <= 0) return { sent: false, reason: 'account-limit-reached' };

  let config;
  try {
    config = smtpConfig(account);
  } catch (error) {
    const message = error?.message || 'Mail credentials could not be decrypted.';
    await recordMailResult({ account, adminId, kind, sent: false, error: message });
    return { sent: false, reason: 'mail-credentials-invalid', error: message };
  }

  const result = await sendSmtpMail({ config, to, subject, text, html, attachments });
  await recordMailResult({
    account,
    adminId,
    registrationId,
    eventId,
    kind,
    sent: result.sent,
    error: result.error,
    messageId: result.messageId,
  });
  return {
    ...result,
    remainingToday: Math.max(0, remainingBefore - (result.sent ? 1 : 0)),
  };
}

export async function testMailAccount(id, user, payload = {}) {
  assertAdmin(user);
  const doc = await findById(id);
  assertCanUse(doc, user);
  if (!doc.active) fail(409, 'Enable this mail account before sending a test.');
  if ((await remainingFor(doc)) <= 0) fail(409, 'This mail account has reached its daily limit.');

  const to = normalizeEmail(payload?.to || user.email, 'Recipient email');
  const note = cleanText(payload?.body || '', 'Note', { required: false, max: 2000 });
  const sample = await buildSampleTicketEmail({
    note,
    appUrl: getAppUrl(),
    fromEmail: doc.from || doc.email,
  });
  const subject = cleanText(payload?.subject || sample.subject, 'Subject', { max: 200 });

  const result = await sendWithAccount({
    account: doc,
    adminId: user.id,
    to,
    subject,
    text: sample.text,
    html: sample.html,
    attachments: sample.attachments,
    kind: 'test',
  });
  if (!result.sent) fail(502, result.error || 'Test email could not be sent.');
  return { sent: true, messageId: result.messageId, remainingToday: result.remainingToday };
}
