import { NextResponse } from 'next/server';
import {
  ApiError,
  bulkCreate,
  createEntity,
  deleteManyEntities,
  listEntities,
} from '@/server/entity-api';
import { errorResponse, parseJsonParam } from '@/server/http';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const { entity } = await context.params;
    const user = await getSessionUser(request);
    const url = new URL(request.url);
    const rows = await listEntities(entity, {
      user,
      filter: parseJsonParam(url.searchParams.get('filter'), 'filter'),
      sort: url.searchParams.get('sort'),
      limit: url.searchParams.get('limit'),
    });
    return NextResponse.json(rows);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request, context) {
  try {
    const { entity } = await context.params;
    const user = await getSessionUser(request);
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
