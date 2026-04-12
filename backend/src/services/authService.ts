// FILE: /backend/src/services/authService.js
// DEPS: bcryptjs, jsonwebtoken, crypto
// ENV: JWT_SECRET, JWT_REFRESH_SECRET

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Agency, Agent, RefreshToken } = require('../models');
const { normalizePhone } = require('../utils/phoneUtils');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const BCRYPT_ROUNDS = 12;

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

/**
 * Registers a new agency and its first admin agent.
 * @param {object} data - Registration data
 * @returns {Promise<object>} { agent, agency, accessToken, refreshToken }
 */
async function register(data) {
  const { agencyName, agencyPhone, agencyEmail, whatsappNumber, agentName, agentEmail, agentPassword } = data;

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
  });

  // Hash password and create admin agent
  const passwordHash = await bcrypt.hash(agentPassword, BCRYPT_ROUNDS);
  const agent = await Agent.create({
    agencyId: agency.id,
    name: agentName,
    email: agentEmail.toLowerCase(),
    passwordHash,
    role: 'ADMIN',
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

  return { agent: agentData, agency: agent.agency, accessToken, refreshToken };
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
  refreshAccessToken,
  logout,
  getProfile,
};
