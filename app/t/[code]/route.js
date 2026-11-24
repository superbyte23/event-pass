import { NextResponse } from 'next/server';

import { errorResponse } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';
import { decodeTicketShortCode } from '@/server/short-links';
import { loadTicketBundle, ticketImageResponse } from '@/server/ticket-download';

export const dynamic = 'force-dynamic';

// Public image downloads are bounded: the signed code is the capability, but
// generating a 1200 × 1800 image is still CPU work worth throttling per client.
const DOWNLOAD_LIMIT = 30;
const DOWNLOAD_WINDOW_SECONDS = 10 * 60;

export async function GET(request, context) {
  const { code } = await context.params;
  const registrationId = decodeTicketShortCode(code);
  if (!registrationId) {
    return NextResponse.redirect(new URL('/find-ticket', request.url), 302);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('download') !== '1') {
    // Viewing a ticket still requires a signed-in session in the SPA.
    return NextResponse.redirect(new URL(`/tickets/${registrationId}`, request.url), 302);
  }

  try {
    await enforceRateLimit(request, {
      name: 'ticket-email-download',
      limit: DOWNLOAD_LIMIT,
      windowSeconds: DOWNLOAD_WINDOW_SECONDS,
    });
    const bundle = await loadTicketBundle(registrationId);
    const format = url.searchParams.get('format') === 'jpeg' ? 'jpeg' : 'webp';
    return await ticketImageResponse({ ...bundle, format });
  } catch (error) {
    return errorResponse(error);
  }
}
