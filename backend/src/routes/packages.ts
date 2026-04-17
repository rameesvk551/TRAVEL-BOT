// FILE: /backend/src/routes/packages.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const packageController = require('../controllers/packageController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
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
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/x-pdf',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
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
  duration: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  basePrice: z.number().int().min(1, 'Price must be positive (in paise)'),
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

/**
 * GET /api/packages - List all packages
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.PACKAGES_VIEW), packageController.list);

/**
 * POST /api/packages/upload-image - Upload package image to Cloudinary (ADMIN only)
 */
router.post('/upload-image', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.PACKAGES_MANAGE), upload.single('image'), packageController.uploadImage);

/**
 * POST /api/packages/upload-brochure - Upload package brochure PDF to Cloudinary (ADMIN only)
 */
router.post('/upload-brochure', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.PACKAGES_MANAGE), brochureUpload.single('brochure'), packageController.uploadBrochure);

/**
 * GET /api/packages/:id - Get package by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.PACKAGES_VIEW), packageController.getById);

/**
 * POST /api/packages - Create a package (ADMIN only)
 */
router.post('/', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(packageSchema), packageController.create);

/**
 * PATCH /api/packages/:id - Update a package (ADMIN only)
 */
router.patch('/:id', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.PACKAGES_MANAGE), validateBody(packageSchema.partial()), packageController.update);

/**
 * DELETE /api/packages/:id - Deactivate a package (ADMIN only)
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.PACKAGES_MANAGE), packageController.deactivate);

module.exports = router;
