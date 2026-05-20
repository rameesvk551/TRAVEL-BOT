const { Router } = require('express');
const { z } = require('zod');
const authenticatePlatformAdmin = require('../middleware/authenticatePlatformAdmin');
const validateBody = require('../middleware/validateBody');
const platformAuthRoutes = require('./platformAuth');
const platformController = require('../controllers/platformController');

const router = Router();

const statusSchema = z.object({
  isActive: z.boolean(),
});

router.use('/auth', platformAuthRoutes);
router.use(authenticatePlatformAdmin);

router.get('/overview', platformController.overview);
router.get('/agencies', platformController.agencies);
router.get('/agencies/:id', platformController.agencyDetail);
router.patch('/agencies/:id/status', validateBody(statusSchema), platformController.updateAgencyStatus);
router.get('/health', platformController.health);
router.get('/activity', platformController.activity);

module.exports = router;
