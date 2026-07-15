// FILE: /backend/src/app.js
// DEPS: express, cors, helmet, morgan

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { registerApiRoutes } = require('./routes');
const resolveAgencyDomain = require('./middleware/resolveAgencyDomain');

const app = express();
app.set('trust proxy', 1);

// Global middleware
app.use(helmet());

// Locked-down CORS for the authenticated dashboard API. The allowlist is
// dynamic: the platform admin host, the public root domain's subdomains, and
// every active white-label partner's custom domain (see corsOriginService).
// A static single-origin policy here silently broke partner-host sessions.
const corsOriginService = require('./services/corsOriginService');
const restrictedCors = cors({
  origin: (origin, callback) => {
    corsOriginService.isAllowedOrigin(origin)
      .then((ok) => callback(null, ok))
      .catch((err) => callback(err));
  },
  credentials: true,
});

// The public embed API (/api/public/*) is meant to be called from arbitrary
// customer-owned websites, so it manages its own permissive CORS at the router
// level. We skip the restrictive policy here so it cannot clobber that or break
// cross-origin preflight. Security for that surface is the publishable key +
// scopes + per-key rate limits, not the Origin header.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/public/')) return next();
  return restrictedCors(req, res, next);
});
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Parse JSON for all routes EXCEPT payment webhook (needs raw body)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// Rate limit all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Custom-domain catalog serving. Runs before API route registration so an agency's
// own domain (or platform subdomain) boots the React app, which renders that
// agency's public catalog mini-site. Live data — no generated files.
app.use(resolveAgencyDomain);

// API routes
registerApiRoutes(app);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
