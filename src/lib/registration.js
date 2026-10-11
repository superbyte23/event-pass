import { db } from "@/api/db";


// Client-side registration. (Backend functions require a Builder+ plan, so
// the one-registration-per-event rule is enforced here: each guest can only
// create registrations as themselves — created_by_id is auto-stamped — and
// they check their own existing registrations for the event before creating.
// Capacity is reflected through the event's status, which admins manage from
// the dashboard where they can see the live registration count.)

function randomToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function shortCode() {
  return randomToken().replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function getMyRegistrationForEvent(eventId, userId) {
  const list = await db.entities.Registration.filter({ event_id: eventId, user_id: userId });
  const active = (list || []).filter((r) => r.status !== "cancelled");
  return active.length > 0 ? active[0] : null;
}

export async function registerForEvent(event, user, responses = {}) {
  if (!user || !user.id) {
    return { error: "You must be signed in to register." };
  }

  // 1. Already registered? (filter by user_id explicitly so it's correct for admins too)
  const existing = await getMyRegistrationForEvent(event.id, user.id);
  if (existing) {
    return { already_registered: true, registration: existing };
  }

  // 2. Availability gate (status-based; capacity reflected by admin-set status)
  if (event.status === "full") return { error: "This event is full." };
  if (event.status === "closed") return { error: "Registration is closed for this event." };
  if (event.status === "completed") return { error: "This event has already concluded." };
  if (event.status === "draft") return { error: "This event is not open for registration yet." };

  const now = new Date();
  const regStart = event.registration_start ? new Date(event.registration_start) : null;
  const regEnd = event.registration_end ? new Date(event.registration_end) : null;
  if (regStart && now < regStart) return { error: "Registration has not opened yet." };
  if (regEnd && now > regEnd) return { error: "Registration is closed for this event." };

  // 3. Generate a human-readable registration number + secure QR token
  const year = event.date ? new Date(event.date).getFullYear() : now.getFullYear();
  const registrationNumber = `REG-${year}-${shortCode()}`;
  const qrToken = randomToken();

  // 4. Create the registration (RLS create = owner; user_id gates reads)
  let registration;
  try {
    registration = await db.entities.Registration.create({
      event_id: event.id,
      event_name: event.name,
      user_id: user.id,
      registration_number: registrationNumber,
      qr_token: qrToken,
      status: "confirmed",
      responses,
    });
  } catch (e) {
    return { error: e?.message || "Could not complete registration. Please try again." };
  }

  // 5. Race cleanup: if a double-submit slipped through, keep the earliest and
  // remove the rest. (Delete is admin-only under RLS, so this best-effort cleanup
  // only succeeds for admins; for guests the double-submit guard in the UI is
  // what prevents duplicates. Wrapped so a failed delete never throws to the user.)
  let recheck;
  try {
    recheck = await db.entities.Registration.filter({ event_id: event.id, user_id: user.id });
  } catch {
    recheck = [registration];
  }
  const active = (recheck || []).filter((r) => r.status !== "cancelled");
  if (active.length > 1) {
    const sorted = active.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const keep = sorted[0];
    await Promise.all(sorted.slice(1).map((d) => db.entities.Registration.delete(d.id).catch(() => {})));
    return { already_registered: true, registration: keep };
  }

  return { success: true, registration };
}

export async function getGuestRegistrationForEvent(eventId, email) {
  const list = await db.entities.Registration.filter({ event_id: eventId, guest_email: email });
  const active = (list || []).filter((r) => r.status !== "cancelled");
  return active.length > 0 ? active[0] : null;
}

// Email-based lookup for guests (no account). Posts to the server endpoint,
// which only returns profile-less registrations for that email.
export async function findGuestTickets({ email, eventId } = {}) {
  const res = await fetch(`/api/guest-tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(email || "").trim(), event_id: eventId || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || "Could not look up your tickets.");
    err.status = res.status;
    throw err;
  }
  return data?.registrations || [];
}

export async function registerGuestForEvent(event, guest, responses = {}) {
  const email = (guest?.email || "").trim().toLowerCase();
  if (!email) return { error: "Email is required." };

  // 1. One ticket per email per event
  const existing = await getGuestRegistrationForEvent(event.id, email);
  if (existing) return { already_registered: true, registration: existing };

  // 2. Availability gate (status-based; capacity reflected by admin-set status)
  if (event.status === "full") return { error: "This event is full." };
  if (event.status === "closed") return { error: "Registration is closed for this event." };
  if (event.status === "completed") return { error: "This event has already concluded." };
  if (event.status === "draft") return { error: "This event is not open for registration yet." };
  const now = new Date();
  const regStart = event.registration_start ? new Date(event.registration_start) : null;
  const regEnd = event.registration_end ? new Date(event.registration_end) : null;
  if (regStart && now < regStart) return { error: "Registration has not opened yet." };
  if (regEnd && now > regEnd) return { error: "Registration is closed for this event." };

  // 3. Create the guest registration (no user account)
  const year = event.date ? new Date(event.date).getFullYear() : now.getFullYear();
  const registrationNumber = `REG-${year}-${shortCode()}`;
  const qrToken = randomToken();

  let registration;
  try {
    registration = await db.entities.Registration.create({
      event_id: event.id,
      event_name: event.name,
      guest_email: email,
      registration_number: registrationNumber,
      qr_token: qrToken,
      status: "confirmed",
      responses,
    });
  } catch (e) {
    return { error: e?.message || "Could not complete registration. Please try again." };
  }

  // 4. Race cleanup (best-effort; delete is admin-only, so guests rely on the UI double-submit guard)
  let recheck;
  try {
    recheck = await db.entities.Registration.filter({ event_id: event.id, guest_email: email });
  } catch {
    recheck = [registration];
  }
  const active = (recheck || []).filter((r) => r.status !== "cancelled");
  if (active.length > 1) {
    const sorted = active.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const keep = sorted[0];
    await Promise.all(sorted.slice(1).map((d) => db.entities.Registration.delete(d.id).catch(() => {})));
    return { already_registered: true, registration: keep };
  }

  return { success: true, registration };
}