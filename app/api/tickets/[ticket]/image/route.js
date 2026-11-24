import { errorResponse } from '@/server/http';
import { getEntity } from '@/server/entity-api';
import { getSessionUser } from '@/server/session';
import { ticketImageResponse } from '@/server/ticket-download';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const { ticket } = await context.params;
    // Session-based downloads keep the normal entity read rules. Signed email
    // downloads go through /t/[code]?download=1 instead, which verifies the
    // short-link HMAC before loading the ticket.
    const user = await getSessionUser(request);
    const registration = await getEntity('Registration', ticket, user);
    const event = registration.event_id
      ? await getEntity('Event', registration.event_id, user)
      : null;

    let guest = {
      full_name: registration.guest_name,
      email: registration.guest_email,
      image: null,
    };
    if (registration.user_id) {
      try {
        const account = await getEntity('User', registration.user_id, user);
        guest = {
          full_name: account.full_name || guest.full_name,
          email: account.email || guest.email,
          image: account.image || null,
        };
      } catch {
        // Captured guest fields remain a valid fallback.
      }
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') === 'jpeg' ? 'jpeg' : 'webp';
    return await ticketImageResponse({ registration, event, guest, format });
  } catch (error) {
    return errorResponse(error);
  }
}
