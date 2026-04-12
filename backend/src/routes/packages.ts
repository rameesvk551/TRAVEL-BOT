// FILE: /backend/src/routes/packages.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const packageController = require('../controllers/packageController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');

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

const packageSchema = z.object({
  name: z.string().min(2),
  duration: z.string().optional(),
  destinations: z.array(z.string()).optional(),
  inclusions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  basePrice: z.number().int().min(1, 'Price must be positive (in paise)'),
  imageUrl: z.string().url().optional().nullable(),
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
router.get('/', authenticate, packageController.list);

/**
 * POST /api/packages/upload-image - Upload package image to Cloudinary (ADMIN only)
 */
router.post('/upload-image', authenticate, requireRole('ADMIN'), upload.single('image'), packageController.uploadImage);

/**
 * GET /api/packages/:id - Get package by ID
 */
router.get('/:id', authenticate, packageController.getById);

/**
 * POST /api/packages - Create a package (ADMIN only)
 */
router.post('/', authenticate, requireRole('ADMIN'), validateBody(packageSchema), packageController.create);

/**
 * PATCH /api/packages/:id - Update a package (ADMIN only)
 */
router.patch('/:id', authenticate, requireRole('ADMIN'), validateBody(packageSchema.partial()), packageController.update);

/**
 * DELETE /api/packages/:id - Deactivate a package (ADMIN only)
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), packageController.deactivate);

module.exports = router;
