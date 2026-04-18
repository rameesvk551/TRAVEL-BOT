const { Router } = require('express');
const { z } = require('zod');
const itineraryController = require('../controllers/itineraryController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');

const router = Router();

const itinerarySchema = z.object({
  name: z.string().min(1),
  customerId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  destination: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED']).optional(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  travelStartDate: z.string().optional().nullable(),
  travelEndDate: z.string().optional().nullable(),
  days: z.array(z.any()).optional(),
  pdfUrl: z.string().url().optional().nullable(),
});

router.get('/', authenticate, itineraryController.list);
router.get('/:id', authenticate, itineraryController.getById);
router.post('/', authenticate, validateBody(itinerarySchema), itineraryController.create);
router.patch('/:id', authenticate, validateBody(itinerarySchema.partial()), itineraryController.update);
router.delete('/:id', authenticate, itineraryController.remove);

module.exports = router;
