// FILE: /backend/src/routes/invoiceTemplates.ts
const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const invoiceTemplateController = require('../controllers/invoiceTemplateController');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  htmlContent: z.string().optional(),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  htmlContent: z.string().optional(),
  config: z.any().optional(),
  isDefault: z.boolean().optional(),
});

router.use(authenticate, requirePermission(PERMISSIONS.AGENCY_MANAGE));

router.get('/presets', invoiceTemplateController.listPresets);
router.get('/', invoiceTemplateController.list);
router.get('/:id', invoiceTemplateController.getById);
router.post('/', requireRole('ADMIN'), validateBody(createSchema), invoiceTemplateController.create);
router.put('/:id', requireRole('ADMIN'), validateBody(updateSchema), invoiceTemplateController.update);
router.delete('/:id', requireRole('ADMIN'), invoiceTemplateController.remove);

module.exports = router;
