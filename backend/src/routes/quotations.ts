// FILE: /backend/src/routes/quotations.ts
const express = require('express');
const router = express.Router();
const controller = require('../controllers/quotationController');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.get('/:id/pdf', controller.downloadPdf);
router.post('/:id/send-whatsapp', controller.sendWhatsApp);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
