import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { exportMailAccounts } from '@/server/mail-accounts';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    return NextResponse.json(await exportMailAccounts(user));
  } catch (error) {
    return errorResponse(error);
  }
}
