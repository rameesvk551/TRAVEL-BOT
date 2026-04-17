const { Router } = require('express');
const whatsappFlowController = require('../controllers/whatsappFlowController');

const router = Router();

router.post('/flow', whatsappFlowController.handleFlowRequest);

module.exports = router;
