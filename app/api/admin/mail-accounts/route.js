import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { createMailAccount, listMailAccounts } from '@/server/mail-accounts';
import { getMailRuntimeConfig } from '@/server/mail-config';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const accounts = await listMailAccounts(user);
    return NextResponse.json({
      accounts,
      defaultProvider: getMailRuntimeConfig().defaultProvider,
      credentialsKeyConfigured: getMailRuntimeConfig().credentialsKeyConfigured,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const body = await request.json().catch(() => ({}));
    const account = await createMailAccount(body?.data || body, user);
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
