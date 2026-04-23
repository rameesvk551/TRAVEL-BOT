// FILE: /backend/src/routes/leads.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const leadController = require('../controllers/leadController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const createLeadSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(2).optional(),
  customerPhone: z.string().min(10).optional(),
  customerSource: z.string().optional(),
  destination: z.string().optional(),
  travelDates: z.string().optional(),
  travellers: z.number().int().min(1).max(50).optional(),
  budgetPerPerson: z.number().int().min(0).optional(),
  interest: z.enum(['DOMESTIC', 'INTERNATIONAL']).nullable().optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  status: z.enum(['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN']).optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
  travelStart: z.string().datetime().optional(),
  travelEnd: z.string().datetime().optional(),
}).refine((data) => data.customerId || data.customerPhone, {
  message: 'Either customerId or customerPhone is required',
});

const updateLeadSchema = z.object({
  status: z.enum(['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN']).optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  destination: z.string().optional(),
  travelDates: z.string().optional(),
  travellers: z.number().int().min(1).max(50).optional(),
  budgetPerPerson: z.number().int().min(0).optional(),
  interest: z.enum(['DOMESTIC', 'INTERNATIONAL']).nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
  lostReason: z.string().optional(),
  travelStart: z.string().datetime().nullable().optional(),
  travelEnd: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/leads - List leads with filters and pagination
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.list);

/**
 * POST /api/leads/bulk-assign - Bulk assign leads to an agent
 */
const bulkAssignSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  agentId: z.string().uuid().nullable().optional(),
});
router.post('/bulk-assign', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), validateBody(bulkAssignSchema), leadController.bulkAssign);

/**
 * GET /api/leads/followups - List follow-ups for the current user, or all for admins
 */
router.get('/followups', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.listFollowUps);

/**
 * GET /api/leads/:id - Get lead by ID with full details
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.getById);

/**
 * POST /api/leads - Create a new lead
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), validateBody(createLeadSchema), leadController.create);

/**
 * PATCH /api/leads/:id - Update a lead
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), validateBody(updateLeadSchema), leadController.update);

/**
 * DELETE /api/leads/:id - Soft delete (cancel) a lead
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.remove);

/**
 * POST /api/leads/:id/followups
 */
router.post('/:id/followups', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.addFollowUp);

/**
 * PATCH /api/leads/:id/followups/:followUpId
 */
router.patch('/:id/followups/:followUpId', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.updateFollowUp);

/**
 * DELETE /api/leads/:id/followups/:followUpId
 */
router.delete('/:id/followups/:followUpId', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.deleteFollowUp);

/**
 * POST /api/leads/:id/notes
 */
router.post('/:id/notes', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.addNote);

module.exports = router;
