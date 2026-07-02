// FILE: /backend/src/middleware/authenticatePublicKey.js
// DEPS: -

const apiKeyService = require('../services/apiKeyService');
const { Agency } = require('../models');

/**
 * Extract the publishable key from the request. Accepted, in order:
 *   1. Authorization: Bearer pk_live_...
 *   2. X-Api-Key: pk_live_...
 *   3. ?api_key=pk_live_...   (last resort, e.g. <img>/no-header contexts)
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractKey(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const header = req.headers['x-api-key'];
  if (header) return String(header).trim();
  if (req.query && req.query.api_key) return String(req.query.api_key).trim();
  return null;
}

function normalizeOrigin(value) {
  return String(value || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Public publishable-key authentication for the embed API.
 *
 * On success attaches:
 *   - req.publicAgency  : the resolved Agency instance (active only)
 *   - req.apiKey        : the AgencyApiKey record
 *   - req.apiKeyScopes  : string[] of granted scopes
 *
 * This middleware NEVER touches the JWT/agent auth path, so there is no route
 * from a publishable key into authenticated agent/admin actions.
 *
 * @param {object} [opts] - { scope: required scope string }
 */
function authenticatePublicKey(opts = {}) {
  const requiredScope = opts.scope || null;

  return async function publicKeyGuard(req, res, next) {
    try {
      const rawKey = extractKey(req);
      if (!rawKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required. Send it as Authorization: Bearer <key> or X-Api-Key.',
          code: 'API_KEY_MISSING',
        });
      }

      const record = await apiKeyService.verifyKey(rawKey);
      if (!record) {
        // Single generic message — never reveal whether the key existed.
        return res.status(401).json({
          success: false,
          error: 'Invalid or revoked API key.',
          code: 'API_KEY_INVALID',
        });
      }

      // Scope check (least privilege).
      if (requiredScope && !(record.scopes || []).includes(requiredScope)) {
        return res.status(403).json({
          success: false,
          error: `This API key is missing the required scope: ${requiredScope}.`,
          code: 'API_KEY_SCOPE_FORBIDDEN',
        });
      }

      // Optional per-key origin allowlist. Only enforced for browser requests
      // (those that send an Origin header); server-to-server calls have none.
      const allowed = record.allowedOrigins || [];
      const origin = req.headers.origin;
      if (allowed.length && origin && !allowed.includes(normalizeOrigin(origin))) {
        return res.status(403).json({
          success: false,
          error: 'This origin is not allowed for this API key.',
          code: 'API_KEY_ORIGIN_FORBIDDEN',
        });
      }

      // Resolve the owning agency. Must still be active.
      const agency = await Agency.findByPk(record.agencyId);
      if (!agency || !agency.isActive) {
        return res.status(403).json({
          success: false,
          error: 'This account is inactive.',
          code: 'AGENCY_INACTIVE',
        });
      }

      req.publicAgency = agency;
      req.apiKey = record;
      req.apiKeyScopes = record.scopes || [];

      // Fire-and-forget metering; never blocks the response.
      apiKeyService.touchUsage(record, req.ip);

      next();
    } catch (err) {
      console.error('[authenticatePublicKey] error:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed.',
        code: 'API_KEY_INTERNAL_ERROR',
      });
    }
  };
}

module.exports = authenticatePublicKey;
