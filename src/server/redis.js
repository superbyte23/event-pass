// Optional Redis (Upstash REST / Vercel Marketplace integration).
//
// Everything built on top of this degrades to a no-op when the integration is
// absent, so the app behaves exactly as it did before Redis existed. The REST
// client is deliberate: Vercel runs many short-lived function instances, and a
// TCP client (ioredis / node-redis) would open one connection per instance.

import { Redis } from '@upstash/redis';

let resolved = false;
let client = null;

// The Vercel Upstash integration injects KV_REST_API_*; a plain Upstash setup
// uses UPSTASH_REDIS_REST_*. Accept either so both work.
function redisConfig() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

export function getRedis() {
  if (resolved) return client;
  resolved = true;

  const config = redisConfig();
  if (!config) return null;

  try {
    client = new Redis({ url: config.url, token: config.token });
  } catch (error) {
    console.error('[redis] disabled:', error?.message || error);
    client = null;
  }
  return client;
}

export function isRedisEnabled() {
  return getRedis() != null;
}
