import { NextResponse } from 'next/server';
import { listGuestTickets } from '@/server/entity-api';
import { errorResponse } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email : '';
    const eventId = typeof body?.event_id === 'string' && body.event_id ? body.event_id : undefined;
    const registrations = await listGuestTickets(email, eventId);
    return NextResponse.json({ registrations });
  } catch (error) {
    return errorResponse(error);
  }
}