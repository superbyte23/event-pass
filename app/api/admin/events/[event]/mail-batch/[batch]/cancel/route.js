import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { cancelBulkMail } from '@/server/bulk-ticket-mail';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId, batch: batchId } = await context.params;
    return NextResponse.json(await cancelBulkMail(eventId, batchId, user));
  } catch (error) {
    return errorResponse(error);
  }
}
