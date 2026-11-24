// Shared ticket-image download helpers.
//
// Two entry points use this:
//  - signed email links (/t/<code>?download=1): the HMAC on the short code is
//    the authorization, so no session is required
//  - the ticket page's image API (/api/tickets/<id>/image): the session and the
//    normal entity read rules are checked by the route before calling here
//
// `loadTicketBundle` deliberately skips row-level read rules — callers must
// have authorized the request first.

import { NextResponse } from 'next/server';

import { connectDb } from '../db/index.js';
import { Event, Registration, User, serialize } from '../db/models.js';
import { ApiError } from './entity-api.js';
import { getAppUrl } from './mail-config.js';
import { buildTicketImage } from './ticket-image.js';

export async function loadTicketBundle(registrationId) {
  await connectDb();
  const registrationDoc = await Registration.findById(registrationId).lean();
  if (!registrationDoc) throw new ApiError(404, 'Ticket not found.');
  const registration = serialize(registrationDoc);

  const eventDoc = registration.event_id
    ? await Event.findById(registration.event_id).lean()
    : null;
  const event = eventDoc ? serialize(eventDoc) : null;

  let guest = {
    full_name: registration.guest_name,
    email: registration.guest_email,
    image: null,
  };
  if (registration.user_id) {
    const accountDoc = await User.findById(registration.user_id).lean();
    if (accountDoc) {
      const account = serialize(accountDoc);
      guest = {
        full_name: account.full_name || guest.full_name,
        email: account.email || guest.email,
        image: account.image || null,
      };
    }
  }

  return { registration, event, guest };
}

export async function ticketImageResponse({ registration, event, guest, format = 'webp' }) {
  const buffer = await buildTicketImage({
    event: event || {},
    registration,
    guest,
    appUrl: getAppUrl(),
    format,
  });

  const safeName = String(registration.registration_number || 'ticket').replace(/[^a-zA-Z0-9_-]/g, '-');
  const extension = format === 'jpeg' ? 'jpg' : 'webp';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': format === 'jpeg' ? 'image/jpeg' : 'image/webp',
      'Content-Disposition': `attachment; filename="ticket-${safeName}.${extension}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
