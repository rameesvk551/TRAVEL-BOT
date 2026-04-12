const bcrypt = require('bcryptjs');
const agentRepository = require('../repositories/agentRepository');

async function listAgents(agencyId) {
  return agentRepository.findAllByAgency(agencyId);
}

async function createAgent(data, agencyId) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const agent = await agentRepository.create({
    agencyId,
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash,
    role: data.role || 'AGENT',
  });

  const safe = agent.toJSON();
  delete safe.passwordHash;
  return safe;
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
  if (requester.role === 'ADMIN') allowed.push('role');

  const filtered = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  if (filtered.isOnline !== undefined) {
    filtered.lastSeenAt = new Date();
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
};