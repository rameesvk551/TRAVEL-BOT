const bcrypt = require('bcryptjs');
const agentRepository = require('../repositories/agentRepository');
const { DEFAULT_AGENT_PERMISSIONS, ALL_PERMISSIONS, normalizePermissions } = require('../constants/permissions');
const { sendUserWelcomePasswordEmail } = require('./emailService');
const { generateTemporaryPassword } = require('../utils/password');
const brandingService = require('./brandingService');

async function listAgents(agencyId) {
  return agentRepository.findAllByAgency(agencyId);
}

async function createAgent(data, agencyId, requester, agency) {
  const rawPassword = data.password || generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  const role = data.role || 'AGENT';
  const permissions = role === 'ADMIN'
    ? [...ALL_PERMISSIONS]
    : normalizePermissions(data.permissions, DEFAULT_AGENT_PERMISSIONS);

  const agent = await agentRepository.create({
    agencyId,
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash,
    role,
    permissions,
  });

  const safe = agent.toJSON();
  delete safe.passwordHash;

  let welcomeEmailSent = false;
  let emailWarning;
  try {
    const branding = await brandingService.brandingForAgency(agency);
    await sendUserWelcomePasswordEmail({
      to: safe.email,
      userName: safe.name,
      ownerName: requester?.name,
      agencyName: agency?.name || 'your agency',
      password: rawPassword,
      branding,
    });
    welcomeEmailSent = true;
  } catch (err) {
    emailWarning = err.message || 'Failed to send welcome email';
  }

  return {
    agent: safe,
    welcomeEmailSent,
    temporaryPassword: rawPassword,
    emailWarning,
  };
}

async function updateAgent(agentId, agencyId, requester, updates) {
  if (agentId !== requester.id && requester.role !== 'ADMIN') {
    throw Object.assign(new Error('Cannot update other agents'), { statusCode: 403, code: 'FORBIDDEN' });
  }

  const agent = await agentRepository.findByIdAndAgency(agentId, agencyId);
  if (!agent) {
    throw Object.assign(new Error('Agent not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const allowed = ['name', 'phone', 'isOnline'];
  if (requester.role === 'ADMIN') allowed.push('role', 'permissions');

  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (filtered.isOnline !== undefined) {
    filtered.lastSeenAt = new Date();
  }

  if (filtered.permissions !== undefined) {
    filtered.permissions = normalizePermissions(filtered.permissions, []);
  }

  if (filtered.role === 'ADMIN') {
    filtered.permissions = [...ALL_PERMISSIONS];
  }

  const updated = await agentRepository.update(agent, filtered);
  const safe = updated.toJSON();
  delete safe.passwordHash;
  return safe;
}

async function updateMyStatus(agentId, isOnline) {
  await agentRepository.updateById(agentId, {
    isOnline: !!isOnline,
    lastSeenAt: new Date(),
  });
}

module.exports = {
  listAgents,
  createAgent,
  updateAgent,
  updateMyStatus,
  ALL_PERMISSIONS,
};