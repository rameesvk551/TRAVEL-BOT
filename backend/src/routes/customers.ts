const { Router } = require('express');
const { z } = require('zod');
const customerController = require('../controllers/customerController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
  },
});

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

/**
 * GET /api/customers/:id/service-report - Standalone services for a customer
 */
router.get('/:id/service-report', authenticate, requirePermission(PERMISSIONS.BOOKINGS_VIEW), customerController.serviceReport);

/**
 * GET /api/customers/:id/activity - Unified lead/enquiry activity timeline
 */
router.get('/:id/activity', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), customerController.activity);

/**
 * POST /api/customers/:id/documents - Upload a document for a customer
 */
router.post(
  '/:id/documents',
  authenticate,
  requirePermission(PERMISSIONS.LEADS_MANAGE),
  upload.single('document'),
  customerController.uploadDocument
);

module.exports = router;
