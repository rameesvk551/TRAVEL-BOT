// FILE: /backend/src/middleware/rateLimitStore.js
// DEPS: ioredis (optional), rate-limit-redis (optional)
// ENV: REDIS_URL

// Returns a rate-limit store backed by Redis when available, otherwise undefined
// so express-rate-limit falls back to its in-memory store. Redis is OPTIONAL and
// matches how the rest of the backend treats it (schedulerService): a single
// fork instance is fully covered by in-memory limiting; Redis only matters for
// multi-instance / cluster topologies or surviving restarts. We never let a
// Redis hiccup crash the request path.

let sharedClient;
let triedClient = false;

function getClient() {
  if (triedClient) return sharedClient;
  triedClient = true;

  const url = process.env.REDIS_URL;
  const isLocalRedis =
    !!url &&
    (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('[::1]'));
  // Skip Redis entirely if unset, or pointed at localhost unless explicitly
  // allowed. Production PM2 environments may not set NODE_ENV, and a missing
  // local Redis must never prevent the API from starting.
  if (!url || (isLocalRedis && process.env.REDIS_RATE_LIMIT_ALLOW_LOCALHOST !== 'true')) {
    return undefined;
  }

  try {
    const IORedis = require('ioredis');
    sharedClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Swallow errors — the limiter must never throw into a request.
    sharedClient.on('error', () => {});
  } catch {
    sharedClient = undefined;
  }
  return sharedClient;
}

/**
 * Build a Redis-backed store for express-rate-limit, or return undefined to use
 * the default in-memory store.
 * @param {string} prefix - key namespace, e.g. 'rl:pubread:'
 * @returns {object|undefined}
 */
function getRateLimitStore(prefix) {
  // Check the optional package FIRST so we never open an idle Redis connection
  // on a box where rate-limit-redis isn't installed (in-memory fallback).
  let RedisStore;
  try {
    ({ RedisStore } = require('rate-limit-redis'));
  } catch {
    return undefined;
  }
  const client = getClient();
  if (!client) return undefined;
  if (client.status !== 'ready') return undefined;
  return new RedisStore({ prefix, sendCommand: (...args) => client.call(...args) });
}

module.exports = { getRateLimitStore };
