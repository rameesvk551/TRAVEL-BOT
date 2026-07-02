const { Router } = require('express');
const { z } = require('zod');
const itemFinanceController = require('../controllers/itemFinanceController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const itemTypeParam = z.enum(['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE']);

const vendorCostSchema = z.object({
  vendorId: z.string().uuid(),
  serviceLabel: z.string().trim().min(1).max(120),
  amount: z.number().int().min(1, 'Cost must be positive (in paise)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function validateItemTypeParam(req, _res, next) {
  const parsed = itemTypeParam.safeParse(String(req.params.itemType || '').toUpperCase());
  if (!parsed.success) {
    return next(Object.assign(new Error('Unsupported item type'), { statusCode: 400, code: 'UNSUPPORTED_ITEM_TYPE' }));
  }
  req.params.itemType = parsed.data;
  return next();
}

router.use(authenticate);

router.get('/:itemType/:id', requirePermission(PERMISSIONS.BOOKINGS_VIEW), validateItemTypeParam, itemFinanceController.report);

router.post(
  '/:itemType/:id/vendor-costs',
  requirePermission(PERMISSIONS.BOOKINGS_MANAGE),
  validateItemTypeParam,
  validateBody(vendorCostSchema),
  itemFinanceController.createVendorCost
);

router.patch(
  '/:itemType/:id/vendor-costs/:costId',
  requirePermission(PERMISSIONS.BOOKINGS_MANAGE),
  validateItemTypeParam,
  validateBody(vendorCostSchema.partial()),
  itemFinanceController.updateVendorCost
);

router.delete(
  '/:itemType/:id/vendor-costs/:costId',
  requirePermission(PERMISSIONS.BOOKINGS_MANAGE),
  validateItemTypeParam,
  itemFinanceController.deleteVendorCost
);

module.exports = router;
