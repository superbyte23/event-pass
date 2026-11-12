import mongoose from 'mongoose';
import { connectDb } from '../db/index.js';
import { MODELS, Event, Registration, serialize } from '../db/models.js';
import { notifyTicketCreated } from './mailer.js';
import { isAdmin, requireAdmin, requireUser } from './session.js';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_ROWS = 5000;

// A filter that can never match (ids are strings, never null).
const NONE = { _id: null };

function modelFor(entity) {
  const model = MODELS[entity];
  if (!model) throw new ApiError(404, `Unknown entity "${entity}".`);
  return model;
}

// ---------------------------------------------------------------------------
// Read scope — mirrors the original backend's per-entity read rules
// Returns a Mongo filter object, or null for "no restriction".
// ---------------------------------------------------------------------------
function readScope(entity, user) {
  switch (entity) {
    case 'Event':
      // published events are public; admins see their own created events + all published
      if (!user) return { published: true };
      if (isAdmin(user)) return { $or: [{ created_by: user.id }, { published: true }] };
      return { published: true };
    case 'Registration':
      // admin: everything, signed-in user: their own rows only,
      // anonymous: nothing (guest tickets are reachable by id only)
      if (isAdmin(user)) return null;
      if (!user) return NONE;
      return { user_id: user.id };
    case 'Setting':
      return null;
    case 'User':
      if (isAdmin(user)) return null;
      if (!user) return NONE;
      return { _id: user.id };
    default:
      throw new ApiError(404, `Unknown entity "${entity}".`);
  }
}

function canReadRow(entity, row, user) {
  if (!user) return false;
  if (isAdmin(user)) {
    switch (entity) {
      case 'Event':
        return row.created_by === user.id || row.published === true;
      default:
        return true;
    }
  }
  switch (entity) {
    case 'Event':
      return row.published === true;
    case 'Registration':
      return row.user_id == null || row.user_id === user.id;
    case 'Setting':
      return true;
    case 'User':
      return row.id === user.id;
    default:
      return false;
  }
}

function assertCanWrite(entity, user) {
  switch (entity) {
    case 'Event':
    case 'Setting':
    case 'User':
      return requireAdmin(user);
    case 'Registration':
      // creating a registration is open to guests (see row rules below),
      // updating/deleting is admin-only — same as the Base44 RLS rules.
      return user;
    default:
      throw new ApiError(404, `Unknown entity "${entity}".`);
  }
}

async function assertRegistrationCreate(data, user, isImport = false) {
  const out = { ...data };
  delete out.checked_in_at;
  delete out.checked_in_by;
  if (out.user_id === '') out.user_id = null;

  if (isImport && !isAdmin(user)) throw new ApiError(403, 'Import mode requires admin.');

  if (!user) {
    if (out.user_id) throw new ApiError(403, 'Sign in to register as yourself.');
    out.user_id = null;
  } else if (!isImport && out.user_id != null && out.user_id !== user.id) {
    throw new ApiError(403, 'You cannot create registrations for another user.');
  }
  if (out.status && out.status !== 'confirmed' && out.status !== 'cancelled') {
    out.status = 'confirmed';
  }
  // Normalize guest email (feeds the partial unique index below).
  if (typeof out.guest_email === 'string') out.guest_email = out.guest_email.trim().toLowerCase() || null;
  else out.guest_email = null;

  if (out.event_id) {
    const event = await Event.findById(out.event_id).lean();
    if (!event) throw new ApiError(404, 'Event not found.');
    // Skip event status/window/capacity checks in import mode
    if (!isImport) {
      if (event.status === 'draft') throw new ApiError(403, 'This event is not open for registration yet.');
      if (event.status === 'completed') throw new ApiError(403, 'This event has already concluded.');
      if (event.status === 'full' || event.status === 'closed') throw new ApiError(403, 'Registration is closed for this event.');
      const now = new Date();
      if (event.registration_start && now < event.registration_start) {
        throw new ApiError(403, 'Registration has not opened yet.');
      }
      if (event.registration_end && now > event.registration_end) {
        throw new ApiError(403, 'Registration is closed for this event.');
      }
      if (event.max_attendees != null && Number.isFinite(Number(event.max_attendees))) {
        const count = await Registration.countDocuments({ event_id: out.event_id, status: { $ne: 'cancelled' } });
        if (count >= Number(event.max_attendees)) throw new ApiError(403, 'This event is full.');
      }
    }
    // Friendly duplicate messages. The partial unique indexes remain the hard
    // backstop below — these just fire before the insert with a clearer reason.
    // Note: guest_email duplicate check is intentionally omitted here to allow
    // bulk imports with ordered:false to handle duplicates gracefully.
    if (!isImport && out.user_id) {
      const existing = await Registration.exists({ event_id: out.event_id, user_id: out.user_id });
      if (existing) throw new ApiError(409, 'You are already registered for this event.');
    }
  }
  // Clean up import flag
  delete out._importMode;
  return out;
}

// ---------------------------------------------------------------------------
// Input shaping: only fields declared on the model, and empty strings on
// non-text fields become NULL (the event form posts "" for unset dates).
// ---------------------------------------------------------------------------
function sanitize(model, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError(400, 'Expected an object.');
  }
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'id' || key === '_id' || key === 'created_date' || key === '__v') continue;
    const path = model.schema.path(key);
    if (!path) continue;
    out[key] = value === '' && path.instance !== 'String' ? null : value;
  }
  return out;
}

function buildFilter(model, filter) {
  if (filter == null) return null;
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    throw new ApiError(400, 'filter must be an object.');
  }
  const out = {};
  for (const [key, value] of Object.entries(filter)) {
    if (key === 'id') {
      out._id = value;
      continue;
    }
    if (!model.schema.path(key)) throw new ApiError(400, `Unknown filter field "${key}".`);
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

function buildSort(model, sort) {
  if (!sort) return { created_date: -1 };
  const direction = String(sort).startsWith('-') ? -1 : 1;
  const key = String(sort).replace(/^[-+]/, '');
  const field = key === 'id' ? '_id' : key;
  if (field !== '_id' && !model.schema.path(field)) {
    throw new ApiError(400, `Cannot sort by "${key}".`);
  }
  return { [field]: direction };
}

function normalizeLimit(limit) {
  if (limit == null || limit === '') return MAX_ROWS;
  const value = Number(limit);
  if (!Number.isFinite(value) || value < 1) {
    throw new ApiError(400, 'limit must be a positive number.');
  }
  return Math.min(Math.trunc(value), MAX_ROWS);
}

function mapDbError(error, entity) {
  if (error?.code === 11000) {
    if (entity === 'Registration') {
      const kp = error?.keyPattern || error?.errorResponse?.keyPattern || {};
      if (kp.guest_email) return new ApiError(409, 'This email is already registered for this event.');
      if (kp.user_id) return new ApiError(409, 'You are already registered for this event.');
    }
    return new ApiError(400, 'A record with the same unique value already exists.');
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return new ApiError(400, error.message || 'One of the provided values is invalid.');
  }
  if (error instanceof mongoose.Error.CastError) {
    return new ApiError(400, 'One of the provided values is invalid.');
  }
  return null;
}

function rethrow(error, entity) {
  const mapped = mapDbError(error, entity);
  if (mapped) throw mapped;
  throw error;
}

// Bulk inserts report failures per row so the client can show a live import log.
function bulkWriteFailureMessage(error, entity) {
  const code = error?.code ?? error?.err?.code;
  const text = error?.errmsg || error?.err?.errmsg || error?.message || '';
  if (code === 11000) {
    if (entity === 'Registration') {
      if (text.includes('guest_email') || /email/i.test(text)) {
        return 'This email is already registered for this event.';
      }
      return 'This attendee is already registered for this event.';
    }
    return 'A record with the same unique value already exists.';
  }
  return text || 'Could not import this row.';
}

// ---------------------------------------------------------------------------
// Public API used by the route handlers
// ---------------------------------------------------------------------------
export async function listEntities(entity, { user, filter, sort, limit } = {}) {
  const model = modelFor(entity);
  await connectDb();
  try {
    const conditions = [readScope(entity, user), buildFilter(model, filter)].filter(
      (condition) => condition != null,
    );
    const query = conditions.length ? { $and: conditions } : {};
    const rows = await model
      .find(query)
      .sort(buildSort(model, sort))
      .limit(normalizeLimit(limit))
      .lean();
    return rows.map(serialize);
  } catch (error) {
    rethrow(error);
  }
}

export async function getEntity(entity, id, user) {
  const model = modelFor(entity);
  await connectDb();
  let row;
  try {
    row = await model.findById(id).lean();
  } catch (error) {
    rethrow(error);
  }
  const serialized = serialize(row);
  if (!row || !canReadRow(entity, serialized, user)) {
    throw new ApiError(404, `${entity} not found.`);
  }
  return serialized;
}

// Guest ticket lookup by email. Guests have no account, so their only claim
// to a ticket is the email used at registration. This intentionally returns
// only profile-less rows (user_id null) — signed-in users' tickets stay
// private behind their own accounts.
export async function listGuestTickets(email, eventId) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw new ApiError(400, 'Email is required.');
  if (eventId && typeof eventId !== 'string') throw new ApiError(400, 'event_id must be a string.');
  await connectDb();
  const conditions = {
    user_id: null,
    status: { $ne: 'cancelled' },
    guest_email: { $regex: new RegExp(`^${escapeRegExp(normalized)}$`, 'i') },
  };
  if (eventId) conditions.event_id = eventId;
  const rows = await Registration.find(conditions)
    .sort({ created_date: -1 })
    .limit(MAX_ROWS)
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    event_id: r.event_id,
    event_name: r.event_name,
    registration_number: r.registration_number,
    status: r.status,
    created_date: r.created_date,
  }));
}

// Tickets that belong to the signed-in caller: registrations created under
// their account, plus guest registrations made with the same email. The email
// comes from the session (never the client), so this cannot be used to read
// someone else's guest ticket.
export async function listMyRegistrations(user, eventId) {
  requireUser(user);
  if (eventId != null && typeof eventId !== 'string') {
    throw new ApiError(400, 'event_id must be a string.');
  }
  await connectDb();
  const email = String(user.email || '').trim().toLowerCase();
  const conditions = [{ user_id: user.id }];
  if (email) {
    conditions.push({
      user_id: null,
      guest_email: { $regex: new RegExp(`^${escapeRegExp(email)}$`, 'i') },
    });
  }
  const query = { $or: conditions };
  if (eventId) query.event_id = eventId;
  const rows = await Registration.find(query).sort({ created_date: -1 }).limit(MAX_ROWS).lean();
  return rows.map(serialize);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Admin-only check-in by the secure QR token embedded in a guest's ticket.
// Idempotent: an already-checked-in registration is returned as-is with
// `already: true` instead of erroring, so the scanner keeps working at the door.
export async function checkInRegistration(token, user) {
  requireAdmin(user);
  const value = String(token || '').trim();
  if (!value) throw new ApiError(400, 'Please provide a ticket code.');
  await connectDb();
  let reg = await Registration.findOne({ qr_token: value }).lean();
  if (!reg) {
    // Fallback: the human-readable registration number (REG-YYYY-XXXXXX),
    // so staff can type it in when a camera isn't available.
    const upper = value.toUpperCase();
    reg = await Registration.findOne({
      registration_number: { $in: [value, upper] },
    }).lean();
  }
  if (!reg) throw new ApiError(404, 'No registration matches this code.');
  const serialized = serialize(reg);
  if (serialized.status === 'cancelled') {
    throw new ApiError(409, 'This registration was cancelled.');
  }
  if (serialized.status === 'checked_in') {
    return { registration: serialized, already: true };
  }
  const doc = await Registration.findByIdAndUpdate(
    reg._id,
    { status: 'checked_in', checked_in_at: new Date().toISOString(), checked_in_by: user.id },
    { new: true },
  ).lean();
  return { registration: serialize(doc), already: false };
}

export async function createEntity(entity, data, user) {
  const model = modelFor(entity);
  assertCanWrite(entity, user);
  let payload = sanitize(model, data);
  await connectDb();
  if (entity === 'Registration') payload = await assertRegistrationCreate(payload, user);
  if (entity === 'Event' && user) payload.created_by = user.id;
  try {
    const doc = await model.create(payload);
    const created = serialize(doc);
    if (entity === 'Registration') {
      // Ticket email: fire-and-forget, never blocks or fails registration.
      // (CSV bulk imports use bulkCreate below, which intentionally skips it.)
      notifyTicketCreated(created).catch(() => {});
    }
    return created;
  } catch (error) {
    rethrow(error, entity);
  }
}

export async function bulkCreate(entity, items, user) {
  if (!Array.isArray(items)) throw new ApiError(400, 'Expected an array of items.');
  if (items.length === 0) return [];
  const model = modelFor(entity);
  assertCanWrite(entity, user);
  // Extract _importMode before sanitize (it strips unknown fields)
  const importModes = items.map((item) => item._importMode === true);
  const payloads = items.map((item) => sanitize(model, item));
  const shaped = [];
  for (let i = 0; i < payloads.length; i++) {
    let payload = payloads[i];
    if (entity === 'Registration') {
      payload = await assertRegistrationCreate(payload, user, importModes[i]);
    }
    shaped.push(payload);
  }
  await connectDb();
  try {
    // ordered: false continues past duplicate-key errors. The response is
    // aligned with `items` so the client can report each row's outcome.
    const docs = await model.insertMany(shaped, { ordered: false });
    return docs.map((doc, index) => ({
      index,
      ok: true,
      id: String(doc._id),
      data: serialize(doc),
    }));
  } catch (error) {
    // Mongoose builds `results` aligned with the input order for
    // ordered:false inserts: successful rows are documents, failed rows are
    // write errors. Prefer it when available.
    if (Array.isArray(error?.results) && error.results.length === shaped.length) {
      return error.results.map((entry, index) => {
        const isError = !entry || entry instanceof Error || entry.errmsg || entry.err?.errmsg;
        if (isError) {
          return { index, ok: false, error: bulkWriteFailureMessage(entry, entity) };
        }
        return { index, ok: true, id: String(entry._id), data: serialize(entry) };
      });
    }

    const result = error?.result;
    const insertedIds = error?.insertedIds || error?.err?.insertedIds || result?.insertedIds || {};
    const writeErrors = error?.writeErrors || error?.err?.writeErrors || result?.writeErrors || [];
    const hasPartialResult =
      Object.keys(insertedIds).length > 0 ||
      writeErrors.length > 0 ||
      (result?.insertedCount != null && result.insertedCount > 0);
    if (!hasPartialResult) rethrow(error, entity);

    const results = shaped.map((_, index) => ({
      index,
      ok: false,
      error: 'Could not import this row.',
    }));

    Object.entries(insertedIds).forEach(([index, id]) => {
      const position = Number(index);
      if (results[position]) results[position] = { index: position, ok: true, id: String(id) };
    });

    writeErrors.forEach((writeError) => {
      const position = writeError?.index;
      if (results[position]) {
        results[position] = {
          index: position,
          ok: false,
          error: bulkWriteFailureMessage(writeError, entity),
        };
      }
    });

    return results;
  }
}

export async function updateEntity(entity, id, data, user) {
  const model = modelFor(entity);
  requireAdmin(user);
  const payload = sanitize(model, data);
  if (Object.keys(payload).length === 0) throw new ApiError(400, 'Nothing to update.');
  await connectDb();
  try {
    const doc = await model.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw new ApiError(404, `${entity} not found.`);
    return serialize(doc);
  } catch (error) {
    rethrow(error);
  }
}

export async function deleteEntity(entity, id, user) {
  const model = modelFor(entity);
  requireAdmin(user);
  await connectDb();
  try {
    const doc = await model.findByIdAndDelete(id);
    if (!doc) throw new ApiError(404, `${entity} not found.`);
    return { id };
  } catch (error) {
    rethrow(error);
  }
}

export async function deleteManyEntities(entity, filter, user) {
  const model = modelFor(entity);
  requireAdmin(user);
  const condition = buildFilter(model, filter);
  if (!condition) throw new ApiError(400, 'deleteMany requires a filter.');
  await connectDb();
  try {
    const result = await model.deleteMany(condition);
    return { deleted: result.deletedCount };
  } catch (error) {
    rethrow(error);
  }
}
