import { NextResponse } from 'next/server';
import {
  ApiError,
  bulkCreate,
  createEntity,
  deleteManyEntities,
  listEntities,
} from '@/server/entity-api';
import { readEventListCache, writeEventListCache } from '@/server/cache';
import { errorResponse, parseJsonParam } from '@/server/http';
import { enforceRateLimit } from '@/server/rate-limit';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

// Guest self-registration is unauthenticated, so it is throttled per IP.
// Signed-in users and admin imports are not limited (imports post many rows).
const GUEST_REGISTRATION_LIMIT = 10;
const GUEST_REGISTRATION_WINDOW_SECONDS = 60 * 60;

export async function GET(request, context) {
  try {
    const { entity } = await context.params;
    const user = await getSessionUser(request);
    const url = new URL(request.url);
    const filter = parseJsonParam(url.searchParams.get('filter'), 'filter');
    const sort = url.searchParams.get('sort');
    const limit = url.searchParams.get('limit');

    // Anonymous event browsing is the busiest read path and returns the same
    // rows for every guest. Admins can see unpublished events, so anything
    // with a session bypasses the cache.
    const cacheable = entity === 'Event' && !user && !filter;
    const variant = `${sort || ''}|${limit || ''}`;
    if (cacheable) {
      const cached = await readEventListCache(variant);
      if (cached) return NextResponse.json(cached);
    }

    const rows = await listEntities(entity, { user, filter, sort, limit });
    if (cacheable) await writeEventListCache(variant, rows);
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, context) {
  try {
    const { entity } = await context.params;
    const user = await getSessionUser(request);
    if (entity === 'Registration' && !user) {
      await enforceRateLimit(request, {
        name: 'guest-registration',
        limit: GUEST_REGISTRATION_LIMIT,
        windowSeconds: GUEST_REGISTRATION_WINDOW_SECONDS,
      });
    }
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.items)) {
      const rows = await bulkCreate(entity, body.items, user);
      return NextResponse.json(rows);
    }
    if (!body?.data) throw new ApiError(400, 'Expected { data } or { items }.');
    const row = await createEntity(entity, body.data, user);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  try {
    const { entity } = await context.params;
    const user = await getSessionUser(request);
    const url = new URL(request.url);
    const filter = parseJsonParam(url.searchParams.get('filter'), 'filter');
    const result = await deleteManyEntities(entity, filter, user);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
