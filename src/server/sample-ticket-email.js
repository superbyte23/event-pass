// Sample ticket used by the mail-account test button. It uses the same premium
// email layout as real ticket emails, with sample data. The QR is an inline
// image (not a downloadable attachment).

import { qrPngBuffer } from '../lib/qr-png.js';
import { buildPremiumTicketEmailHtml } from './premium-email-template.js';
import { escapeHtml } from './ticket-email-template.js';

const SAMPLE = {
  eventName: '12th Educators Congress',
  date: 'January 12, 2027',
  time: '7:00 AM – 8:00 PM',
  venue: 'St. Columban Arts Center, KCC',
  address: 'Kabankalan City, Negros Occidental',
  attendee: 'Sample Attendee',
  ticketType: 'Delegate Pass',
  registrationNumber: 'EC-2026-0001',
  qrToken: 'SAMPLE-EC-2026-0001',
};

export async function buildSampleTicketEmail({ note = '', appUrl = '', fromEmail = '' } = {}) {
  const cleanNote = String(note || '').trim();
  const noteHtml = escapeHtml(cleanNote).replace(/\r?\n/g, '<br />');
  const safeAppUrl = escapeHtml(appUrl || '#');
  const qrPng = qrPngBuffer(`${appUrl}/checkin/${SAMPLE.qrToken}`, { scale: 7 });

  const event = {
    name: SAMPLE.eventName,
    date: SAMPLE.date,
    time_label: SAMPLE.time,
    venue: SAMPLE.venue,
    venue_address: SAMPLE.address,
    accent_color: '#0f172a',
  };
  const registration = {
    id: 'sample-registration',
    registration_number: SAMPLE.registrationNumber,
    guest_name: SAMPLE.attendee,
    status: 'confirmed',
    qr_token: SAMPLE.qrToken,
  };
  const guest = { full_name: SAMPLE.attendee, email: 'sample.attendee@example.com' };

  const subject = `Your ticket for ${SAMPLE.eventName} (Sample)`;
  const noteText = cleanNote ? `Note: ${cleanNote}\n\n` : '';
  const text = [
    'Hello,',
    '',
    'This is a sample of the ticket email your registered guests will receive.',
    'It is not valid for entry.',
    '',
    `Event: ${SAMPLE.eventName}`,
    `Date: ${SAMPLE.date}`,
    `Time: ${SAMPLE.time}`,
    `Venue: ${SAMPLE.venue}, ${SAMPLE.address}`,
    `Attendee: ${SAMPLE.attendee}`,
    `Ticket type: ${SAMPLE.ticketType}`,
    `Registration no.: ${SAMPLE.registrationNumber}`,
    '',
    'A sample QR code is shown in this email.',
    '',
    noteText + `Sent from your EventPass mail account: ${fromEmail || 'your configured Gmail account'}`,
  ].join('\n');

  const html = buildPremiumTicketEmailHtml({
    event,
    registration,
    guest,
    appUrl,
    ticketUrl: appUrl || '#',
    shortUrl: appUrl || '#',
    downloadUrl: appUrl || '#',
    ctaLabel: 'Open EventPass →',
    sample: true,
    qrSrc: 'cid:ticketqr',
    noticeHtml: `${noteHtml ? `${noteHtml}<br />` : ''}Ticket type: <strong>${escapeHtml(SAMPLE.ticketType)}</strong> · This is a test message; the QR is not valid for entry.`,
    footerHtml: `Sent from your EventPass mail account: <strong style="color:#334155;">${escapeHtml(fromEmail || 'your configured Gmail account')}</strong><br />
<a href="${safeAppUrl}" style="color:#4f46e5;text-decoration:none;">Open EventPass</a>`,
  });

  return {
    subject,
    text,
    html,
    attachments: [
      {
        filename: 'sample-ticket-qr.png',
        content: qrPng,
        cid: 'ticketqr',
        contentDisposition: 'inline',
      },
    ],
  };
}
