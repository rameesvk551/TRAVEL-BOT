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

// `type` used to be accepted and then ignored by the service, which always sent
// text — so asking for an IMAGE returned 201 and silently delivered a caption
// with no picture. The service now honors it, and this schema makes the media
// contract explicit: TEXT needs content; IMAGE/DOCUMENT need a mediaUrl (content
// is then the optional caption).
const sendMessageSchema = z
  .object({
    customerId: z.string().uuid(),
    content: z.string().optional(),
    type: z.enum(['TEXT', 'IMAGE', 'DOCUMENT']).optional(),
    mediaUrl: z.string().url().optional(),
    filename: z.string().min(1).max(200).optional(),
  })
  .superRefine((val, ctx) => {
    const type = val.type || 'TEXT';

    if (type === 'TEXT') {
      if (!val.content || !val.content.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['content'],
          message: 'Message content required',
        });
      }
      return;
    }

    if (!val.mediaUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mediaUrl'],
        message: `mediaUrl is required when type is ${type}`,
      });
    }
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
 * GET /api/messages/:messageId/media - Stream inbound media (photo/audio/video/doc)
 */
router.get('/:messageId/media', authenticate, requirePermission(PERMISSIONS.MESSAGES_VIEW), messageController.media);

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
