// FILE: /backend/src/routes/cruises.ts

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const path = require('path');
const cruiseController = require('../controllers/cruiseController');
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

const cabinTypeSchema = z.object({
  name: z.string(),
  price: z.number().int().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
});

const cruiseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  cruiseLine: z.string().optional().nullable(),
  departurePort: z.string().optional().nullable(),
  destinations: z.array(z.string()).optional(),
  duration: z.string().optional().nullable(),
  cabinTypes: z.array(cabinTypeSchema).optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  basePrice: z.number().int().nonnegative().optional().nullable(),
  imageUrl: z.string().optional().nullable().or(z.literal('')),
  departureDate: z.string().optional().nullable(),
  capacity: z.number().int().nonnegative().optional().nullable(),
  summary: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/cruises - List all cruises
 */
router.get('/', authenticate, requirePermission(PERMISSIONS.CRUISES_VIEW), cruiseController.list);

/**
 * POST /api/cruises/upload-image - Upload cruise image (ADMIN only)
 */
router.post('/upload-image', authenticate, requirePermission(PERMISSIONS.CRUISES_MANAGE), upload.single('image'), cruiseController.uploadImage);

/**
 * GET /api/cruises/:id - Get cruise by ID
 */
router.get('/:id', authenticate, requirePermission(PERMISSIONS.CRUISES_VIEW), cruiseController.getById);

/**
 * POST /api/cruises - Create a cruise (ADMIN only)
 */
router.post('/', authenticate, requirePermission(PERMISSIONS.CRUISES_MANAGE), validateBody(cruiseSchema), cruiseController.create);

/**
 * PATCH /api/cruises/:id - Update a cruise (ADMIN only)
 */
router.patch('/:id', authenticate, requirePermission(PERMISSIONS.CRUISES_MANAGE), validateBody(cruiseSchema.partial()), cruiseController.update);

/**
 * DELETE /api/cruises/:id - Deactivate a cruise (ADMIN only)
 */
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.CRUISES_MANAGE), cruiseController.deactivate);

module.exports = router;
