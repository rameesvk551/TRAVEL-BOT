const platformAdminService = require('../services/platformAdminService');

async function overview(_req, res, next) {
  try {
    const data = await platformAdminService.getOverview();
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
    const data = await platformAdminService.getAgencyDetail(req.params.id, req.platformAdmin.id, req);
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
  health,
  activity,
};
