// FILE: /backend/src/routes/uploads.ts
// Generic authenticated file uploads (currently PDF documents) that aren't tied to
// a specific catalog entity — e.g. a PDF attached directly to a flow's Send-PDF node.

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const authenticate = require('../middleware/authenticate');
const mediaService = require('../services/mediaService');

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
      cb(Object.assign(new Error('Only PDF files are allowed'), { statusCode: 400, code: 'INVALID_FILE_TYPE' }));
      return;
    }
    cb(null, true);
  },
});

router.post('/pdf', authenticate, pdfUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('PDF file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    }
    const uploaded = await mediaService.uploadDocumentPdf(
      req.file.buffer,
      req.agency.id,
      'flowdoc',
      path.parse(req.file.originalname || 'document').name,
    );
    res.status(201).json({
      success: true,
      data: { url: uploaded.secureUrl, publicId: uploaded.publicId, fileName: req.file.originalname || uploaded.originalFilename },
      message: 'Document uploaded',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
