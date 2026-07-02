// FILE: /backend/src/routes/analytics.ts

const { Router } = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();
const guard = [authenticate, requirePermission(PERMISSIONS.ANALYTICS_VIEW)];

/**
 * GET /api/analytics/summary - Dashboard summary (original)
 */
router.get('/summary', ...guard, analyticsController.summary);

/**
 * GET /api/analytics/crm - CRM dashboard (cards, funnel, activity, suggestions)
 */
router.get('/crm', ...guard, analyticsController.crmReport);

/**
 * GET /api/analytics/calls - Calling report (KPIs, trend, staff/lead rollups,
 * recommendations). Accepts ?from&to&agentId&leadId. Non-admins are scoped to
 * their own calls regardless of agentId.
 */
router.get('/calls', ...guard, analyticsController.callingReport);

/**
 * GET /api/analytics/sales - Sales / Revenue report
 */
router.get('/sales', ...guard, analyticsController.salesReport);

/**
 * GET /api/analytics/lead-funnel - Lead & Conversion funnel
 */
router.get('/lead-funnel', ...guard, analyticsController.leadFunnelReport);

/**
 * GET /api/analytics/agent-performance - Agent performance
 */
router.get('/agent-performance', ...guard, analyticsController.agentPerformanceReport);

/**
 * GET /api/analytics/packages - Package & Destination report
 */
router.get('/packages', ...guard, analyticsController.packageReport);

/**
 * GET /api/analytics/lost-leads - Lost leads analysis
 */
router.get('/lost-leads', ...guard, analyticsController.lostLeadsReport);

/**
 * GET /api/analytics/response - Response & follow-up report
 */
router.get('/response', ...guard, analyticsController.responseReport);

/**
 * GET /api/analytics/reviews - Customer review report
 */
router.get('/reviews', ...guard, analyticsController.reviewReport);

/**
 * GET /api/analytics/seasonal - Seasonal / trend report
 */
router.get('/seasonal', ...guard, analyticsController.seasonalReport);

/**
 * GET /api/analytics/profit - Profit estimation report
 */
router.get('/profit', ...guard, analyticsController.profitReport);

/**
 * GET /api/analytics/sources - Lead source attribution
 */
router.get('/sources', ...guard, analyticsController.sourceReport);

/**
 * GET /api/analytics/leads-by-ad - Click-to-WhatsApp ad attribution breakdown
 */
router.get('/leads-by-ad', ...guard, analyticsController.leadsByAdReport);

/**
 * GET /api/analytics/bookings - Booking report
 */
router.get('/bookings', ...guard, analyticsController.bookingReport);

/**
 * GET /api/analytics/export?type=sales&from=&to= - CSV export
 */
router.get('/export', ...guard, analyticsController.exportReport);

/**
 * GET /api/analytics/customer-ltv - Customer Lifetime Value report
 */
router.get('/customer-ltv', ...guard, analyticsController.customerLtvReport);

/**
 * GET /api/analytics/cac - Customer Acquisition Cost report
 */
router.get('/cac', ...guard, analyticsController.cacReport);

/**
 * GET /api/analytics/operational - Operational Excellence report
 */
router.get('/operational', ...guard, analyticsController.operationalReport);

/**
 * GET /api/analytics/campaign-roi - Campaign ROI report
 */
router.get('/campaign-roi', ...guard, analyticsController.campaignRoiReport);

/**
 * GET /api/analytics/growth - Growth & Pipeline Velocity report
 */
router.get('/growth', ...guard, analyticsController.growthReport);

module.exports = router;
