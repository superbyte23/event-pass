// Short-lived cache for the public event list.
//
// Cache keys carry a version number; any Event write bumps it, which orphans
// the old keys (they expire on their own TTL) instead of requiring a scan.
// Reads and writes swallow Redis errors: a cache miss is always acceptable,
// a failed page load is not.

import { getRedis } from './redis';

const VERSION_KEY = 'cache:events:version';
const TTL_SECONDS = 60;

async function currentVersion(redis) {
  const value = await redis.get(VERSION_KEY);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function readEventListCache(variant) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const version = await currentVersion(redis);
    const cached = await redis.get(`cache:events:${version}:${variant}`);
    if (!cached) return null;
    // Upstash deserializes JSON automatically; fall back for plain strings.
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch (error) {
    console.error('[cache] read failed:', error?.message || error);
    return null;
  }
}

export async function writeEventListCache(variant, rows) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const version = await currentVersion(redis);
    await redis.set(`cache:events:${version}:${variant}`, JSON.stringify(rows), {
      ex: TTL_SECONDS,
    });
  } catch (error) {
    console.error('[cache] write failed:', error?.message || error);
  }
}

export async function invalidateEventCache() {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
  } catch (error) {
    console.error('[cache] invalidate failed:', error?.message || error);
  }
}
