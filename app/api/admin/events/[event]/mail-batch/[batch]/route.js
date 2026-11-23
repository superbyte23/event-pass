import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { getBulkMail } from '@/server/bulk-ticket-mail';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { event: eventId, batch: batchId } = await context.params;
    return NextResponse.json(await getBulkMail(eventId, batchId, user));
  } catch (error) {
    return errorResponse(error);
  }
}
