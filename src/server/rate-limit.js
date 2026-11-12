// Fixed-window rate limiting backed by Redis.
//
// Fails open by design: a Redis outage must never block sign-ups, ticket
// lookups, or check-in at the door. With no Redis configured this is a no-op.

import { ApiError } from './entity-api';
import { getRedis } from './redis';

// Vercel sets x-forwarded-for; the left-most entry is the client.
export function clientIp(request) {
  const headers = request?.headers;
  const forwarded = headers?.get?.('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return headers?.get?.('x-real-ip')?.trim() || 'unknown';
}

export async function enforceRateLimit(request, { name, limit, windowSeconds, key }) {
  const redis = getRedis();
  if (!redis) return;

  const bucket = `ratelimit:${name}:${key || clientIp(request)}`;
  let count;
  try {
    count = await redis.incr(bucket);
    if (count === 1) await redis.expire(bucket, windowSeconds);
  } catch (error) {
    console.error('[rate-limit] skipped:', error?.message || error);
    return;
  }

  if (count > limit) {
    throw new ApiError(429, 'Too many requests. Please wait a moment and try again.');
  }
}
