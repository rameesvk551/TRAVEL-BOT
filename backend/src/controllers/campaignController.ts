// FILE: /backend/src/controllers/campaignController.ts

const campaignService = require('../services/campaignService');

exports.list = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;
    const result = await campaignService.listCampaigns(req.user.agencyId, { ...req.query, page, pageSize });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id, req.user.agencyId);
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const result = await campaignService.getCampaignStats(req.params.id, req.user.agencyId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const campaign = await campaignService.createCampaign(req.user.agencyId, req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.user.agencyId, req.body);
    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

exports.send = async (req, res, next) => {
  try {
    const campaign = await campaignService.sendCampaign(req.params.id, req.user.agencyId);
    res.json({ success: true, data: campaign });
  } catch (err) {
    // Return friendly message if audience is empty, etc.
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.cancel = async (req, res, next) => {
  try {
    const campaign = await campaignService.cancelCampaign(req.params.id, req.user.agencyId);
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.delete = async (req, res, next) => {
  try {
    const result = await campaignService.deleteCampaign(req.params.id, req.user.agencyId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const campaign = await campaignService.duplicateCampaign(req.params.id, req.user.agencyId);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

exports.previewAudience = async (req, res, next) => {
  try {
    const count = await campaignService.previewAudienceCount(req.user.agencyId, req.body);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
};

exports.analytics = async (req, res, next) => {
  try {
    const result = await campaignService.getCampaignAnalytics(req.user.agencyId, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Import contacts from a JSON array of { name, phone } objects.
 * Returns the created/found customer IDs to use as manualCustomerIds.
 */
exports.importContacts = async (req, res, next) => {
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ success: false, error: 'Provide a non-empty contacts array.' });
    }
    if (contacts.length > 10000) {
      return res.status(400).json({ success: false, error: 'Maximum 10,000 contacts per import.' });
    }
    const customerIds = await campaignService.importContacts(req.user.agencyId, contacts);
    res.json({ success: true, data: { customerIds, count: customerIds.length } });
  } catch (err) {
    next(err);
  }
};
