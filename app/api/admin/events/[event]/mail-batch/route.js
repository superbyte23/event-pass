import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { getSessionUser, requireAdmin } from '@/server/session';
import { getLatestBulkMail, startBulkMail } from '@/server/bulk-ticket-mail';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId } = await context.params;
    return NextResponse.json(await getLatestBulkMail(eventId, user));
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
    const batch = await startBulkMail(
      eventId,
      {
        registrationIds: payload?.registrationIds,
        accountId: payload?.accountId,
      },
      user,
    );
    return NextResponse.json(batch, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
