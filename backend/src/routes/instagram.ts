// Instagram proxy routes — forward Instagram API calls from Travel Bot → Marketing OS
// These routes let the Travel Bot frontend access the Marketing OS Instagram endpoints
// via the Travel Bot backend, handling tenant token resolution automatically.

const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');
const { Agency } = require('../models');
const marketingOsPartnerService = require('../services/marketingOsPartnerService');
const instagramAutomationService = require('../services/instagramAutomationService');

const router = Router();

// Middleware: resolve the Marketing OS tenant token from the agency
async function resolveIgTenantToken(req, res, next) {
  try {
    const agency = await Agency.findByPk(req.agency.id);
    if (!agency?.marketingOsTenantId) {
      return res.status(400).json({ success: false, error: 'No Instagram provider connected. Go to Settings first.' });
    }

    const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
    req.igTenantToken = tenantToken;
    req.igTenantId = agency.marketingOsTenantId;
    next();
  } catch (err) {
    next(err);
  }
}

function getTenantClient(tenantToken) {
  const axios = require('axios');
  const PARTNER_API_BASE_URL = process.env.MARKETING_OS_PARTNER_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
  const PARTNER_API_KEY = process.env.MARKETING_OS_PARTNER_API_KEY || '';

  return axios.create({
    baseURL: PARTNER_API_BASE_URL,
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PARTNER_API_KEY,
      Authorization: `Bearer ${tenantToken}`,
    },
  });
}

// ── Inbox: DMs ──

router.get(
  '/messages',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get('/instagram/inbox/messages', {
        params: { accountId: req.query.accountId },
      });
      res.json({ success: true, data: response.data?.data || [] });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/messages/:accountId/send',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.post(`/instagram/inbox/messages/${req.params.accountId}/send`, req.body);
      res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
      next(err);
    }
  }
);

// ── Inbox: Comments ──

router.get(
  '/comments',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get('/instagram/inbox/comments', {
        params: { accountId: req.query.accountId },
      });
      res.json({ success: true, data: response.data?.data || [] });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/comments/:accountId/:commentId/reply',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.post(
        `/instagram/inbox/comments/${req.params.accountId}/${req.params.commentId}/reply`,
        req.body
      );
      res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/comments/:accountId/:commentId',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      await client.delete(`/instagram/inbox/comments/${req.params.accountId}/${req.params.commentId}`);
      res.json({ success: true, message: 'Comment deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/comments/:accountId/:commentId/private-reply',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  async (req, res, next) => {
    try {
      const response = await instagramAutomationService.sendPrivateReplyForComment(req.agency.id, {
        accountId: req.params.accountId,
        commentId: req.params.commentId,
        text: req.body.text,
        quickReplies: req.body.quickReplies || [],
      });
      res.json({ success: true, data: response?.data || response });
    } catch (err) {
      next(err);
    }
  }
);

// Comment-to-DM automation rules owned by TravelBot.

router.get(
  '/automations',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  async (req, res, next) => {
    try {
      const data = await instagramAutomationService.listAutomations(req.agency.id, {
        accountId: req.query.accountId,
        mediaId: req.query.mediaId,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/automations',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  async (req, res, next) => {
    try {
      const data = await instagramAutomationService.createAutomation(req.agency.id, req.body);
      res.status(201).json({ success: true, data, message: 'Instagram automation created' });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/automations/:automationId',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  async (req, res, next) => {
    try {
      const data = await instagramAutomationService.updateAutomation(req.agency.id, req.params.automationId, req.body);
      res.json({ success: true, data, message: 'Instagram automation updated' });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/automations/:automationId',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  async (req, res, next) => {
    try {
      const data = await instagramAutomationService.deleteAutomation(req.agency.id, req.params.automationId);
      res.json({ success: true, data, message: 'Instagram automation deleted' });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/automations/:automationId/logs',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  async (req, res, next) => {
    try {
      const data = await instagramAutomationService.listLogs(req.agency.id, {
        automationId: req.params.automationId,
        accountId: req.query.accountId,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ── Content Publishing ──

router.post(
  '/publish',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.post('/instagram/publish', req.body);
      res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/publish/carousel',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.post('/instagram/publish/carousel', req.body);
      res.json({ success: true, data: response.data?.data || response.data });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/media',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get('/instagram/media', { params: req.query });
      res.json({ success: true, data: response.data?.data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// ── Analytics ──

router.get(
  '/analytics/:accountId',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get(`/instagram/analytics/${req.params.accountId}`, {
        params: { period: req.query.period || 'week' },
      });
      res.json({ success: true, data: response.data?.data || {} });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/analytics/:accountId/media',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get(`/instagram/analytics/${req.params.accountId}/media`, {
        params: { limit: req.query.limit || 12 },
      });
      res.json({ success: true, data: response.data?.data || [] });
    } catch (err) {
      next(err);
    }
  }
);

// ── Profile ──

router.get(
  '/profile/:accountId',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_VIEW),
  resolveIgTenantToken,
  async (req, res, next) => {
    try {
      const client = getTenantClient(req.igTenantToken);
      const response = await client.get(`/instagram/profile/${req.params.accountId}`);
      res.json({ success: true, data: response.data?.data || {} });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
