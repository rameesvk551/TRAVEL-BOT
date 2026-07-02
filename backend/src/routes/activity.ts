// FILE: /backend/src/routes/activity.js
// Per-agency activity / audit log report.

const { Router } = require('express');
const activityController = require('../controllers/activityController');
const authenticate = require('../middleware/authenticate');

const router = Router();

// Any authenticated agent can read; the controller scopes the result set by
// role (ADMIN → whole agency, others → own actions only).
router.get('/', authenticate, activityController.list);
router.get('/filters', authenticate, activityController.filters);

module.exports = router;
