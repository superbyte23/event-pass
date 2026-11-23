// Short, signed links for ticket emails.
//
// Format: /t/<base62 registration id>.<8-char HMAC>
// The signature keeps ticket ids from being enumerated by trying short codes.

import { createHmac, timingSafeEqual } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);

function secret() {
  return (
    process.env.SHORT_LINK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.MAIL_CREDENTIALS_KEY ||
    'eventpass-local-short-link-secret'
  );
}

function sign(code) {
  return createHmac('sha256', secret()).update(code).digest('base64url').slice(0, 8);
}

function toBase62(value) {
  if (value === 0n) return ALPHABET[0];
  let current = value;
  let out = '';
  while (current > 0n) {
    out = ALPHABET[Number(current % BASE)] + out;
    current /= BASE;
  }
  return out;
}

function fromBase62(text) {
  let value = 0n;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) return null;
    value = value * BASE + BigInt(index);
  }
  return value;
}

function idToCode(id) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(raw)) {
    return `u${toBase62(BigInt(`0x${raw.replace(/-/g, '')}`))}`;
  }
  if (/^[0-9a-fA-F]{24}$/.test(raw)) return `o${toBase62(BigInt(`0x${raw}`))}`;
  return `b${toBase62(BigInt(`0x${Buffer.from(raw, 'utf8').toString('hex')}`))}`;
}

export function ticketShortPath(registrationId) {
  const code = idToCode(registrationId);
  if (!code) return null;
  return `/t/${code}.${sign(code)}`;
}

export function ticketShortUrl(registrationId, appUrl = '') {
  const path = ticketShortPath(registrationId);
  if (!path) return null;
  const base = String(appUrl || '').replace(/\/$/, '');
  return `${base}${path}`;
}

export function decodeTicketShortCode(value) {
  const raw = String(value || '').trim();
  const [code, signature, extra] = raw.split('.');
  if (!code || !signature || extra) return null;
  const expected = Buffer.from(sign(code));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const kind = code.charAt(0);
  const numeric = fromBase62(code.slice(1));
  if (numeric === null) return null;
  const hex = numeric.toString(16);

  if (kind === 'u') {
    const padded = hex.padStart(32, '0');
    if (padded.length !== 32) return null;
    return [
      padded.slice(0, 8),
      padded.slice(8, 12),
      padded.slice(12, 16),
      padded.slice(16, 20),
      padded.slice(20),
    ].join('-');
  }
  if (kind === 'o') {
    const padded = hex.padStart(24, '0');
    return padded.length === 24 ? padded : null;
  }
  if (kind === 'b') {
    const padded = hex.padStart(Math.ceil(hex.length / 2) * 2, '0');
    return Buffer.from(padded, 'hex').toString('utf8');
  }
  return null;
}
