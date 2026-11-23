import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { unlinkAdminFromEvent } from '@/server/event-admin-links';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function DELETE(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId, admin: adminId } = await context.params;
    return NextResponse.json(await unlinkAdminFromEvent(eventId, adminId, user));
  } catch (error) {
    return errorResponse(error);
  }
}
