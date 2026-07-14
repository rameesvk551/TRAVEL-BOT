// FILE: /backend/src/routes/leadForms.ts
// DEPS: zod
// Admin CRUD for an agency's named public lead forms (/api/lead-forms).

const { Router } = require('express');
const { z } = require('zod');
const leadFormController = require('../controllers/leadFormController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');
const leadFormConfig = require('../services/leadFormConfig');

const router = Router();

const optionSchema = z.object({
  label: z.string().trim().max(120).optional(),
  value: z.string().trim().max(120).optional(),
});

const fieldSchema = z.object({
  id: z.string().trim().max(80).optional(),
  label: z.string().trim().min(1).max(120),
  type: z.enum(leadFormConfig.FIELD_TYPES),
  placeholder: z.string().trim().max(160).optional().or(z.literal('')),
  required: z.boolean().optional(),
  mapsTo: z.enum(leadFormConfig.MAP_TARGETS).optional(),
  options: z.array(optionSchema).max(50).optional(),
});

// The service re-normalises everything (leadFormConfig.normalizeLeadFormConfig),
// so this schema only has to keep obviously-malformed payloads out.
const formSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(80).optional().or(z.literal('')),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  title: z.string().trim().max(160).optional().or(z.literal('')),
  description: z.string().trim().max(600).optional().or(z.literal('')),
  successMessage: z.string().trim().max(400).optional().or(z.literal('')),
  submitLabel: z.string().trim().max(60).optional().or(z.literal('')),
  fields: z.array(fieldSchema).max(40).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999).optional(),
});

router.use(authenticate);

router.get('/', leadFormController.list);
router.post('/', validateBody(formSchema), leadFormController.create);
router.get('/:id', leadFormController.getOne);
router.put('/:id', validateBody(formSchema), leadFormController.update);
router.delete('/:id', leadFormController.remove);

module.exports = router;
