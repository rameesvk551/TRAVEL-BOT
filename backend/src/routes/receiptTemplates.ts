// FILE: /backend/src/routes/receiptTemplates.ts
const express = require('express');
const router = express.Router();
const controller = require('../controllers/receiptTemplateController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authenticate, requirePermission(PERMISSIONS.AGENCY_MANAGE));

router.get('/presets', controller.listPresets);
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', requireRole('ADMIN'), controller.create);
router.put('/:id', requireRole('ADMIN'), controller.update);
router.delete('/:id', requireRole('ADMIN'), controller.remove);

module.exports = router;
