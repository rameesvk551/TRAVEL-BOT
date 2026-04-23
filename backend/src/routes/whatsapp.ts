const { Router } = require('express');
const whatsappFlowController = require('../controllers/whatsappFlowController');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

const router = Router();

router.post('/flow', whatsappFlowController.handleFlowRequest);
router.post('/webhook', whatsappWebhookController.handleWebhook);

module.exports = router;
