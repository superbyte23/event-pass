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
    responses: { type: Schema.Types.Mixed, default: () => ({}) },
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

export const MODELS = { Event, Registration, Setting, User };

// Mongo documents expose `_id`; the app (Base44 contract) reads `id`, so flatten
// it here and drop Mongo bookkeeping fields.
export function serialize(doc) {
  if (doc == null) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject({ versionKey: false }) : doc;
  const { _id, __v, ...rest } = obj;
  return { id: _id != null ? String(_id) : undefined, ...rest };
}
