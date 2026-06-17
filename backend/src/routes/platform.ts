const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const authenticatePlatformAdmin = require('../middleware/authenticatePlatformAdmin');
const validateBody = require('../middleware/validateBody');
const platformAuthRoutes = require('./platformAuth');
const platformController = require('../controllers/platformController');
const partnerController = require('../controllers/partnerController');

const router = Router();

const IMAGE_FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB
const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.ico', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_FILE_SIZE_LIMIT },
  fileFilter: (_req, file, cb) => {
    const isImageMime = String(file.mimetype || '').startsWith('image/');
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!isImageMime && !imageExtensions.has(ext)) {
      cb(Object.assign(new Error('Only image files are allowed'), { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
      return;
    }
    cb(null, true);
  },
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

const modulesSchema = z.object({
  modules: z.array(z.string()).max(50),
});

const hex = z.string().regex(/^#([0-9a-fA-F]{6})$/);
const partnerBrandingSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  slug: z.string().trim().min(2).max(80).optional(),
  customDomain: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
  brandName: z.string().trim().max(120).nullable().optional(),
  logoUrl: z.string().trim().max(1000).nullable().optional(),
  faviconUrl: z.string().trim().max(1000).nullable().optional(),
  primaryColor: hex.nullable().optional(),
  accentColor: hex.nullable().optional(),
  loginTagline: z.string().trim().max(255).nullable().optional(),
  loginImageUrl: z.string().trim().max(1000).nullable().optional(),
  supportEmail: z.string().trim().max(255).nullable().optional(),
  supportUrl: z.string().trim().max(1000).nullable().optional(),
  emailFromName: z.string().trim().max(120).nullable().optional(),
  emailReplyTo: z.string().trim().max(255).nullable().optional(),
  emailFooterText: z.string().trim().max(500).nullable().optional(),
  billingModel: z.enum(['REV_SHARE', 'MARKUP', 'FLAT']).optional(),
  revenueSharePercent: z.coerce.number().min(0).max(100).optional(),
  perAgencyFee: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  billingStatus: z.enum(['ACTIVE', 'PAST_DUE', 'SUSPENDED']).optional(),
});

const createPartnerSchema = partnerBrandingSchema.extend({
  name: z.string().trim().min(2).max(255),
});

const assignAgencySchema = z.object({ agencyId: z.string().uuid() });
const invoicePeriodSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const invoiceStatusSchema = z.object({ status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID']) });

router.use('/auth', platformAuthRoutes);
router.use(authenticatePlatformAdmin);

router.get('/overview', platformController.overview);
router.get('/agencies', platformController.agencies);
router.get('/agencies/:id', platformController.agencyDetail);
router.patch('/agencies/:id/status', validateBody(statusSchema), platformController.updateAgencyStatus);
router.patch('/agencies/:id/modules', validateBody(modulesSchema), platformController.updateAgencyModules);
router.get('/health', platformController.health);
router.get('/activity', platformController.activity);

// ===== White-label partners =====
router.get('/partners', partnerController.list);
router.post('/partners/upload-asset', upload.single('image'), partnerController.uploadAsset);
router.post('/partners', validateBody(createPartnerSchema), partnerController.create);
router.get('/partners/:id', partnerController.detail);
router.patch('/partners/:id', validateBody(partnerBrandingSchema), partnerController.update);
router.post('/partners/:id/agencies', validateBody(assignAgencySchema), partnerController.assignAgency);
router.delete('/partners/agencies/:agencyId', partnerController.unassignAgency);
router.post('/partners/:id/invoices', validateBody(invoicePeriodSchema), partnerController.generateInvoice);
router.patch('/partners/invoices/:invoiceId', validateBody(invoiceStatusSchema), partnerController.updateInvoiceStatus);

module.exports = router;
