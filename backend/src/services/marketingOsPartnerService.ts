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

/**
 * Streams inbound WhatsApp media bytes from Marketing OS by media id. MOS
 * resolves the tenant's WABA token, fetches the media URL from Meta, downloads
 * it and pipes the binary back. Returns an axios stream response.
 * @param {string} tenantToken - Tenant JWT
 * @param {string} mediaId - WhatsApp media id
 * @returns {Promise<{ stream: any, contentType: string|null, filename: string|null }>}
 */
async function getTenantWhatsAppMedia(tenantToken, mediaId) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/whatsapp/media/${encodeURIComponent(mediaId)}`, {
    responseType: 'stream',
  });
  const disposition = response.headers['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return {
    stream: response.data,
    contentType: response.headers['content-type'] || null,
    filename: match ? match[1] : null,
  };
}

async function sendTenantInstagramMessage(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { tenantId, accountId?, recipientId, text?, quickReplies?, buttons?,
  //   mediaUrl?, mediaType?, caption?, ctaLabel? }.
  // quickReplies render as tappable chips (their payload echoes back on the inbound webhook);
  // buttons render as a button template (web_url buttons for links);
  // mediaUrl + mediaType ('image' | 'video' | 'audio') send a native attachment, with an
  // optional caption delivered as a follow-up text.
  const response = await client.post('/messages/instagram/send', payload, {
    headers: payload.tenantId ? { 'x-tenant-id': payload.tenantId } : undefined,
  });
  return response.data;
}

async function sendTenantInstagramSenderAction(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { tenantId, accountId?, recipientId, senderAction }.
  // senderAction is 'typing_on' | 'typing_off' | 'mark_seen' — a native Instagram UI signal
  // (typing bubble / seen receipt), not a stored message.
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

async function sendTenantInstagramCommentReply(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { accountId, commentId, text }
  const response = await client.post(
    `/instagram/inbox/comments/${encodeURIComponent(payload.accountId)}/${encodeURIComponent(payload.commentId)}/reply`,
    { text: payload.text }
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

// Enable WhatsApp voice calling on the tenant's connected phone number (Meta
// /<PHONE_NUMBER_ID>/settings). Required before inbound customer calls — and thus
// missed-call events — can happen. Idempotent; Meta rejects it until the number
// reaches the 2,000 business-initiated messaging tier.
async function enableTenantWhatsAppCalling(tenantToken, payload = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/calling/enable', payload);
  return response.data;
}

// Read the tenant number's current call settings (calling status, icon, etc.).
async function getTenantWhatsAppCallingSettings(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/whatsapp/calling/settings');
  return response.data;
}

async function syncTenantWhatsAppBusinessAppData(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/whatsapp/smb-app-data', payload);
  return response.data;
}

async function disconnectTenantWhatsApp(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.delete('/whatsapp/settings');
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

async function publishTenantWhatsAppFlow(tenantToken, flowId, payload = undefined) {
  const client = getTenantClient(tenantToken);
  const response = await client.post(`/whatsapp/flows/${encodeURIComponent(flowId)}/publish`, payload, { timeout: FLOW_TIMEOUT_MS });
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

async function getTenantMessengerConnection(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/messenger/connection');
  return response.data;
}

async function connectTenantMessenger(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { code, redirectUri } (Facebook Login) or { userAccessToken }, optional { pageId }
  const response = await client.post('/messenger/connect', payload);
  return response.data;
}

async function disconnectTenantMessenger(tenantToken, accountId) {
  const client = getTenantClient(tenantToken);
  const response = await client.delete(`/messenger/disconnect/${encodeURIComponent(accountId)}`);
  return response.data;
}

async function getTenantMessengerMessages(tenantToken, params = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/messenger/inbox/messages', { params });
  return response.data;
}

async function sendTenantMessengerMessage(tenantToken, payload) {
  const client = getTenantClient(tenantToken);
  // payload expects { accountId, recipientId, text }
  const response = await client.post(
    `/messenger/inbox/messages/${encodeURIComponent(payload.accountId)}/send`,
    { recipientId: payload.recipientId, text: payload.text }
  );
  return response.data;
}

async function createTenantMetaConnectSession(tenantToken, payload = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.post('/meta/connect-session', payload);
  return response.data;
}

async function getTenantMetaLoginUrl(tenantToken, payload = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/auth/meta/login', {
    params: {
      token: tenantToken,
      redirectUri: payload.redirectUri,
      scope: Array.isArray(payload.scopes) ? payload.scopes.join(',') : payload.scope,
    },
  });
  return response.data;
}

async function listTenantMetaAdAccounts(tenantToken) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/meta/ad-accounts');
  return response.data;
}

async function listTenantMetaCampaigns(tenantToken, params = {}) {
  const client = getTenantClient(tenantToken);
  const adAccountId = params.adAccountId || params.accountId;
  const path = adAccountId
    ? `/meta/ad-accounts/${encodeURIComponent(adAccountId)}/campaigns`
    : '/meta/campaigns';
  const response = await client.get(path, { params });
  return response.data;
}

async function getTenantMetaCampaign(tenantToken, campaignId) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/meta/campaigns/${encodeURIComponent(campaignId)}`);
  return response.data;
}

async function getTenantMetaCampaignInsights(tenantToken, campaignId, params = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/meta/campaigns/${encodeURIComponent(campaignId)}/insights`, { params });
  return response.data;
}

async function listTenantMetaForms(tenantToken, params = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get('/meta/forms', { params });
  return response.data;
}

async function listTenantMetaFormLeads(tenantToken, formId, params = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/meta/forms/${encodeURIComponent(formId)}/leads`, { params });
  return response.data;
}

async function getTenantMetaLead(tenantToken, leadgenId) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/meta/leads/${encodeURIComponent(leadgenId)}`);
  return response.data;
}

/**
 * Resolve a single Meta ad by its ID (the `source_id` from a Click-to-WhatsApp
 * referral). Returns the ad with its ad set + campaign so the CRM can show a
 * readable ad name. Best-effort: the partner API may not expose this endpoint on
 * every deployment, in which case it throws a 404/405 that callers treat as
 * "not resolvable" and fall back to the ad headline.
 */
async function getTenantMetaAd(tenantToken, adId) {
  const client = getTenantClient(tenantToken);
  const response = await client.get(`/meta/ads/${encodeURIComponent(adId)}`);
  return response.data;
}

async function subscribeTenantMetaForm(tenantToken, formId) {
  const client = getTenantClient(tenantToken);
  const response = await client.post(`/meta/forms/${encodeURIComponent(formId)}/subscribe`);
  return response.data;
}

async function backfillTenantMetaForm(tenantToken, formId, payload = {}) {
  const client = getTenantClient(tenantToken);
  const response = await client.post(`/meta/forms/${encodeURIComponent(formId)}/backfill`, payload);
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
  getTenantWhatsAppMedia,
  sendTenantWhatsAppTemplate,
  enableTenantWhatsAppCalling,
  getTenantWhatsAppCallingSettings,
  syncTenantWhatsAppBusinessAppData,
  disconnectTenantWhatsApp,
  sendTenantInstagramMessage,
  sendTenantInstagramSenderAction,
  sendTenantInstagramPrivateReply,
  sendTenantInstagramCommentReply,
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
  getTenantMessengerConnection,
  connectTenantMessenger,
  disconnectTenantMessenger,
  getTenantMessengerMessages,
  sendTenantMessengerMessage,
  createTenantMetaConnectSession,
  getTenantMetaLoginUrl,
  listTenantMetaAdAccounts,
  listTenantMetaCampaigns,
  getTenantMetaCampaign,
  getTenantMetaCampaignInsights,
  listTenantMetaForms,
  listTenantMetaFormLeads,
  getTenantMetaLead,
  getTenantMetaAd,
  subscribeTenantMetaForm,
  backfillTenantMetaForm,
};

