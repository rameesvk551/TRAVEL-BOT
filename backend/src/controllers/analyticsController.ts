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

async function callingReport(req, res, next) {
  try {
    const { from, to, agentId, leadId } = req.query;
    const data = await analyticsService.getCallingReport(req.agency.id, from, to, {
      requester: req.agent,
      agentId: agentId && agentId !== 'all' ? agentId : null,
      leadId: leadId && leadId !== 'all' ? leadId : null,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function crmReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getCrmReport(req.agency.id, from, to);
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

async function leadsByAdReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getLeadsByAd(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function bookingReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getBookingReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function customerLtvReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getCustomerLtvReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function cacReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getCacReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function operationalReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getOperationalReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function campaignRoiReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getCampaignRoiReport(req.agency.id, from, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function growthReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const data = await analyticsService.getGrowthReport(req.agency.id, from, to);
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
  callingReport,
  crmReport,
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
  leadsByAdReport,
  bookingReport,
  customerLtvReport,
  cacReport,
  operationalReport,
  campaignRoiReport,
  growthReport,
  exportReport,
};