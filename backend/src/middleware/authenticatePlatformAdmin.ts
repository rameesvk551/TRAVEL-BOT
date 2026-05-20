const jwt = require('jsonwebtoken');
const { PlatformAdmin } = require('../models');

function platformAccessSecret() {
  if (process.env.PLATFORM_JWT_SECRET) return process.env.PLATFORM_JWT_SECRET;
  return `${process.env.JWT_SECRET || 'travelbot-dev-secret'}:platform`;
}

async function authenticatePlatformAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Platform access token required.',
        code: 'PLATFORM_AUTH_TOKEN_MISSING',
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, platformAccessSecret());
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: err.name === 'TokenExpiredError' ? 'Platform access token expired.' : 'Invalid platform access token.',
        code: err.name === 'TokenExpiredError' ? 'PLATFORM_AUTH_TOKEN_EXPIRED' : 'PLATFORM_AUTH_TOKEN_INVALID',
      });
    }

    if (decoded.type !== 'platform_admin' || !decoded.platformAdminId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid platform token scope.',
        code: 'PLATFORM_AUTH_SCOPE_INVALID',
      });
    }

    const admin = await PlatformAdmin.findByPk(decoded.platformAdminId, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Platform admin account is inactive or not found.',
        code: 'PLATFORM_ADMIN_INACTIVE',
      });
    }

    req.platformAdmin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticatePlatformAdmin;
module.exports.platformAccessSecret = platformAccessSecret;
