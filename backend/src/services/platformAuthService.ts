const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PlatformAdmin, PlatformAdminSession } = require('../models');
const { platformAccessSecret } = require('../middleware/authenticatePlatformAdmin');
const { logPlatformAction } = require('./platformAuditService');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 14;

function safeAdmin(admin) {
  const data = admin.toJSON ? admin.toJSON() : { ...admin };
  delete data.passwordHash;
  return data;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(admin) {
  return jwt.sign({
    platformAdminId: admin.id,
    role: admin.role,
    type: 'platform_admin',
  }, platformAccessSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

async function generateRefreshToken(adminId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await PlatformAdminSession.create({
    adminId,
    token: hashToken(rawToken),
    expiresAt,
  });

  return rawToken;
}

async function login(email, password, req) {
  const admin = await PlatformAdmin.findOne({
    where: { email: String(email || '').toLowerCase() },
  });

  if (!admin || !admin.isActive) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'PLATFORM_INVALID_CREDENTIALS' });
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash);
  if (!validPassword) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'PLATFORM_INVALID_CREDENTIALS' });
  }

  await admin.update({ lastLoginAt: new Date() });
  const accessToken = generateAccessToken(admin);
  const refreshToken = await generateRefreshToken(admin.id);

  await logPlatformAction(admin.id, 'PLATFORM_LOGIN', { req });

  return { admin: safeAdmin(admin), accessToken, refreshToken };
}

async function refreshAccessToken(rawRefreshToken) {
  const session = await PlatformAdminSession.findOne({
    where: { token: hashToken(rawRefreshToken || '') },
    include: [{ model: PlatformAdmin, as: 'admin' }],
  });

  if (!session || session.revokedAt) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401, code: 'PLATFORM_INVALID_REFRESH_TOKEN' });
  }

  if (new Date() > session.expiresAt) {
    throw Object.assign(new Error('Refresh token has expired'), { statusCode: 401, code: 'PLATFORM_EXPIRED_REFRESH_TOKEN' });
  }

  if (!session.admin || !session.admin.isActive) {
    throw Object.assign(new Error('Platform admin account is inactive'), { statusCode: 401, code: 'PLATFORM_ADMIN_INACTIVE' });
  }

  await session.update({ revokedAt: new Date() });

  return {
    accessToken: generateAccessToken(session.admin),
    refreshToken: await generateRefreshToken(session.admin.id),
  };
}

async function logout(rawRefreshToken, adminId, req) {
  if (rawRefreshToken) {
    const session = await PlatformAdminSession.findOne({ where: { token: hashToken(rawRefreshToken) } });
    if (session && !session.revokedAt) {
      await session.update({ revokedAt: new Date() });
    }
  }

  await logPlatformAction(adminId, 'PLATFORM_LOGOUT', { req });
}

async function getProfile(adminId) {
  const admin = await PlatformAdmin.findByPk(adminId, {
    attributes: { exclude: ['passwordHash'] },
  });
  if (!admin) {
    throw Object.assign(new Error('Platform admin not found'), { statusCode: 404, code: 'PLATFORM_ADMIN_NOT_FOUND' });
  }
  return admin;
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  getProfile,
};
