import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { linkAdminToEvent, listEventAdminLinks } from '@/server/event-admin-links';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId } = await context.params;
    return NextResponse.json(await listEventAdminLinks(eventId, user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const payload = body?.data || body;
    const result = await linkAdminToEvent(
      eventId,
      { adminId: payload?.adminId, email: payload?.email },
      user,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
