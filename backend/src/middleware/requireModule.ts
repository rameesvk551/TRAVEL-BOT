// FILE: /backend/src/middleware/requireModule.ts
//
// Route-group middleware that enforces per-agency module access on the backend.
// Mounted in routes/index.ts ahead of module-specific route groups, e.g.
//   app.use('/api/bookings', requireModule('/api/bookings'), bookingRoutes);
//
// It first ensures the session is authenticated (delegating to `authenticate`,
// which is idempotent — the inner per-route `authenticate` then becomes a no-op),
// then checks the resolved `req.agency.sidebarPreferences` against the module
// grant map. Agencies with no explicit preference keep full access.

const authenticate = require('./authenticate');
const { isApiPrefixAllowed } = require('../constants/modules');

/**
 * @param {string} apiPrefix - the route group's API prefix, e.g. '/api/bookings'
 */
function requireModule(apiPrefix) {
  return (req, res, next) => {
    // Resolve the session. On auth failure `authenticate` sends its own 401 and
    // never calls our callback, so we only reach the module check when authed.
    authenticate(req, res, (err) => {
      if (err) return next(err);

      if (isApiPrefixAllowed(req.agency?.sidebarPreferences, apiPrefix)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'This module is not enabled for your account.',
        code: 'MODULE_NOT_ENABLED',
        module: apiPrefix,
      });
    });
  };
}

module.exports = requireModule;
