// Outgoing mail (ticket delivery). Provider-agnostic SMTP: works with Gmail
// (App Password), Resend/Postmark/etc. via their SMTP endpoints, or any
// other SMTP relay.
//
// INACTIVE until configured: without SMTP_HOST (and MAIL_FROM) every send
// resolves { sent: false } without touching the network, so the app behaves
// exactly as if mail didn't exist. Fill in .env.local when ready.

import { deflateSync } from 'node:zlib';

import { connectDb } from '../db/index.js';
import { Event, User } from '../db/models.js';
import { createQRMatrix } from '../lib/qr-encode.js';

export function getMailConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  if (!host) return null;
  // An explicit FROM is required — silently sending from a made-up address
  // would only produce bounces and spam-folder placement.
  const from = (process.env.MAIL_FROM || '').trim();
  if (!from) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== ''
      ? String(process.env.SMTP_SECURE).toLowerCase() === 'true'
      : port === 465;
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure,
    user: (process.env.SMTP_USER || '').trim() || null,
    pass: (process.env.SMTP_PASS || '').trim() || null,
    from,
    appUrl: (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000')
      .trim()
      .replace(/\/$/, ''),
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEventDate(event) {
  if (!event?.date) return '';
  try {
    const d = new Date(event.date);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch {
    /* fall through to raw value */
  }
  return String(event.date);
}

// Minimal PNG encoder (8-bit grayscale, no interlace) for the ticket QR.
// Keeps QR attachments dependency-free; verified by decoding round-trip.
const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([...typeBuf, ...data]), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function qrPngBuffer(text, { scale = 8, quiet = 4 } = {}) {
  const qr = createQRMatrix(text);
  const dim = qr.size + quiet * 2;
  const width = dim * scale;
  const rows = [];
  for (let r = 0; r < dim; r++) {
    const row = Buffer.alloc(1 + width, 255);
    row[0] = 0; // filter type 0 (None)
    for (let c = 0; c < dim; c++) {
      const mr = r - quiet;
      const mc = c - quiet;
      const dark = mr >= 0 && mc >= 0 && mr < qr.size && mc < qr.size && qr.at(mr, mc);
      if (!dark) continue;
      for (let x = 0; x < scale; x++) {
        row[1 + c * scale + x] = 0;
      }
    }
    rows.push(row);
  }
  // Expand rows vertically: each module row repeats `scale` scanlines.
  const expanded = [];
  for (let r = 0; r < dim; r++) {
    for (let y = 0; y < scale; y++) expanded.push(rows[r]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(width, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const idat = deflateSync(Buffer.concat(expanded));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function buildTicketEmail({ registration, event, displayName, appUrl }) {
  const reg = registration || {};
  const eventName = event?.name || reg.event_name || 'your event';
  const number = reg.registration_number || '';
  const name = displayName || reg.guest_name || 'there';
  const ticketUrl = `${appUrl}/tickets/${reg.id}`;
  const findUrl = event?.slug ? `${appUrl}/find-ticket?event=${event.slug}` : `${appUrl}/find-ticket`;
  const dateStr = formatEventDate(event);
  const timeStr = [event?.start_time, event?.end_time].filter(Boolean).join(' – ');
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
    `You're registered for ${eventName}.`,
    ...detailLines.slice(1),
    '',
    `Registration no.: ${number}`,
    '',
    'Your QR code is attached — present it at entry (or open your ticket):',
    ticketUrl,
    '',
    `Lost this email? Look up your tickets any time: ${findUrl}`,
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px;margin:0 auto;padding:24px;">
<p>Hi ${escapeHtml(name)},</p>
<p>You're registered for <strong>${escapeHtml(eventName)}</strong>.</p>
${detailLines.slice(1).map((l) => `<p style="color:#475569;margin:4px 0;">${escapeHtml(l)}</p>`).join('')}
<p>Registration no.: <strong style="font-family:monospace;">${escapeHtml(number)}</strong></p>
<p><img src="cid:ticketqr" alt="Ticket QR code" width="220" height="220" style="border:1px solid #e2e8f0;border-radius:12px;" /></p>
<p>Present this QR at entry, or open your ticket here:<br /><a href="${escapeHtml(ticketUrl)}">${escapeHtml(ticketUrl)}</a></p>
<p style="color:#64748b;font-size:12px;">Lost this email? Look up your tickets any time: <a href="${escapeHtml(findUrl)}">Find my ticket</a></p>
</body></html>`;

  return { subject, text, html, qrPng, to: null };
}

export async function sendMail({ to, subject, text, html, attachments }) {
  const config = getMailConfig();
  if (!config) return { sent: false, reason: 'mail-not-configured' };
  try {
    const { default: nodemailer } = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
    return { sent: true, messageId: info?.messageId || null };
  } catch (error) {
    console.error('Mail send failed:', error?.message || error);
    return { sent: false, reason: 'error' };
  }
}

// Ticket delivery for a freshly created registration. Never throws and never
// blocks registration: failures only log. Resolve the recipient from the
// guest email, falling back to the owner's account email.
export async function notifyTicketCreated(registration) {
  try {
    const config = getMailConfig();
    if (!config) return { sent: false, reason: 'mail-not-configured' };
    const reg = registration || {};
    let to = String(reg.guest_email || '').trim();
    let displayName = reg.guest_name || null;
    await connectDb();
    if (!to && reg.user_id) {
      const owner = await User.findById(reg.user_id).lean();
      to = String(owner?.email || '').trim();
      displayName = displayName || owner?.full_name || null;
    }
    if (!to) return { sent: false, reason: 'no-recipient' };
    const event = reg.event_id ? await Event.findById(reg.event_id).lean() : null;
    const built = buildTicketEmail({ registration: reg, event, displayName, appUrl: config.appUrl });
    return await sendMail({
      to,
      subject: built.subject,
      text: built.text,
      html: built.html,
      attachments: [
        {
          filename: `ticket-${reg.registration_number || 'qr'}.png`,
          content: built.qrPng,
          cid: 'ticketqr',
        },
      ],
    });
  } catch (error) {
    console.error('Ticket email failed:', error?.message || error);
    return { sent: false, reason: 'error' };
  }
}
