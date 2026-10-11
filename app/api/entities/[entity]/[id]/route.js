import { NextResponse } from 'next/server';
import {
  deleteEntity,
  getEntity,
  updateEntity,
} from '@/server/entity-api';
import { getSessionUser } from '@/server/session';
import { errorResponse } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  try {
    const { entity, id } = await context.params;
    const user = await getSessionUser(request);
    const row = await getEntity(entity, id, user);
    return NextResponse.json(row);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request, context) {
  try {
    const { entity, id } = await context.params;
    const user = await getSessionUser(request);
    const body = await request.json().catch(() => ({}));
    if (!body?.data) {
      return NextResponse.json({ message: 'Expected { data }.' }, { status: 400 });
    }
    const row = await updateEntity(entity, id, body.data, user);
    return NextResponse.json(row);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  try {
    const { entity, id } = await context.params;
    const user = await getSessionUser(request);
    const result = await deleteEntity(entity, id, user);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
