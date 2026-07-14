// FILE: /backend/src/routes/uploads.ts
// Generic authenticated file uploads that aren't tied to a specific catalog
// entity — a PDF attached to a flow's Send-PDF node, or an image an agent
// attaches to a WhatsApp conversation from the inbox.

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const authenticate = require('../middleware/authenticate');
const mediaService = require('../services/mediaService');

const router = Router();
const PDF_FILE_SIZE_LIMIT = 50 * 1024 * 1024;
const pdfMimeTypes = new Set(['application/pdf', 'application/x-pdf']);
const genericFileMimeTypes = new Set(['application/octet-stream', '']);

// WhatsApp rejects images over 5MB, so refuse them here rather than burn a
// Cloudinary upload on a file Meta will bounce.
const CHAT_IMAGE_SIZE_LIMIT = 5 * 1024 * 1024;
const chatImageMimeTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_IMAGE_SIZE_LIMIT },
  fileFilter: (_req, file, cb) => {
    if (!chatImageMimeTypes.has(String(file.mimetype || '').toLowerCase())) {
      cb(Object.assign(new Error('Only JPEG, PNG or WebP images can be sent'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

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

/**
 * POST /api/uploads/chat-image
 * Hosts an image publicly and returns its URL, which the caller then passes as
 * `mediaUrl` to POST /api/messages/send with type=IMAGE. Meta must be able to
 * fetch the URL itself, which is why this returns a public Cloudinary URL rather
 * than streaming the bytes through our own authenticated media proxy.
 */
router.post('/chat-image', authenticate, chatImageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    }

    const uploaded = await mediaService.uploadTemplateMedia(
      req.file.buffer,
      req.agency.id,
      req.file.mimetype,
      path.parse(req.file.originalname || 'chat-image').name,
    );

    res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname || 'chat-image',
      },
      message: 'Image uploaded',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
