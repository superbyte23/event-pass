import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { getEntity } from '@/server/entity-api';
import { getAppUrl } from '@/server/mail-config';
import { getSessionUser } from '@/server/session';
import { buildTicketImage } from '@/server/ticket-image';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const { ticket } = await context.params;
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
  } catch (error) {
    return errorResponse(error);
  }
}
