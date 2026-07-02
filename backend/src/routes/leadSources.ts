const express = require('express');
const router = express.Router();
const leadSourceController = require('../controllers/leadSourceController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.AGENCY_VIEW), leadSourceController.listLeadSources);
router.post('/', requirePermission(PERMISSIONS.AGENCY_MANAGE), leadSourceController.createLeadSource);
router.put('/:id', requirePermission(PERMISSIONS.AGENCY_MANAGE), leadSourceController.updateLeadSource);
router.delete('/:id', requirePermission(PERMISSIONS.AGENCY_MANAGE), leadSourceController.deleteLeadSource);

module.exports = router;
