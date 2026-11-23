import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { testMailAccount } from '@/server/mail-accounts';
import { enforceRateLimit } from '@/server/rate-limit';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    await enforceRateLimit(request, {
      name: 'mail-account-test',
      limit: 10,
      windowSeconds: 60 * 60,
      key: user.id,
    });
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await testMailAccount(id, user, body?.data || body);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
