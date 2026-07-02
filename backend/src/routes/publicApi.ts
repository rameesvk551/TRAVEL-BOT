// FILE: /backend/src/routes/publicApi.js
// DEPS: express, cors, zod

const { Router } = require('express');
const cors = require('cors');
const { z } = require('zod');
const validateBody = require('../middleware/validateBody');
const authenticatePublicKey = require('../middleware/authenticatePublicKey');
const {
  publicReadLimiter,
  publicWriteBurstLimiter,
  publicWriteHourlyLimiter,
} = require('../middleware/rateLimiter');
const publicApiController = require('../controllers/publicApiController');

const router = Router();

// Publishable keys are designed to be embedded on any customer-owned site, so
// the browser needs permissive CORS here. This is NOT the security boundary —
// the key + scopes + rate limits are. Per-key origin locking is enforced inside
// authenticatePublicKey for agencies that opt in. We reflect the request origin
// (rather than '*') so credentialed fetches still work, and never expose
// cross-origin responses to authenticated cookies (there are none on this API).
router.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  maxAge: 600,
}));

// Lead submission schema. A hidden `company`/`website_url` acts as the honeypot.
const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  destination: z.string().trim().max(500).optional().or(z.literal('')),
  travelDates: z.string().trim().max(255).optional().or(z.literal('')),
  travellers: z.coerce.number().int().min(1).max(200).optional(),
  budgetPerPerson: z.coerce.number().int().min(0).max(100000000).optional(),
  itemType: z.enum(['PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE', 'CUSTOM_TRIP']).optional(),
  itemId: z.string().uuid().optional(),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
  company: z.string().optional(),      // honeypot
  website_url: z.string().optional(),  // honeypot
});

// ---- Catalog (read) — requires the catalog:read scope ----
const readGuard = authenticatePublicKey({ scope: 'catalog:read' });
router.get('/catalog', publicReadLimiter, readGuard, publicApiController.listAll);
router.get('/catalog/:resource', publicReadLimiter, readGuard, publicApiController.listResource);
router.get('/catalog/:resource/:id', publicReadLimiter, readGuard, publicApiController.getResource);

// ---- Leads (write) — requires the leads:write scope + strict rate limits ----
router.post(
  '/leads',
  publicWriteBurstLimiter,
  publicWriteHourlyLimiter,
  authenticatePublicKey({ scope: 'leads:write' }),
  validateBody(leadSchema),
  publicApiController.submitLead,
);

module.exports = router;
