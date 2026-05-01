// FILE: /backend/src/routes/templates.ts
const { Router } = require('express');
const multer = require('multer');
const templateController = require('../controllers/templateController');
const authenticate = require('../middleware/authenticate');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      cb(Object.assign(new Error('Only image or video files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

router.get('/prebuilt', authenticate, templateController.listPrebuilt);
router.post('/prebuilt/:id/use', authenticate, templateController.usePrebuilt);
router.post('/sync', authenticate, templateController.sync);
router.post('/upload-media', authenticate, upload.single('media'), templateController.uploadMedia);

router.get('/', authenticate, templateController.listAgency);
router.post('/', authenticate, templateController.create);
router.get('/:id', authenticate, templateController.getById);
router.patch('/:id', authenticate, templateController.update);
router.delete('/:id', authenticate, templateController.remove);
router.post('/:id/duplicate', authenticate, templateController.duplicate);
router.post('/:id/submit', authenticate, templateController.submit);

module.exports = router;
