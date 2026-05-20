const { Router } = require('express');
const multer = require('multer');
const { z } = require('zod');
const itineraryController = require('../controllers/itineraryController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');

const router = Router();
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(Object.assign(new Error('Only PDF files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

const emptyToNull = (value) => (value === '' ? null : value);
const nullableUuid = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());
const nullableUrl = z.preprocess(emptyToNull, z.string().url().optional().nullable());
const nullableString = z.preprocess(emptyToNull, z.string().optional().nullable());

const itinerarySchema = z.object({
  name: z.string().min(1),
  customerId: nullableUuid,
  packageId: nullableUuid,
  leadId: nullableUuid,
  destination: nullableString,
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED']).optional(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  travelStartDate: nullableString,
  travelEndDate: nullableString,
  days: z.array(z.any()).optional(),
  pdfUrl: nullableUrl,
});

router.get('/', authenticate, itineraryController.list);
router.get('/:id', authenticate, itineraryController.getById);
router.post('/', authenticate, validateBody(itinerarySchema), itineraryController.create);
router.patch('/:id', authenticate, validateBody(itinerarySchema.partial()), itineraryController.update);
router.post('/:id/upload-pdf', authenticate, pdfUpload.single('pdf'), itineraryController.uploadPdf);
router.delete('/:id', authenticate, itineraryController.remove);

module.exports = router;
