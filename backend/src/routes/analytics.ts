// FILE: /backend/src/routes/analytics.js

const { Router } = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

/**
 * GET /api/analytics/summary - Dashboard analytics summary
 */
router.get('/summary', authenticate, requirePermission(PERMISSIONS.ANALYTICS_VIEW), analyticsController.summary);

module.exports = router;
