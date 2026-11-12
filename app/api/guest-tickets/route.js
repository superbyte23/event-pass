import { NextResponse } from 'next/server';
import { listGuestTickets } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

// Unauthenticated lookup keyed by email, so it is the one endpoint that can be
// used to probe whether a given address is registered.
const LOOKUP_LIMIT = 10;
const LOOKUP_WINDOW_SECONDS = 10 * 60;

export async function POST(request) {
  try {
    await enforceRateLimit(request, {
      name: 'guest-tickets',
      limit: LOOKUP_LIMIT,
      windowSeconds: LOOKUP_WINDOW_SECONDS,
    });
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email : '';
    const eventId = typeof body?.event_id === 'string' && body.event_id ? body.event_id : undefined;
    const registrations = await listGuestTickets(email, eventId);
    return NextResponse.json({ registrations });
  } catch (error) {
    return errorResponse(error);
  }
}