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

const selectedItemSchema = z.object({
  itemType: z.enum(['PACKAGE', 'PROPERTY']),
  itemId: z.string().uuid(),
});

// Lead forms send every field, defaulting blanks to ''. None are mandatory, so
// treat '' as "not provided" — otherwise format/length checks (email, min length)
// reject the empty string and the whole save fails with 400.
const blankableString = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const customTripDetailsSchema = z.record(z.any()).optional();

const createLeadSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: blankableString(z.string().min(1)),
  customerPhone: blankableString(z.string().min(10)),
  customerEmail: blankableString(z.string().email()),
  customerSource: z.string().optional(),
  source: z.string().optional(),
  destination: z.string().optional(),
  place: z.string().max(500).optional(),
  travelDates: z.string().optional(),
  travellers: z.number().int().min(1).max(50).optional(),
  budgetPerPerson: z.number().int().min(0).optional(),
  interest: z.string().max(80).nullable().optional(),
  enquiryType: z.string().max(80).optional(),
  assignedAgentId: z.string().uuid().nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  status: z.enum(['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN']).optional(),
  lostReason: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  selectedItems: z.array(selectedItemSchema).max(50).optional(),
  customTripDetails: customTripDetailsSchema,
  travelStart: z.string().datetime().optional(),
  travelEnd: z.string().datetime().optional(),
});

const updateLeadSchema = z.object({
  // The kanban board (LeadPipeline.jsx) sends pipelineStageId when an agency has
  // custom stages. Without it here, validateBody strips the key and the drag
  // silently no-ops (200, no change). The service reconciles stage <-> status.
  pipelineStageId: z.string().uuid().nullable().optional(),
  status: z.enum(['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN']).optional(),
  // min(1): the bot creates single-char names from WhatsApp profile names. min(2)
  // made those leads un-editable — the edit form resubmits the stored name on every
  // save (status included), so zod 400'd the whole PATCH before it reached the service.
  customerName: blankableString(z.string().min(1)),
  customerPhone: blankableString(z.string().min(10)),
  customerEmail: blankableString(z.string().email()),
  assignedAgentId: z.string().uuid().nullable().optional(),
  destination: z.string().optional(),
  place: z.string().max(500).optional(),
  travelDates: z.string().optional(),
  travellers: z.number().int().min(1).max(50).optional(),
  budgetPerPerson: z.number().int().min(0).optional(),
  interest: z.string().max(80).nullable().optional(),
  packageId: z.string().uuid().nullable().optional(),
  propertyId: z.string().uuid().nullable().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  lostReason: z.string().optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  selectedItems: z.array(selectedItemSchema).max(50).optional(),
  customTripDetails: customTripDetailsSchema,
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

router.post('/:id/staff-first-outreach', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), leadController.sendStaffFirstOutreach);

/**
 * GET /api/leads/followups - List follow-ups for the current user, or all for admins
 */
router.get('/followups', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.listFollowUps);

/**
 * GET /api/leads/export/pdf - Export leads as professional PDF report
 */
router.get('/export/pdf', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.exportPdf);

/**
 * GET /api/leads/export/excel - Export leads as Excel report with multiple sheets
 */
router.get('/export/excel', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), leadController.exportExcel);

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
