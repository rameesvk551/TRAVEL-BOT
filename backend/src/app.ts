// FILE: /backend/src/app.js
// DEPS: express, cors, helmet, morgan

const express = require('express');
const expressStatic = require('express').static;
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { registerApiRoutes } = require('./routes');
const resolveAgencyDomain = require('./middleware/resolveAgencyDomain');
const { SITES_ROOT } = require('./services/websiteBuilderService');

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

// Static previews for generated agency websites.
app.use('/sites', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';"
  );
  next();
}, expressStatic(SITES_ROOT));

// Custom-domain website serving. Runs before API route registration so agency
// domains can serve generated static files from their own host.
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
