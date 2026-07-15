const { Router } = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const validateBody = require('../middleware/validateBody');
const publicController = require('../controllers/publicController');

const router = Router();

const enquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many enquiries. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const enquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  destination: z.string().trim().max(500).optional().or(z.literal('')),
  travelDates: z.string().trim().max(255).optional().or(z.literal('')),
  travellers: z.coerce.number().int().min(1).max(200).optional(),
  budgetPerPerson: z.coerce.number().int().min(0).max(100000000).optional(),
  itemType: z.enum(['PACKAGE', 'PROPERTY', 'CUSTOM_TRIP']).optional(),
  itemId: z.string().uuid().optional(),
  packageId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  company: z.string().optional(),
});

const leadFormLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many submissions. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

router.get('/:agencyKey/info', publicController.getInfo);
// No slug = the agency's default form (keeps pre-existing /lead/:agencyKey links working).
router.get('/:agencyKey/lead-form', publicController.getLeadForm);
router.post('/:agencyKey/lead-form', leadFormLimiter, publicController.submitLeadForm);
// A slug selects one of the agency's named forms.
router.get('/:agencyKey/lead-form/:slug', publicController.getLeadForm);
router.post('/:agencyKey/lead-form/:slug', leadFormLimiter, publicController.submitLeadForm);
router.get('/:agencyKey/packages', publicController.listPackages);
router.get('/:agencyKey/packages/:id', publicController.getPackage);
router.get('/:agencyKey/properties', publicController.listProperties);
router.get('/:agencyKey/properties/:id', publicController.getProperty);
// Public catalog mini-site (/s/:agencyKey). Gated on the catalogSite add-on.
router.get('/:agencyKey/catalog', publicController.getCatalog);
router.get('/:agencyKey/catalog/:type/:slug', publicController.getCatalogItem);
router.post('/:agencyKey/enquiry', enquiryLimiter, validateBody(enquirySchema), publicController.submitEnquiry);
router.get('/domain/allowed', publicController.allowDomain);

module.exports = router;
