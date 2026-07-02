// FILE: /backend/src/services/apiKeyService.js
// DEPS: crypto (node builtin), sequelize

const crypto = require('crypto');
const { Op } = require('sequelize');
const { AgencyApiKey } = require('../models');

// Publishable key format:  pk_live_<keyId>_<secret>
//   - keyId  : 16 hex chars (public, indexed lookup component)
//   - secret : 48 base64url chars (~36 bytes of entropy)
// The raw key is returned to the caller exactly once and never stored; only the
// SHA-256 of the full string is persisted.
const KEY_ENV = process.env.NODE_ENV === 'production' ? 'live' : 'test';
const KEY_REGEX = /^pk_(?:live|test)_([a-f0-9]{16})_([A-Za-z0-9_-]{20,})$/;
const DEFAULT_SCOPES = ['catalog:read', 'leads:write'];
const VALID_SCOPES = new Set(['catalog:read', 'leads:write']);

/**
 * SHA-256 hex of a string.
 * @param {string} value
 * @returns {string}
 */
function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

/**
 * Constant-time comparison of two equal-length hex digests.
 * Returns false on any length mismatch instead of throwing.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Parse a presented key into its components without trusting it.
 * @param {string} rawKey
 * @returns {{ keyId: string } | null}
 */
function parseKey(rawKey) {
  const match = KEY_REGEX.exec(String(rawKey || '').trim());
  if (!match) return null;
  return { keyId: match[1] };
}

function sanitizeScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : DEFAULT_SCOPES;
  const cleaned = [...new Set(list.map((s) => String(s).trim()).filter((s) => VALID_SCOPES.has(s)))];
  return cleaned.length ? cleaned : DEFAULT_SCOPES;
}

function sanitizeOrigins(origins) {
  if (!Array.isArray(origins)) return [];
  return [...new Set(
    origins
      .map((o) => String(o || '').trim().toLowerCase().replace(/\/+$/, ''))
      .filter((o) => /^https?:\/\/[^\s/]+$/.test(o)),
  )].slice(0, 20);
}

/**
 * Mint a new publishable key for an agency.
 * @param {string} agencyId
 * @param {object} [opts] - { label, scopes, allowedOrigins, createdByAgentId }
 * @returns {Promise<{ record: object, rawKey: string }>} rawKey is shown ONCE.
 */
async function createKey(agencyId, opts = {}) {
  const keyId = crypto.randomBytes(8).toString('hex'); // 16 hex chars
  const secret = crypto.randomBytes(36).toString('base64url'); // 48 chars
  const rawKey = `pk_${KEY_ENV}_${keyId}_${secret}`;

  const record = await AgencyApiKey.create({
    agencyId,
    label: String(opts.label || '').trim().slice(0, 120) || null,
    keyId,
    keyPrefix: `pk_${KEY_ENV}_${keyId.slice(0, 8)}…`,
    keyHash: sha256(rawKey),
    scopes: sanitizeScopes(opts.scopes),
    allowedOrigins: sanitizeOrigins(opts.allowedOrigins),
    createdByAgentId: opts.createdByAgentId || null,
  });

  return { record, rawKey };
}

/**
 * Verify a presented raw key and return its live DB record, or null.
 * Resilient to malformed input and uses constant-time hash comparison.
 * @param {string} rawKey
 * @returns {Promise<object|null>}
 */
async function verifyKey(rawKey) {
  const parsed = parseKey(rawKey);
  if (!parsed) return null;

  const record = await AgencyApiKey.findOne({
    where: { keyId: parsed.keyId, isActive: true, revokedAt: { [Op.is]: null } },
  });
  if (!record) return null;

  if (!safeEqualHex(sha256(rawKey), record.keyHash)) return null;
  return record;
}

/**
 * Fire-and-forget usage metering. Never blocks or throws into the request path.
 * @param {object} record - AgencyApiKey instance
 * @param {string} [ip]
 */
function touchUsage(record, ip) {
  if (!record) return;
  record.increment('requestCount').catch(() => {});
  record.update({ lastUsedAt: new Date(), lastUsedIp: ip ? String(ip).slice(0, 64) : record.lastUsedIp })
    .catch(() => {});
}

/**
 * List an agency's keys (never exposes the hash or raw value).
 * @param {string} agencyId
 * @returns {Promise<object[]>}
 */
async function listKeys(agencyId) {
  const rows = await AgencyApiKey.findAll({
    where: { agencyId },
    order: [['createdAt', 'DESC']],
  });
  return rows.map(publicKeyView);
}

/**
 * Revoke a key. Scoped to the agency so one tenant can never revoke another's.
 * @param {string} keyRecordId
 * @param {string} agencyId
 * @returns {Promise<object>}
 */
async function revokeKey(keyRecordId, agencyId) {
  const record = await AgencyApiKey.findOne({ where: { id: keyRecordId, agencyId } });
  if (!record) {
    throw Object.assign(new Error('API key not found'), { statusCode: 404, code: 'API_KEY_NOT_FOUND' });
  }
  if (!record.isActive) return publicKeyView(record);
  await record.update({ isActive: false, revokedAt: new Date() });
  return publicKeyView(record);
}

/**
 * Dashboard-safe projection — excludes keyHash and the raw secret.
 * @param {object} record
 */
function publicKeyView(record) {
  return {
    id: record.id,
    label: record.label,
    keyPrefix: record.keyPrefix,
    scopes: record.scopes,
    allowedOrigins: record.allowedOrigins,
    isActive: record.isActive,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt,
    requestCount: Number(record.requestCount || 0),
    createdAt: record.createdAt,
  };
}

module.exports = {
  createKey,
  verifyKey,
  touchUsage,
  listKeys,
  revokeKey,
  publicKeyView,
  sanitizeScopes,
  sanitizeOrigins,
};
