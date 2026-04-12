const agencyService = require('../services/agencyService');

async function me(req, res, next) {
  try {
    const data = await agencyService.getCurrentAgency(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const data = await agencyService.updateCurrentAgency(req.agency.id, req.body);
    res.json({ success: true, data, message: 'Agency updated' });
  } catch (err) {
    next(err);
  }
}

async function getWhatsAppConnection(req, res, next) {
  try {
    const data = await agencyService.getWhatsAppConnection(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createWhatsAppConnectSession(req, res, next) {
  try {
    const data = await agencyService.createMarketingOsConnectSession(req.agency.id);
    res.json({ success: true, data, message: 'Marketing OS connect session created' });
  } catch (err) {
    next(err);
  }
}

async function handleMarketingOsCallback(req, res, next) {
  try {
    await agencyService.handleMarketingOsCallback(req.headers, req.body);
    res.json({ success: true, message: 'Marketing OS callback processed' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  me,
  updateMe,
  getWhatsAppConnection,
  createWhatsAppConnectSession,
  handleMarketingOsCallback,
};
