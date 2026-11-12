import { db } from "@/api/db";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// The attendee profile behind a registration: the linked account when the row
// carries a user_id, otherwise the guest details captured at registration.
//
// Guest rows still resolve to an account photo when the guest email belongs to
// a registered user (e.g. someone registered while signed out, then signed in
// with Google). That keeps ticket, check-in and admin avatars consistent with
// the account instead of falling back to initials.
export async function resolveAttendeeProfile(reg, user = null) {
  if (!reg) return null;

  if (reg.user_id) {
    if (user?.id && user.id === reg.user_id) return user;
    try {
      const linked = await db.entities.User.get(reg.user_id);
      if (linked) return linked;
    } catch {
      // fall through to the captured guest fields
    }
    return { full_name: reg.guest_name, email: reg.guest_email, image: null };
  }

  const profile = {
    full_name: reg.guest_name || null,
    email: reg.guest_email || null,
    image: null,
  };

  const guestEmail = normalizeEmail(reg.guest_email);
  if (!guestEmail) return profile;

  if (normalizeEmail(user?.email) === guestEmail && user?.image) {
    profile.image = user.image;
    profile.full_name = profile.full_name || user.full_name;
    return profile;
  }

  // Signed-in callers only. The User read scope limits non-admins to their own
  // row, so this can never expose another attendee's profile to a normal user.
  if (user) {
    try {
      const matches = await db.entities.User.filter({ email: guestEmail });
      const match = (matches || []).find((candidate) => candidate.image);
      if (match) {
        profile.image = match.image;
        profile.full_name = profile.full_name || match.full_name;
      }
    } catch {
      // best effort — initials remain a valid fallback
    }
  }

  return profile;
}
