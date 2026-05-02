const axios = require('axios');

const PARTNER_API_BASE_URL = process.env.MARKETING_OS_PARTNER_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const PARTNER_API_KEY = process.env.MARKETING_OS_PARTNER_API_KEY || '';
const DEFAULT_TIMEOUT_MS = Number(process.env.MARKETING_OS_TIMEOUT_MS || 20000);
const FLOW_TIMEOUT_MS = Number(process.env.MARKETING_OS_FLOW_TIMEOUT_MS || 90000);

function ensureConfigured() {
  if (!PARTNER_API_KEY) {
    throw Object.assign(
      new Error('Marketing OS partner API key is not configured. Set MARKETING_OS_PARTNER_API_KEY in the backend environment.'),
      { statusCode: 500, code: 'MARKETING_OS_PARTNER_KEY_MISSING' }
    );
  }
}

function getPartnerClient() {
  ensureConfigured();
  return axios.create({
    baseURL: PARTNER_API_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PARTNER_API_KEY,
    },
  });
}

function getTenantClient(tenantToken) {
  ensureConfigured();
  return axios.create({
    baseURL: PARTNER_API_BASE_URL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': PARTNER_API_KEY,
      Authorization: `Bearer ${tenantToken}`,
    },
  });
}

async function findTenantByEmail(email) {
  if (!email) return null;

  const client = getPartnerClient();
  const response = await client.get('/tenants', {
    params: {
      search: email,
      limit: 100,
    },
  });

  const tenants = response.data?.data?.tenants || [];
  return tenants.find((tenant) => String(tenant.email || '').toLowerCase() === String(email).toLowerCase()) || null;
}

async function createTenant(payload) {
  const client = getPartnerClient();
  const response = await client.post('/tenants', payload);
  return response.data?.data;
}

async function getTenantToken(tenantId) {
  const client = getPartnerClient();
  const response = await client.post(`/tenants/${encodeURIComponent(tenantId)}/token`);
  return response.data?.data?.token;
}

async function getEmbeddedSignupConfig(tenantToken, options = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/whatsapp/settings/embedded/config', {
    params: options,
  });
  return response.data?.data;
}

async function completeEmbeddedSignup(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/settings/embedded/complete', payload);
  return response.data?.data;
}

async function sendMessage(tenantId, payload, options = {}) {
  const client = getPartnerClient();
  const response = await client.post('/messages/send', {
    tenantId,
    ...payload,
  }, {
    headers: {
      'x-tenant-id': tenantId,
      ...(options.idempotencyKey ? { 'x-idempotency-key': options.idempotencyKey } : {}),
    },
  });

  return response.data?.data;
}

async function sendTenantWhatsAppMessage(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/send', payload);
  return response.data;
}

async function sendTenantWhatsAppInteractive(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/interactive', payload);
  return response.data;
}

async function sendTenantWhatsAppMedia(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/media', payload);
  return response.data;
}

async function sendTenantInstagramMessage(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { tenantId, accountId?, recipientId, text }
  const response = await client.post('/messages/instagram/send', payload, {
    headers: payload.tenantId ? { 'x-tenant-id': payload.tenantId } : undefined,
  });
  return response.data;
}

async function sendTenantInstagramPrivateReply(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { accountId, commentId, text, quickReplies? }
  const response = await client.post(
    `/instagram/comments/${encodeURIComponent(payload.accountId)}/${encodeURIComponent(payload.commentId)}/private-reply`,
    {
      text: payload.text,
      quickReplies: payload.quickReplies || [],
    }
  );
  return response.data;
}

async function sendTenantWhatsAppReadTyping(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/read-typing', payload);
  return response.data;
}

async function sendTenantWhatsAppTemplate(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/template', payload);
  return response.data;
}

async function syncTenantWhatsAppBusinessAppData(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/smb-app-data', payload);
  return response.data;
}

async function getTenantWhatsAppTemplates(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/whatsapp/templates');
  return response.data;
}

async function createTenantWhatsAppTemplate(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/templates', payload);
  return response.data;
}

async function updateTenantWhatsAppTemplate(tenantToken, templateId, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.put(`/whatsapp/templates/${encodeURIComponent(templateId)}`, payload);
  return response.data;
}

async function submitTenantWhatsAppTemplate(tenantToken, templateId) {
  const client = getTenantClient(tenantToken);
  const response = await client.post(`/whatsapp/templates/${encodeURIComponent(templateId)}/submit`);
  return response.data;
}

async function deleteTenantWhatsAppTemplate(tenantToken, templateId) {
  const client = getTenantClient(tenantToken);
  const response = await client.delete(`/whatsapp/templates/${encodeURIComponent(templateId)}`);
  return response.data;
}

async function syncTenantWhatsAppTemplates(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/templates/sync');
  return response.data;
}

async function getTenantWhatsAppFlows(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/whatsapp/flows', { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function createTenantWhatsAppFlow(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/flows', payload, { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function updateTenantWhatsAppFlow(tenantToken, flowId, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.put(`/whatsapp/flows/${encodeURIComponent(flowId)}`, payload, { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function publishTenantWhatsAppFlow(tenantToken, flowId) {
  const client = getTenantClient(tenantToken);
  const response = await client.post(`/whatsapp/flows/${encodeURIComponent(flowId)}/publish`, undefined, { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function deleteTenantWhatsAppFlow(tenantToken, flowId) {
  const client = getTenantClient(tenantToken);
  const response = await client.delete(`/whatsapp/flows/${encodeURIComponent(flowId)}`, { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function syncTenantWhatsAppFlows(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/flows/sync', undefined, { timeout: FLOW_TIMEOUT_MS });
  return response.data;
}

async function getTenantInstagramConnection(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/instagram/connection');
  return response.data;
}

async function connectTenantInstagram(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/instagram/connect', payload);
  return response.data;
}

async function disconnectTenantInstagram(tenantToken, accountId) {
  const client = getTenantClient(tenantToken);
  const response = await client.delete(`/instagram/disconnect/${encodeURIComponent(accountId)}`);
  return response.data;
}

module.exports = {
  findTenantByEmail,
  createTenant,
  getTenantToken,
  getEmbeddedSignupConfig,
  completeEmbeddedSignup,
  sendMessage,
  sendTenantWhatsAppMessage,
  sendTenantWhatsAppInteractive,
  sendTenantWhatsAppMedia,
  sendTenantWhatsAppTemplate,
  syncTenantWhatsAppBusinessAppData,
  sendTenantInstagramMessage,
  sendTenantInstagramPrivateReply,
  sendTenantWhatsAppReadTyping,
  getTenantWhatsAppTemplates,
  createTenantWhatsAppTemplate,
  updateTenantWhatsAppTemplate,
  submitTenantWhatsAppTemplate,
  deleteTenantWhatsAppTemplate,
  syncTenantWhatsAppTemplates,
  getTenantWhatsAppFlows,
  createTenantWhatsAppFlow,
  updateTenantWhatsAppFlow,
  publishTenantWhatsAppFlow,
  deleteTenantWhatsAppFlow,
  syncTenantWhatsAppFlows,
  getTenantInstagramConnection,
  connectTenantInstagram,
  disconnectTenantInstagram,
};

