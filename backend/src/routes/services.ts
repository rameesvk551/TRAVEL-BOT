// FILE: /backend/src/routes/services.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const serviceController = require('../controllers/serviceController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isImageMime = String(file.mimetype || '').startsWith('image/');
    const hasImageExt = imageExtensions.has(path.extname(file.originalname || '').toLowerCase());
    if (!isImageMime && !hasImageExt) {
      cb(Object.assign(new Error('Only image files are allowed'), { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
      return;
    }
    cb(null, true);
  },
});

const serviceSchema = z.object({
  name: z.string().min(2).max(255),
  category: z.enum(['TICKETING', 'DOCUMENTATION', 'VISA', 'INSURANCE', 'OTHER']).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  basePrice: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().url().max(1000).optional().nullable(),
  pricingType: z.enum(['FIXED', 'STARTING_FROM', 'VARIABLE']).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()),
});

/**
 * POST /api/services/upload-image - Upload a service image to Cloudinary (ADMIN only)
 */
router.post('/upload-image', authenticate, requirePermission(PERMISSIONS.SERVICES_MANAGE), upload.single('image'), serviceController.uploadImage);

/**
 * GET /api/services - List all services
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.SERVICES_VIEW), serviceController.list);

/**
 * GET /api/services/:id - Get service by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.SERVICES_VIEW), serviceController.getById);

/**
 * POST /api/services - Create a service (ADMIN only)
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.SERVICES_MANAGE), validateBody(serviceSchema), serviceController.create);

/**
 * PATCH /api/services/reorder - Reorder services (ADMIN only)
 * IMPORTANT: This must be before /:id to avoid matching 'reorder' as an ID
 */
router.patch('/reorder', authenticate, requirePermission(PERMISSIONS.SERVICES_MANAGE), validateBody(reorderSchema), serviceController.reorder);

/**
 * PATCH /api/services/:id - Update a service (ADMIN only)
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.SERVICES_MANAGE), validateBody(serviceSchema.partial()), serviceController.update);

/**
 * DELETE /api/services/:id - Deactivate a service (ADMIN only)
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.SERVICES_MANAGE), serviceController.deactivate);

module.exports = router;
