// Downloadable 4 × 6 portrait ticket image (WebP or JPEG).
//
// This mirrors the current `TicketCard.jsx` UI: a 4:3 cover header, a two-column
// event details panel, a perforated divider, then guest/registration details
// beside the QR code. Images are composited with sharp because librsvg does not
// render data-URI images inside SVG. Local `/uploads/...` files are read from
// disk so generation never depends on a running HTTP server or public APP_URL.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import { formatDate, timeRangeLabel } from '../lib/event-utils.js';
import { qrPngBuffer } from '../lib/qr-png.js';
import { absoluteUrl } from './ticket-email-template.js';
import { svgText } from './ticket-text.js';

const CACHE_LIMIT = 30;
const cache = new Map();
const imageCache = new Map();

const WIDTH = 1200;
const HEIGHT = 1800;
const HEADER = 900; // 4:3 header at 1200 wide — matches TicketCard's aspect-[4/3]
const DIVIDER = 1120;
const PAD = 60;

const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`;

const ICON_PATHS = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

const AVATAR_MASK = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90"><circle cx="45" cy="45" r="45" fill="white"/></svg>',
);

function wrapText(value, maxChars, maxLines = 2) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(0, maxChars - 1))}…`;
  return kept;
}

function textBlock(lines, x, y, size, lineHeight, weight = '400', fill = '#0f172a', options = {}) {
  return svgText({ lines, x, y, size, lineHeight, weight, fill, ...options });
}

function icon(kind, x, y) {
  return `<g transform="translate(${x},${y - 20}) scale(0.9)" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[kind]}</g>`;
}

function detailLabel(kind, label, y, x = PAD) {
  return `${icon(kind, x, y)}${textBlock([label], x + 30, y, 21, 24, 'bold', '#94a3b8', { letterSpacing: 1.4 })}`;
}

// Local uploads are stored under public/uploads in development. Reading them
// directly keeps ticket images working without a running HTTP server.
async function readLocalImage(value) {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(raw.split(/[?#]/)[0]);
  } catch {
    decoded = raw.split(/[?#]/)[0];
  }
  const root = path.resolve(process.cwd(), 'public');
  const file = path.resolve(root, decoded.replace(/^\/+/, ''));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  try {
    const buffer = await readFile(file);
    return buffer.length && buffer.length <= 12 * 1024 * 1024 ? buffer : null;
  } catch {
    return null;
  }
}

async function loadImage(value, appUrl) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^data:image\//i.test(raw)) {
    try {
      const buffer = Buffer.from(raw.slice(raw.indexOf(',') + 1), 'base64');
      return buffer.length ? buffer : null;
    } catch {
      return null;
    }
  }
  if (imageCache.has(raw)) return imageCache.get(raw);

  const local = await readLocalImage(raw);
  if (local) {
    imageCache.set(raw, local);
    return local;
  }

  const url = absoluteUrl(raw, appUrl);
  if (!url || !/^https?:/i.test(url)) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 12 * 1024 * 1024) return null;
    imageCache.set(raw, buffer);
    if (imageCache.size > CACHE_LIMIT) imageCache.delete(imageCache.keys().next().value);
    return buffer;
  } catch {
    // Do not cache failures: the image may become reachable on a later retry.
    return null;
  }
}

export async function buildTicketImage({
  event = {},
  registration = {},
  guest = {},
  appUrl = '',
  format = 'webp',
  width = 1200,
  height = 1800,
} = {}) {
  const outputFormat = format === 'jpeg' || format === 'jpg' ? 'jpeg' : 'webp';
  const cacheKey = [
    registration.registration_number || registration.id || '',
    registration.updated_date || '',
    event.name || '',
    event.cover_image || '',
    event.logo || '',
    event.accent_color || '',
    JSON.stringify(event.form_fields || []),
    JSON.stringify(registration.responses || {}),
    outputFormat,
    width,
  ].join('|');
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const accent = event.accent_color || '#0f172a';
  const eventName = event.name || registration.event_name || 'Your event';
  const date = formatDate(event.date) || '—';
  const time = event.time_label || timeRangeLabel(event.start_time, event.end_time) || '—';
  const venue = event.venue || '—';
  const address = event.venue_address || '';
  const guestName = guest?.full_name || registration.guest_name || 'Guest';
  const guestEmail = guest?.email || registration.guest_email || '';
  const number = registration.registration_number || '';
  const initial = String(guestName || guestEmail || '?').trim().charAt(0).toUpperCase() || '?';

  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const shownValues = new Set(
    [guest?.full_name, guest?.email, registration.guest_name, registration.guest_email]
      .map(normalize)
      .filter(Boolean),
  );
  const fieldDetails = (event.form_fields || [])
    .map((field) => {
      const raw = registration.responses?.[field.id];
      if (raw === undefined || raw === null || raw === '') return null;
      const value = Array.isArray(raw) ? raw.join(', ') : String(raw);
      if (!value.trim() || shownValues.has(normalize(value))) return null;
      return { id: field.id, label: field.label || 'Field', value };
    })
    .filter(Boolean)
    .slice(0, 3);

  const [cover, logo, avatar] = await Promise.all([
    loadImage(event.cover_image, appUrl),
    loadImage(event.logo, appUrl),
    loadImage(guest?.image, appUrl),
  ]);

  // Layer 1: solid background. The cover is composited over the header, then
  // the text/card overlay is composited on top of both.
  const baseSvg = `${SVG_OPEN}
<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" />
<rect width="${WIDTH}" height="${HEADER}" fill="${accent}" />
</svg>`;

  const overlaySvg = `${SVG_OPEN}
<defs>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000000" stop-opacity="0.25" />
    <stop offset="55%" stop-color="#000000" stop-opacity="0.45" />
    <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
  </linearGradient>
</defs>

<!-- Header text -->
<rect width="${WIDTH}" height="${HEADER}" fill="url(#fade)" />
<rect x="${PAD}" y="758" width="90" height="90" rx="22" fill="#ffffff" fill-opacity="0.15" />
${
  logo
    ? ''
    : `<g transform="translate(82,778) scale(2.1)" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 11v2M13 17v2" /></g>`
}
${svgText({ lines: ['EVENT PASS'], x: 172, y: 795, size: 21, weight: 'bold', fill: '#ffffff', letterSpacing: 4, opacity: 0.7 })}
${textBlock(wrapText(eventName, 30, 2), 172, 838, 38, 44, 'bold', '#ffffff')}

<!-- Event details panel (matches TicketCard's grid) -->
${detailLabel('calendar', 'Date', 958)}
${textBlock([date], PAD, 998, 30, 34, '600', '#0f172a')}
${detailLabel('clock', 'Time', 1052)}
${textBlock([time], PAD, 1092, 30, 34, '600', '#0f172a')}
${detailLabel('pin', 'Venue', 958, 630)}
${textBlock(wrapText(venue, 30, 1), 630, 998, 30, 34, '600', '#0f172a')}
${address ? textBlock(wrapText(address, 34, 1), 630, 1032, 24, 28, '400', '#64748b') : ''}

<!-- Perforated divider -->
<line x1="0" y1="${DIVIDER}" x2="${WIDTH}" y2="${DIVIDER}" stroke="#e2e8f0" stroke-width="4" stroke-dasharray="14 14" />
<circle cx="0" cy="${DIVIDER}" r="24" fill="#f1f5f9" />
<circle cx="${WIDTH}" cy="${DIVIDER}" r="24" fill="#f1f5f9" />

<!-- Guest + registration details -->
${svgText({ lines: ['GUEST'], x: PAD, y: 1188, size: 21, weight: 'bold', fill: '#94a3b8', letterSpacing: 4 })}
<circle cx="105" cy="1260" r="45" fill="${accent}" />
${
  avatar
    ? ''
    : svgText({ lines: [initial], x: 105, y: 1272, size: 36, weight: 'bold', fill: '#ffffff', anchor: 'middle' })
}
${textBlock(wrapText(guestName, 20, 1), 180, 1252, 30, 34, '600', '#0f172a')}
${guestEmail ? textBlock(wrapText(guestEmail, 24, 1), 180, 1288, 25, 28, '400', '#64748b') : ''}

${svgText({ lines: ['REGISTRATION NO.'], x: PAD, y: 1370, size: 21, weight: 'bold', fill: '#94a3b8', letterSpacing: 4 })}
${textBlock([number], PAD, 1415, 34, 38, 'bold', '#0f172a', { letterSpacing: 2 })}

${
  fieldDetails.length
    ? `${svgText({ lines: ['FIELD DETAILS'], x: PAD, y: 1488, size: 21, weight: 'bold', fill: '#94a3b8', letterSpacing: 4 })}
${fieldDetails
  .map((field, index) => {
    const y = 1532 + index * 62;
    return `<circle cx="66" cy="${y - 7}" r="3.5" fill="${accent}" />
${textBlock([field.label], 84, y, 18, 22, 'bold', '#94a3b8')}
${textBlock(wrapText(field.value, 30, 1), 84, y + 24, 22, 26, '600', '#334155')}`;
  })
  .join('\n')}`
    : ''
}

<!-- QR stub -->
<rect x="726" y="1245" width="414" height="381" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
${svgText({ lines: ['PRESENT AT ENTRY'], x: 933, y: 1660, size: 21, weight: 'bold', fill: '#94a3b8', letterSpacing: 4, anchor: 'middle' })}
</svg>`;

  const composites = [];

  if (cover) {
    composites.push({
      input: await sharp(cover).rotate().resize(WIDTH, HEADER, { fit: 'cover' }).png().toBuffer(),
      left: 0,
      top: 0,
    });
  }
  composites.push({ input: Buffer.from(overlaySvg), left: 0, top: 0 });

  if (logo) {
    composites.push({
      input: await sharp(logo)
        .rotate()
        .resize(90, 90, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
      left: PAD,
      top: 758,
    });
  }
  if (avatar) {
    composites.push({
      input: await sharp(avatar)
        .rotate()
        .resize(90, 90, { fit: 'cover' })
        .composite([{ input: AVATAR_MASK, blend: 'destination-in' }])
        .png()
        .toBuffer(),
      left: 60,
      top: 1215,
    });
  }

  const qrValue = `${String(appUrl || '').replace(/\/$/, '')}/checkin/${registration.qr_token || ''}`;
  const qrPng = qrPngBuffer(qrValue, { scale: 10 });
  composites.push({
    input: await sharp(qrPng).resize(337, 337, { fit: 'contain' }).png().toBuffer(),
    left: 748,
    top: 1267,
  });

  let pipeline = sharp(Buffer.from(baseSvg), { density: 96 })
    .composite(composites)
    .resize(width, height, { fit: 'fill' });

  const buffer = await (outputFormat === 'jpeg'
    ? pipeline.jpeg({ quality: 90, mozjpeg: true })
    : pipeline.webp({ quality: 90, effort: 4 })
  ).toBuffer();

  cache.set(cacheKey, buffer);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return buffer;
}
