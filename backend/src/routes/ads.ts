const { Router } = require('express');
const { z } = require('zod');
const adsController = require('../controllers/adsController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const backfillSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).passthrough();

const connectSchema = z.object({
  returnUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
}).passthrough();

router.get('/webhook/leadgen', adsController.verifyLeadgenWebhook);
router.post('/webhook/leadgen', adsController.handleLeadgenWebhook);

router.post(
  '/connect',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(connectSchema),
  adsController.createConnectSession
);
router.get('/accounts', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), adsController.listAccounts);
router.get('/campaigns', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), adsController.listCampaigns);
router.get('/campaigns/:campaignId', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), adsController.getCampaign);
router.get('/campaigns/:campaignId/insights', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), adsController.getCampaignInsights);
router.get('/forms', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), adsController.listForms);
router.post(
  '/forms/:formId/backfill',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(backfillSchema),
  adsController.backfillForm
);

module.exports = router;
