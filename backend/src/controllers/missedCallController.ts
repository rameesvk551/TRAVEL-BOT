const missedCallService = require('../services/missedCallService');

async function list(req, res, next) {
  try {
    const result = await missedCallService.listWhatsAppCalls(req.agency.id, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
