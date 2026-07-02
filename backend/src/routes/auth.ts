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
  industry: z.enum(['TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email required'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
 * POST /api/auth/forgot-password
 * Sends a password reset email when the account exists.
 */
router.post('/forgot-password', loginLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);

/**
 * POST /api/auth/reset-password
 * Resets password using a valid one-time reset token.
 */
router.post('/reset-password', loginLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

/**
 * POST /api/auth/refresh
 * Refreshes access token using the refresh token from the request body or the
 * HttpOnly `rt` cookie (no body validation — the cookie may be the only source
 * on Safari PWAs where localStorage was evicted). Presence is checked in the controller.
 */
router.post('/refresh', authController.refresh);

/**
 * POST /api/auth/logout
 * Revokes the refresh token (from body or cookie) and clears the cookie.
 */
router.post('/logout', authController.logout);

/**
 * GET /api/auth/me
 * Returns current agent profile.
 */
router.get('/me', authenticate, authController.me);

module.exports = router;
