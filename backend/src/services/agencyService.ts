const agencyRepository = require('../repositories/agencyRepository');
const { encrypt } = require('../utils/crypto');
const { normalizePhone } = require('../utils/phoneUtils');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const marketingOsPartnerService = require('./marketingOsPartnerService');
const flowService = require('./flowService');
const templateService = require('./templateService');
const websiteBuilderService = require('./websiteBuilderService');
const { normalizeLeadFormConfig } = require('./leadFormConfig');
const { AgencyChannel, Package, Property, Service, Visa, Cruise, WhatsAppFlow } = require('../models');

const CALLBACK_SECRET = process.env.MARKETING_OS_WEBHOOK_SECRET || '';
const WEBHOOK_APP_SECRET = process.env.WEBHOOK_APP_SECRET || '';
const SESSION_SECRET = process.env.MARKETING_OS_SESSION_SECRET || process.env.JWT_SECRET || 'travelbot_marketing_os_session_secret';
const INTERNAL_BOT_WEBHOOK_URL = process.env.INTERNAL_BOT_WEBHOOK_URL || `http://127.0.0.1:${process.env.BOT_PORT || 3001}/webhook`;
const DEFAULT_WHATSAPP_MENU_LABELS = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Plan a Trip',
  staycations: 'Staycations',
  flight: 'Flight',
  rail: 'Rail',
  domestic: 'Domestic',
  international: 'International',
  customTrip: 'Custom Trip',
};

const marketingOsCallbackSchema = z.object({
  agencyId: z.string().uuid(),
  status: z.enum(['NOT_CONNECTED', 'PENDING', 'CONNECTED', 'FAILED']),
  whatsappNumber: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
  businessAccountId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  channelId: z.string().optional(),
  errorMessage: z.string().optional(),
});

const connectSessionOptionsSchema = z.object({
  onboardingMode: z.enum(['standard', 'coexistence']).optional(),
});

function signEmbeddedSession(payload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: '15m' });
}

function verifyEmbeddedSession(token) {
  return jwt.verify(token, SESSION_SECRET);
}

function getDerivedConnectionStatus(agency) {
  if (agency.whatsappConnectionStatus && agency.whatsappConnectionStatus !== 'NOT_CONNECTED') {
    return agency.whatsappConnectionStatus;
  }

  if (agency.whatsappProvider === 'MARKETING_OS') {
    return agency.whatsappNumber ? 'PENDING' : 'NOT_CONNECTED';
  }

  return agency.whatsappNumber ? 'CONNECTED' : 'NOT_CONNECTED';
}

function serializeWhatsAppConnection(agency) {
  const status = getDerivedConnectionStatus(agency);
  const canLaunchEmbeddedSignup = agency.whatsappProvider === 'MARKETING_OS';
  const onboardingMode = agency.whatsappOnboardingMode || 'STANDARD';

  return {
    provider: agency.whatsappProvider,
    status,
    channelId: agency.whatsappChannelId || null,
    businessAccountId: agency.whatsappBusinessAccountId || null,
    phoneNumberId: agency.whatsappPhoneNumberId || null,
    displayPhoneNumber: agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || null,
    errorMessage: agency.whatsappConnectionError || null,
    lastSyncedAt: agency.whatsappLastSyncedAt || null,
    connectUrl: null,
    canLaunchEmbeddedSignup,
    marketingOsTenantId: agency.marketingOsTenantId || null,
    onboardingMode,
    coexistence: {
      enabled: onboardingMode === 'COEXISTENCE' || agency.whatsappCoexistenceStatus === 'ACTIVE',
      status: agency.whatsappCoexistenceStatus || 'NOT_ENABLED',
      contactSyncStatus: agency.whatsappContactSyncStatus || 'NOT_STARTED',
      historySyncStatus: agency.whatsappHistorySyncStatus || 'NOT_STARTED',
      lastSyncedAt: agency.whatsappCoexistenceLastSyncedAt || null,
    },
    tripFlow: {
      id: agency.whatsappTripFlowId || null,
      name: agency.whatsappTripFlowName || null,
      status: agency.whatsappTripFlowStatus || null,
      errorMessage: agency.whatsappTripFlowError || null,
      lastSyncedAt: agency.whatsappTripFlowLastSyncedAt || null,
    },
  };
}

function normalizeWhatsAppMenuLabels(labels = {}) {
  if (!labels || typeof labels !== 'object' || Array.isArray(labels)) {
    return {};
  }

  return Object.fromEntries(
    Object.keys(DEFAULT_WHATSAPP_MENU_LABELS)
      .map((key) => [key, String(labels[key] || '').trim().slice(0, 20)])
      .filter(([, value]) => value.length > 0)
  );
}

function toMenuId(value, fallback) {
  const raw = String(value || fallback || '').trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function normalizeWhatsAppMenuConfig(items = []) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const type = String(item.type || '').trim().toUpperCase();
      if (!['PACKAGE_CATEGORY', 'PROPERTY', 'SERVICE', 'CUSTOM_TRIP'].includes(type)) return null;

      const title = String(item.title || '').trim().slice(0, 24);
      if (!title) return null;

      const value = String(item.value || '').trim().slice(0, 80);
      const id = toMenuId(item.id, `${type}_${value || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: String(item.description || '').trim().slice(0, 72),
        type,
        value,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

const FLOW_ACTIONS = new Set([
  'OPEN_PACKAGE_CATEGORY_MENU',
  'OPEN_PROPERTY_FLOW',
  'OPEN_SERVICE_MENU',
  'OPEN_CUSTOM_TRIP_FLOW',
  'SHOW_TOUR_TYPE_LIST',
  'OPEN_PACKAGE_FLOW',
  'CAPTURE_SERVICE_DETAILS',
]);

const FLOW_GRAPH_NODE_TYPES = new Set([
  'START',
  'MESSAGE',
  'BUTTONS',
  'LIST',
  'QUESTION',
  'CONDITION',
  'CATALOG_LIST',
  'SEARCH',
  'WHATSAPP_BUTTON',
  'SEND_ITEM_DETAIL',
  'SEND_ITEM_DOCUMENT',
  'SAVE_ENQUIRY',
  'NOTIFY_STAFF',
  'OPEN_SERVICE',
  'OPEN_PACKAGE_FLOW',
  'OPEN_PROPERTY_FLOW',
  'OPEN_VISA_FLOW',
  'OPEN_CRUISE_FLOW',
  'OPEN_SERVICE_FLOW',
  'OPEN_CUSTOM_TRIP_FLOW',
  'OPEN_META_FLOW',
  'HANDOFF',
  'END',
]);

const FLOW_GRAPH_FIELD_LIMITS = {
  body: 1024,
  prompt: 1024,
  message: 1024,
  title: 24,
  label: 24,
  description: 72,
  fieldKey: 48,
  value: 120,
  emptyMessage: 300,
  notePrefix: 80,
  staffMessage: 1500,
};

function normalizeFlowMenuItems(items = [], limit = 10) {
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const action = String(item.action || '').trim().toUpperCase();
      if (!FLOW_ACTIONS.has(action)) return null;

      const title = String(item.title || '').trim().slice(0, 24);
      if (!title) return null;

      const category = String(item.category || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32);
      const tourType = String(item.tourType || item.value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 80);
      const id = toMenuId(item.id, `${action}_${category || tourType || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: String(item.description || '').trim().slice(0, 72),
        action,
        ...(category ? { category } : {}),
        ...(tourType ? { tourType, value: tourType } : {}),
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeFlowValue(value, limit = 80) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, limit);
}

function normalizeFlowGraphText(value, limit = 255) {
  return String(value || '').trim().slice(0, limit);
}

function normalizeGraphNodeId(value, fallback) {
  return toMenuId(value, fallback).slice(0, 80);
}

function normalizeGraphOption(option = {}, fallbackPrefix, index, titleLimit = 24) {
  const label = normalizeFlowGraphText(option.label || option.title || `Option ${index + 1}`, titleLimit);
  const id = normalizeGraphNodeId(option.id || option.value, `${fallbackPrefix}_${index + 1}`);
  if (!id || !label) return null;
  return {
    id,
    label,
    title: normalizeFlowGraphText(option.title || label, titleLimit),
    description: normalizeFlowGraphText(option.description, FLOW_GRAPH_FIELD_LIMITS.description),
    value: normalizeFlowGraphText(option.value || id, FLOW_GRAPH_FIELD_LIMITS.value),
  };
}

const FLOW_CATALOG_TYPES = new Set(['SERVICE', 'PACKAGE', 'PROPERTY', 'VISA', 'CRUISE']);

function normalizeCatalogType(value, fallback = 'SERVICE') {
  const type = String(value || '').trim().toUpperCase();
  return FLOW_CATALOG_TYPES.has(type) ? type : fallback;
}

function normalizeGraphItemOverride(item = {}, fallbackType = 'SERVICE') {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const itemType = normalizeCatalogType(item.itemType || item.catalogType || fallbackType, fallbackType);
  const itemId = normalizeFlowGraphText(item.itemId || item.id, 80);
  if (!itemId) return null;
  return {
    itemType,
    itemId,
    label: normalizeFlowGraphText(item.label || item.itemName || itemId, 48),
  };
}

// Instagram-only rendering mode for catalog/search results: LIST (numbered text + images),
// CARDS (one generic-template card per item), or CAROUSEL (a swipeable row of cards).
function normalizeIgCardMode(value) {
  const v = String(value || '').trim().toUpperCase();
  return ['CARDS', 'CAROUSEL'].includes(v) ? v : 'LIST';
}

function normalizeGraphData(type, data = {}, nodeId = '') {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const normalized = {};

  if (source.label !== undefined) normalized.label = normalizeFlowGraphText(source.label, FLOW_GRAPH_FIELD_LIMITS.label);
  if (source.title !== undefined) normalized.title = normalizeFlowGraphText(source.title, FLOW_GRAPH_FIELD_LIMITS.title);
  if (source.body !== undefined) normalized.body = normalizeFlowGraphText(source.body, FLOW_GRAPH_FIELD_LIMITS.body);
  if (source.prompt !== undefined) normalized.prompt = normalizeFlowGraphText(source.prompt, FLOW_GRAPH_FIELD_LIMITS.prompt);
  if (source.message !== undefined) normalized.message = normalizeFlowGraphText(source.message, FLOW_GRAPH_FIELD_LIMITS.message);
  if (source.fieldKey !== undefined) normalized.fieldKey = toMenuId(source.fieldKey, 'answer').slice(0, FLOW_GRAPH_FIELD_LIMITS.fieldKey);
  if (source.operator !== undefined) {
    const operator = String(source.operator || '').trim().toUpperCase();
    normalized.operator = ['EQUALS', 'CONTAINS', 'EXISTS', 'NOT_EQUALS'].includes(operator) ? operator : 'EXISTS';
  }
  if (source.value !== undefined) normalized.value = normalizeFlowGraphText(source.value, FLOW_GRAPH_FIELD_LIMITS.value);
  if (source.catalogType !== undefined) {
    const rawCatalogType = String(source.catalogType || '').trim().toUpperCase();
    normalized.catalogType = type === 'SEND_ITEM_DETAIL' && rawCatalogType === 'AUTO'
      ? 'AUTO'
      : normalizeCatalogType(source.catalogType);
  }
  if (source.emptyMessage !== undefined) normalized.emptyMessage = normalizeFlowGraphText(source.emptyMessage, FLOW_GRAPH_FIELD_LIMITS.emptyMessage);
  if (source.notePrefix !== undefined) normalized.notePrefix = normalizeFlowGraphText(source.notePrefix, FLOW_GRAPH_FIELD_LIMITS.notePrefix);
  if (source.finalMessage !== undefined) normalized.finalMessage = normalizeFlowGraphText(source.finalMessage, FLOW_GRAPH_FIELD_LIMITS.message);
  if (source.staffMessage !== undefined) normalized.staffMessage = normalizeFlowGraphText(source.staffMessage, FLOW_GRAPH_FIELD_LIMITS.staffMessage);
  if (source.fallbackMessage !== undefined) normalized.fallbackMessage = normalizeFlowGraphText(source.fallbackMessage, FLOW_GRAPH_FIELD_LIMITS.emptyMessage);
  if (source.status !== undefined) {
    const status = String(source.status || '').trim().toUpperCase();
    normalized.status = ['NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED'].includes(status) ? status : 'ENQUIRY';
  }
  if (source.category !== undefined) normalized.category = normalizeFlowValue(source.category, 32);
  if (source.tourType !== undefined) normalized.tourType = normalizeFlowValue(source.tourType, 80);
  if (source.serviceCategory !== undefined) normalized.serviceCategory = normalizeFlowValue(source.serviceCategory, 80);
  if (source.serviceKey !== undefined) normalized.serviceKey = normalizeFlowValue(source.serviceKey, 80);
  if (source.serviceId !== undefined) normalized.serviceId = normalizeFlowGraphText(source.serviceId, 80);
  if (source.routingIntentKey !== undefined) normalized.routingIntentKey = toMenuId(source.routingIntentKey, 'properties').slice(0, 80);
  if (source.propertyType !== undefined) normalized.propertyType = normalizeFlowGraphText(source.propertyType, 80);
  if (source.propertyLocation !== undefined) normalized.propertyLocation = normalizeFlowGraphText(source.propertyLocation, 80);
  if (source.flowId !== undefined) normalized.flowId = normalizeFlowGraphText(source.flowId, 80);
  if (source.flowType !== undefined) {
    const flowType = String(source.flowType || '').trim().toUpperCase();
    normalized.flowType = ['PACKAGE', 'PROPERTY', 'VISA', 'CRUISE', 'SERVICE', 'CUSTOM_TRIP', 'REVIEW', 'GENERIC'].includes(flowType) ? flowType : 'GENERIC';
  }
  if (source.cta !== undefined) normalized.cta = normalizeFlowGraphText(source.cta, 20);
  if (source.reason !== undefined) normalized.reason = normalizeFlowGraphText(source.reason, 180);

  if (type === 'BUTTONS') {
    normalized.buttons = (Array.isArray(source.buttons) ? source.buttons : [])
      .map((option, index) => normalizeGraphOption(option, `${nodeId}_button`, index, 20))
      .filter(Boolean)
      .slice(0, 3);
  }

  if (type === 'LIST') {
    normalized.buttonLabel = normalizeFlowGraphText(source.buttonLabel || 'Choose Option', 20);
    normalized.rows = (Array.isArray(source.rows) ? source.rows : [])
      .map((option, index) => normalizeGraphOption(option, `${nodeId}_row`, index, 24))
      .filter(Boolean)
      .slice(0, 10);
  }

  if (type === 'CATALOG_LIST') {
    const catalogType = normalizeCatalogType(source.catalogType);
    normalized.catalogType = catalogType;
    normalized.body = normalizeFlowGraphText(source.body || 'Please choose an option.', FLOW_GRAPH_FIELD_LIMITS.body);
    normalized.buttonLabel = normalizeFlowGraphText(source.buttonLabel || 'View Options', 20);
    normalized.emptyMessage = normalizeFlowGraphText(source.emptyMessage || 'No active options are available right now.', FLOW_GRAPH_FIELD_LIMITS.emptyMessage);
    normalized.itemOverrides = (Array.isArray(source.itemOverrides) ? source.itemOverrides : [])
      .map((item) => normalizeGraphItemOverride(item, catalogType))
      .filter(Boolean)
      .slice(0, 100);
    normalized.igCardMode = normalizeIgCardMode(source.igCardMode);
    normalized.igCardButtonLabel = normalizeFlowGraphText(source.igCardButtonLabel || 'Get details on WhatsApp', 20);
  }

  if (type === 'SEARCH') {
    normalized.catalogType = normalizeCatalogType(source.catalogType, 'PROPERTY');
    normalized.body = normalizeFlowGraphText(source.body || 'Here are the closest matches:', FLOW_GRAPH_FIELD_LIMITS.body);
    normalized.emptyMessage = normalizeFlowGraphText(source.emptyMessage || 'Sorry, I could not find a match for that. Our team will help you shortly.', FLOW_GRAPH_FIELD_LIMITS.emptyMessage);
    normalized.pickPrompt = normalizeFlowGraphText(source.pickPrompt || 'Reply with the number of your choice.', 200);
    normalized.igCardMode = normalizeIgCardMode(source.igCardMode);
    normalized.igCardButtonLabel = normalizeFlowGraphText(source.igCardButtonLabel || 'Get details on WhatsApp', 20);
    const maxResults = parseInt(source.maxResults, 10);
    normalized.maxResults = Number.isFinite(maxResults) ? Math.min(10, Math.max(1, maxResults)) : 6;
    // fieldKey normalized the same way as QUESTION fieldKeys so they always line up at runtime.
    normalized.searchMappings = (Array.isArray(source.searchMappings) ? source.searchMappings : [])
      .map((mapping) => {
        if (!mapping || typeof mapping !== 'object') return null;
        const fieldKey = toMenuId(mapping.fieldKey, '').slice(0, FLOW_GRAPH_FIELD_LIMITS.fieldKey);
        const matchField = normalizeFlowGraphText(mapping.matchField, 40);
        if (!fieldKey || !matchField) return null;
        return { fieldKey, matchField };
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  if (type === 'WHATSAPP_BUTTON') {
    normalized.body = normalizeFlowGraphText(source.body || 'Tap below to chat with us on WhatsApp.', FLOW_GRAPH_FIELD_LIMITS.body);
    normalized.buttonLabel = normalizeFlowGraphText(source.buttonLabel || 'Chat on WhatsApp', 20);
    const target = String(source.target || '').trim().toUpperCase();
    normalized.target = ['ASSIGNED_AGENT', 'CUSTOM'].includes(target) ? target : 'ASSIGNED_AGENT';
    normalized.phone = normalized.target === 'CUSTOM'
      ? String(source.phone || '').replace(/[^0-9+]/g, '').slice(0, 20)
      : '';
  }

  return normalized;
}

async function assertGraphReferencesBelongToAgency(agencyId, nodes = []) {
  const serviceIds = nodes
    .filter((node) => node.type === 'OPEN_SERVICE' && node.data?.serviceId)
    .map((node) => node.data.serviceId);
  const flowIds = nodes
    .filter((node) => node.type === 'OPEN_META_FLOW' && node.data?.flowId)
    .map((node) => node.data.flowId);
  const catalogRefs = {
    SERVICE: [],
    PACKAGE: [],
    PROPERTY: [],
    VISA: [],
    CRUISE: [],
  };

  nodes
    .filter((node) => node.type === 'CATALOG_LIST')
    .forEach((node) => {
      (node.data?.itemOverrides || []).forEach((item) => {
        const itemType = normalizeCatalogType(item.itemType || node.data?.catalogType);
        if (catalogRefs[itemType]) catalogRefs[itemType].push(item.itemId);
      });
    });

  if (serviceIds.length) {
    const services = await Service.findAll({ where: { agencyId, id: serviceIds }, attributes: ['id'] });
    const found = new Set(services.map((item) => String(item.id)));
    const missing = serviceIds.find((id) => !found.has(String(id)));
    if (missing) {
      throw Object.assign(new Error('Selected service is not available for this agency'), {
        statusCode: 400,
        code: 'INVALID_FLOW_SERVICE',
      });
    }
  }

  if (flowIds.length) {
    const flows = await WhatsAppFlow.findAll({ where: { agencyId, id: flowIds }, attributes: ['id'] });
    const found = new Set(flows.map((item) => String(item.id)));
    const missing = flowIds.find((id) => !found.has(String(id)));
    if (missing) {
      throw Object.assign(new Error('Selected WhatsApp flow is not available for this agency'), {
        statusCode: 400,
        code: 'INVALID_FLOW_REFERENCE',
      });
    }
  }

  const checks = [
    ['SERVICE', Service, catalogRefs.SERVICE],
    ['PACKAGE', Package, catalogRefs.PACKAGE],
    ['PROPERTY', Property, catalogRefs.PROPERTY],
    ['VISA', Visa, catalogRefs.VISA],
    ['CRUISE', Cruise, catalogRefs.CRUISE],
  ];

  for (const [type, model, ids] of checks) {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    if (!uniqueIds.length) continue;
    const records = await model.findAll({ where: { agencyId, id: uniqueIds }, attributes: ['id'] });
    const found = new Set(records.map((item) => String(item.id)));
    const missing = uniqueIds.find((id) => !found.has(String(id)));
    if (missing) {
      throw Object.assign(new Error(`Selected ${type.toLowerCase()} is not available for this agency`), {
        statusCode: 400,
        code: `INVALID_FLOW_${type}_REFERENCE`,
      });
    }
  }
}

async function normalizeWhatsAppFlowGraphConfig(agencyId, config = {}) {
  const rawNodes = Array.isArray(config.nodes) ? config.nodes : [];
  const rawEdges = Array.isArray(config.edges) ? config.edges : [];
  const seenNodes = new Set();

  const nodes = rawNodes
    .map((node, index) => {
      if (!node || typeof node !== 'object') return null;
      const type = String(node.type || '').trim().toUpperCase();
      if (!FLOW_GRAPH_NODE_TYPES.has(type)) return null;
      const id = normalizeGraphNodeId(node.id, `${type.toLowerCase()}_${index + 1}`);
      if (!id || seenNodes.has(id)) return null;
      seenNodes.add(id);
      const position = node.position && typeof node.position === 'object'
        ? {
            x: Number.isFinite(Number(node.position.x)) ? Number(node.position.x) : 0,
            y: Number.isFinite(Number(node.position.y)) ? Number(node.position.y) : 0,
          }
        : { x: 0, y: 0 };
      return {
        id,
        type,
        position,
        data: normalizeGraphData(type, node.data || {}, id),
      };
    })
    .filter(Boolean)
    .slice(0, 80);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const seenEdges = new Set();
  const edges = rawEdges
    .map((edge, index) => {
      if (!edge || typeof edge !== 'object') return null;
      const source = normalizeGraphNodeId(edge.source, '');
      const target = normalizeGraphNodeId(edge.target, '');
      if (!source || !target || !nodeIds.has(source) || !nodeIds.has(target)) return null;
      const sourceHandle = normalizeGraphNodeId(edge.sourceHandle || 'default', 'default');
      const id = normalizeGraphNodeId(edge.id, `${source}_${sourceHandle}_${target}_${index}`);
      if (!id || seenEdges.has(id)) return null;
      seenEdges.add(id);
      return { id, source, sourceHandle, target };
    })
    .filter(Boolean)
    .slice(0, 160);

  const startNodes = nodes.filter((node) => node.type === 'START');
  if (startNodes.length !== 1) {
    throw Object.assign(new Error('Flow builder must contain exactly one start node'), {
      statusCode: 400,
      code: 'INVALID_FLOW_GRAPH_START',
    });
  }

  await assertGraphReferencesBelongToAgency(agencyId, nodes);

  const requestedStartNodeId = normalizeGraphNodeId(config.startNodeId, '');

  return {
    schemaVersion: Number(config.schemaVersion) >= 3 ? 3 : 2,
    startNodeId: nodeIds.has(requestedStartNodeId) ? requestedStartNodeId : startNodes[0].id,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

async function normalizeWhatsAppFlowLibraryConfig(agencyId, config = {}) {
  const rawFlows = Array.isArray(config.flows) ? config.flows : [];
  const seen = new Set();
  const flows = [];

  for (let index = 0; index < rawFlows.length; index += 1) {
    const flow = rawFlows[index];
    if (!flow || typeof flow !== 'object' || Array.isArray(flow)) continue;
    const id = normalizeGraphNodeId(flow.id, `flow_${index + 1}`);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const graph = await normalizeWhatsAppFlowGraphConfig(agencyId, {
      schemaVersion: 3,
      startNodeId: flow.startNodeId,
      nodes: flow.nodes,
      edges: flow.edges,
    });
    flows.push({
      id,
      name: normalizeFlowGraphText(flow.name || `Flow ${flows.length + 1}`, 40),
      description: normalizeFlowGraphText(flow.description || '', 120),
      startNodeId: graph.startNodeId,
      nodes: graph.nodes,
      edges: graph.edges,
      updatedAt: new Date().toISOString(),
    });
    if (flows.length >= 20) break;
  }

  if (!flows.length) {
    throw Object.assign(new Error('Flow builder must contain at least one flow'), {
      statusCode: 400,
      code: 'INVALID_FLOW_LIBRARY',
    });
  }

  const requestedEntryFlowId = normalizeGraphNodeId(config.entryFlowId, '');
  const entryFlowId = flows.some((flow) => flow.id === requestedEntryFlowId)
    ? requestedEntryFlowId
    : flows[0].id;

  return {
    schemaVersion: 4,
    entryFlowId,
    flows,
    updatedAt: new Date().toISOString(),
  };
}

async function normalizeWhatsAppFlowConfig(agencyId, config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};

  if (Number(config.schemaVersion) >= 4 && Array.isArray(config.flows)) {
    return normalizeWhatsAppFlowLibraryConfig(agencyId, config);
  }

  if (Number(config.schemaVersion) === 2 || Array.isArray(config.nodes) || Array.isArray(config.edges)) {
    return normalizeWhatsAppFlowGraphConfig(agencyId, config);
  }

  const welcomeMenu = normalizeFlowMenuItems(config.welcomeMenu, 10);
  const packageCategories = normalizeFlowMenuItems(config.packageCategories, 3);
  const tourTypes = normalizeFlowMenuItems(config.tourTypes, 10);
  const serviceMenu = normalizeFlowMenuItems(config.serviceMenu, 10);

  return {
    ...(welcomeMenu.length ? { welcomeMenu } : {}),
    ...(packageCategories.length ? { packageCategories } : {}),
    ...(tourTypes.length ? { tourTypes } : {}),
    ...(serviceMenu.length ? { serviceMenu } : {}),
  };
}

function serializeWhatsAppChannel(channel) {
  if (!channel) return null;
  const row = typeof channel.toJSON === 'function' ? channel.toJSON() : channel;
  return {
    id: row.id,
    agencyId: row.agencyId,
    label: row.label || null,
    isDefault: Boolean(row.isDefault),
    isActive: row.isActive !== false,
    provider: row.whatsappProvider || 'SELF_HOSTED',
    status: row.whatsappConnectionStatus || 'NOT_CONNECTED',
    whatsappNumber: row.whatsappNumber || null,
    displayPhoneNumber: row.whatsappDisplayPhoneNumber || row.whatsappNumber || null,
    phoneNumberId: row.whatsappPhoneNumberId || null,
    businessAccountId: row.whatsappBusinessAccountId || null,
    marketingOsTenantId: row.marketingOsTenantId || null,
    onboardingMode: row.whatsappOnboardingMode || 'STANDARD',
    errorMessage: row.whatsappConnectionError || null,
    lastSyncedAt: row.whatsappLastSyncedAt || null,
    coexistence: {
      enabled: row.whatsappOnboardingMode === 'COEXISTENCE' || row.whatsappCoexistenceStatus === 'ACTIVE',
      status: row.whatsappCoexistenceStatus || 'NOT_ENABLED',
      contactSyncStatus: row.whatsappContactSyncStatus || 'NOT_STARTED',
      historySyncStatus: row.whatsappHistorySyncStatus || 'NOT_STARTED',
      lastSyncedAt: row.whatsappCoexistenceLastSyncedAt || null,
    },
  };
}

async function listWhatsAppChannels(agencyId) {
  const channels = await AgencyChannel.findAll({
    where: { agencyId, isActive: true },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  return channels.map(serializeWhatsAppChannel);
}

async function upsertWhatsAppChannel(agency, values = {}) {
  const displayPhoneNumber = values.displayPhoneNumber || values.whatsappDisplayPhoneNumber || null;
  const whatsappNumber = values.whatsappNumber || (displayPhoneNumber ? normalizePhone(displayPhoneNumber) : null);
  const phoneNumberId = values.phoneNumberId || values.whatsappPhoneNumberId || null;
  const businessAccountId = values.businessAccountId || values.whatsappBusinessAccountId || null;
  const existingDefaultCount = await AgencyChannel.count({ where: { agencyId: agency.id, isDefault: true } });
  const where = phoneNumberId
    ? { agencyId: agency.id, whatsappPhoneNumberId: phoneNumberId }
    : { agencyId: agency.id, whatsappNumber };

  if (!phoneNumberId && !whatsappNumber) return null;

  const payload = {
    agencyId: agency.id,
    label: values.label || displayPhoneNumber || whatsappNumber || 'WhatsApp Channel',
    isDefault: values.isDefault ?? existingDefaultCount === 0,
    isActive: values.isActive ?? true,
    whatsappProvider: values.provider || values.whatsappProvider || 'MARKETING_OS',
    whatsappConnectionStatus: values.status || values.whatsappConnectionStatus || 'CONNECTED',
    whatsappNumber: whatsappNumber || null,
    whatsappDisplayPhoneNumber: displayPhoneNumber || whatsappNumber || null,
    whatsappPhoneNumberId: phoneNumberId || null,
    whatsappBusinessAccountId: businessAccountId || null,
    whatsappCatalogId: values.whatsappCatalogId || agency.whatsappCatalogId || null,
    whatsappOnboardingMode: values.onboardingMode || values.whatsappOnboardingMode || agency.whatsappOnboardingMode || 'STANDARD',
    whatsappCoexistenceStatus: values.whatsappCoexistenceStatus || agency.whatsappCoexistenceStatus || 'NOT_ENABLED',
    whatsappContactSyncStatus: values.whatsappContactSyncStatus || agency.whatsappContactSyncStatus || 'NOT_STARTED',
    whatsappHistorySyncStatus: values.whatsappHistorySyncStatus || agency.whatsappHistorySyncStatus || 'NOT_STARTED',
    whatsappCoexistenceLastSyncedAt: values.whatsappCoexistenceLastSyncedAt || agency.whatsappCoexistenceLastSyncedAt || null,
    whatsappConnectionError: values.errorMessage || values.whatsappConnectionError || null,
    whatsappLastSyncedAt: values.whatsappLastSyncedAt || new Date(),
    marketingOsTenantId: values.marketingOsTenantId || agency.marketingOsTenantId || null,
  };

  const [channel] = await AgencyChannel.findOrCreate({
    where,
    defaults: payload,
  });

  if (!channel.isDefault && payload.isDefault) {
    await AgencyChannel.update({ isDefault: false }, { where: { agencyId: agency.id } });
  }

  await channel.update(payload);
  return channel;
}

function mapMarketingOsStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'connected') return 'CONNECTED';
  if (normalized === 'error' || normalized === 'failed') return 'FAILED';
  if (normalized === 'pending' || normalized === 'connecting') return 'PENDING';
  return 'NOT_CONNECTED';
}

function getRawBodyString(rawBody, payload) {
  if (Buffer.isBuffer(rawBody)) {
    return rawBody.toString('utf8');
  }

  if (typeof rawBody === 'string' && rawBody.length > 0) {
    return rawBody;
  }

  return JSON.stringify(payload || {});
}

function hasValidSharedSecret(headers = {}) {
  if (!CALLBACK_SECRET) {
    return true;
  }

  const headerSecret = headers['x-marketing-os-secret'] || headers.authorization?.replace(/^Bearer\s+/i, '');
  return headerSecret === CALLBACK_SECRET;
}

function hasValidSignedProxySignature(headers = {}, rawPayload = '') {
  const signatureHeader = headers['x-marketing-os-signature'];
  if (!signatureHeader) {
    return false;
  }

  const normalizedSignature = String(signatureHeader).replace(/^sha256=/i, '');
  const candidateSecrets = [CALLBACK_SECRET, WEBHOOK_APP_SECRET].filter(Boolean);
  if (!candidateSecrets.length) {
    return true;
  }

  return candidateSecrets.some((secret) => {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedSignature));
    } catch (err) {
      return false;
    }
  });
}

async function relayMarketingOsMessageWebhook(payload, rawBody, inboundHeaders = {}) {
  const inboundEventType = String(inboundHeaders['x-marketing-os-event'] || payload?.eventType || '').toLowerCase();
  const shouldUnwrapPartnerEnvelope = ['instagram_message', 'instagram_comment'].includes(inboundEventType)
    && payload?.data
    && typeof payload.data === 'object'
    && !Array.isArray(payload.data);
  const forwardedPayload = shouldUnwrapPartnerEnvelope
    ? {
        ...payload.data,
        tenantId: payload.tenantId || inboundHeaders['x-partner-tenant-id'],
      }
    : payload;
  const rawPayload = getRawBodyString(null, forwardedPayload);
  const headers = {
    'content-type': 'application/json',
  };

  const eventType = inboundHeaders['x-marketing-os-event'] || payload?.eventType;
  const tenantId = payload?.tenantId || inboundHeaders['x-partner-tenant-id'];
  const accountId = inboundHeaders['x-instagram-account-id'];

  if (eventType) {
    headers['x-marketing-os-event'] = eventType;
  }

  if (tenantId) {
    headers['x-partner-tenant-id'] = tenantId;
  }

  if (accountId) {
    headers['x-instagram-account-id'] = accountId;
  }

  if (WEBHOOK_APP_SECRET) {
    const signature = crypto
      .createHmac('sha256', WEBHOOK_APP_SECRET)
      .update(rawPayload)
      .digest('hex');

    headers['x-hub-signature-256'] = `sha256=${signature}`;
  }

  const response = await fetch(INTERNAL_BOT_WEBHOOK_URL, {
    method: 'POST',
    headers,
    body: rawPayload,
  });

  if (!response.ok) {
    throw Object.assign(new Error(`TravelBot bot webhook returned ${response.status}`), {
      statusCode: 502,
      code: 'MARKETING_OS_BOT_RELAY_FAILED',
    });
  }
}

function isRawMarketingOsMessageEvent(headers = {}, payload = {}) {
  const eventType = String(headers['x-marketing-os-event'] || '').toLowerCase();
  return ['message', 'instagram_message', 'instagram_comment'].includes(eventType)
    || Array.isArray(payload?.entry);
}

async function resolveMarketingOsTenant(agency) {
  if (agency.marketingOsTenantId) {
    return agency.marketingOsTenantId;
  }

  const internalEmail = `agency-${agency.id}@travelbot.internal`;
  const candidateEmails = [agency.email, internalEmail];

  for (const email of candidateEmails) {
    const existingTenant = await marketingOsPartnerService.findTenantByEmail(email);
    if (existingTenant?.tenantId) {
      await agency.update({ marketingOsTenantId: existingTenant.tenantId });
      return existingTenant.tenantId;
    }
  }

  const tenantPayloads = [
    {
      name: agency.name,
      email: agency.email,
      phone: agency.phone,
      metadata: {
        source: 'travelbot',
        agencyId: agency.id,
        businessEmail: agency.email,
      },
    },
    {
      name: agency.name,
      email: internalEmail,
      phone: agency.phone,
      metadata: {
        source: 'travelbot',
        agencyId: agency.id,
        businessEmail: agency.email,
      },
    },
  ];

  let lastError = null;

  for (const payload of tenantPayloads) {
    try {
      const createdTenant = await marketingOsPartnerService.createTenant(payload);
      if (createdTenant?.tenantId) {
        await agency.update({ marketingOsTenantId: createdTenant.tenantId });
        return createdTenant.tenantId;
      }
    } catch (err) {
      if (err.response?.status === 409) {
        const tenantAfterConflict = await marketingOsPartnerService.findTenantByEmail(payload.email);
        if (tenantAfterConflict?.tenantId) {
          await agency.update({ marketingOsTenantId: tenantAfterConflict.tenantId });
          return tenantAfterConflict.tenantId;
        }
      }

      lastError = err;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw Object.assign(new Error('Marketing OS tenant creation did not return a tenantId'), {
    statusCode: 502,
    code: 'MARKETING_OS_TENANT_CREATE_FAILED',
  });
}

async function getCurrentAgency(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  const data = agency.toJSON();
  delete data.razorpayKeySecret;
  data.whatsappConnection = serializeWhatsAppConnection(agency);
  return data;
}

async function updateCurrentAgency(agencyId, updates) {
  const payload = { ...updates };
  if (payload.razorpayKeySecret) {
    payload.razorpayKeySecret = encrypt(payload.razorpayKeySecret);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'welcomeMessage')) {
    payload.welcomeMessage = String(payload.welcomeMessage || '').trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'whatsappMenuLabels')) {
    payload.whatsappMenuLabels = normalizeWhatsAppMenuLabels(payload.whatsappMenuLabels);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'whatsappMenuConfig')) {
    payload.whatsappMenuConfig = normalizeWhatsAppMenuConfig(payload.whatsappMenuConfig);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'leadFormConfig')) {
    payload.leadFormConfig = normalizeLeadFormConfig(payload.leadFormConfig);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'whatsappFlowConfig')) {
    payload.whatsappFlowConfig = await normalizeWhatsAppFlowConfig(agencyId, payload.whatsappFlowConfig);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'instagramFlowConfig')) {
    // Instagram DM flow graph is validated/sanitized the same way as the WhatsApp
    // flow graph (same node types, same agency-reference checks). It is never
    // published to Meta — it is executed over IG DMs via Marketing OS.
    payload.instagramFlowConfig = await normalizeWhatsAppFlowConfig(agencyId, payload.instagramFlowConfig);
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'whatsappTripFlowId')
    || Object.prototype.hasOwnProperty.call(payload, 'whatsappTripFlowName')
    || Object.prototype.hasOwnProperty.call(payload, 'whatsappTripFlowStatus')
    || Object.prototype.hasOwnProperty.call(payload, 'whatsappTripFlowError')
  ) {
    payload.whatsappTripFlowLastSyncedAt = new Date();
  }

  const agency = await agencyRepository.updateById(agencyId, payload);
  const data = agency.toJSON();
  delete data.razorpayKeySecret;
  data.whatsappConnection = serializeWhatsAppConnection(agency);
  return data;
}

async function getWebsiteStatus(agencyId) {
  return websiteBuilderService.getWebsiteStatus(agencyId);
}

async function updateWebsite(agencyId, updates) {
  return websiteBuilderService.updateWebsiteSettings(agencyId, updates);
}

async function publishWebsite(agencyId) {
  return websiteBuilderService.generateWebsite(agencyId);
}

async function unpublishWebsite(agencyId) {
  return websiteBuilderService.unpublishWebsite(agencyId);
}

async function getWhatsAppConnection(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const connection = serializeWhatsAppConnection(agency);
  connection.channels = await listWhatsAppChannels(agencyId);
  return connection;
}

async function getWhatsAppChannels(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  return listWhatsAppChannels(agencyId);
}

async function deleteWhatsAppChannel(agencyId, channelId) {
  const channel = await AgencyChannel.findOne({ where: { id: channelId, agencyId } });
  if (!channel) {
    throw Object.assign(new Error('Channel not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const wasDefault = Boolean(channel.isDefault);

  // When removing the default channel, promote another active channel (most recent) so the
  // agency keeps a usable default for send-path credential resolution.
  const activeChannels = await AgencyChannel.findAll({
    where: { agencyId, isActive: true },
    order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
  });
  const replacement = activeChannels.find((c) => c.id !== channelId) || null;

  // Best-effort: if this is the number currently provisioned in Marketing OS (mirrored by the
  // agency's cached phone number id), tear down the Marketing OS WhatsApp config too. Skipped
  // when disconnecting an older/secondary number so the remaining number's connection is left
  // intact — this is the "they changed their number" case.
  const agency = await agencyRepository.findById(agencyId);
  const isMarketingOsNumber = Boolean(
    channel.whatsappProvider === 'MARKETING_OS'
    && channel.whatsappPhoneNumberId
    && agency?.whatsappPhoneNumberId
    && String(channel.whatsappPhoneNumberId) === String(agency.whatsappPhoneNumberId)
  );

  if (isMarketingOsNumber && agency?.marketingOsTenantId) {
    try {
      const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
      await marketingOsPartnerService.disconnectTenantWhatsApp(tenantToken);
    } catch (err) {
      console.error('[agencyService] Marketing OS WhatsApp disconnect failed (continuing):', err.message);
    }
  }

  await channel.update({ isActive: false, isDefault: false });

  if (wasDefault && replacement) {
    await AgencyChannel.update({ isDefault: false }, { where: { agencyId } });
    await replacement.update({ isDefault: true, isActive: true });
  }

  // Keep agency-level cached WhatsApp fields in sync with the surviving default channel so the
  // dashboard and the agency-level send fallback reflect the correct number.
  if (agency && (wasDefault || isMarketingOsNumber)) {
    if (replacement) {
      await agency.update({
        whatsappProvider: replacement.whatsappProvider || agency.whatsappProvider,
        whatsappPhoneNumberId: replacement.whatsappPhoneNumberId || null,
        whatsappBusinessAccountId: replacement.whatsappBusinessAccountId || null,
        whatsappNumber: replacement.whatsappNumber || null,
        whatsappDisplayPhoneNumber: replacement.whatsappDisplayPhoneNumber || replacement.whatsappNumber || null,
        whatsappChannelId: replacement.id,
        whatsappConnectionStatus: replacement.whatsappConnectionStatus || agency.whatsappConnectionStatus,
        marketingOsTenantId: replacement.marketingOsTenantId || agency.marketingOsTenantId,
      });
    } else {
      await agency.update({
        whatsappConnectionStatus: 'NOT_CONNECTED',
        whatsappChannelId: null,
        whatsappPhoneNumberId: null,
        whatsappBusinessAccountId: null,
        whatsappNumber: null,
        whatsappDisplayPhoneNumber: null,
      });
    }
  }

  return listWhatsAppChannels(agencyId);
}

async function createMarketingOsConnectSession(agencyId, options = {}) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const parsedOptions = connectSessionOptionsSchema.parse(options || {});
  const onboardingMode = parsedOptions.onboardingMode === 'coexistence' ? 'COEXISTENCE' : 'STANDARD';
  const isCoexistence = onboardingMode === 'COEXISTENCE';

  if (agency.whatsappProvider !== 'MARKETING_OS') {
    await agency.update({
      whatsappProvider: 'MARKETING_OS',
      whatsappConnectionStatus: 'PENDING',
      whatsappConnectionError: null,
      whatsappOnboardingMode: onboardingMode,
      whatsappCoexistenceStatus: isCoexistence ? 'PENDING' : 'NOT_ENABLED',
      whatsappContactSyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
      whatsappHistorySyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    });
  } else {
    await agency.update({
      whatsappConnectionStatus: 'PENDING',
      whatsappConnectionError: null,
      whatsappOnboardingMode: onboardingMode,
      whatsappCoexistenceStatus: isCoexistence ? 'PENDING' : 'NOT_ENABLED',
      whatsappContactSyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
      whatsappHistorySyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    });
  }

  const tenantId = await resolveMarketingOsTenant(agency);
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  const embeddedConfig = await marketingOsPartnerService.getEmbeddedSignupConfig(tenantToken, {
    featureType: isCoexistence ? 'whatsapp_business_app_onboarding' : undefined,
    sessionInfoVersion: '3',
  });

  if (!embeddedConfig?.appId) {
    throw Object.assign(new Error('Marketing OS embedded signup is not configured for this environment'), {
      statusCode: 502,
      code: 'MARKETING_OS_EMBEDDED_SIGNUP_UNAVAILABLE',
    });
  }

  const refreshedAgency = await agencyRepository.findById(agencyId);
  const connection = serializeWhatsAppConnection(refreshedAgency);
  const sessionToken = signEmbeddedSession({
    agencyId,
    tenantId,
    tenantToken,
    state: embeddedConfig.state,
    appId: embeddedConfig.appId,
    configId: embeddedConfig.configId,
    onboardingMode,
    featureType: isCoexistence ? 'whatsapp_business_app_onboarding' : null,
  });

  return {
    ...connection,
    connectUrl: null,
    embeddedSignup: {
      appId: embeddedConfig.appId,
      configId: embeddedConfig.configId || null,
      sessionToken,
      featureType: isCoexistence ? 'whatsapp_business_app_onboarding' : null,
      sessionInfoVersion: '3',
    },
  };
}

async function completeMarketingOsConnectSession(agencyId, payload) {
  let session;
  try {
    session = verifyEmbeddedSession(payload.sessionToken);
  } catch (err) {
    throw Object.assign(new Error('Embedded signup session is invalid or expired'), {
      statusCode: 401,
      code: 'INVALID_MARKETING_OS_SESSION',
    });
  }

  if (session.agencyId !== agencyId) {
    throw Object.assign(new Error('Embedded signup session does not belong to this agency'), {
      statusCode: 403,
      code: 'MARKETING_OS_SESSION_MISMATCH',
    });
  }

  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  let result;
  try {
    result = await marketingOsPartnerService.completeEmbeddedSignup(session.tenantToken, {
      code: payload.code,
      state: session.state,
      featureType: session.featureType || undefined,
      sessionInfoVersion: '3',
      phoneNumberId: payload.phoneNumberId || payload.sessionInfo?.phone_number_id,
      wabaId: payload.wabaId || payload.sessionInfo?.waba_id,
      businessId: payload.businessId || payload.sessionInfo?.business_id,
      sessionInfo: payload.sessionInfo,
    });
  } catch (err) {
    const upstream = err.response?.data;
    const message = upstream?.message || upstream?.error || err.message || 'Marketing OS embedded signup failed';
    throw Object.assign(new Error(message), {
      statusCode: err.response?.status || 502,
      code: upstream?.code || 'MARKETING_OS_EMBEDDED_SIGNUP_FAILED',
      details: upstream?.errors || upstream?.details || upstream || null,
    });
  }

  const providerConnection = result?.connection;
  const displayPhoneNumber = providerConnection?.displayPhoneNumber || null;
  const normalizedWhatsappNumber = displayPhoneNumber ? normalizePhone(displayPhoneNumber) : agency.whatsappNumber;
  const onboardingMode = session.onboardingMode || 'STANDARD';
  const isCoexistence = onboardingMode === 'COEXISTENCE';

  await agency.update({
    whatsappProvider: 'MARKETING_OS',
    whatsappConnectionStatus: mapMarketingOsStatus(providerConnection?.status),
    whatsappOnboardingMode: onboardingMode,
    whatsappCoexistenceStatus: isCoexistence
      ? (mapMarketingOsStatus(providerConnection?.status) === 'CONNECTED' ? 'ACTIVE' : 'PENDING')
      : 'NOT_ENABLED',
    whatsappContactSyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    whatsappHistorySyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    marketingOsTenantId: session.tenantId,
    whatsappBusinessAccountId: providerConnection?.whatsappBusinessAccountId || agency.whatsappBusinessAccountId,
    whatsappPhoneNumberId: providerConnection?.phoneNumberId || agency.whatsappPhoneNumberId,
    whatsappDisplayPhoneNumber: displayPhoneNumber || agency.whatsappDisplayPhoneNumber,
    whatsappNumber: normalizedWhatsappNumber,
    whatsappConnectionError: providerConnection?.errorMessage || null,
    whatsappLastSyncedAt: new Date(),
    whatsappCoexistenceLastSyncedAt: isCoexistence ? new Date() : agency.whatsappCoexistenceLastSyncedAt,
  });

  const refreshedAgency = await agencyRepository.findById(agencyId);
  await upsertWhatsAppChannel(refreshedAgency, {
    provider: 'MARKETING_OS',
    status: mapMarketingOsStatus(providerConnection?.status),
    onboardingMode,
    whatsappCoexistenceStatus: isCoexistence
      ? (mapMarketingOsStatus(providerConnection?.status) === 'CONNECTED' ? 'ACTIVE' : 'PENDING')
      : 'NOT_ENABLED',
    whatsappContactSyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    whatsappHistorySyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    whatsappCoexistenceLastSyncedAt: isCoexistence ? new Date() : null,
    marketingOsTenantId: session.tenantId,
    businessAccountId: providerConnection?.whatsappBusinessAccountId,
    phoneNumberId: providerConnection?.phoneNumberId,
    displayPhoneNumber,
    whatsappNumber: normalizedWhatsappNumber,
    errorMessage: providerConnection?.errorMessage || null,
  });
  if (isCoexistence) {
    await initiateCoexistenceSync(refreshedAgency, session.tenantToken);
  }
  await flowService.ensureDefaultFlowsForAgency(refreshedAgency);
  templateService.ensureDefaultApprovalTemplatesForAgency(refreshedAgency).catch((err) => {
    console.error('[AgencyService] Default WhatsApp template submission failed:', err.message);
  });
  return getWhatsAppConnection(agencyId);
}

async function initiateCoexistenceSync(agency, tenantToken) {
  const phoneNumberId = agency?.whatsappPhoneNumberId;
  if (!phoneNumberId) {
    await agency.update({
      whatsappContactSyncStatus: 'FAILED',
      whatsappHistorySyncStatus: 'FAILED',
      whatsappConnectionError: 'Cannot start Business App sync until Meta phone number ID is available',
    });
    return;
  }

  const syncBasePayload = {
    tenantId: agency.marketingOsTenantId,
    phoneNumberId,
    messaging_product: 'whatsapp',
  };

  try {
    await marketingOsPartnerService.syncTenantWhatsAppBusinessAppData(tenantToken, {
      ...syncBasePayload,
      sync_type: 'smb_app_state_sync',
    });

    await marketingOsPartnerService.syncTenantWhatsAppBusinessAppData(tenantToken, {
      ...syncBasePayload,
      sync_type: 'history',
    });

    await agency.update({
      whatsappContactSyncStatus: 'PENDING',
      whatsappHistorySyncStatus: 'PENDING',
      whatsappCoexistenceLastSyncedAt: new Date(),
      whatsappConnectionError: null,
    });
  } catch (err) {
    await agency.update({
      whatsappContactSyncStatus: 'FAILED',
      whatsappHistorySyncStatus: 'FAILED',
      whatsappConnectionError: err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to start Business App data sync',
      whatsappCoexistenceLastSyncedAt: new Date(),
    });
  }
}

async function handleMarketingOsCallback(headers, payload, rawBody) {
  if (isRawMarketingOsMessageEvent(headers, payload)) {
    const rawPayload = getRawBodyString(rawBody, payload);

    if (!hasValidSignedProxySignature(headers, rawPayload) && !hasValidSharedSecret(headers)) {
      throw Object.assign(new Error('Invalid Marketing OS message webhook signature'), {
        statusCode: 401,
        code: 'INVALID_PROVIDER_SIGNATURE',
      });
    }

    await relayMarketingOsMessageWebhook(payload, rawPayload, headers);
    return {
      message: 'Marketing OS message webhook relayed to bot',
      data: { relayed: true },
    };
  }

  if (!hasValidSharedSecret(headers)) {
    throw Object.assign(new Error('Invalid Marketing OS callback secret'), { statusCode: 401, code: 'INVALID_PROVIDER_SECRET' });
  }

  const parsed = marketingOsCallbackSchema.safeParse(payload);
  if (!parsed.success) {
    throw Object.assign(new Error('Invalid Marketing OS callback payload'), {
      statusCode: 400,
      code: 'INVALID_PROVIDER_PAYLOAD',
      details: parsed.error.errors,
    });
  }

  payload = parsed.data;

  const agency = await agencyRepository.findById(payload.agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const nextValues = {
    whatsappProvider: 'MARKETING_OS',
    whatsappConnectionStatus: payload.status,
    whatsappCoexistenceStatus: payload.status === 'CONNECTED'
      ? (agency.whatsappOnboardingMode === 'COEXISTENCE' ? 'ACTIVE' : agency.whatsappCoexistenceStatus)
      : (payload.status === 'FAILED' && agency.whatsappOnboardingMode === 'COEXISTENCE' ? 'FAILED' : agency.whatsappCoexistenceStatus),
    whatsappChannelId: payload.channelId || agency.whatsappChannelId,
    whatsappBusinessAccountId: payload.businessAccountId || agency.whatsappBusinessAccountId,
    whatsappPhoneNumberId: payload.phoneNumberId || agency.whatsappPhoneNumberId,
    whatsappDisplayPhoneNumber: payload.displayPhoneNumber || payload.whatsappNumber || agency.whatsappDisplayPhoneNumber,
    whatsappConnectionError: payload.status === 'FAILED' ? (payload.errorMessage || 'Marketing OS reported a connection failure') : null,
    whatsappLastSyncedAt: new Date(),
    whatsappCoexistenceLastSyncedAt: agency.whatsappOnboardingMode === 'COEXISTENCE' ? new Date() : agency.whatsappCoexistenceLastSyncedAt,
  };

  if (payload.whatsappNumber) {
    nextValues.whatsappNumber = normalizePhone(payload.whatsappNumber);
  }

  await agency.update(nextValues);
  const refreshedAgency = await agencyRepository.findById(payload.agencyId);
  await upsertWhatsAppChannel(refreshedAgency, {
    provider: 'MARKETING_OS',
    status: payload.status,
    onboardingMode: refreshedAgency.whatsappOnboardingMode,
    whatsappCoexistenceStatus: refreshedAgency.whatsappCoexistenceStatus,
    whatsappContactSyncStatus: refreshedAgency.whatsappContactSyncStatus,
    whatsappHistorySyncStatus: refreshedAgency.whatsappHistorySyncStatus,
    whatsappCoexistenceLastSyncedAt: refreshedAgency.whatsappCoexistenceLastSyncedAt,
    marketingOsTenantId: refreshedAgency.marketingOsTenantId,
    businessAccountId: payload.businessAccountId || refreshedAgency.whatsappBusinessAccountId,
    phoneNumberId: payload.phoneNumberId || refreshedAgency.whatsappPhoneNumberId,
    displayPhoneNumber: payload.displayPhoneNumber || payload.whatsappNumber || refreshedAgency.whatsappDisplayPhoneNumber,
    whatsappNumber: payload.whatsappNumber ? normalizePhone(payload.whatsappNumber) : refreshedAgency.whatsappNumber,
    errorMessage: payload.status === 'FAILED' ? (payload.errorMessage || 'Marketing OS reported a connection failure') : null,
  });
  await flowService.ensureDefaultFlowsForAgency(refreshedAgency);
  return {
    message: 'Marketing OS callback processed',
    data: await getWhatsAppConnection(refreshedAgency.id),
  };
}

async function getInstagramConnection(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (!agency.marketingOsTenantId) {
    return { connected: false, accounts: [] };
  }

  try {
    const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
    const data = await marketingOsPartnerService.getTenantInstagramConnection(tenantToken);
    return data?.data || { connected: false, accounts: [] };
  } catch (err) {
    return {
      connected: false,
      accounts: [],
      errorMessage: err.response?.data?.error || err.response?.data?.message || err.message || 'Instagram connection unavailable',
    };
  }
}

async function connectInstagram(agencyId, payload) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const tenantId = await resolveMarketingOsTenant(agency);
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  
  const result = await marketingOsPartnerService.connectTenantInstagram(tenantToken, payload);
  return result?.data || result;
}

async function disconnectInstagram(agencyId, accountId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (!agency.marketingOsTenantId) {
    throw Object.assign(new Error('No tenant found'), { statusCode: 404 });
  }

  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  const result = await marketingOsPartnerService.disconnectTenantInstagram(tenantToken, accountId);
  return result;
}

module.exports = {
  getCurrentAgency,
  updateCurrentAgency,
  getWebsiteStatus,
  updateWebsite,
  publishWebsite,
  unpublishWebsite,
  getWhatsAppConnection,
  getWhatsAppChannels,
  deleteWhatsAppChannel,
  createMarketingOsConnectSession,
  completeMarketingOsConnectSession,
  handleMarketingOsCallback,
  getInstagramConnection,
  connectInstagram,
  disconnectInstagram,
};
