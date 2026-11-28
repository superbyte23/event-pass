// Append-only check-in history. Only the check-in server paths write rows;
// failures are never logged and restoring a registration never removes them.

import { connectDb } from '../db/index.js';
import { CheckInLog, serialize } from '../db/models.js';

export async function recordCheckInLog({
  eventId,
  registration,
  method,
  already = false,
  adminId = null,
}) {
  await connectDb();
  const doc = await CheckInLog.create({
    event_id: eventId ? String(eventId) : null,
    registration_id: registration?.id ? String(registration.id) : null,
    registration_number: registration?.registration_number ?? null,
    guest_name: registration?.guest_name ?? null,
    guest_email: registration?.guest_email ?? null,
    method,
    already: Boolean(already),
    admin_id: adminId ? String(adminId) : null,
  });
  return serialize(doc);
}

export async function listCheckInLogs(eventId, limit = 100) {
  await connectDb();
  const docs = await CheckInLog.find({ event_id: eventId })
    .sort({ created_date: -1 })
    .limit(limit)
    .lean();
  return docs.map(serialize);
}
