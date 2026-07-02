// FILE: /backend/src/routes/apiKeys.js
// DEPS: express, zod

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const apiKeyController = require('../controllers/apiKeyController');

const router = Router();

const createSchema = z.object({
  label: z.string().trim().max(120).optional(),
  scopes: z.array(z.enum(['catalog:read', 'leads:write'])).optional(),
  allowedOrigins: z.array(z.string().trim().max(255)).max(20).optional(),
});

// All key management is ADMIN-only and scoped to the caller's own agency.
router.get('/', authenticate, requireRole('ADMIN'), apiKeyController.list);
router.post('/', authenticate, requireRole('ADMIN'), validateBody(createSchema), apiKeyController.create);
router.delete('/:id', authenticate, requireRole('ADMIN'), apiKeyController.revoke);

module.exports = router;
