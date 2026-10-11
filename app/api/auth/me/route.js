import { NextResponse } from 'next/server';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }
  return NextResponse.json(user);
}
