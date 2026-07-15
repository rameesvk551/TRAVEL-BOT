// FILE: /backend/src/routes/brochures.ts
// DEPS: multer
//
// Mounted behind requireFeature('brochureBuilder') in routes/index.ts, so every
// route here is unreachable unless the platform admin has enabled the add-on for
// this agency.

const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/brochureController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const IMAGE_FILE_SIZE_LIMIT = 25 * 1024 * 1024;
// A resort drop is typically 10-30 photos; 40 leaves headroom without letting a
// single request pin the process on image uploads.
const MAX_IMAGES_PER_UPLOAD = 40;
const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_FILE_SIZE_LIMIT,
    files: MAX_IMAGES_PER_UPLOAD,
  },
  fileFilter: (_req, file, cb) => {
    const isImageMime = String(file.mimetype || '').startsWith('image/');
    const hasImageExt = imageExtensions.has(path.extname(file.originalname || '').toLowerCase());
    if (!isImageMime && !hasImageExt) {
      cb(Object.assign(new Error('Only image files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);

const canView = requirePermission(PERMISSIONS.AGENCY_VIEW);
const canManage = requirePermission(PERMISSIONS.AGENCY_MANAGE);

// Editor bootstrap
router.get('/meta', canView, controller.getMeta);

// All ten shipped designs, built live against this agency's own photos.
router.get('/presets/preview', canView, controller.previewPresets);

// One fresh themed page for the "+ Page → pick a layout" menu. Pure/no-DB, but gated with
// the same manage permission as editing a brochure, since the page is inserted into one.
router.post('/pages/build', canManage, controller.buildBrochurePage);

// Image library
router.get('/assets', canView, controller.listAssets);
router.post('/assets', canManage, upload.array('images', MAX_IMAGES_PER_UPLOAD), controller.uploadAssets);
router.put('/assets/order', canManage, controller.reorderAssets);
router.delete('/assets/:assetId', canManage, controller.deleteAsset);

// Reusable designs
router.get('/templates', canView, controller.listTemplates);
router.delete('/templates/:templateId', canManage, controller.deleteTemplate);

// Brochures
router.get('/', canView, controller.list);
router.post('/', canManage, controller.create);
router.get('/:id', canView, controller.getById);
router.put('/:id', canManage, controller.update);
router.delete('/:id', canManage, controller.remove);

router.put('/:id/theme', canManage, controller.retheme);
router.post('/:id/template', canManage, controller.applyTemplate);
router.post('/:id/save-as-template', canManage, controller.saveAsTemplate);
router.get('/:id/pdf', canView, controller.downloadPdf);
router.post('/:id/render', canManage, controller.renderToUrl);
router.post('/:id/send', canManage, controller.sendToLead);

module.exports = router;
