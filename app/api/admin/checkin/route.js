import { NextResponse } from 'next/server';
import { checkInRegistration } from '@/server/entity-api';
import { getSessionUser } from '@/server/session';
import { errorResponse } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';

export const dynamic = 'force-dynamic';

// Door staff scan continuously, so the limit is per admin rather than per
// request - generous enough for a busy door, tight enough to stop code
// guessing from a stolen session.
const CHECKIN_LIMIT = 120;
const CHECKIN_WINDOW_SECONDS = 60;

// Accepts whatever the scanner/`m` field sends: a bare token, a bare path
// (`/checkin/<token>`) or the full URL the ticket's QR encodes.
function extractToken(value) {
  const s = String(value || '').trim().split(/[?#]/)[0];
  if (!s) return '';
  const m = s.match(/(?:^|\/)([A-Za-z0-9_-]{6,})\/?$/);
  return m ? m[1] : s;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getSessionUser(request);
    await enforceRateLimit(request, {
      name: 'checkin',
      limit: CHECKIN_LIMIT,
      windowSeconds: CHECKIN_WINDOW_SECONDS,
      key: user?.id,
    });
    const token = extractToken(body?.value);
    const result = await checkInRegistration(token, user);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}