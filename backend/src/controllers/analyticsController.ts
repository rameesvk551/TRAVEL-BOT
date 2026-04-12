const analyticsService = require('../services/analyticsService');

async function summary(req, res, next) {
  try {
    const data = await analyticsService.getSummary(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  summary,
};