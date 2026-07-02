// FILE: /backend/src/middleware/rateLimiter.js
// DEPS: express-rate-limit

const rateLimit = require('express-rate-limit');
const { getRateLimitStore } = require('./rateLimitStore');

/**
 * Login rate limiter — 5 attempts per IP per 15 minutes.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

/**
 * General API rate limiter — 100 requests per minute.
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Keys the limiter by API key id when present, else by client IP. This means a
 * single abusive key (or IP, pre-auth) is throttled without affecting others.
 */
function apiKeyOrIp(req) {
  if (req.apiKey && req.apiKey.id) return `key:${req.apiKey.id}`;
  return `ip:${req.ip}`;
}

/**
 * Public catalog reads — generous, since this is cacheable public data.
 * 300 requests / minute per key (or per IP before the key is resolved).
 */
const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiKeyOrIp,
  store: getRateLimitStore('rl:pubread:'),
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

/**
 * Public lead submissions — strict. 5 per minute and 30 per hour per key/IP.
 * Two stacked windows blunt both bursts and slow drip-spam.
 */
const publicWriteBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiKeyOrIp,
  store: getRateLimitStore('rl:pubwrite:burst:'),
  message: {
    success: false,
    error: 'Too many submissions. Please try again in a minute.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const publicWriteHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: apiKeyOrIp,
  store: getRateLimitStore('rl:pubwrite:hourly:'),
  message: {
    success: false,
    error: 'Submission limit reached. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

module.exports = {
  loginLimiter,
  apiLimiter,
  publicReadLimiter,
  publicWriteBurstLimiter,
  publicWriteHourlyLimiter,
};
