const { Router } = require('express');
const { z } = require('zod');
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  notes: z.string().optional(),
});

/**
 * GET /api/customers - List all customers
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), customerController.list);

/**
 * POST /api/customers - Manually create a customer
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), validateBody(createCustomerSchema), customerController.create);

module.exports = router;
