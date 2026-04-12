// FILE: /backend/src/routes/agencies.js

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const agencyController = require('../controllers/agencyController');

const router = Router();

const updateAgencySchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PRO']).optional(),
});

const marketingOsCallbackSchema = z.object({
  agencyId: z.string().uuid(),
  status: z.enum(['NOT_CONNECTED', 'PENDING', 'CONNECTED', 'FAILED']),
  whatsappNumber: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
  businessAccountId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  channelId: z.string().optional(),
  errorMessage: z.string().optional(),
});

/**
 * GET /api/agencies/me - Get current agency details
 */
router.get('/me', authenticate, agencyController.me);

/**
 * GET /api/agencies/me/whatsapp-connection - Get partner onboarding status
 */
router.get('/me/whatsapp-connection', authenticate, agencyController.getWhatsAppConnection);

/**
 * POST /api/agencies/me/whatsapp-connection/connect - Create partner connect session
 */
router.post('/me/whatsapp-connection/connect', authenticate, requireRole('ADMIN'), agencyController.createWhatsAppConnectSession);

/**
 * PATCH /api/agencies/me - Update agency settings (ADMIN only)
 */
router.patch('/me', authenticate, requireRole('ADMIN'), validateBody(updateAgencySchema), agencyController.updateMe);

/**
 * POST /api/agencies/whatsapp/marketing-os/callback - Provider callback after onboarding
 */
router.post(
  '/whatsapp/marketing-os/callback',
  validateBody(marketingOsCallbackSchema),
  agencyController.handleMarketingOsCallback
);

module.exports = router;
