import { NextResponse } from 'next/server';

import { decodeTicketShortCode } from '@/server/short-links';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { code } = await context.params;
  const registrationId = decodeTicketShortCode(code);
  if (!registrationId) {
    return NextResponse.redirect(new URL('/find-ticket', request.url), 302);
  }
  const url = new URL(request.url);
  const target = url.searchParams.get('download') === '1'
    ? `/tickets/${registrationId}?download=1`
    : `/tickets/${registrationId}`;
  return NextResponse.redirect(new URL(target, request.url), 302);
}
