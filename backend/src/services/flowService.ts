const { Op } = require('sequelize');
const { Agency, WhatsAppFlow } = require('../models');
const marketingOsPartnerService = require('./marketingOsPartnerService');
const { getDefaultFlowDefinitions } = require('./defaultFlowDefinitions');
const { getWhatsappFlowPublicKeyPem } = require('../utils/flowEncryption');

const DEFAULT_ENDPOINT_URI = process.env.WHATSAPP_FLOW_ENDPOINT_URL || 'https://travelbot.wayon.in/api/whatsapp/flow';

function buildError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeFlowPayload(data = {}) {
  let jsonDefinition = data.jsonDefinition || data.json_definition || {};
  if (typeof jsonDefinition === 'string') {
    jsonDefinition = JSON.parse(jsonDefinition || '{}');
  }

  const screens = Array.isArray(jsonDefinition?.screens) ? jsonDefinition.screens : [];
  const firstScreenId = data.firstScreenId
    || data.first_screen_id
    || screens[0]?.id
    || null;

  return {
    name: String(data.name || data.displayName || '').trim(),
    flowType: ['PACKAGE', 'PROPERTY', 'CUSTOM_TRIP', 'REVIEW', 'GENERIC'].includes(String(data.flowType || '').toUpperCase())
      ? String(data.flowType).toUpperCase()
      : 'GENERIC',
    status: ['DRAFT', 'PUBLISHED', 'FAILED', 'ARCHIVED'].includes(String(data.status || '').toUpperCase())
      ? String(data.status).toUpperCase()
      : 'DRAFT',
    metaFlowId: data.metaFlowId || data.meta_flow_id || null,
    endpointUri: String(data.endpointUri || data.endpoint_uri || DEFAULT_ENDPOINT_URI).trim(),
    firstScreenId,
    categories: Array.isArray(data.categories) && data.categories.length ? data.categories : ['OTHER'],
    jsonDefinition,
    validationErrors: Array.isArray(data.validationErrors) ? data.validationErrors : [],
    healthStatus: data.healthStatus || null,
    lastSyncedAt: data.lastSyncedAt || null,
  };
}

function toNameString(value) {
  return String(value || '').trim();
}

function normalizePartnerFlowError(error, action) {
  const status = error?.response?.status;
  const remoteMessage = error?.response?.data?.error
    || error?.response?.data?.message
    || error?.response?.data?.details?.message
    || error?.message;

  if ([404, 405, 501].includes(status)) {
    return buildError(`Connected Marketing OS server does not support WhatsApp flow ${action} yet.`, 501);
  }

  if (status === 401 || status === 403) {
    return buildError(`Marketing OS rejected the WhatsApp flow ${action} request for this company.`, 502);
  }

  if (status >= 400 && status < 500) {
    return buildError(remoteMessage || `WhatsApp flow ${action} failed.`, status);
  }

  return buildError(remoteMessage || `Could not complete WhatsApp flow ${action}.`, 502);
}

async function getAgencyOrThrow(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw buildError('Agency not found', 404);
  if (!agency.marketingOsTenantId) {
    throw buildError('This company is not connected to Marketing OS yet.', 400);
  }
  return agency;
}

async function getTenantTokenForAgency(agencyId) {
  const agency = await getAgencyOrThrow(agencyId);
  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  if (!tenantToken) throw buildError('Could not resolve tenant token for this company.', 502);
  return { agency, tenantToken };
}

function canSeedDefaultFlows(agency) {
  if (!agency) return false;
  if (agency.whatsappProvider !== 'MARKETING_OS') return false;
  if (!agency.marketingOsTenantId) return false;

  const status = String(agency.whatsappConnectionStatus || '').toUpperCase();
  return status !== 'FAILED';
}

async function ensureDefaultFlowsForAgency(agencyOrId) {
  const agency = typeof agencyOrId === 'string'
    ? await Agency.findByPk(agencyOrId)
    : agencyOrId;

  if (!canSeedDefaultFlows(agency)) {
    return { created: 0, skipped: true };
  }

  const defaults = getDefaultFlowDefinitions(agency);
  let created = 0;

  for (const flowDefaults of defaults) {
    const [flow, wasCreated] = await WhatsAppFlow.findOrCreate({
      where: {
        agencyId: agency.id,
        name: flowDefaults.name,
      },
      defaults: {
        agencyId: agency.id,
        ...flowDefaults,
      },
    });

    if (wasCreated) {
      created += 1;
      continue;
    }

    if (!flow.jsonDefinition || Object.keys(flow.jsonDefinition || {}).length === 0) {
      await flow.update({
        endpointUri: flow.endpointUri || flowDefaults.endpointUri,
        firstScreenId: flow.firstScreenId || flowDefaults.firstScreenId,
        categories: Array.isArray(flow.categories) && flow.categories.length ? flow.categories : flowDefaults.categories,
        jsonDefinition: flowDefaults.jsonDefinition,
      });
    }
  }

  return { created, skipped: false };
}

function mapRemoteFlow(remote = {}) {
  return {
    name: remote.name || '',
    status: String(remote.status || 'DRAFT').toUpperCase(),
    metaFlowId: remote.id || null,
    endpointUri: remote.endpoint_uri || remote.endpointUri || DEFAULT_ENDPOINT_URI,
    categories: Array.isArray(remote.categories) && remote.categories.length ? remote.categories : ['OTHER'],
    validationErrors: Array.isArray(remote.validation_errors) ? remote.validation_errors : [],
    healthStatus: remote.health_status || null,
    lastSyncedAt: new Date(),
  };
}

function extractRemoteFlows(response) {
  return response?.data?.flows || response?.data || response?.flows || [];
}

async function listFlows(agencyId, query = {}) {
  await ensureDefaultFlowsForAgency(agencyId);

  const where = { agencyId };
  if (query.status && query.status !== 'ALL') where.status = String(query.status).toUpperCase();
  if (query.flowType && query.flowType !== 'ALL') where.flowType = String(query.flowType).toUpperCase();
  if (query.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${query.search}%` } },
      { metaFlowId: { [Op.iLike]: `%${query.search}%` } },
    ];
  }

  return WhatsAppFlow.findAll({
    where,
    order: [['updatedAt', 'DESC']],
  });
}

async function getFlow(id, agencyId) {
  return WhatsAppFlow.findOne({ where: { id, agencyId } });
}

async function createFlow(agencyId, payload) {
  const normalized = normalizeFlowPayload(payload);
  if (!normalized.name) throw buildError('Flow name is required');

  return WhatsAppFlow.create({
    agencyId,
    ...normalized,
    name: toNameString(normalized.name),
  });
}

async function updateFlow(id, agencyId, payload) {
  const flow = await getFlow(id, agencyId);
  if (!flow) throw buildError('Flow not found', 404);

  const normalized = normalizeFlowPayload({ ...flow.toJSON(), ...payload });
  if (!normalized.name) throw buildError('Flow name is required');

  await flow.update(normalized);
  return flow;
}

async function deleteFlow(id, agencyId) {
  const flow = await getFlow(id, agencyId);
  if (!flow) throw buildError('Flow not found', 404);

  const { tenantToken } = await getTenantTokenForAgency(agencyId);
  if (flow.metaFlowId) {
    try {
      await marketingOsPartnerService.deleteTenantWhatsAppFlow(tenantToken, flow.metaFlowId);
    } catch (error) {
      throw normalizePartnerFlowError(error, 'deletion');
    }
  }

  await flow.destroy();
}

async function syncFlows(agencyId) {
  const { tenantToken } = await getTenantTokenForAgency(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.syncTenantWhatsAppFlows(tenantToken);
  } catch (error) {
    throw normalizePartnerFlowError(error, 'sync');
  }
  const remoteFlows = extractRemoteFlows(response);

  const existing = await WhatsAppFlow.findAll({ where: { agencyId } });
  const byMetaId = new Map(existing.filter((item) => item.metaFlowId).map((item) => [String(item.metaFlowId), item]));

  let count = 0;
  for (const remoteFlow of remoteFlows) {
    const mapped = mapRemoteFlow(remoteFlow);
    const remoteName = String(remoteFlow.name || '').toLowerCase();
    const inferredType = remoteName.includes('review') || remoteName.includes('feedback')
      ? 'REVIEW'
      : remoteName.includes('property')
      ? 'PROPERTY'
      : remoteName.includes('custom')
        ? 'CUSTOM_TRIP'
        : remoteName.includes('package')
          ? 'PACKAGE'
          : 'GENERIC';

    const current = byMetaId.get(String(mapped.metaFlowId));
    if (current) {
      await current.update({
        ...mapped,
        flowType: current.flowType || inferredType,
      });
      count += 1;
    } else {
      await WhatsAppFlow.create({
        agencyId,
        name: mapped.name || `flow_${mapped.metaFlowId}`,
        flowType: inferredType,
        jsonDefinition: {},
        firstScreenId: null,
        ...mapped,
      });
      count += 1;
    }
  }

  return { count, flows: await listFlows(agencyId, {}) };
}

async function publishFlow(id, agencyId) {
  const flow = await getFlow(id, agencyId);
  if (!flow) throw buildError('Flow not found', 404);

  const { tenantToken } = await getTenantTokenForAgency(agencyId);
  let flowPublicKey = null;
  try {
    flowPublicKey = getWhatsappFlowPublicKeyPem();
  } catch (error) {
    throw normalizePartnerFlowError(error, 'creation');
  }

  const payload = {
    name: flow.name,
    categories: flow.categories,
    endpointUri: flow.endpointUri || DEFAULT_ENDPOINT_URI,
    firstScreenId: flow.firstScreenId || null,
    jsonDefinition: flow.jsonDefinition || {},
    flowPublicKey,
  };

  if (!flow.metaFlowId) {
    try {
      const syncResponse = await marketingOsPartnerService.syncTenantWhatsAppFlows(tenantToken);
      const remoteFlows = extractRemoteFlows(syncResponse);
      const matchingRemote = remoteFlows.find((remoteFlow) =>
        String(remoteFlow.name || '').trim().toLowerCase() === String(flow.name || '').trim().toLowerCase()
      );
      if (matchingRemote?.id) {
        await flow.update({
          metaFlowId: matchingRemote.id,
          status: String(matchingRemote.status || flow.status || 'DRAFT').toUpperCase(),
          endpointUri: matchingRemote.endpoint_uri || flow.endpointUri || DEFAULT_ENDPOINT_URI,
          categories: matchingRemote.categories || flow.categories,
          validationErrors: matchingRemote.validation_errors || [],
          healthStatus: matchingRemote.health_status || null,
          lastSyncedAt: new Date(),
        });
      }
    } catch (_error) {
      // Best-effort lookup prevents duplicate Meta drafts after a previous request timed out.
    }
  }

  let remote;
  try {
    if (flow.metaFlowId) {
      remote = await marketingOsPartnerService.updateTenantWhatsAppFlow(tenantToken, flow.metaFlowId, payload);
    } else {
      remote = await marketingOsPartnerService.createTenantWhatsAppFlow(tenantToken, payload);
    }
  } catch (error) {
    throw normalizePartnerFlowError(error, flow.metaFlowId ? 'update' : 'creation');
  }

  const remoteData = remote?.data || remote;
  const metaFlowId = remoteData?.id || flow.metaFlowId;
  if (!metaFlowId) throw buildError('Flow publish failed: no Meta flow ID returned', 502);

  let publishResult;
  try {
    publishResult = await marketingOsPartnerService.publishTenantWhatsAppFlow(tenantToken, metaFlowId, {
      flowPublicKey,
    });
  } catch (error) {
    throw normalizePartnerFlowError(error, 'publish');
  }
  const details = publishResult?.data || publishResult;

  await flow.update({
    metaFlowId,
    status: String(details?.status || 'PUBLISHED').toUpperCase(),
    endpointUri: details?.endpoint_uri || flow.endpointUri || DEFAULT_ENDPOINT_URI,
    categories: details?.categories || flow.categories,
    validationErrors: details?.validation_errors || [],
    healthStatus: details?.health_status || null,
    lastSyncedAt: new Date(),
  });

  return flow;
}

module.exports = {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  publishFlow,
  syncFlows,
  ensureDefaultFlowsForAgency,
};
