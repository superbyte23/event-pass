import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { deleteMailAccount, setDefaultMailAccount, updateMailAccount } from '@/server/mail-accounts';
import { getSessionUser, requireAdmin } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function PATCH(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result =
      body?.set_default === true
        ? await setDefaultMailAccount(id, user)
        : await updateMailAccount(id, body?.data || body, user);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  try {
    const user = requireAdmin(await getSessionUser(request));
    const { id } = await context.params;
    const result = await deleteMailAccount(id, user);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
