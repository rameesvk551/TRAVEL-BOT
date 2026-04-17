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

exports.previewAudience = async (req, res, next) => {
  try {
    const count = await campaignService.previewAudienceCount(req.user.agencyId, req.body);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
};
