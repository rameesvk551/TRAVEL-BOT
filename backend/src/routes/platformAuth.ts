const { Router } = require('express');
const { z } = require('zod');
const validateBody = require('../middleware/validateBody');
const authenticatePlatformAdmin = require('../middleware/authenticatePlatformAdmin');
const platformAuthController = require('../controllers/platformAuthController');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/login', loginLimiter, validateBody(loginSchema), platformAuthController.login);
router.post('/refresh', validateBody(refreshSchema), platformAuthController.refresh);
router.post('/logout', authenticatePlatformAdmin, validateBody(refreshSchema), platformAuthController.logout);
router.get('/me', authenticatePlatformAdmin, platformAuthController.me);

module.exports = router;
