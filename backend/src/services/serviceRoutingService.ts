const { Op } = require('sequelize');
const { Agent, Lead, ServiceRoutingRule } = require('../models');

const INTENT_ALIASES = {
  property: 'properties',
  properties: 'properties',
  stay: 'staycations',
  stays: 'staycations',
  staycation: 'staycations',
  staycations: 'staycations',
  package: 'packages',
  packages: 'packages',
  trip: 'packages',
  trips: 'packages',
  plan_trip: 'packages',
  custom_trip: 'packages',
  visa: 'visa',
  visas: 'visa',
  visa_ticketing: 'visa',
  ticketing: 'visa',
  flight: 'visa',
  rail: 'visa',
  train: 'visa',
};

const DEFAULT_INTENTS = [
  { key: 'properties', label: 'Properties' },
  { key: 'staycations', label: 'Staycations' },
  { key: 'packages', label: 'Packages' },
  { key: 'visa', label: 'Visa Services' },
];

const ACTIVE_LEAD_STATUSES = [
  'JUST_CONTACTED',
  'PACKAGE_SEARCHED',
  'PACKAGE_INTERESTED',
  'NEW',
  'ENQUIRY',
  'CONTACTED',
  'QUOTED',
  'NEGOTIATING',
];

function normalizeIntentKey(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return INTENT_ALIASES[normalized] || normalized.slice(0, 80);
}

async function listRoutingRules(agencyId) {
  const rules = await ServiceRoutingRule.findAll({
    where: { agencyId },
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone', 'isOnline'] }],
    order: [['intentKey', 'ASC'], ['priority', 'ASC'], ['createdAt', 'ASC']],
  });

  return rules.map((rule) => {
    const json = rule.toJSON();
    json.intentKey = normalizeIntentKey(json.intentKey);
    return json;
  });
}

async function replaceRoutingRules(agencyId, items = []) {
  if (!Array.isArray(items)) {
    throw Object.assign(new Error('rules must be an array'), { statusCode: 400, code: 'INVALID_RULES' });
  }

  const normalizedItems = items
    .map((item) => ({
      intentKey: normalizeIntentKey(item.intentKey),
      agentId: String(item.agentId || '').trim(),
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 100,
      isActive: item.isActive !== false,
    }))
    .filter((item) => item.intentKey && item.agentId);

  const agentIds = [...new Set(normalizedItems.map((item) => item.agentId))];
  if (agentIds.length > 0) {
    const validAgents = await Agent.count({
      where: { agencyId, id: { [Op.in]: agentIds } },
    });

    if (validAgents !== agentIds.length) {
      throw Object.assign(new Error('One or more agents do not belong to this agency'), {
        statusCode: 400,
        code: 'INVALID_AGENT',
      });
    }
  }

  await ServiceRoutingRule.destroy({ where: { agencyId } });

  if (normalizedItems.length === 0) return [];

  await ServiceRoutingRule.bulkCreate(
    normalizedItems.map((item) => ({
      agencyId,
      intentKey: item.intentKey,
      agentId: item.agentId,
      priority: item.priority,
      isActive: item.isActive,
    }))
  );

  return listRoutingRules(agencyId);
}

async function findLeastBusyAgent(agencyId) {
  const agents = await Agent.findAll({
    where: { agencyId },
    attributes: ['id', 'name', 'email', 'phone', 'isOnline'],
  });

  if (agents.length === 0) return null;

  const onlineAgents = agents.filter((agent) => agent.isOnline);
  const pool = onlineAgents.length ? onlineAgents : agents;

  const loads = await Promise.all(pool.map(async (agent) => {
    const count = await Lead.count({
      where: {
        agencyId,
        assignedAgentId: agent.id,
        status: { [Op.in]: ACTIVE_LEAD_STATUSES },
      },
    });
    return { agent, count };
  }));

  loads.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    return String(a.agent.name || '').localeCompare(String(b.agent.name || ''));
  });

  return loads[0]?.agent || null;
}

async function resolveAgentForIntent(agencyId, intentKey) {
  const normalizedIntent = normalizeIntentKey(intentKey);
  if (!normalizedIntent) return findLeastBusyAgent(agencyId);

  const rules = await ServiceRoutingRule.findAll({
    where: {
      agencyId,
      intentKey: normalizedIntent,
      isActive: true,
    },
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone', 'isOnline'] }],
    order: [['priority', 'ASC'], ['createdAt', 'ASC']],
  });

  const candidates = rules.map((rule) => rule.agent).filter(Boolean);
  if (candidates.length === 1) return candidates[0];

  if (candidates.length > 1) {
    const loads = await Promise.all(candidates.map(async (agent) => {
      const count = await Lead.count({
        where: {
          agencyId,
          assignedAgentId: agent.id,
          status: { [Op.in]: ACTIVE_LEAD_STATUSES },
        },
      });
      return { agent, count };
    }));
    loads.sort((a, b) => a.count - b.count);
    return loads[0].agent;
  }

  return findLeastBusyAgent(agencyId);
}

async function assignLeadToIntentAgent(lead, agencyId, intentKey) {
  if (!lead?.id) return { lead, agent: null, intentKey: normalizeIntentKey(intentKey), changed: false };

  const normalizedIntent = normalizeIntentKey(intentKey);

  if (lead.assignedAgentId) {
    const existingAgent = await Agent.findOne({
      where: { id: lead.assignedAgentId, agencyId },
      attributes: ['id', 'name', 'email', 'phone', 'isOnline'],
    });

    if (existingAgent) {
      return {
        lead,
        agent: existingAgent,
        intentKey: normalizedIntent,
        changed: false,
        lockedToExistingAgent: true,
      };
    }
  }

  const agent = await resolveAgentForIntent(agencyId, normalizedIntent);
  if (!agent?.id) return { lead, agent: null, intentKey: normalizedIntent, changed: false };

  if (lead.assignedAgentId === agent.id) {
    return { lead, agent, intentKey: normalizedIntent, changed: false };
  }

  await Lead.update(
    { assignedAgentId: agent.id },
    { where: { id: lead.id, agencyId } }
  );

  const updatedLead = await Lead.findOne({ where: { id: lead.id, agencyId } });
  return { lead: updatedLead || lead, agent, intentKey: normalizedIntent, changed: true };
}

module.exports = {
  DEFAULT_INTENTS,
  normalizeIntentKey,
  listRoutingRules,
  replaceRoutingRules,
  resolveAgentForIntent,
  assignLeadToIntentAgent,
};
