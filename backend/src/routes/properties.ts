const { Router } = require('express');
const { z } = require('zod');
const multer = require('multer');
const propertyController = require('../controllers/propertyController');
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

const nullableText = z.string().max(2000).optional().nullable();

const propertySchema = z.object({
  name: z.string().min(2),
  propertyType: z.enum(['Hotel', 'Resort', 'Villa', 'Apartment']),
  location: z.string().max(255).optional().nullable(),
  address: nullableText,
  amenities: z.array(z.string().max(120)).optional(),
  description: nullableText,
  pricePerNight: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
});

const propertyViewGuard = requirePermission(PERMISSIONS.PROPERTIES_VIEW, PERMISSIONS.PACKAGES_VIEW);

router.get('/', authenticate, propertyViewGuard, propertyController.listProperties);

router.post(
  '/upload-image',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.PROPERTIES_MANAGE),
  upload.single('image'),
  propertyController.uploadImage
);

router.get('/:id', authenticate, propertyViewGuard, propertyController.getProperty);

router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.PROPERTIES_MANAGE),
  validateBody(propertySchema),
  propertyController.createProperty
);

router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.PROPERTIES_MANAGE),
  validateBody(propertySchema.partial()),
  propertyController.updateProperty
);

router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.PROPERTIES_MANAGE),
  validateBody(propertySchema.partial()),
  propertyController.updateProperty
);

router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.PROPERTIES_MANAGE),
  propertyController.deleteProperty
);

module.exports = router;
