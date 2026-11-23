import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { importMailAccounts } from '@/server/mail-accounts';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const body = await request.json().catch(() => ({}));
    const result = await importMailAccounts(body?.data ?? body, user, {
      updateExisting: body?.options?.updateExisting === true || body?.update_existing === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
