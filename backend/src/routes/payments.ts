// FILE: /backend/src/routes/payments.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const paymentController = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const paymentRequestSchema = z.object({
  bookingId: z.string().uuid(),
});

/**
 * POST /api/payments/request - Create and send a payment link
 */
router.post('/request', authenticate, requirePermission(PERMISSIONS.PAYMENTS_MANAGE), validateBody(paymentRequestSchema), paymentController.requestPayment);

/**
 * POST /api/payments/webhook - Razorpay webhook (NO auth, raw body)
 */
router.post('/webhook', paymentController.webhook);

/**
 * GET /api/payments/booking/:bookingId - Get payments for a booking
 */
router.get('/booking/:bookingId', authenticate, requirePermission(PERMISSIONS.PAYMENTS_VIEW), paymentController.byBooking);

/**
 * GET /api/payments - List all payments with filtering and pagination
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.PAYMENTS_VIEW), paymentController.list);

/**
 * GET /api/payments/:id/receipt - download the receipt PDF
 */
router.get('/:id/receipt', authenticate, requirePermission(PERMISSIONS.PAYMENTS_VIEW), paymentController.downloadReceipt);

/**
 * POST /api/payments/:id/receipt/send-whatsapp - send the receipt to the customer
 */
router.post('/:id/receipt/send-whatsapp', authenticate, requirePermission(PERMISSIONS.PAYMENTS_MANAGE), paymentController.sendReceipt);

module.exports = router;
