// FILE: /backend/src/routes/visas.ts

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const visaController = require('../controllers/visaController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();
const IMAGE_FILE_SIZE_LIMIT = 25 * 1024 * 1024;
const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);

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
      }), false);
    } else {
      cb(null, true);
    }
  },
});

const visaSchema = z.object({
  country: z.string().min(1, 'Country is required'),
  visaType: z.string().optional().nullable(),
  price: z.number().int().nonnegative().optional().nullable(),
  processingTime: z.string().optional().nullable(),
  validityPeriod: z.string().optional().nullable(),
  requiredDocuments: z.array(z.string()).optional(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable().or(z.literal('')),
  eligibilityNotes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/visas - List all visas
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.VISAS_VIEW), visaController.list);

/**
 * POST /api/visas/upload-image - Upload visa image (ADMIN only)
 */
router.post('/upload-image', authenticate, requirePermission(PERMISSIONS.VISAS_MANAGE), upload.single('image'), visaController.uploadImage);

/**
 * GET /api/visas/:id - Get visa by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.VISAS_VIEW), visaController.getById);

/**
 * POST /api/visas - Create a visa (ADMIN only)
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.VISAS_MANAGE), validateBody(visaSchema), visaController.create);

/**
 * PATCH /api/visas/:id - Update a visa (ADMIN only)
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.VISAS_MANAGE), validateBody(visaSchema.partial()), visaController.update);

/**
 * DELETE /api/visas/:id - Deactivate a visa (ADMIN only)
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.VISAS_MANAGE), visaController.deactivate);

module.exports = router;
