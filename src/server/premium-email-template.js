// Premium ticket delivery email. The QR is an inline CID image (`cid:ticketqr`)
// so it renders in Gmail and other clients that strip data URIs. It is not a
// downloadable attachment. Links to view or download the official ticket are
// included without printing the raw short URL in the layout.

import {
  absoluteUrl,
  cssUrl,
  escapeHtml,
} from './ticket-email-template.js';
import { formatDate, timeRangeLabel } from '../lib/event-utils.js';

const ICON_CALENDAR =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CLOCK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const ICON_PIN =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

function detailBlock(icon, label, value, sub) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:14px;">
  <div style="color:#94a3b8;font-size:10px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;">${icon} ${label}</div>
  <div style="margin-top:5px;color:#0f172a;font-size:14px;font-weight:bold;line-height:1.4;">${escapeHtml(value || '—')}</div>
  ${sub ? `<div style="margin-top:2px;color:#64748b;font-size:12px;line-height:1.4;">${escapeHtml(sub)}</div>` : ''}
</td></tr></table>`;
}

export function buildPremiumTicketEmailHtml({
  event = {},
  registration = {},
  guest = {},
  appUrl = '',
  ticketUrl = '',
  downloadUrl = '',
  qrSrc = 'cid:ticketqr',
  ctaLabel = 'View your ticket →',
  sample = false,
  noticeHtml = '',
  footerHtml = '',
} = {}) {
  const accent = event.accent_color || '#0f172a';
  const eventName = event.name || registration.event_name || 'your event';
  const firstName = String(guest?.full_name || registration.guest_name || 'there')
    .trim()
    .split(/\s+/)[0];
  const cover = absoluteUrl(event.cover_image, appUrl);
  const date = formatDate(event.date) || '—';
  const time = event.time_label || timeRangeLabel(event.start_time, event.end_time) || '—';
  const venue = event.venue || '—';
  const address = event.venue_address || '';
  const safeTicketUrl = escapeHtml(ticketUrl || '#');
  const safeDownloadUrl = escapeHtml(downloadUrl || ticketUrl || '#');
  const heroStyle = [
    `background-color:${accent}`,
    cover
      ? `background-image:linear-gradient(to top,rgba(0,0,0,0.82),rgba(0,0,0,0.35)),url('${cssUrl(cover)}')`
      : '',
    'background-size:cover',
    'background-position:center',
  ]
    .filter(Boolean)
    .join(';');

  const preheader = sample
    ? 'This is a sample of the ticket email your guests will receive.'
    : `Your QR ticket for ${eventName} is ready. Save it to your phone and present it at the entrance.`;

  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
</head><body style="margin:0;padding:0;background:#eef2f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 24px 48px -18px rgba(15,23,42,0.25);font-family:Arial,Helvetica,sans-serif;color:#0f172a;">

<tr><td style="${heroStyle};padding:26px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="color:#c7d2fe;font-size:12px;font-weight:bold;letter-spacing:3px;">EVENTPASS</td>
    <td align="right" style="color:#e2e8f0;font-size:12px;letter-spacing:1px;">${sample ? 'SAMPLE TICKET' : 'ADMIT ONE'}</td>
  </tr></table>
  <div style="margin-top:34px;color:#ffffff;font-size:28px;font-weight:bold;line-height:1.2;">${escapeHtml(eventName)}</div>
  <div style="margin-top:8px;color:#e2e8f0;font-size:14px;">${escapeHtml(date)}${time && time !== '—' ? ` · ${escapeHtml(time)}` : ''}</div>
</td></tr>

<tr><td style="padding:38px 40px 6px;">
  <div style="color:#4f46e5;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">You're registered</div>
  <h1 style="margin:10px 0 0;color:#0f172a;font-size:30px;line-height:1.2;">Your ticket is ready, ${escapeHtml(firstName)}.</h1>
  <p style="margin:14px 0 0;color:#475569;font-size:15px;line-height:1.65;">
    We can't wait to see you at <strong style="color:#0f172a;">${escapeHtml(eventName)}</strong>. Your personal QR ticket is below — save the image to your phone, or open your ticket online with the link in this email.
  </p>
</td></tr>

<tr><td style="padding:20px 40px 26px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
    <tr><td style="padding:18px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="50%" valign="top" style="padding-right:18px;">
          ${detailBlock(ICON_CALENDAR, 'Date', date)}
          ${detailBlock(ICON_CLOCK, 'Time', time)}
        </td>
        <td width="50%" valign="top" style="padding-left:18px;border-left:1px solid #e2e8f0;">
          ${detailBlock(ICON_PIN, 'Venue', venue, address)}
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<tr><td align="center" style="padding:0 40px 16px;">
  <div style="display:inline-block;padding:14px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;box-shadow:0 10px 24px -12px rgba(15,23,42,0.35);">
    <img src="${qrSrc}" alt="Your ticket QR code" width="180" height="180" style="display:block;width:180px;height:180px;" />
  </div>
  <p style="margin:10px 0 0;color:#94a3b8;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">Present at entry</p>
  <p style="margin:8px 0 0;color:#64748b;font-size:13px;line-height:1.6;">Present the QR code at the entrance. Screenshot it or save the image for offline use.</p>
</td></tr>

<tr><td align="center" style="padding:10px 40px 34px;">
  <a href="${safeTicketUrl}" style="display:inline-block;padding:14px 30px;border-radius:10px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(ctaLabel)}</a>
  <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
    <a href="${safeDownloadUrl}" style="color:#4f46e5;font-weight:bold;text-decoration:underline;">Download ticket image →</a>
  </p>
</td></tr>

${
  noticeHtml
    ? `<tr><td style="padding:0 40px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c7d2fe;border-radius:12px;background:#eef2ff;">
    <tr><td style="padding:16px 18px;color:#3730a3;font-size:13px;line-height:1.6;">${noticeHtml}</td></tr>
  </table>
</td></tr>`
    : ''
}

<tr><td style="padding:22px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.7;">
  You're receiving this email because you registered for <strong style="color:#334155;">${escapeHtml(eventName)}</strong>.
  Keep this QR private — anyone with it can check in as you.<br />
  ${footerHtml || `<a href="${escapeHtml(appUrl || '#')}" style="color:#4f46e5;text-decoration:none;">Open EventPass</a>`}
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}
