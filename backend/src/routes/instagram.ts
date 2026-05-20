// Instagram proxy routes — forward Instagram API calls from Travel Bot → Marketing OS
// These routes let the Travel Bot frontend access the Marketing OS Instagram endpoints
// via the Travel Bot backend, handling tenant token resolution automatically.

const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');
const { Op } = require('sequelize');
const { Agency, Customer, Lead } = require('../models');
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

function parseInstagramLeadNotes(notes = '') {
  const text = String(notes || '');
  const pick = (label) => {
    const match = text.match(new RegExp(`${label}:\\s*([^\\n\\r]+)`, 'i'));
    return match ? match[1].trim() : '';
  };

  return {
    phone: pick('Phone'),
    budget: pick('Budget'),
    travelDates: pick('Dates'),
    travellers: pick('Travellers'),
    intent: pick('Intent'),
  };
}

function formatBudget(value) {
  if (value == null || value === '') return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const rupees = amount >= 1000 ? amount / 100 : amount;
  return `Rs ${Math.round(rupees).toLocaleString('en-IN')}`;
}

function latestInsightValue(metric) {
  const values = Array.isArray(metric?.values) ? metric.values : [];
  const latest = values[values.length - 1];
  const raw = latest?.value;
  if (raw && typeof raw === 'object') {
    const firstNumber = Object.values(raw).find((value) => typeof value === 'number');
    return firstNumber ?? 0;
  }
  return typeof raw === 'number' ? raw : 0;
}

function normalizeInsightsPayload(payload, profile = {}, instagramLeads = 0) {
  const source = payload?.data ?? payload;
  const summary = Array.isArray(source)
    ? source.reduce((acc, metric) => {
        const key = String(metric?.name || '').replace(/_([a-z])/g, (_, char) => char.toUpperCase());
        if (key) acc[key] = latestInsightValue(metric);
        return acc;
      }, {})
    : { ...(source || {}) };

  return {
    ...summary,
    followersCount: summary.followersCount ?? profile.followersCount ?? profile.followers_count ?? 0,
    followsCount: summary.followsCount ?? profile.followsCount ?? profile.follows_count ?? 0,
    mediaCount: summary.mediaCount ?? profile.mediaCount ?? profile.media_count ?? 0,
    reach: summary.reach ?? summary.accountsReached ?? 0,
    impressions: summary.impressions ?? 0,
    profileViews: summary.profileViews ?? summary.profile_views ?? 0,
    websiteClicks: summary.websiteClicks ?? summary.website_clicks ?? 0,
    leadsCreated: summary.leadsCreated ?? summary.instagramLeads ?? instagramLeads,
    instagramLeads,
  };
}

function normalizeMediaAnalytics(items = []) {
  return items.map((item) => ({
    ...item,
    id: item.id || item.igMediaId,
    caption: item.caption || item.name || '',
    mediaUrl: item.mediaUrl || item.media_url || item.imageUrl || item.thumbnailUrl,
    imageUrl: item.imageUrl || item.mediaUrl || item.media_url || item.thumbnailUrl,
    thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || item.mediaUrl || item.media_url,
    likeCount: item.likeCount ?? item.like_count ?? item.likes ?? 0,
    commentCount: item.commentCount ?? item.commentsCount ?? item.comments_count ?? item.comments ?? 0,
    reach: item.reach ?? 0,
    impressions: item.impressions ?? 0,
    leadsCreated: item.leadsCreated ?? 0,
  }));
}

function getInstagramParticipant(message, accountId) {
  const senderId = String(message?.senderId || '');
  const recipientId = String(message?.recipientId || '');
  if (message?.isEcho || senderId === 'business' || senderId === String(accountId)) return recipientId;
  return senderId || recipientId;
}

function normalizeInstagramMessages(messages = [], accountId) {
  const groups = new Map();

  for (const message of messages) {
    const participantId = getInstagramParticipant(message, accountId);
    if (!participantId || participantId === 'business' || participantId === String(accountId)) continue;

    const existing = groups.get(participantId) || {
      id: participantId,
      senderId: participantId,
      accountId: message.accountId,
      source: 'DM',
      replies: [],
      timestamp: message.timestamp,
      updatedAt: message.updatedAt,
    };

    const reply = {
      ...message,
      id: message.id,
      text: message.text,
      message: message.text,
      content: message.text,
      direction: message.isEcho ? 'OUT' : 'IN',
      from: { id: message.isEcho ? accountId : participantId },
    };

    existing.replies.push(reply);

    const messageTime = new Date(message.timestamp || message.updatedAt || 0).getTime();
    const currentTime = new Date(existing.timestamp || existing.updatedAt || 0).getTime();
    if (!existing.text || messageTime >= currentTime) {
      existing.text = message.text;
      existing.message = message.text;
      existing.content = message.text;
      existing.timestamp = message.timestamp;
      existing.updatedAt = message.updatedAt;
      existing.isEcho = message.isEcho;
    }

    groups.set(participantId, existing);
  }

  return Array.from(groups.values()).map((thread) => ({
    ...thread,
    replies: thread.replies.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)),
  })).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

async function enrichInstagramThreads(agencyId, threads) {
  if (!threads.length) return threads;

  const phoneKeys = threads.map((thread) => `ig_${thread.senderId}`);
  const customers = await Customer.findAll({
    where: {
      agencyId,
      phone: { [Op.in]: phoneKeys },
    },
    include: [{
      model: Lead,
      as: 'leads',
      required: false,
      where: { source: { [Op.in]: ['instagram', 'instagram_dm'] } },
    }],
  });

  const customerByPhone = new Map(customers.map((customer) => [customer.phone, customer]));

  return threads.map((thread) => {
    const customer = customerByPhone.get(`ig_${thread.senderId}`);
    const leads = customer?.leads || customer?.Leads || [];
    const lead = [...leads].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
    const custom = lead?.customTripDetails || {};
    const noteDetails = parseInstagramLeadNotes(lead?.notes);

    return {
      ...thread,
      lead: lead || null,
      customerName: custom.name || customer?.name || thread.customerName,
      name: custom.name || customer?.name || thread.name,
      phone: custom.phone || noteDetails.phone || thread.phone,
      collectedPhone: custom.phone || noteDetails.phone || thread.collectedPhone,
      destination: lead?.destination || custom.destination || custom.location || noteDetails.intent || thread.destination,
      travelDates: lead?.travelDates || custom.travelDates || custom.dates || noteDetails.travelDates || thread.travelDates,
      travellers: lead?.travellers || custom.travellers || noteDetails.travellers || thread.travellers,
      budget: custom.budgetText || noteDetails.budget || formatBudget(lead?.budgetPerPerson) || thread.budget,
      budgetPerPerson: lead?.budgetPerPerson || thread.budgetPerPerson,
      leadStatus: lead?.status || thread.leadStatus,
      source: 'Instagram DM',
    };
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
      const rows = response.data?.data || [];
      const threads = normalizeInstagramMessages(rows, req.query.accountId);
      const enrichedThreads = await enrichInstagramThreads(req.agency.id, threads);
      res.json({ success: true, data: enrichedThreads });
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
      let profile = {};
      try {
        const profileResponse = await client.get(`/instagram/profile/${req.params.accountId}`);
        profile = profileResponse.data?.data || {};
      } catch (profileError) {
        profile = {};
      }
      const instagramLeads = await Lead.count({
        where: {
          agencyId: req.agency.id,
          source: { [Op.in]: ['instagram', 'instagram_dm'] },
        },
      });
      res.json({
        success: true,
        data: normalizeInsightsPayload(response.data?.data || response.data || {}, profile, instagramLeads),
      });
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
      let items = response.data?.data || [];
      if (!items.length) {
        try {
          const mediaResponse = await client.get('/instagram/media', {
            params: { accountId: req.params.accountId, limit: req.query.limit || 12 },
          });
          items = mediaResponse.data?.data || [];
        } catch (mediaError) {
          items = [];
        }
      }
      res.json({ success: true, data: normalizeMediaAnalytics(items) });
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
