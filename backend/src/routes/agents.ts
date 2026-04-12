// FILE: /backend/src/routes/agents.js

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const agentController = require('../controllers/agentController');

const router = Router();

const createAgentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  isOnline: z.boolean().optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
});

/**
 * GET /api/agents - List agents for current agency
 */
router.get('/', authenticate, agentController.list);

/**
 * POST /api/agents - Add a new agent (ADMIN only)
 */
router.post('/', authenticate, requireRole('ADMIN'), validateBody(createAgentSchema), agentController.create);

/**
 * PATCH /api/agents/:id - Update an agent
 */
router.patch('/:id', authenticate, agentController.update);

/**
 * PATCH /api/agents/me/status - Toggle online/offline
 */
router.patch('/me/status', authenticate, agentController.updateStatus);

module.exports = router;
