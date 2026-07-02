const { Op } = require('sequelize');
const { Agent, Lead, ServiceRoutingRule, Agency, sequelize } = require('../models');

const ROUTING_STRATEGIES = ['INTENT', 'ROUND_ROBIN'];

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
  visa: 'visas',
  visas: 'visas',
  visa_ticketing: 'visas',
  ticketing: 'visas',
  flight: 'visas',
  rail: 'visas',
  train: 'visas',
  cruise: 'cruises',
  cruises: 'cruises',
  service: 'services',
  services: 'services',
};

function routeKey(prefix, value = '') {
  const suffix = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
  return suffix ? `${prefix}_${suffix}`.slice(0, 80) : prefix;
}

function titleCase(value = '') {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pushUniqueIntent(intents, seen, intent) {
  if (!intent?.key || seen.has(intent.key)) return;
  seen.add(intent.key);
  intents.push(intent);
}

const DEFAULT_INTENTS = [
  { key: 'packages', label: 'Packages' },
  { key: 'cruises', label: 'Cruises' },
  { key: 'visas', label: 'Visas' },
  { key: 'services', label: 'Services' },
  { key: 'properties', label: 'Properties' },
];

async function getDynamicIntents(agencyId) {
  const { Agency, Service, Package, Property, Cruise } = require('../models');
  const [agency, services, packages, properties, cruises] = await Promise.all([
    Agency.findByPk(agencyId),
    Service.findAll({ where: { agencyId, isActive: true }, attributes: ['id', 'name', 'category'], order: [['displayOrder', 'ASC'], ['name', 'ASC']] }),
    Package.findAll({ where: { agencyId, isActive: true }, attributes: ['id', 'name', 'category', 'tourType'], order: [['category', 'ASC'], ['name', 'ASC']] }),
    Property.findAll({ where: { agencyId, isActive: true }, attributes: ['id', 'name', 'propertyType', 'location'], order: [['propertyType', 'ASC'], ['name', 'ASC']] }),
    Cruise.findAll({ where: { agencyId, isActive: true }, attributes: ['id', 'name', 'cruiseLine', 'destinations'], order: [['cruiseLine', 'ASC'], ['name', 'ASC']] }),
  ]);
  const prefs = agency?.sidebarPreferences;
  const intents = [];
  const seen = new Set();

  // Empty/missing prefs = legacy full access; otherwise gate every section/category by enabled modules.
  const hasPrefs = Array.isArray(prefs) && prefs.length > 0;
  const moduleEnabled = (path) => !hasPrefs || prefs.includes(path);

  if (!prefs || !Array.isArray(prefs)) {
    DEFAULT_INTENTS.forEach((intent) => pushUniqueIntent(intents, seen, { ...intent, section: intent.key, level: 'section' }));
  } else {
    if (prefs.includes('/packages')) pushUniqueIntent(intents, seen, { key: 'packages', label: 'All Packages', section: 'packages', level: 'section' });
    if (prefs.includes('/cruises')) pushUniqueIntent(intents, seen, { key: 'cruises', label: 'All Cruises', section: 'cruises', level: 'section' });
    if (prefs.includes('/visas')) pushUniqueIntent(intents, seen, { key: 'visas', label: 'All Visas', section: 'visas', level: 'section' });
    if (prefs.includes('/services')) pushUniqueIntent(intents, seen, { key: 'services', label: 'All Services', section: 'services', level: 'section' });
    if (prefs.includes('/properties')) pushUniqueIntent(intents, seen, { key: 'properties', label: 'All Properties', section: 'properties', level: 'section' });
    if (intents.length === 0) DEFAULT_INTENTS.forEach((intent) => pushUniqueIntent(intents, seen, { ...intent, section: intent.key, level: 'section' }));
  }

  if (moduleEnabled('/services')) {
    services.forEach(service => {
      pushUniqueIntent(intents, seen, {
        key: `service_${service.id}`,
        label: `Service: ${service.name}`,
        section: 'services',
        level: 'item',
        itemId: service.id,
        itemType: 'SERVICE',
        description: service.category || 'Service item',
      });
    });
  }

  if (moduleEnabled('/packages')) {
    const packageCategories = new Set(['DOMESTIC', 'INTERNATIONAL']);
    packages.forEach((pkg) => {
      if (pkg.category) packageCategories.add(String(pkg.category).trim().toUpperCase());
    });
    packageCategories.forEach((category) => {
      pushUniqueIntent(intents, seen, {
        key: routeKey('packages', category),
        label: `Packages: ${titleCase(category)}`,
        section: 'packages',
        level: 'category',
        category,
      });
    });
    pushUniqueIntent(intents, seen, { key: 'packages_custom_trip', label: 'Packages: Custom Trip', section: 'packages', level: 'category', category: 'CUSTOM_TRIP' });
  }

  if (moduleEnabled('/properties')) {
    const propertyTypes = new Set(properties.map((property) => String(property.propertyType || '').trim()).filter(Boolean));
    propertyTypes.forEach((propertyType) => {
      pushUniqueIntent(intents, seen, {
        key: routeKey('properties', propertyType),
        label: `Properties: ${titleCase(propertyType)}`,
        section: 'properties',
        level: 'category',
        category: propertyType,
      });
    });
  }

  if (moduleEnabled('/cruises')) {
    const cruiseLines = new Set(cruises.map((cruise) => String(cruise.cruiseLine || '').trim()).filter(Boolean));
    cruiseLines.forEach((cruiseLine) => {
      pushUniqueIntent(intents, seen, {
        key: routeKey('cruises', cruiseLine),
        label: `Cruises: ${titleCase(cruiseLine)}`,
        section: 'cruises',
        level: 'category',
        category: cruiseLine,
      });
    });
  }

  return intents;
}

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
  let normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('visa_')) return 'visas';

  if (
    normalized.startsWith('service_') ||
    normalized.startsWith('package_') ||
    normalized.startsWith('packages_') ||
    normalized.startsWith('property_') ||
    normalized.startsWith('properties_') ||
    normalized.startsWith('cruise_') ||
    normalized.startsWith('cruises_')
  ) {
    return normalized.slice(0, 80);
  }

  normalized = normalized
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (normalized.startsWith('visa_')) return 'visas';

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

  const normalizedItems = [];
  const seenIntentKeys = new Set();

  items
    .map((item) => ({
      intentKey: normalizeIntentKey(item.intentKey),
      agentId: String(item.agentId || '').trim(),
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 100,
      isActive: item.isActive !== false,
    }))
    .filter((item) => item.intentKey && item.agentId)
    .forEach((item) => {
      if (seenIntentKeys.has(item.intentKey)) return;
      seenIntentKeys.add(item.intentKey);
      normalizedItems.push(item);
    });

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
    where: { agencyId, role: 'AGENT' },
    attributes: ['id', 'name', 'email', 'phone', 'isOnline', 'role'],
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

async function getRoutingStrategy(agencyId) {
  const agency = await Agency.findByPk(agencyId, { attributes: ['leadRoutingStrategy'] });
  const strategy = agency?.leadRoutingStrategy;
  return ROUTING_STRATEGIES.includes(strategy) ? strategy : 'INTENT';
}

async function setRoutingStrategy(agencyId, strategy) {
  const normalized = String(strategy || '').trim().toUpperCase();
  if (!ROUTING_STRATEGIES.includes(normalized)) {
    throw Object.assign(new Error('Invalid routing strategy'), { statusCode: 400, code: 'INVALID_STRATEGY' });
  }
  await Agency.update({ leadRoutingStrategy: normalized }, { where: { id: agencyId } });
  return normalized;
}

/**
 * Pure rotation helper: given an ordered agent list and the last-assigned agent id,
 * return the next agent in strict A->B->C->A order. Exported for unit testing.
 */
function pickNextInRotation(agents, cursorAgentId) {
  if (!Array.isArray(agents) || agents.length === 0) return null;
  if (!cursorAgentId) return agents[0];
  const idx = agents.findIndex((agent) => agent.id === cursorAgentId);
  if (idx === -1) return agents[0];
  return agents[(idx + 1) % agents.length];
}

/**
 * Atomically advance the agency round-robin cursor and return the next agent.
 * Locks the agency row so two simultaneous inbound messages cannot land on the
 * same staff member.
 */
async function resolveNextRoundRobinAgent(agencyId) {
  return sequelize.transaction(async (transaction) => {
    const agency = await Agency.findByPk(agencyId, {
      attributes: ['id', 'roundRobinCursorAgentId'],
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!agency) return null;

    const agents = await Agent.findAll({
      where: { agencyId, role: 'AGENT' },
      attributes: ['id', 'name', 'email', 'phone', 'isOnline', 'role'],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      transaction,
    });
    if (agents.length === 0) return null;

    const next = pickNextInRotation(agents, agency.roundRobinCursorAgentId);
    if (!next) return null;

    await agency.update({ roundRobinCursorAgentId: next.id }, { transaction });
    return next;
  });
}

async function resolveAgentForIntent(agencyId, intentKey) {
  const strategy = await getRoutingStrategy(agencyId);
  if (strategy === 'ROUND_ROBIN') {
    const rrAgent = await resolveNextRoundRobinAgent(agencyId);
    if (rrAgent) return rrAgent;
    // No agents at all -> fall through to intent logic, which also returns null.
  }

  const normalizedIntent = normalizeIntentKey(intentKey);
  if (!normalizedIntent) return findLeastBusyAgent(agencyId);

  const findCandidatesForIntent = (key) => ServiceRoutingRule.findAll({
    where: {
      agencyId,
      intentKey: key,
      isActive: true,
    },
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone', 'isOnline'] }],
    order: [['priority', 'ASC'], ['createdAt', 'ASC']],
  });

  const chooseLeastBusy = async (candidates) => {
    if (candidates.length === 1) return candidates[0];
    if (candidates.length <= 1) return null;
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
  };

  const fallbackIntent = (() => {
    if (normalizedIntent.startsWith('service_')) return 'services';
    if (normalizedIntent.startsWith('package_')) return 'packages';
    if (normalizedIntent.startsWith('packages_')) return 'packages';
    if (normalizedIntent.startsWith('property_')) return 'properties';
    if (normalizedIntent.startsWith('properties_')) return 'properties';
    if (normalizedIntent.startsWith('cruise_')) return 'cruises';
    if (normalizedIntent.startsWith('cruises_')) return 'cruises';
    if (normalizedIntent.startsWith('visa_')) return 'visas';
    return '';
  })();

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
  const exactAgent = await chooseLeastBusy(candidates);
  if (exactAgent) return exactAgent;

  if (fallbackIntent && fallbackIntent !== normalizedIntent) {
    const fallbackRules = await findCandidatesForIntent(fallbackIntent);
    const fallbackAgent = await chooseLeastBusy(fallbackRules.map((rule) => rule.agent).filter(Boolean));
    if (fallbackAgent) return fallbackAgent;
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
  getDynamicIntents,
  normalizeIntentKey,
  listRoutingRules,
  replaceRoutingRules,
  resolveAgentForIntent,
  assignLeadToIntentAgent,
  getRoutingStrategy,
  setRoutingStrategy,
  resolveNextRoundRobinAgent,
  pickNextInRotation,
  ROUTING_STRATEGIES,
};
