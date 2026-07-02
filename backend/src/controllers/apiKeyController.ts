// FILE: /backend/src/controllers/apiKeyController.js
// DEPS: -

const apiKeyService = require('../services/apiKeyService');

/**
 * GET /api/api-keys
 * Lists the calling agency's publishable keys (never the raw value).
 */
async function list(req, res, next) {
  try {
    const keys = await apiKeyService.listKeys(req.agency.id);
    res.json({ success: true, data: keys });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/api-keys
 * Mints a new key. The raw key is returned ONCE in this response and never again.
 */
async function create(req, res, next) {
  try {
    const { record, rawKey } = await apiKeyService.createKey(req.agency.id, {
      label: req.body.label,
      scopes: req.body.scopes,
      allowedOrigins: req.body.allowedOrigins,
      createdByAgentId: req.agent ? req.agent.id : null,
    });
    res.status(201).json({
      success: true,
      data: {
        ...apiKeyService.publicKeyView(record),
        key: rawKey, // shown exactly once
      },
      message: 'Store this key now — it will not be shown again.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/api-keys/:id
 * Revokes a key. Scoped to the calling agency.
 */
async function revoke(req, res, next) {
  try {
    const data = await apiKeyService.revokeKey(req.params.id, req.agency.id);
    res.json({ success: true, data, message: 'API key revoked' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, revoke };
