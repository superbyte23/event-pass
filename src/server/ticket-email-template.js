// Email-safe rendering of src/components/TicketCard.jsx.
//
// TicketCard is React + Tailwind, which email clients do not execute. This
// mirrors its layout with tables and inline CSS so the ticket in the inbox
// matches the card guests see on the site. The QR is embedded with the
// `cid:ticketqr` attachment used by every ticket mail.

import { formatDate, timeRangeLabel } from '../lib/event-utils.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function absoluteUrl(value, appUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|cid:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  const base = String(appUrl || '').replace(/\/$/, '');
  if (!base) return raw;
  return `${base}/${raw.replace(/^\//, '')}`;
}

export function cssUrl(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '');
}

const STATUS_STYLES = {
  confirmed: { label: 'Confirmed', bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
  cancelled: { label: 'Cancelled', bg: '#fff1f2', border: '#fecdd3', color: '#be123c' },
  checked_in: { label: 'Checked In', bg: '#eef2ff', border: '#c7d2fe', color: '#4338ca' },
};

const ICON_CALENDAR =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CLOCK =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const ICON_PIN =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
const ICON_TICKET =
  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/></svg>';

function detail(icon, label, value, sub) {
  return `
<td width="33%" valign="top" style="padding-right:12px;">
  <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;white-space:nowrap;">${icon} ${label}</div>
  <div style="margin-top:4px;color:#0f172a;font-size:14px;font-weight:600;line-height:1.35;">${escapeHtml(value || '—')}</div>
  ${sub ? `<div style="margin-top:2px;color:#64748b;font-size:12px;line-height:1.35;">${escapeHtml(sub)}</div>` : ''}
</td>`;
}

export function buildTicketCardHtml({
  event = {},
  registration = {},
  guest = {},
  appUrl = '',
  sample = false,
  noticeHtml = '',
  footerHtml = '',
} = {}) {
  const accent = event.accent_color || '#0f172a';
  const eventName = event.name || registration.event_name || 'Your event';
  const cover = absoluteUrl(event.cover_image, appUrl);
  const logo = absoluteUrl(event.logo, appUrl);
  const avatar = absoluteUrl(guest?.image, appUrl);
  const date = formatDate(event.date) || '—';
  const time = event.time_label || timeRangeLabel(event.start_time, event.end_time) || '—';
  const venue = event.venue || '—';
  const address = event.venue_address || '';
  const guestName = guest?.full_name || registration.guest_name || 'Guest';
  const guestEmail = guest?.email || registration.guest_email || '';
  const number = registration.registration_number || '';
  const status = STATUS_STYLES[registration.status] || {
    label: registration.status || 'Unknown',
    bg: '#f1f5f9',
    border: '#e2e8f0',
    color: '#475569',
  };
  const initial = String(guestName || guestEmail || '?').trim().charAt(0).toUpperCase() || '?';

  const coverStyle = [
    `background-color:${accent}`,
    cover
      ? `background-image:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.45) 55%,rgba(0,0,0,0.25) 100%),url('${cssUrl(cover)}')`
      : '',
    'background-size:cover',
    'background-position:center',
  ]
    .filter(Boolean)
    .join(';');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;background:#ffffff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);font-family:Arial,Helvetica,sans-serif;color:#0f172a;">

<tr><td>
  <div style="${coverStyle};min-height:168px;box-sizing:border-box;padding:24px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48" valign="middle" style="width:48px;padding-right:12px;">
        ${
          logo
            ? `<img src="${escapeHtml(logo)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:contain;border-radius:12px;background:#ffffff;padding:4px;box-sizing:border-box;" />`
            : `<div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.15);text-align:center;line-height:48px;">${ICON_TICKET}</div>`
        }
      </td>
      <td valign="middle" style="min-width:0;">
        <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${sample ? 'Sample Ticket' : 'Event Pass'}</div>
        <div style="margin-top:6px;color:#ffffff;font-size:20px;font-weight:bold;line-height:1.25;">${escapeHtml(eventName)}</div>
      </td>
    </tr></table>
  </div>
</td></tr>

<tr><td style="padding:20px 32px 6px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${detail(ICON_CALENDAR, 'Date', date)}
    ${detail(ICON_CLOCK, 'Time', time)}
    ${detail(ICON_PIN, 'Venue', venue, address)}
  </tr></table>
</td></tr>

<tr><td style="padding:14px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="24" style="width:24px;font-size:0;line-height:0;">&nbsp;</td>
    <td width="12" style="width:12px;height:24px;border-radius:50%;background:#f1f5f9;font-size:0;line-height:0;">&nbsp;</td>
    <td style="border-top:2px dashed #e2e8f0;font-size:0;line-height:0;">&nbsp;</td>
    <td width="12" style="width:12px;height:24px;border-radius:50%;background:#f1f5f9;font-size:0;line-height:0;">&nbsp;</td>
    <td width="24" style="width:24px;font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</td></tr>

<tr><td style="padding:8px 32px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="60%" valign="middle" style="padding-right:16px;">
      <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">Guest</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
        <td width="48" valign="middle" style="width:48px;padding-right:12px;">
          ${
            avatar
              ? `<img src="${escapeHtml(avatar)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;object-fit:cover;border-radius:50%;" />`
              : `<div style="width:48px;height:48px;border-radius:50%;background:${accent};color:#ffffff;text-align:center;line-height:48px;font-size:20px;font-weight:600;">${escapeHtml(initial)}</div>`
          }
        </td>
        <td valign="middle" style="min-width:0;">
          <div style="color:#0f172a;font-size:16px;font-weight:600;line-height:1.3;">${escapeHtml(guestName)}</div>
          ${guestEmail ? `<div style="margin-top:2px;color:#64748b;font-size:13px;line-height:1.3;">${escapeHtml(guestEmail)}</div>` : ''}
        </td>
      </tr></table>
      <div style="margin-top:20px;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">Registration No.</div>
      <div style="margin-top:4px;color:#0f172a;font-family:Consolas,Monaco,monospace;font-size:18px;font-weight:600;letter-spacing:1px;">${escapeHtml(number)}</div>
      <div style="margin-top:12px;">
        <span style="display:inline-block;padding:2px 10px;border:1px solid ${status.border};border-radius:999px;background:${status.bg};color:${status.color};font-size:12px;font-weight:600;">${escapeHtml(status.label)}</span>
      </div>
    </td>
    <td width="40%" valign="middle" align="center" style="padding-left:16px;">
      <div style="display:inline-block;padding:12px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <img src="cid:ticketqr" alt="Ticket QR code" width="180" height="180" style="display:block;width:180px;height:180px;border-radius:8px;" />
      </div>
      <div style="margin-top:12px;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;">Present at entry</div>
    </td>
  </tr></table>
</td></tr>

${
  noticeHtml
    ? `<tr><td style="padding:0 32px 22px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c7d2fe;border-radius:10px;background:#eef2ff;">
    <tr><td style="padding:13px 16px;color:#3730a3;font-size:13px;line-height:1.55;">${noticeHtml}</td></tr>
  </table>
</td></tr>`
    : ''
}

${
  footerHtml
    ? `<tr><td style="padding:18px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">${footerHtml}</td></tr>`
    : ''
}

</table>
</td></tr>
</table>
</body></html>`;
}
