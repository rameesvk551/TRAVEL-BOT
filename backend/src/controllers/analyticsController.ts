// FILE: /backend/src/controllers/analyticsController.ts

const analyticsService = require('../services/analyticsService');

async function summary(req, res, next) {
  try {
    const data = await analyticsService.getSummary(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function salesReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getSalesReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function leadFunnelReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getLeadFunnelReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function agentPerformanceReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getAgentPerformanceReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function packageReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getPackageReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function lostLeadsReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getLostLeadsReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function responseReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getResponseReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function reviewReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getReviewReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function seasonalReport(req, res, next) {
  try {
    const data = await analyticsService.getSeasonalReport(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function profitReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getProfitReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function sourceReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getSourceReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const { type, from, to } = req.query;
    if (!type) return res.status(400).json({ success: false, error: 'Missing report type' });

    const csv = await analyticsService.exportReport(req.agency.id, type, from, to);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  summary,
  salesReport,
  leadFunnelReport,
  agentPerformanceReport,
  packageReport,
  lostLeadsReport,
  responseReport,
  reviewReport,
  seasonalReport,
  profitReport,
  sourceReport,
  exportReport,
};