import { NextResponse } from 'next/server';
import { listMyRegistrations } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

// The caller's own tickets: account registrations plus guest registrations
// made with the caller's email. Scoped by the session, not by client input.
export async function GET(request) {
  try {
    const user = await getSessionUser(request);
    const url = new URL(request.url);
    const eventId = url.searchParams.get('event_id') || undefined;
    const registrations = await listMyRegistrations(user, eventId);
    return NextResponse.json(registrations);
  } catch (error) {
    return errorResponse(error);
  }
}
