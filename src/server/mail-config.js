// Central mail configuration.
//
// Phase 1 keeps the existing flat SMTP_* variables as the fallback sender.
// Later phases add per-admin Gmail accounts stored in the database; this file
// is the single place where env defaults and those accounts will be resolved.

const DEFAULT_PROVIDER = 'gmail';
const DEFAULT_SEND_INTERVAL_MS = 400;
const DEFAULT_BATCH_POLL_MS = 2000;
const DEFAULT_BATCH_CHUNK_SIZE = 20;

function envText(name, fallback = '') {
  const value = String(process.env[name] ?? '').trim();
  return value || fallback;
}

export function getAppUrl() {
  return (envText('APP_URL') || envText('NEXTAUTH_URL') || 'http://localhost:3000').replace(
    /\/$/,
    '',
  );
}

function envInt(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = envText(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Runtime knobs for bulk ticket delivery. All values have safe defaults, so
 * the app boots without any of these variables set.
 */
export function getMailRuntimeConfig() {
  return {
    defaultProvider: envText('MAIL_DEFAULT_PROVIDER', DEFAULT_PROVIDER).toLowerCase(),
    sendIntervalMs: envInt('MAIL_SEND_INTERVAL_MS', DEFAULT_SEND_INTERVAL_MS, {
      min: 0,
      max: 10000,
    }),
    batchPollMs: envInt('MAIL_BATCH_POLL_MS', DEFAULT_BATCH_POLL_MS, {
      min: 250,
      max: 60000,
    }),
    batchChunkSize: envInt('MAIL_BATCH_CHUNK_SIZE', DEFAULT_BATCH_CHUNK_SIZE, {
      min: 1,
      max: 100,
    }),
    credentialsKeyConfigured: Boolean(envText('MAIL_CREDENTIALS_KEY')),
  };
}

/**
 * AES key used later to encrypt per-admin Gmail App Passwords. Nothing calls
 * this during boot; a missing/invalid key only fails when account storage is
 * actually used.
 */
export function getMailCredentialsKey() {
  const rawKey = envText('MAIL_CREDENTIALS_KEY');
  if (!rawKey) throw new Error('MAIL_CREDENTIALS_KEY is not configured.');

  let key;
  try {
    key = Buffer.from(rawKey, 'base64');
  } catch {
    throw new Error('MAIL_CREDENTIALS_KEY must be valid base64.');
  }
  if (key.length !== 32) {
    throw new Error('MAIL_CREDENTIALS_KEY must decode to 32 bytes.');
  }
  return key;
}

/**
 * Existing provider-agnostic SMTP settings, kept as the bootstrap fallback
 * until per-admin accounts exist. Moved here from mailer.js without behavior
 * changes.
 */
export function getLegacyMailConfig() {
  const host = envText('SMTP_HOST');
  if (!host) return null;
  const from = envText('MAIL_FROM');
  if (!from) return null;

  const port = Number(envText('SMTP_PORT', '587'));
  const secureRaw = envText('SMTP_SECURE');
  const secure = secureRaw
    ? secureRaw.toLowerCase() === 'true'
    : port === 465;

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure,
    user: envText('SMTP_USER') || null,
    pass: envText('SMTP_PASS') || null,
    from,
    appUrl: getAppUrl(),
  };
}
