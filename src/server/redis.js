// Optional Redis. Two transports, same tiny interface, both fail open:
//
//   REST  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//         or KV_REST_API_URL / KV_REST_API_TOKEN  (Vercel Upstash integration)
//   TCP   REDIS_URL / REDIS_TLS_URL               (Vercel Redis Cloud integration)
//
// REST is preferred on serverless: Vercel runs many short-lived function
// instances and each TCP client holds a connection open per instance. TCP is
// supported because the Redis Cloud marketplace integration injects REDIS_URL.
//
// Everything built on top of this degrades to a no-op when neither transport is
// configured, so the app behaves exactly as it did before Redis existed.

import { Redis } from '@upstash/redis';
import IORedis from 'ioredis';

let resolved = false;
let client = null;

// The Vercel Upstash integration injects KV_REST_API_*; a plain Upstash setup
// uses UPSTASH_REDIS_REST_*. Accept either so both work.
function restConfig() {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

function tcpUrl() {
  return (process.env.REDIS_URL || process.env.REDIS_TLS_URL || '').trim();
}

// Normalize both clients to get/set/incr/expire so cache.js and rate-limit.js
// do not care which transport is active.
function wrapRest(redis) {
  return {
    get: (key) => redis.get(key),
    set: (key, value, options) => redis.set(key, value, options),
    incr: (key) => redis.incr(key),
    expire: (key, seconds) => redis.expire(key, seconds),
  };
}

function wrapTcp(redis) {
  return {
    get: (key) => redis.get(key),
    set: (key, value, options) => {
      const seconds = options?.ex;
      return seconds ? redis.set(key, value, 'EX', seconds) : redis.set(key, value);
    },
    incr: (key) => redis.incr(key),
    expire: (key, seconds) => redis.expire(key, seconds),
  };
}

function createTcpClient(url) {
  const redis = new IORedis(url, {
    // A door check-in must never wait on a dead Redis. One retry, short
    // connect timeout, then give up and let the caller fail open.
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    enableReadyCheck: false,
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 1000)),
  });
  // ioredis emits 'error' on connection failures; without a listener Node
  // treats it as an unhandled error event. Log once to keep logs quiet.
  let logged = false;
  redis.on('error', (error) => {
    if (logged) return;
    logged = true;
    console.error('[redis] connection error:', error?.message || error);
  });
  return wrapTcp(redis);
}

export function getRedis() {
  if (resolved) return client;
  resolved = true;

  const rest = restConfig();
  if (rest) {
    try {
      client = wrapRest(new Redis({ url: rest.url, token: rest.token }));
    } catch (error) {
      console.error('[redis] disabled:', error?.message || error);
      client = null;
    }
    return client;
  }

  const url = tcpUrl();
  if (url) {
    try {
      client = createTcpClient(url);
    } catch (error) {
      console.error('[redis] disabled:', error?.message || error);
      client = null;
    }
    return client;
  }

  return null;
}

export function isRedisEnabled() {
  return getRedis() != null;
}
