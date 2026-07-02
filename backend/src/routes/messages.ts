// FILE: /backend/src/routes/messages.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const messageController = require('../controllers/messageController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const sendMessageSchema = z.object({
  customerId: z.string().uuid(),
  content: z.string().min(1, 'Message content required'),
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT']).optional(),
});

const assignSchema = z.object({
  agentId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/messages - List messages for a customer
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.MESSAGES_VIEW), messageController.list);

/**
 * GET /api/messages/live - Live message feed for dashboard
 */
router.get('/live', authenticate, requirePermission(PERMISSIONS.MESSAGES_VIEW), messageController.live);

/**
 * GET /api/messages/threads - WhatsApp conversation list
 */
router.get('/threads', authenticate, requirePermission(PERMISSIONS.MESSAGES_VIEW), messageController.threads);

/**
 * GET /api/messages/agents - Agents a conversation can be assigned to
 */
router.get('/agents', authenticate, requirePermission(PERMISSIONS.MESSAGES_VIEW), messageController.assignableAgents);

/**
 * POST /api/messages/send - Send a message from agent to customer
 */
router.post('/send', authenticate, requirePermission(PERMISSIONS.MESSAGES_SEND), validateBody(sendMessageSchema), messageController.send);

/**
 * PATCH /api/messages/threads/:customerId/assignee - Assign/reassign a conversation
 */
router.patch('/threads/:customerId/assignee', authenticate, requirePermission(PERMISSIONS.MESSAGES_SEND), validateBody(assignSchema), messageController.assign);

/**
 * PATCH /api/sessions/:customerId/takeover - Agent takes over from bot
 */
router.patch('/sessions/:customerId/takeover', authenticate, requirePermission(PERMISSIONS.MESSAGES_SEND), messageController.takeover);

module.exports = router;
