// Outgoing mail (ticket delivery). Provider-agnostic SMTP: works with Gmail
// (App Password), Resend/Postmark/etc. via their SMTP endpoints, or any
// other SMTP relay.
//
// INACTIVE until configured: without SMTP_HOST (and MAIL_FROM) every send
// resolves { sent: false } without touching the network, so the app behaves
// exactly as if mail didn't exist. Fill in .env.local when ready.

import { connectDb } from '../db/index.js';
import { Event, User } from '../db/models.js';
import { formatDate, timeRangeLabel } from '../lib/event-utils.js';
import { qrPngBuffer } from '../lib/qr-png.js';
import { getAppUrl, getLegacyMailConfig as getMailConfig } from './mail-config.js';
import { sendSmtpMail } from './smtp.js';
import { findDefaultAccount, resolveAccountForAdmin, sendWithAccount } from './mail-accounts.js';
import { buildPremiumTicketEmailHtml } from './premium-email-template.js';
import { ticketShortUrl } from './short-links.js';

// Kept exported so existing callers keep working. SMTP resolution now lives in
// src/server/mail-config.js alongside the bulk-send defaults.
export { getMailConfig, qrPngBuffer };

export async function buildTicketEmail({ registration, event, displayName, guest, guestEmail, appUrl }) {
  const reg = registration || {};
  const attendee = guest || { full_name: displayName || reg.guest_name, email: guestEmail || reg.guest_email || '' };
  const eventName = event?.name || reg.event_name || 'your event';
  const number = reg.registration_number || '';
  const name = displayName || attendee.full_name || reg.guest_name || 'there';
  const ticketUrl = `${appUrl}/tickets/${reg.id}`;
  const shortUrl = reg.id ? ticketShortUrl(reg.id, appUrl) || ticketUrl : ticketUrl;
  const downloadUrl = `${shortUrl}${shortUrl.includes('?') ? '&' : '?'}download=1`;
  const findUrl = event?.slug ? `${appUrl}/find-ticket?event=${event.slug}` : `${appUrl}/find-ticket`;
  const dateStr = formatDate(event?.date);
  const timeStr = timeRangeLabel(event?.start_time, event?.end_time);
  const venueStr = [event?.venue, event?.venue_address].filter(Boolean).join(', ');
  const qrValue = `${appUrl}/checkin/${reg.qr_token}`;
  const qrPng = qrPngBuffer(qrValue);

  const subject = `Your ticket for ${eventName}`;
  const detailLines = [
    eventName,
    [dateStr, timeStr].filter(Boolean).join(' · '),
    venueStr,
  ].filter(Boolean);

  const text = [
    `Hi ${name},`,
    '',
    `You're registered for ${eventName}. Your QR ticket is included in this email.`,
    ...detailLines.slice(1),
    '',
    `Registration no.: ${number}`,
    '',
    'View your ticket online (short link):',
    shortUrl,
    '',
    'Download a portrait ticket image:',
    downloadUrl,
    '',
    'Present the QR code at the entrance. Screenshot it or save the image for offline use.',
    '',
    `Lost this email? Look up your tickets any time: ${findUrl}`,
  ].join('\n');

  const html = buildPremiumTicketEmailHtml({
    event,
    registration: { ...reg, id: reg.id },
    guest: attendee,
    appUrl,
    ticketUrl,
    shortUrl,
    downloadUrl,
    qrSrc: 'cid:ticketqr',
  });

  return { subject, text, html, qrPng, to: null };
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  attachments,
  accountId = null,
  adminId = null,
  registrationId = null,
  eventId = null,
  kind = 'ticket',
}) {
  // New path: a configured per-admin Gmail account was selected explicitly
  // (bulk send) or resolved from the event owner (automatic ticket email).
  if (accountId || adminId) {
    if (!adminId) return { sent: false, reason: 'mail-account-not-configured' };
    const user = { id: adminId, role: 'admin' };
    const account = accountId
      ? await resolveAccountForAdmin(accountId, user, { requireOwner: false })
      : await findDefaultAccount(adminId);
    if (!account) return { sent: false, reason: 'mail-account-not-configured' };
    return sendWithAccount({
      account,
      adminId: adminId || account.owner_admin_id,
      to,
      subject,
      text,
      html,
      attachments,
      registrationId,
      eventId,
      kind,
    });
  }

  // Legacy fallback: flat SMTP_* env settings. Kept so existing installs keep
  // working until an admin account is configured in the UI.
  return sendSmtpMail({ config: getMailConfig(), to, subject, text, html, attachments });
}

// Ticket delivery for a freshly created registration. Never throws and never
// blocks registration: failures only log. Resolve the recipient from the
// guest email, falling back to the owner's account email.
export async function notifyTicketCreated(registration) {
  try {
    const reg = registration || {};
    let to = String(reg.guest_email || '').trim();
    let displayName = reg.guest_name || null;
    let attendeeProfile = null;
    await connectDb();
    if (reg.user_id) {
      attendeeProfile = await User.findById(reg.user_id).lean();
      if (!to) to = String(attendeeProfile?.email || '').trim();
      displayName = displayName || attendeeProfile?.full_name || null;
    }
    if (!to) return { sent: false, reason: 'no-recipient' };

    const event = reg.event_id ? await Event.findById(reg.event_id).lean() : null;
    const adminId = event?.created_by || null;
    const account = adminId ? await findDefaultAccount(adminId) : null;
    const legacyConfig = getMailConfig();
    if (!account && !legacyConfig) return { sent: false, reason: 'mail-not-configured' };

    const built = await buildTicketEmail({
      registration: reg,
      event,
      displayName,
      guest: attendeeProfile || { full_name: displayName, email: to },
      guestEmail: to,
      appUrl: legacyConfig?.appUrl || getAppUrl(),
    });
    const payload = {
      to,
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
      registrationId: reg.id || null,
      eventId: reg.event_id || null,
    };

    if (account) {
      return await sendMail({ ...payload, accountId: account.id, adminId });
    }
    return await sendMail(payload);
  } catch (error) {
    console.error('Ticket email failed:', error?.message || error);
    return { sent: false, reason: 'error' };
  }
}
