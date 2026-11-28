import mongoose from 'mongoose';

const { Schema } = mongoose;

// ids stay strings (matching the Base44/Postgres contract) instead of ObjectId
const id = () => ({ type: String, default: () => crypto.randomUUID() });
const createdDate = { type: Date, default: () => new Date() };
const options = { versionKey: false, minimize: false };

// User entity fields (source of truth for the app contract)
const userSchema = new Schema(
  {
    _id: id(),
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    full_name: { type: String, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    // Set when a per-admin mail account is configured. Kept on the user so the
    // default sender can be resolved from the session without another lookup.
    default_mail_account_id: { type: String, default: null, index: true },
    created_date: createdDate,
  },
  options,
);

// Event entity fields (source of truth for the app contract)
const eventSchema = new Schema(
  {
    _id: id(),
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    cover_image: { type: String, default: null },
    logo: { type: String, default: null },
    date: { type: String, required: true },
    start_time: { type: String, default: null },
    end_time: { type: String, default: null },
    venue: { type: String, required: true },
    venue_address: { type: String, default: null },
    registration_start: { type: Date, default: null },
    registration_end: { type: Date, default: null },
    max_attendees: { type: Number, default: null },
    status: {
      type: String,
      enum: ['draft', 'open', 'closed', 'full', 'completed'],
      default: 'draft',
    },
    published: { type: Boolean, default: false },
    accent_color: { type: String, default: '#0f172a' },
    form_fields: { type: [Schema.Types.Mixed], default: [] },
    created_by: { type: String, default: null, index: true },
    // Other admins explicitly linked to this event. They can see and manage
    // it even when unpublished; only the owner can change this list.
    linked_admin_ids: { type: [String], default: [], index: true },
    created_date: createdDate,
  },
  options,
);

// Registration entity fields (source of truth for the app contract)
const registrationSchema = new Schema(
  {
    _id: id(),
    event_id: { type: String, required: true, index: true },
    event_name: { type: String, default: null },
    user_id: { type: String, default: null, index: true },
    guest_name: { type: String, default: null },
    guest_email: { type: String, default: null },
    registration_number: { type: String, required: true },
    qr_token: { type: String, required: true },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled', 'checked_in'],
      default: 'confirmed',
    },
    checked_in_at: { type: Date, default: null },
    checked_in_by: { type: String, default: null },
    check_in_method: { type: String, default: null },
    responses: { type: Schema.Types.Mixed, default: () => ({}) },
    // Ticket delivery state. Persisted so the registrations list can show
    // whether each guest has already been emailed.
    email_status: {
      type: String,
      enum: ['not_sent', 'sending', 'sent', 'failed', 'skipped'],
      default: 'not_sent',
      index: true,
    },
    email_sent_at: { type: Date, default: null },
    email_error: { type: String, default: null },
    email_account_id: { type: String, default: null },
    email_attempts: { type: Number, default: 0 },
    created_date: createdDate,
  },
  options,
);

// Setting entity fields (single row; source of truth for the app contract)
const settingSchema = new Schema(
  {
    _id: id(),
    google_auth_enabled: { type: Boolean, default: true },
    created_date: createdDate,
  },
  options,
);

// Per-admin mail sender. The App Password is stored encrypted; only safe
// metadata is ever serialized back to the browser.
const mailAccountSchema = new Schema(
  {
    _id: id(),
    owner_admin_id: { type: String, required: true, index: true },
    label: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['gmail'], default: 'gmail' },
    email: { type: String, required: true, lowercase: true, trim: true },
    from: { type: String, required: true, trim: true },
    host: { type: String, default: 'smtp.gmail.com' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    encrypted_password: { type: String, required: true },
    daily_limit: { type: Number, default: 500, min: 1, max: 10000 },
    active: { type: Boolean, default: true },
    shared_with_admins: { type: Boolean, default: false },
    created_date: createdDate,
    updated_date: { type: Date, default: () => new Date() },
  },
  options,
);

mailAccountSchema.index({ owner_admin_id: 1, email: 1 }, { unique: true });

// Successful sends count toward a Gmail account's rolling 24-hour quota.
// Failures are kept for troubleshooting but do not consume quota.
const mailLogSchema = new Schema(
  {
    _id: id(),
    account_id: { type: String, required: true, index: true },
    owner_admin_id: { type: String, default: null, index: true },
    admin_id: { type: String, default: null },
    registration_id: { type: String, default: null, index: true },
    event_id: { type: String, default: null },
    kind: { type: String, enum: ['ticket', 'test'], default: 'ticket' },
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error: { type: String, default: null },
    message_id: { type: String, default: null },
    sent_at: { type: Date, default: () => new Date() },
  },
  options,
);

// Live progress for a bulk ticket send. The client advances the batch in
// chunks so each request stays short and per-email status remains observable.
const mailBatchSchema = new Schema(
  {
    _id: id(),
    event_id: { type: String, required: true, index: true },
    admin_id: { type: String, required: true, index: true },
    account_id: { type: String, required: true },
    account_label: { type: String, default: null },
    account_email: { type: String, default: null },
    status: {
      type: String,
      enum: ['running', 'completed', 'cancelled', 'failed'],
      default: 'running',
    },
    processing: { type: Boolean, default: false },
    cancel_requested: { type: Boolean, default: false },
    items: { type: [Schema.Types.Mixed], default: [] },
    counts: {
      total: { type: Number, default: 0 },
      processed: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    error: { type: String, default: null },
    created_date: createdDate,
    updated_date: { type: Date, default: () => new Date() },
    completed_date: { type: Date, default: null },
  },
  options,
);

mailBatchSchema.index({ event_id: 1, admin_id: 1, status: 1 });

// Append-only check-in history. Written only by the admin check-in paths;
// restoring a registration never removes these rows.
const checkInLogSchema = new Schema(
  {
    _id: id(),
    event_id: { type: String, required: true, index: true },
    registration_id: { type: String, required: true, index: true },
    registration_number: { type: String, default: null },
    guest_name: { type: String, default: null },
    guest_email: { type: String, default: null },
    method: { type: String, required: true },
    already: { type: Boolean, default: false },
    admin_id: { type: String, default: null },
    created_date: { ...createdDate },
  },
  options,
);

// Reuse compiled models across Next.js dev hot-reloads.
function register(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

// Hard one-ticket-per-event guarantees at the DB level:
//  - one registration per signed-in user per event (user_id is a string)
//  - one guest ticket per email per event. `guest_email` is normalized
//    (trimmed/lowercased) before insert so these indexes stay meaningful.
// `null` user_id/guest_email are excluded from partial filters, so many
// anonymous rows never collide with each other.
registrationSchema.index(
  { event_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { user_id: { $type: 'string' } } },
);
registrationSchema.index(
  { event_id: 1, guest_email: 1 },
  { unique: true, partialFilterExpression: { guest_email: { $exists: true, $type: 'string' } } },
);

export const User = register('User', userSchema);
export const Event = register('Event', eventSchema);
export const Registration = register('Registration', registrationSchema);
export const Setting = register('Setting', settingSchema);
export const MailAccount = register('MailAccount', mailAccountSchema);
export const MailLog = register('MailLog', mailLogSchema);
export const MailBatch = register('MailBatch', mailBatchSchema);
export const CheckInLog = register('CheckInLog', checkInLogSchema);

// MailAccount/MailLog/MailBatch/CheckInLog are intentionally not in MODELS — they
// have dedicated admin-only APIs and must not be reachable through generic routes.
export const MODELS = { Event, Registration, Setting, User };

// Mongo documents expose `_id`; the app (Base44 contract) reads `id`, so flatten
// it here and drop Mongo bookkeeping fields.
export function serialize(doc) {
  if (doc == null) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;
  const { _id, __v, ...rest } = obj;
  return { id: _id != null ? String(_id) : undefined, ...rest };
}
