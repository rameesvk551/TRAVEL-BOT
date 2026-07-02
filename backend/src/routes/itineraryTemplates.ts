// FILE: /backend/src/routes/itineraryTemplates.ts
const express = require('express');
const router = express.Router();
const controller = require('../controllers/itineraryTemplateController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authenticate);

router.get('/presets', requirePermission(PERMISSIONS.AGENCY_VIEW), controller.listPresets);
router.get('/', requirePermission(PERMISSIONS.AGENCY_VIEW), controller.list);
router.get('/:id', requirePermission(PERMISSIONS.AGENCY_VIEW), controller.getById);
router.post('/', requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), controller.create);
router.put('/:id', requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), controller.update);
router.delete('/:id', requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), controller.remove);

module.exports = router;
