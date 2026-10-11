import { NextResponse } from 'next/server';
import { ApiError } from './entity-api';

export function errorResponse(error) {
  const status = error?.status || (error instanceof ApiError ? error.status : 500);
  const message =
    status === 500 && !error?.status
      ? 'Something went wrong. Please try again.'
      : error?.message || 'Request failed.';
  if (status === 500) console.error('[api]', error);
  return NextResponse.json({ message }, { status });
}

export function parseJsonParam(raw, name) {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, `${name} must be valid JSON.`);
  }
}
