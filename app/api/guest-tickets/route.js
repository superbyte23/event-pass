import { NextResponse } from 'next/server';
import { listGuestTickets } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

// Unauthenticated lookup keyed by the email or name used at registration, so
// it is the one endpoint that can be used to probe guest registrations.
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
    // `email` is kept as a fallback for older clients/bookmarks.
    const query = typeof body?.query === 'string'
      ? body.query
      : typeof body?.email === 'string' ? body.email : '';
    const eventId = typeof body?.event_id === 'string' && body.event_id ? body.event_id : undefined;
    const registrations = await listGuestTickets(query, eventId);
    return NextResponse.json({ registrations });
  } catch (error) {
    return errorResponse(error);
  }
}