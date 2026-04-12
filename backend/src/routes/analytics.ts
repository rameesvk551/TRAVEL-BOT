// FILE: /backend/src/routes/analytics.js

const { Router } = require('express');
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/authenticate');

const router = Router();

/**
 * GET /api/analytics/summary - Dashboard analytics summary
 */
router.get('/summary', authenticate, analyticsController.summary);

module.exports = router;
