// FILE: /backend/src/routes/auth.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authenticate');
const validateBody = require('../middleware/validateBody');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = Router();

const registerSchema = z.object({
  agencyName: z.string().min(2, 'Agency name must be at least 2 characters'),
  agencyPhone: z.string().min(10, 'Valid phone number required'),
  agencyEmail: z.string().email('Valid email required'),
  whatsappNumber: z.string().min(10, 'Valid WhatsApp number required'),
  agentName: z.string().min(2, 'Agent name must be at least 2 characters'),
  agentEmail: z.string().email('Valid email required'),
  agentPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/register
 * Registers a new agency and admin agent.
 */
router.post('/register', validateBody(registerSchema), authController.register);

/**
 * POST /api/auth/login
 * Authenticates an agent and returns tokens.
 */
router.post('/login', loginLimiter, validateBody(loginSchema), authController.login);

/**
 * POST /api/auth/refresh
 * Refreshes access token using refresh token.
 */
router.post('/refresh', validateBody(refreshSchema), authController.refresh);

/**
 * POST /api/auth/logout
 * Revokes refresh token.
 */
router.post('/logout', validateBody(refreshSchema), authController.logout);

/**
 * GET /api/auth/me
 * Returns current agent profile.
 */
router.get('/me', authenticate, authController.me);

module.exports = router;
