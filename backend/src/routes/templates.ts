// FILE: /backend/src/routes/templates.ts
const { Router } = require('express');
const templateController = require('../controllers/templateController');
const authenticate = require('../middleware/authenticate');

const router = Router();

router.get('/prebuilt', authenticate, templateController.listPrebuilt);
router.post('/prebuilt/:id/use', authenticate, templateController.usePrebuilt);

router.get('/', authenticate, templateController.listAgency);
router.post('/', authenticate, templateController.create);
router.get('/:id', authenticate, templateController.getById);
router.patch('/:id', authenticate, templateController.update);
router.delete('/:id', authenticate, templateController.remove);
router.post('/:id/duplicate', authenticate, templateController.duplicate);
router.post('/:id/submit', authenticate, templateController.submit);
router.post('/sync', authenticate, templateController.sync);

module.exports = router;
