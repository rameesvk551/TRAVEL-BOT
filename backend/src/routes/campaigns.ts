// FILE: /backend/src/routes/campaigns.ts
const { Router } = require('express');
const campaignController = require('../controllers/campaignController');
const authenticate = require('../middleware/authenticate');

const router = Router();

router.get('/', authenticate, campaignController.list);
router.post('/', authenticate, campaignController.create);
router.post('/preview-audience', authenticate, campaignController.previewAudience);
router.post('/import-contacts', authenticate, campaignController.importContacts);
router.get('/analytics', authenticate, campaignController.analytics);
router.get('/reports', authenticate, campaignController.reports);
router.get('/:id', authenticate, campaignController.getById);
router.get('/:id/stats', authenticate, campaignController.getStats);
router.get('/:id/report', authenticate, campaignController.getReport);
router.patch('/:id', authenticate, campaignController.update);
router.post('/:id/send', authenticate, campaignController.send);
router.post('/:id/cancel', authenticate, campaignController.cancel);
router.post('/:id/duplicate', authenticate, campaignController.duplicate);
router.delete('/:id', authenticate, campaignController.delete);

module.exports = router;
