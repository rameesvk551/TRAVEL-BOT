const platformAdminService = require('../services/platformAdminService');

async function overview(_req, res, next) {
  try {
    const data = await platformAdminService.getOverview(_req.query?.range);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function agencies(req, res, next) {
  try {
    const data = await platformAdminService.listAgencies(req.query || {});
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function agencyDetail(req, res, next) {
  try {
    const data = await platformAdminService.getAgencyDetail(req.params.id, req.platformAdmin.id, req, req.query?.range);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateAgencyStatus(req, res, next) {
  try {
    const data = await platformAdminService.updateAgencyStatus(req.params.id, req.body.isActive, req.platformAdmin.id, req);
    res.json({ success: true, data, message: data.isActive ? 'Agency reactivated' : 'Agency suspended' });
  } catch (err) {
    next(err);
  }
}

async function updateAgencyModules(req, res, next) {
  try {
    const data = await platformAdminService.updateAgencyModules(req.params.id, req.body.modules, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Agency modules updated' });
  } catch (err) {
    next(err);
  }
}

async function updateAgencyFeatures(req, res, next) {
  try {
    const data = await platformAdminService.updateAgencyFeatures(req.params.id, req.body.features, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Agency add-ons updated' });
  } catch (err) {
    next(err);
  }
}

async function updateAgencyStaffWhatsAppFeature(req, res, next) {
  try {
    const data = await platformAdminService.updateAgencyStaffWhatsAppFeature(req.params.id, req.body.enabled, req.platformAdmin.id, req);
    res.json({ success: true, data, message: data.staffWhatsAppEnabled ? 'Staff WhatsApp feature enabled' : 'Staff WhatsApp feature disabled' });
  } catch (err) {
    next(err);
  }
}

async function health(_req, res, next) {
  try {
    const data = await platformAdminService.getHealth();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function activity(_req, res, next) {
  try {
    const data = await platformAdminService.getActivity();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  overview,
  agencies,
  agencyDetail,
  updateAgencyStatus,
  updateAgencyModules,
  updateAgencyFeatures,
  updateAgencyStaffWhatsAppFeature,
  health,
  activity,
};
