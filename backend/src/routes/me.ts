// FILE: /backend/src/routes/me.js
//
// Session-scoped "me" endpoints for the current authenticated agent. Kept
// separate from /api/auth so the mobile app has a stable /api/me namespace.
// Never module-gated — the manifest itself decides what the tenant can see.

const { Router } = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');

const router = Router();

/**
 * GET /api/me/app-manifest
 * Per-tenant navigation manifest for the React Native mobile shell (tabs,
 * modules, labels, branding, home widgets). Driven by agency.industry +
 * sidebarPreferences + agent.role.
 */
router.get('/app-manifest', authenticate, authController.appManifest);

module.exports = router;
