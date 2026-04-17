// FILE: /backend/src/routes/bookings.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const bookingController = require('../controllers/bookingController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const createBookingSchema = z.object({
  leadId: z.string().uuid(),
  packageId: z.string().uuid().optional(),
  totalAmount: z.number().int().min(1, 'Total amount must be positive'),
  advanceAmount: z.number().int().min(0).optional(),
  travelDate: z.string().datetime().or(z.string().min(1)),
  returnDate: z.string().datetime().or(z.string().min(1)),
  travellers: z.number().int().min(1).max(50),
  notes: z.string().optional(),
});

const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
  travelDate: z.string().optional(),
  returnDate: z.string().optional(),
});

/**
 * GET /api/bookings - List bookings with filters
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.BOOKINGS_VIEW), bookingController.list);

/**
 * GET /api/bookings/:id - Get booking by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.BOOKINGS_VIEW), bookingController.getById);

/**
 * POST /api/bookings - Create a booking from a lead
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.BOOKINGS_MANAGE), validateBody(createBookingSchema), bookingController.create);

/**
 * PATCH /api/bookings/:id - Update a booking
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.BOOKINGS_MANAGE), validateBody(updateBookingSchema), bookingController.update);

/**
 * GET /api/bookings/:id/timeline - Get booking event timeline
 */
router.get('/:id/timeline', authenticate, requirePermission(PERMISSIONS.BOOKINGS_VIEW), bookingController.timeline);

module.exports = router;
