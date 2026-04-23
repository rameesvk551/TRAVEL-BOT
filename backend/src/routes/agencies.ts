// FILE: /backend/src/routes/agencies.js

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const agencyController = require('../controllers/agencyController');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const updateAgencySchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  googleReviewLink: z.string().optional(),
  autoReviewCollectionEnabled: z.boolean().optional(),
  autoReviewDelayDays: z.number().int().min(0).max(30).optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PRO']).optional(),
  whatsappTripFlowId: z.string().optional(),
  whatsappTripFlowName: z.string().optional(),
  whatsappTripFlowStatus: z.string().optional(),
  whatsappTripFlowError: z.string().nullable().optional(),
  whatsappCatalogId: z.string().optional(),
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

const marketingOsCompleteSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  sessionToken: z.string().min(1, 'Session token is required'),
});

/**
 * GET /api/agencies/me - Get current agency details
 */
router.get('/me', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.me);

/**
 * GET /api/agencies/me/whatsapp-connection - Get partner onboarding status
 */
router.get('/me/whatsapp-connection', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getWhatsAppConnection);

/**
 * POST /api/agencies/me/whatsapp-connection/connect - Create partner connect session
 */
router.post('/me/whatsapp-connection/connect', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), agencyController.createWhatsAppConnectSession);

/**
 * POST /api/agencies/me/whatsapp-connection/complete - Complete provider embedded signup
 */
router.post(
  '/me/whatsapp-connection/complete',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(marketingOsCompleteSchema),
  agencyController.completeWhatsAppConnectSession
);

/**
 * GET /api/agencies/me/instagram-connection - Get Instagram connection status
 */
router.get('/me/instagram-connection', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getInstagramConnection);

/**
 * POST /api/agencies/me/instagram-connection/connect - Connect Instagram account
 */
router.post(
  '/me/instagram-connection/connect',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.connectInstagram
);

/**
 * DELETE /api/agencies/me/instagram-connection/:accountId - Disconnect Instagram account
 */
router.delete(
  '/me/instagram-connection/:accountId',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.disconnectInstagram
);

/**
 * PATCH /api/agencies/me - Update agency settings (ADMIN only)
 */
router.patch('/me', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), validateBody(updateAgencySchema), agencyController.updateMe);

/**
 * POST /api/agencies/whatsapp/marketing-os/callback - Provider callback after onboarding
 */
router.post(
  '/whatsapp/marketing-os/callback',
  agencyController.handleMarketingOsCallback
);

module.exports = router;
