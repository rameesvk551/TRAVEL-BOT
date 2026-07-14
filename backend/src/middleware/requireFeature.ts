// FILE: /backend/src/middleware/requireFeature.ts
//
// Route-group middleware for paid add-on modules. Mounted in routes/index.ts:
//   app.use('/api/brochures', requireFeature('brochureBuilder'), brochureRoutes);
//
// Deliberately NOT the same mechanism as requireModule/sidebarPreferences.
// `sidebarPreferences` is a *visibility* list whose empty state means "unrestricted"
// (see constants/modules.ts) — so putting an add-on there would hand it, free, to
// every agency that has no explicit module list. An add-on must be deny-by-default.
//
// Entitlements live in the `agency.features` JSONB column:
//   { "brochureBuilder": true }
//
// Toggling a feature also cannot strip an agency's other modules, because it does
// not touch sidebarPreferences at all.

const authenticate = require('./authenticate');

/**
 * @param {string} featureKey - e.g. 'brochureBuilder'
 */
function requireFeature(featureKey) {
  return (req, res, next) => {
    // Resolve the session first. On auth failure `authenticate` sends its own 401
    // and never invokes our callback.
    authenticate(req, res, (err) => {
      if (err) return next(err);

      const features = req.agency?.features;
      if (features && typeof features === 'object' && features[featureKey] === true) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'This add-on is not enabled for your account.',
        code: 'FEATURE_NOT_ENABLED',
        feature: featureKey,
      });
    });
  };
}

module.exports = requireFeature;
