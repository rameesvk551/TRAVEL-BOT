const { Router } = require('express');
const multer = require('multer');
const { z } = require('zod');
const path = require('path');
const itineraryController = require('../controllers/itineraryController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');

const router = Router();
const PDF_FILE_SIZE_LIMIT = 50 * 1024 * 1024;
const pdfMimeTypes = new Set(['application/pdf', 'application/x-pdf']);
const genericFileMimeTypes = new Set(['application/octet-stream', '']);
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PDF_FILE_SIZE_LIMIT },
  fileFilter: (_req, file, cb) => {
    const mimeType = file.mimetype || '';
    const isPdfExtension = path.extname(file.originalname || '').toLowerCase() === '.pdf';
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

const emptyToNull = (value) => (value === '' ? null : value);
const nullableUuid = z.preprocess(emptyToNull, z.string().uuid().optional().nullable());
const nullableUrl = z.preprocess(emptyToNull, z.string().url().optional().nullable());
const nullableString = z.preprocess(emptyToNull, z.string().optional().nullable());

const itinerarySchema = z.object({
  name: z.string().min(1),
  customerId: nullableUuid,
  packageId: nullableUuid,
  leadId: nullableUuid,
  templateId: nullableUuid,
  destination: nullableString,
  productCode: nullableString,
  summary: nullableString,
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED']).optional(),
  adults: z.number().int().optional(),
  children: z.number().int().optional(),
  travelStartDate: nullableString,
  travelEndDate: nullableString,
  days: z.array(z.any()).optional(),
  hotels: z.array(z.any()).optional(),
  vehicle: z.any().optional(),
  priceRooms: z.array(z.any()).optional(),
  pricing: z.any().optional(),
  inclusions: z.array(z.any()).optional(),
  exclusions: z.array(z.any()).optional(),
  totalPrice: z.number().optional(),
  pdfUrl: nullableUrl,
});

router.get('/', authenticate, itineraryController.list);
router.get('/:id', authenticate, itineraryController.getById);
router.get('/:id/pdf', authenticate, itineraryController.downloadPdf);
router.post('/', authenticate, validateBody(itinerarySchema), itineraryController.create);
router.patch('/:id', authenticate, validateBody(itinerarySchema.partial()), itineraryController.update);
router.post('/:id/upload-pdf', authenticate, pdfUpload.single('pdf'), itineraryController.uploadPdf);
router.post('/:id/send-whatsapp', authenticate, itineraryController.sendWhatsApp);
router.delete('/:id', authenticate, itineraryController.remove);

module.exports = router;
