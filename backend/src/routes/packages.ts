// FILE: /backend/src/routes/packages.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const packageController = require('../controllers/packageController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();
const IMAGE_FILE_SIZE_LIMIT = 25 * 1024 * 1024;
const PDF_FILE_SIZE_LIMIT = 50 * 1024 * 1024;
const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);
const pdfMimeTypes = new Set(['application/pdf', 'application/x-pdf']);
const genericFileMimeTypes = new Set(['application/octet-stream', '']);

function hasAllowedExtension(file, allowedExtensions) {
  return allowedExtensions.has(path.extname(file.originalname || '').toLowerCase());
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_FILE_SIZE_LIMIT,
  },
  fileFilter: (_req, file, cb) => {
    const isImageMime = String(file.mimetype || '').startsWith('image/');
    if (!isImageMime && !hasAllowedExtension(file, imageExtensions)) {
      cb(Object.assign(new Error('Only image files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

const brochureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PDF_FILE_SIZE_LIMIT,
  },
  fileFilter: (_req, file, cb) => {
    const mimeType = file.mimetype || '';
    const isPdfExtension = hasAllowedExtension(file, new Set(['.pdf']));
    const isPdfFile = pdfMimeTypes.has(mimeType) || (genericFileMimeTypes.has(mimeType) && isPdfExtension);
    if (!isPdfFile) {
      cb(Object.assign(new Error('Only PDF files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }

    cb(null, true);
  },
});

const packageSchema = z.object({
  name: z.string().min(2),
  category: z.enum(['DOMESTIC', 'INTERNATIONAL']).optional().nullable(),
  tourType: z.string().trim().max(80).optional().nullable(),
  duration: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  basePrice: z.number().int().min(1, 'Price must be positive (in paise)').optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
  brochureUrl: z.string().url().optional().nullable(),
  brochureFileName: z.string().max(255).optional().nullable(),
  itinerary: z.array(z.object({
    day: z.number().int(),
    title: z.string(),
    description: z.string().optional(),
    activities: z.array(z.string()).optional(),
  })).optional(),
  isActive: z.boolean().optional(),
});

const vendorCostSchema = z.object({
  vendorId: z.string().uuid(),
  serviceLabel: z.string().trim().min(1).max(120),
  amount: z.number().int().min(1, 'Cost must be positive (in paise)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/packages - List all packages
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.PACKAGES_VIEW), packageController.list);

/**
 * POST /api/packages/upload-image - Upload package image to Cloudinary (ADMIN only)
 */
router.post('/upload-image', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), upload.single('image'), packageController.uploadImage);

/**
 * POST /api/packages/upload-brochure - Upload package brochure PDF to Cloudinary (ADMIN only)
 */
router.post('/upload-brochure', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), brochureUpload.single('brochure'), packageController.uploadBrochure);

/**
 * GET /api/packages/:id/finance - Package receivables, payables, profit, and ops KPIs
 */
router.get('/:id/finance', authenticate, requirePermission(PERMISSIONS.PACKAGES_VIEW), packageController.finance);

/**
 * POST /api/packages/:id/vendor-costs - Add committed vendor cost for a package
 */
router.post('/:id/vendor-costs', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(vendorCostSchema), packageController.createVendorCost);

/**
 * PATCH /api/packages/:id/vendor-costs/:costId - Update committed vendor cost
 */
router.patch('/:id/vendor-costs/:costId', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(vendorCostSchema.partial()), packageController.updateVendorCost);

/**
 * DELETE /api/packages/:id/vendor-costs/:costId - Delete committed vendor cost
 */
router.delete('/:id/vendor-costs/:costId', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), packageController.deleteVendorCost);

/**
 * GET /api/packages/:id - Get package by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.PACKAGES_VIEW), packageController.getById);

/**
 * POST /api/packages - Create a package (ADMIN only)
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(packageSchema), packageController.create);

/**
 * PATCH /api/packages/:id - Update a package (ADMIN only)
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(packageSchema.partial()), packageController.update);

/**
 * DELETE /api/packages/:id - Deactivate a package (ADMIN only)
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.PACKAGES_MANAGE), packageController.deactivate);

module.exports = router;
