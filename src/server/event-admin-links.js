// Link other admin accounts to an event.
//
// Linked admins can view and manage an event even when it is unpublished.
// Only the event owner (or an admin of a legacy event with no owner) can add
// or remove links.

import { connectDb } from '../db/index.js';
import { Event, User } from '../db/models.js';
import { invalidateEventCache } from './cache.js';

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function assertAdmin(user) {
  if (user?.role !== 'admin') fail(403, 'You need an admin account to do that.');
}

function linkedIdsOf(event) {
  return [...new Set((Array.isArray(event?.linked_admin_ids) ? event.linked_admin_ids : [])
    .filter(Boolean)
    .map(String))];
}

function canRead(event, user) {
  if (!event.created_by || event.created_by === user.id) return true;
  if (linkedIdsOf(event).includes(user.id)) return true;
  return event.published === true;
}

// Shared with other admin features (bulk mail) so access rules stay aligned.
export async function assertAdminCanAccessEvent(eventId, user) {
  assertAdmin(user);
  const event = await findEvent(eventId);
  if (!canRead(event, user)) fail(404, 'Event not found.');
  return event;
}

function assertCanManage(event, user) {
  // Legacy/seeded events have no owner; any admin may manage their links.
  if (event.created_by && event.created_by !== user.id) {
    fail(403, 'Only the event owner can change linked admins.');
  }
}

function publicUser(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    email: String(doc.email || '').toLowerCase(),
    fullName: doc.full_name || null,
    role: doc.role === 'admin' ? 'admin' : 'user',
    image: doc.image || null,
  };
}

function displayName(admin) {
  return admin?.fullName || admin?.email || 'Unknown admin';
}

async function findEvent(id) {
  if (!id) fail(400, 'Event id is required.');
  await connectDb();
  const event = await Event.findById(String(id)).lean();
  if (!event) fail(404, 'Event not found.');
  return event;
}

async function findAdminById(id) {
  if (!id) return null;
  return User.findOne({ _id: String(id), role: 'admin' }).lean();
}

async function findAdminByEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return null;
  return User.findOne({ email: value, role: 'admin' }).lean();
}

export async function listEventAdminLinks(eventId, user) {
  assertAdmin(user);
  const event = await findEvent(eventId);
  if (!canRead(event, user)) fail(404, 'Event not found.');

  const ownerId = event.created_by ? String(event.created_by) : null;
  const linkedIds = linkedIdsOf(event).filter((id) => id !== ownerId);

  const ids = [ownerId, ...linkedIds].filter(Boolean);
  const rows = ids.length ? await User.find({ _id: { $in: ids }, role: 'admin' }).lean() : [];
  const byId = new Map(rows.map((row) => [String(row._id), publicUser(row)]));

  const canManage = !ownerId || ownerId === user.id;
  let availableAdmins = [];
  if (canManage) {
    const allAdmins = await User.find({ role: 'admin' }).sort({ email: 1 }).lean();
    availableAdmins = allAdmins
      .map(publicUser)
      .filter((admin) => admin.id !== ownerId && !linkedIds.includes(admin.id));
  }

  return {
    eventId: String(event._id),
    eventName: event.name,
    canManage,
    owner: ownerId
      ? byId.get(ownerId) || { id: ownerId, email: null, fullName: null, role: 'admin', image: null }
      : null,
    linked: linkedIds.map(
      (id) =>
        byId.get(id) || {
          id,
          email: null,
          fullName: 'Removed admin',
          role: 'user',
          image: null,
        },
    ),
    availableAdmins,
  };
}

async function resolveTargetAdmin(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  const byId = typeof input === 'object' && input != null ? input.adminId : null;
  const byEmail = typeof input === 'object' && input != null ? input.email : value;

  let doc = byId ? await findAdminById(byId) : null;
  if (!doc && byEmail) doc = await findAdminByEmail(byEmail);
  if (!doc) fail(404, 'No admin account matches that email or id.');
  return doc;
}

export async function linkAdminToEvent(eventId, input, user) {
  assertAdmin(user);
  const event = await findEvent(eventId);
  assertCanManage(event, user);

  const target = await resolveTargetAdmin(input);
  const ownerId = event.created_by ? String(event.created_by) : null;
  const targetId = String(target._id);

  if (targetId === ownerId) fail(409, 'The event owner is already linked.');
  if (linkedIdsOf(event).includes(targetId)) fail(409, `${displayName(publicUser(target))} is already linked.`);

  await Event.findByIdAndUpdate(
    event._id,
    { $addToSet: { linked_admin_ids: targetId } },
    { new: true },
  );
  await invalidateEventCache();
  return listEventAdminLinks(event._id, user);
}

export async function unlinkAdminFromEvent(eventId, adminId, user) {
  assertAdmin(user);
  const event = await findEvent(eventId);
  assertCanManage(event, user);

  const id = String(adminId || '').trim();
  if (!id) fail(400, 'Admin id is required.');
  if (!linkedIdsOf(event).includes(id)) fail(404, 'That admin is not linked to this event.');

  await Event.findByIdAndUpdate(event._id, { $pull: { linked_admin_ids: id } }, { new: true });
  await invalidateEventCache();
  return listEventAdminLinks(event._id, user);
}
