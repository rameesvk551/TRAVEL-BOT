// FILE: /backend/src/services/authService.js
// DEPS: bcryptjs, jsonwebtoken, crypto
// ENV: JWT_SECRET, JWT_REFRESH_SECRET

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Agency, Agent, RefreshToken, Partner } = require('../models');
const { normalizePhone } = require('../utils/phoneUtils');
const { ALL_PERMISSIONS } = require('../constants/permissions');
const { sendPasswordResetEmail } = require('./emailService');
const brandingService = require('./brandingService');
const pipelineService = require('./pipelineService');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;

/**
 * Generates a JWT access token.
 * @param {object} payload - { agentId, agencyId, role }
 * @returns {string} JWT token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generates a random refresh token and stores its hash in the database.
 * @param {string} agentId - The agent's ID
 * @returns {Promise<string>} The raw refresh token (sent to client)
 */
async function generateRefreshToken(agentId) {
  const rawToken = crypto.randomBytes(64).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await RefreshToken.create({
    agentId,
    token: hashedToken,
    expiresAt,
  });

  return rawToken;
}

// Subdomains that would collide with real routes on the public host.
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'lead', 'public', 'sites', 'static', 'assets']);

/**
 * Derives a unique, readable subdomain from an agency name ("GetOutHouse.in" ->
 * "getouthouse-in"), appending -2, -3 … on collision. Never throws: falls back to a
 * generic slug so registration can't fail over a name we can't slugify.
 */
async function generateAgencySubdomain(agencyName) {
  try {
    const root = String(agencyName || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '') || 'agency';
    const base = RESERVED_SUBDOMAINS.has(root) ? `${root}-travel` : root;

    for (let n = 1; n <= 50; n += 1) {
      const candidate = n === 1 ? base : `${base}-${n}`.slice(0, 63);
      const clash = await Agency.findOne({ where: { subdomain: candidate }, attributes: ['id'] });
      if (!clash) return candidate;
    }
  } catch (err) {
    console.error('[authService] subdomain generation failed:', err.message);
  }
  return null; // link falls back to the agency UUID
}

/**
 * Registers a new agency and its first admin agent.
 * @param {object} data - Registration data
 * @returns {Promise<object>} { agent, agency, accessToken, refreshToken }
 */
async function register(data) {
  const { agencyName, agencyPhone, agencyEmail, whatsappNumber, agentName, agentEmail, agentPassword, industry } = data;

  // Check uniqueness
  const existingAgency = await Agency.findOne({
    where: { email: agencyEmail },
  });
  if (existingAgency) {
    throw Object.assign(new Error('An agency with this email already exists'), { statusCode: 409, code: 'DUPLICATE_EMAIL' });
  }

  const existingAgent = await Agent.findOne({
    where: { email: agentEmail },
  });
  if (existingAgent) {
    throw Object.assign(new Error('An agent with this email already exists'), { statusCode: 409, code: 'DUPLICATE_EMAIL' });
  }

  // Create agency
  const agency = await Agency.create({
    name: agencyName,
    phone: normalizePhone(agencyPhone),
    email: agencyEmail.toLowerCase(),
    whatsappNumber: normalizePhone(whatsappNumber),
    // Every agency gets a readable subdomain up front — it is the :agencyKey in the
    // public lead-form link (/lead/:agencyKey). Without it the link falls back to the
    // raw agency UUID, which works but is useless in an Instagram bio.
    subdomain: await generateAgencySubdomain(agencyName),
    // Passive vertical marker; column defaults to TRAVEL when omitted.
    ...(industry ? { industry } : {}),
  });

  // Seed the default pipeline statuses so a newly onboarded agency has a working
  // funnel from day one (before anyone opens the CRM). Idempotent and race-safe;
  // the agency can rename, recolor, reorder, add or remove them afterwards.
  await pipelineService.ensureDefaultStages(agency.id).catch((err) => {
    console.error('Failed to seed default pipeline stages for agency', agency.id, err);
  });

  // Hash password and create admin agent
  const passwordHash = await bcrypt.hash(agentPassword, BCRYPT_ROUNDS);
  const agent = await Agent.create({
    agencyId: agency.id,
    name: agentName,
    email: agentEmail.toLowerCase(),
    passwordHash,
    role: 'ADMIN',
    permissions: ALL_PERMISSIONS,
    lastSeenAt: new Date(),
  });

  const accessToken = generateAccessToken({
    agentId: agent.id,
    agencyId: agency.id,
    role: agent.role,
  });
  const refreshToken = await generateRefreshToken(agent.id);

  // Remove sensitive fields
  const agentData = agent.toJSON();
  delete agentData.passwordHash;

  return { agent: agentData, agency, accessToken, refreshToken };
}

/**
 * Authenticates an agent with email and password.
 * @param {string} email - Agent email
 * @param {string} password - Plain text password
 * @returns {Promise<object>} { agent, agency, accessToken, refreshToken }
 */
async function login(email, password) {
  const agent = await Agent.findOne({
    where: { email: email.toLowerCase() },
    include: [{ model: Agency, as: 'agency' }],
  });

  if (!agent) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  const validPassword = await bcrypt.compare(password, agent.passwordHash);
  if (!validPassword) {
    throw Object.assign(new Error('Invalid email or password'), { statusCode: 401, code: 'INVALID_CREDENTIALS' });
  }

  if (!agent.agency.isActive) {
    throw Object.assign(new Error('Your agency account is inactive'), { statusCode: 403, code: 'AGENCY_INACTIVE' });
  }

  // White-label cascade: a suspended/inactive reseller blocks its agencies' logins.
  if (agent.agency.partnerId) {
    const partner = await Partner.findByPk(agent.agency.partnerId, {
      attributes: ['id', 'isActive', 'billingStatus'],
    });
    if (partner && (!partner.isActive || partner.billingStatus === 'SUSPENDED')) {
      throw Object.assign(new Error('This account is temporarily unavailable. Please contact support.'), {
        statusCode: 403,
        code: 'PARTNER_SUSPENDED',
      });
    }
  }

  // Update last seen
  await agent.update({ lastSeenAt: new Date(), isOnline: true });

  const accessToken = generateAccessToken({
    agentId: agent.id,
    agencyId: agent.agency.id,
    role: agent.role,
  });
  const refreshToken = await generateRefreshToken(agent.id);

  const agentData = agent.toJSON();
  delete agentData.passwordHash;

  const branding = await brandingService.brandingForAgency(agent.agency);

  return { agent: agentData, agency: agent.agency, accessToken, refreshToken, branding };
}

/**
 * Refreshes an access token using a valid refresh token.
 * Implements token rotation (old token revoked, new one issued).
 * @param {string} rawRefreshToken - The raw refresh token from client
 * @returns {Promise<object>} { accessToken, refreshToken }
 */
async function refreshAccessToken(rawRefreshToken) {
  const hashedToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  const tokenRecord = await RefreshToken.findOne({
    where: { token: hashedToken },
    include: [{ model: Agent, as: 'agent', include: [{ model: Agency, as: 'agency' }] }],
  });

  if (!tokenRecord) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  if (tokenRecord.revokedAt) {
    throw Object.assign(new Error('Refresh token has been revoked'), { statusCode: 401, code: 'REVOKED_REFRESH_TOKEN' });
  }

  if (new Date() > tokenRecord.expiresAt) {
    throw Object.assign(new Error('Refresh token has expired'), { statusCode: 401, code: 'EXPIRED_REFRESH_TOKEN' });
  }

  // Revoke old token
  await tokenRecord.update({ revokedAt: new Date() });

  // Issue new tokens
  const accessToken = generateAccessToken({
    agentId: tokenRecord.agent.id,
    agencyId: tokenRecord.agent.agency.id,
    role: tokenRecord.agent.role,
  });
  const newRefreshToken = await generateRefreshToken(tokenRecord.agent.id);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Logs out by revoking the refresh token.
 * @param {string} rawRefreshToken - The raw refresh token
 */
async function logout(rawRefreshToken) {
  const hashedToken = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const tokenRecord = await RefreshToken.findOne({ where: { token: hashedToken } });
  if (tokenRecord) {
    await tokenRecord.update({ revokedAt: new Date() });
  }
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a one-time password reset token and emails it to the agent.
 * Always returns a generic success response to avoid account enumeration.
 */
async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const agent = await Agent.findOne({
    where: { email: normalizedEmail },
    include: [{ model: Agency, as: 'agency' }],
  });

  if (!agent) {
    return { emailSent: false };
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const resetPasswordTokenHash = hashPasswordResetToken(rawToken);
  const resetPasswordExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

  await agent.update({
    resetPasswordTokenHash,
    resetPasswordExpiresAt,
  });

  const branding = await brandingService.brandingForAgency(agent.agency);
  await sendPasswordResetEmail({
    to: agent.email,
    userName: agent.name,
    token: rawToken,
    branding,
  });

  return { emailSent: true };
}

/**
 * Resets an agent password using a valid one-time reset token.
 */
async function resetPassword(token, password) {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    throw Object.assign(new Error('Reset link is invalid or expired'), { statusCode: 400, code: 'INVALID_RESET_TOKEN' });
  }

  const tokenHash = hashPasswordResetToken(rawToken);
  const agent = await Agent.findOne({
    where: {
      resetPasswordTokenHash: tokenHash,
    },
  });

  if (!agent || !agent.resetPasswordExpiresAt || new Date() > new Date(agent.resetPasswordExpiresAt)) {
    throw Object.assign(new Error('Reset link is invalid or expired'), { statusCode: 400, code: 'INVALID_RESET_TOKEN' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await agent.update({
    passwordHash,
    resetPasswordTokenHash: null,
    resetPasswordExpiresAt: null,
  });

  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { agentId: agent.id, revokedAt: null } }
  );

  return { success: true };
}

/**
 * Gets the current agent profile with agency info.
 * @param {string} agentId - The agent ID
 * @returns {Promise<object>} Agent with agency
 */
async function getProfile(agentId) {
  const agent = await Agent.findByPk(agentId, {
    attributes: { exclude: ['passwordHash'] },
    include: [{ model: Agency, as: 'agency' }],
  });
  if (!agent) {
    throw Object.assign(new Error('Agent not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return agent;
}

module.exports = {
  register,
  login,
  requestPasswordReset,
  resetPassword,
  refreshAccessToken,
  logout,
  getProfile,
};
