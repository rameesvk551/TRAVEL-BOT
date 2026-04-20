// FILE: /backend/src/controllers/templateController.ts

const templateService = require('../services/templateService');

exports.listPrebuilt = async (req, res, next) => {
  try {
    const templates = await templateService.listPrebuiltTemplates(req.query);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

exports.listAgency = async (req, res, next) => {
  try {
    const templates = await templateService.listAgencyTemplates(req.user.agencyId, req.query);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const template = await templateService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    // Simple permission check
    if (template.agencyId && template.agencyId !== req.user.agencyId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const template = await templateService.createTemplate(req.user.agencyId, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.usePrebuilt = async (req, res, next) => {
  try {
    const template = await templateService.usePrebuiltTemplate(req.user.agencyId, req.params.id, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const template = await templateService.updateTemplate(req.params.id, req.user.agencyId, req.body);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.duplicate = async (req, res, next) => {
  try {
    const template = await templateService.duplicateTemplate(req.params.id, req.user.agencyId);
    res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await templateService.deleteTemplate(req.params.id, req.user.agencyId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const template = await templateService.submitForApproval(req.params.id, req.user.agencyId);
    res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
};

exports.sync = async (req, res, next) => {
  try {
    const result = await templateService.syncTemplates(req.user.agencyId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
