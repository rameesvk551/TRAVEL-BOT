// FILE: /backend/src/routes/messages.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const messageController = require('../controllers/messageController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');

const router = Router();

const sendMessageSchema = z.object({
  customerId: z.string().uuid(),
  content: z.string().min(1, 'Message content required'),
  type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT']).optional(),
});

/**
 * GET /api/messages - List messages for a customer
 */
router.get('/', authenticate, messageController.list);

/**
 * GET /api/messages/live - Live message feed for dashboard
 */
router.get('/live', authenticate, messageController.live);

/**
 * POST /api/messages/send - Send a message from agent to customer
 */
router.post('/send', authenticate, validateBody(sendMessageSchema), messageController.send);

/**
 * PATCH /api/sessions/:customerId/takeover - Agent takes over from bot
 */
router.patch('/sessions/:customerId/takeover', authenticate, messageController.takeover);

module.exports = router;
