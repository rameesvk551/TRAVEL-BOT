// FILE: /backend/src/routes/missedCalls.js

const { Router } = require('express');
const missedCallController = require('../controllers/missedCallController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

// Inbound WhatsApp calls (missed-call log). Written by the marketing-os call
// webhook; read here for the Missed Calls page.
router.get('/', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), missedCallController.list);

module.exports = router;
