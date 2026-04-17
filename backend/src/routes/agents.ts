// FILE: /backend/src/routes/agents.js

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const agentController = require('../controllers/agentController');
const { ALL_PERMISSIONS, PERMISSIONS } = require('../constants/permissions');

const router = Router();

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  isOnline: z.boolean().optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
});

/**
 * GET /api/agents - List agents for current agency
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.USERS_MANAGE), agentController.list);

/**
 * GET /api/agents/permissions - List all available permission keys
 */
router.get('/permissions', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.USERS_MANAGE), agentController.permissionCatalog);

/**
 * POST /api/agents - Add a new agent (ADMIN only)
 */
router.post('/', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.USERS_MANAGE), validateBody(createAgentSchema), agentController.create);

/**
 * PATCH /api/agents/:id - Update an agent
 */
router.patch('/:id', authenticate, validateBody(updateAgentSchema), agentController.update);

/**
 * PATCH /api/agents/me/status - Toggle online/offline
 */
router.patch('/me/status', authenticate, agentController.updateStatus);

module.exports = router;
