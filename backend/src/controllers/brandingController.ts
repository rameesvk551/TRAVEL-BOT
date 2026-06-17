const brandingService = require('../services/brandingService');

/**
 * Public, unauthenticated endpoint. Resolves white-label branding from the
 * request host so the frontend can theme itself before login.
 */
async function getBranding(req, res, next) {
  try {
    const host = req.query.host || req.headers['x-forwarded-host'] || req.headers.host;
    const branding = await brandingService.resolveBrandingByHost(host);
    res.json({ success: true, data: branding });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBranding };
