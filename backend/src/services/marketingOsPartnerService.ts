const axios = require('axios');

const PARTNER_API_BASE_URL = process.env.MARKETING_OS_PARTNER_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const PARTNER_API_KEY = process.env.MARKETING_OS_PARTNER_API_KEY || '';

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
    timeout: 20000,
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
    timeout: 20000,
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

async function getEmbeddedSignupConfig(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/whatsapp/settings/embedded/config');
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

async function sendTenantWhatsAppReadTyping(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/messages/read-typing', payload);
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
  sendTenantWhatsAppReadTyping,
};
