const missedCallService = require('../services/missedCallService');

async function list(req, res, next) {
  try {
    const result = await missedCallService.listWhatsAppCalls(req.agency.id, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function enableCalling(req, res, next) {
  try {
    const data = await missedCallService.enableCallingForAgency(req.agency.id);
    res.json({ success: true, data, message: 'WhatsApp calling enabled' });
  } catch (err) {
    next(err);
  }
}

async function callingStatus(req, res, next) {
  try {
    const data = await missedCallService.getCallingStatusForAgency(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, enableCalling, callingStatus };
