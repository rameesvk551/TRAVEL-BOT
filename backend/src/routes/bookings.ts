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
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  newCustomer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
  }).optional(),
  itemType: z.enum(['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM']).optional(),
  packageId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  cruiseId: z.string().uuid().optional(),
  visaId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  customItemName: z.string().optional(),
  customItemDescription: z.string().optional(),
  paymentMode: z.enum(['FULL', 'ADVANCE', 'NO_PAYMENT']).optional(),
  paymentMethodId: z.string().uuid().optional(),
  // COMMISSION_ONLY: agency earns only its commission; the customer pays the balance at
  // the property. commissionAmount is the agency's revenue (paise); defaults to advance.
  settlementType: z.enum(['FULL_COLLECTION', 'COMMISSION_ONLY']).optional(),
  commissionAmount: z.number().int().min(0).optional(),
  basePrice: z.number().int().min(0).optional(),
  totalAmount: z.number().int().min(0, 'Total amount must be valid'),
  advanceAmount: z.number().int().min(0).optional(),
  travelDate: z.string().datetime().or(z.string().min(1)).optional(),
  returnDate: z.string().datetime().or(z.string().min(1)).optional(),
  travellers: z.number().int().min(1).max(50).optional(),
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
 * GET /api/bookings/:id/invoice - Download invoice PDF for a booking
 */
router.get('/:id/invoice', authenticate, requirePermission(PERMISSIONS.BOOKINGS_VIEW), bookingController.invoice);

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
