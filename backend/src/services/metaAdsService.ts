const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Agency,
  Customer,
  Lead,
  MetaAdCampaign,
  MetaLeadForm,
  MetaLeadSyncEvent,
} = require('../models');
const marketingOsPartnerService = require('./marketingOsPartnerService');
const { normalizePhone } = require('../utils/phoneUtils');

function compact(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizePlatform(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['ig', 'instagram'].includes(normalized)) return 'instagram';
  if (['fb', 'facebook'].includes(normalized)) return 'facebook';
  return normalized || 'facebook';
}

/**
 * For a freshly-imported Meta lead, apply round-robin assignment (when the
 * agency uses that strategy) and notify the owning agent. INTENT-strategy
 * agencies leave Meta leads unassigned, as before. Requires are lazy to avoid
 * a circular dependency with leadService.
 */
async function autoAssignAndNotify(lead, agencyId) {
  try {
    const serviceRoutingService = require('./serviceRoutingService');
    const strategy = await serviceRoutingService.getRoutingStrategy(agencyId);
    if (strategy !== 'ROUND_ROBIN') return;

    const agent = await serviceRoutingService.resolveNextRoundRobinAgent(agencyId);
    if (!agent?.id) return;

    await lead.update({ assignedAgentId: agent.id });

    const leadService = require('./leadService');
    const fullLead = await leadService.getLeadById(lead.id, agencyId);
    await leadService.notifyAssignedAgent(fullLead, agencyId, 'meta lead');
  } catch (err) {
    console.error('Failed to auto-assign Meta lead', err);
  }
}

function sourceForPlatform(platform) {
  return normalizePlatform(platform) === 'instagram' ? 'instagram_ad' : 'facebook_ad';
}

const META_ADS_SCOPES = [
  'ads_read',
  'leads_retrieval',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'pages_manage_metadata',
  'business_management',
  'email',
  'public_profile',
];

function getData(payload) {
  if (!payload) return null;
  if (payload.data?.data !== undefined) return payload.data.data;
  if (payload.data !== undefined) return payload.data;
  return payload;
}

function extractArray(payload, keys = []) {
  const source = getData(payload);
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== 'object') return [];
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  return [];
}

function normalizeMetricNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInsights(raw = {}) {
  const source = getData(raw) || {};
  const row = Array.isArray(source) ? source[0] || {} : source;
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const leadAction = actions.find((action) => /lead/i.test(String(action.action_type || action.type || '')));
  const leads = normalizeMetricNumber(row.leads ?? row.lead_count ?? leadAction?.value);
  const spend = normalizeMetricNumber(row.spend);
  return {
    impressions: normalizeMetricNumber(row.impressions),
    clicks: normalizeMetricNumber(row.clicks),
    spend,
    leads,
    ctr: normalizeMetricNumber(row.ctr),
    cpc: normalizeMetricNumber(row.cpc),
    cpm: normalizeMetricNumber(row.cpm),
    costPerLead: leads > 0 ? spend / leads : normalizeMetricNumber(row.cost_per_lead),
    raw: row,
  };
}

async function ensureMarketingOsTenant(agency) {
  if (agency.marketingOsTenantId) return agency.marketingOsTenantId;

  const internalEmail = `agency-${agency.id}@travelbot.internal`;
  const candidateEmails = [agency.email, internalEmail].filter(Boolean);

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
        metaAdsEnabled: true,
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
        metaAdsEnabled: true,
      },
    },
  ].filter((payload) => payload.email);

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

  if (lastError) throw lastError;

  throw Object.assign(new Error('Marketing OS tenant creation did not return a tenantId'), {
    statusCode: 502,
    code: 'MARKETING_OS_TENANT_CREATE_FAILED',
  });
}

async function resolveTenant(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'AGENCY_NOT_FOUND' });
  }
  if (!agency.marketingOsTenantId) {
    throw Object.assign(new Error('Meta ads are not connected. Connect Meta/Instagram in Settings first.'), {
      statusCode: 400,
      code: 'META_NOT_CONNECTED',
    });
  }
  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  return { agency, tenantToken };
}

function fillTemplate(template, values = {}) {
  return String(template || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => encodeURIComponent(values[key] || ''));
}

function getMarketingOsPublicApiBaseUrl() {
  const configured = String(process.env.MARKETING_OS_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
  if (configured) return configured;

  const internalBase = String(process.env.MARKETING_OS_PARTNER_API_BASE_URL || '').replace(/\/+$/, '');
  if (internalBase && !/127\.0\.0\.1|localhost/i.test(internalBase)) return internalBase;

  const appUrl = String(process.env.MARKETING_OS_APP_URL || '').replace(/\/+$/, '');
  if (/^https:\/\/app\.wayon\.in$/i.test(appUrl)) return 'https://api.app.wayon.in/api/v1';
  if (/^https:\/\/app\.staging\.wayon\.in$/i.test(appUrl)) return 'https://api.app.staging.wayon.in/api/v1';

  return internalBase || 'http://localhost:8000/api/v1';
}

function buildFallbackConnectUrl(tenantId, payload = {}) {
  const returnUrl = payload.returnUrl || '';
  const webhookUrl = payload.webhookUrl || '';
  const template = process.env.MARKETING_OS_META_CONNECT_URL_TEMPLATE || process.env.MARKETING_OS_CONNECT_URL_TEMPLATE || '';

  if (template) {
    return fillTemplate(template, {
      tenantId,
      returnUrl,
      webhookUrl,
      source: 'travelbot',
      integration: 'meta_ads',
    });
  }

  const baseUrl = String(process.env.MARKETING_OS_APP_URL || '').replace(/\/+$/, '');
  if (!baseUrl) return null;

  const params = new URLSearchParams({
    tenantId,
    source: 'travelbot',
    integration: 'meta_ads',
  });
  if (returnUrl) params.set('returnUrl', returnUrl);
  if (webhookUrl) params.set('webhookUrl', webhookUrl);

  return `${baseUrl}/ads-manager?${params.toString()}`;
}

async function getMetaOAuthConnectUrl(tenantToken, payload) {
  const appUrl = String(process.env.MARKETING_OS_APP_URL || '').replace(/\/+$/, '');
  const redirectUri = process.env.MARKETING_OS_META_REDIRECT_URI
    || (appUrl ? `${appUrl}/auth/meta/callback` : `${getMarketingOsPublicApiBaseUrl()}/auth/meta/callback`);
  const response = await marketingOsPartnerService.getTenantMetaLoginUrl(tenantToken, {
    redirectUri,
    scopes: payload.scopes,
  });
  const data = getData(response) || {};
  return data.url || data.connectUrl || data.authorizationUrl || null;
}

function normalizeConnectSessionResponse(response, tenantId, payload) {
  const data = getData(response) || {};
  const connectUrl = data.connectUrl || data.url || data.authorizationUrl || data.authUrl || buildFallbackConnectUrl(tenantId, payload);

  return {
    provider: 'MARKETING_OS',
    status: data.status || 'PENDING',
    tenantId,
    connectUrl,
    expiresAt: data.expiresAt || null,
    scopes: data.scopes || META_ADS_SCOPES,
  };
}

function isMarketingOsMetaUnavailable(err) {
  const status = err?.response?.status;
  return [404, 405, 501].includes(status);
}

function normalizeMarketingOsMetaError(err) {
  const status = err?.response?.status;
  const data = err?.response?.data || {};
  const message = data.message || data.error || err.message || 'Meta Ads request failed';
  const code = data.code || err.code;

  if (status === 400 && /missing permissions|permission/i.test(String(message))) {
    throw Object.assign(
      new Error('Meta Ads permissions are missing. Reconnect Meta Ads and approve ads_read and leads_retrieval permissions.'),
      {
        statusCode: 400,
        code: 'META_ADS_PERMISSION_MISSING',
        details: {
          providerCode: code,
          providerMessage: message,
        },
      }
    );
  }

  if (status >= 400 && status < 500) {
    throw Object.assign(new Error(message), {
      statusCode: 400,
      code: code || 'MARKETING_OS_META_REQUEST_FAILED',
    });
  }

  throw err;
}

function throwMetaNotConnected(err) {
  if (!isMarketingOsMetaUnavailable(err)) normalizeMarketingOsMetaError(err);

  throw Object.assign(new Error('Meta Ads is not connected in Marketing OS yet. Connect an ad account to continue.'), {
    statusCode: 400,
    code: 'META_NOT_CONNECTED',
  });
}

async function createConnectSession(agencyId, options = {}) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'AGENCY_NOT_FOUND' });
  }

  const tenantId = await ensureMarketingOsTenant(agency);
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  const payload = {
    source: 'travelbot',
    integration: 'meta_ads',
    returnUrl: compact(options.returnUrl),
    webhookUrl: compact(options.webhookUrl),
    agencyId,
    scopes: META_ADS_SCOPES,
  };

  try {
    const response = await marketingOsPartnerService.createTenantMetaConnectSession(tenantToken, payload);
    return normalizeConnectSessionResponse(response, tenantId, payload);
  } catch (err) {
    if (!isMarketingOsMetaUnavailable(err)) throw err;

    let connectUrl = null;
    try {
      connectUrl = await getMetaOAuthConnectUrl(tenantToken, payload);
    } catch (_oauthErr) {
      connectUrl = buildFallbackConnectUrl(tenantId, payload);
    }

    if (!connectUrl) {
      throw Object.assign(new Error('Marketing OS Meta Ads connect session is not available yet.'), {
        statusCode: 502,
        code: 'MARKETING_OS_META_CONNECT_UNAVAILABLE',
      });
    }

    return normalizeConnectSessionResponse({ data: { connectUrl, status: 'PENDING' } }, tenantId, payload);
  }
}

function normalizeCampaign(item = {}) {
  const id = compact(item.id || item.campaignId || item.metaCampaignId);
  const adSets = item.adSets || item.adsets?.data || item.raw?.adsets?.data || [];
  const ads = item.ads || item.raw?.ads?.data || [];
  return {
    id,
    metaCampaignId: id,
    metaAdAccountId: compact(item.account_id || item.adAccountId || item.metaAdAccountId),
    name: compact(item.name) || 'Untitled campaign',
    status: compact(item.status || item.effective_status),
    objective: compact(item.objective),
    buyingType: compact(item.buyingType || item.buying_type),
    platform: normalizePlatform(item.platform || item.publisher_platform),
    insights: normalizeInsights(item.insights || item.lastInsights || {}),
    startTime: compact(item.startTime || item.start_time),
    stopTime: compact(item.stopTime || item.stop_time),
    createdTime: compact(item.createdTime || item.created_time),
    updatedTime: compact(item.updatedTime || item.updated_time),
    dailyBudget: normalizeMetricNumber(item.dailyBudget || item.daily_budget),
    lifetimeBudget: normalizeMetricNumber(item.lifetimeBudget || item.lifetime_budget),
    adSetCount: normalizeMetricNumber(item.adSetCount ?? item.adsetCount ?? adSets.length),
    adCount: normalizeMetricNumber(item.adCount ?? ads.length),
    adSets,
    ads,
    rawPayload: item,
  };
}

function normalizeForm(item = {}) {
  const id = compact(item.id || item.formId || item.metaFormId);
  return {
    id,
    metaFormId: id,
    metaPageId: compact(item.page_id || item.pageId || item.metaPageId),
    metaAdAccountId: compact(item.account_id || item.adAccountId || item.metaAdAccountId),
    name: compact(item.name) || 'Lead form',
    status: compact(item.status),
    platform: normalizePlatform(item.platform),
    pageName: compact(item.pageName || item.page_name),
    leadsCount: normalizeMetricNumber(item.leadsCount || item.leads_count),
    questionsCount: Array.isArray(item.questions) ? item.questions.length : normalizeMetricNumber(item.questionsCount),
    isSubscribed: Boolean(item.isSubscribed || item.subscribed),
    rawPayload: item,
  };
}

async function cacheCampaign(agencyId, campaign) {
  if (!campaign.metaCampaignId) return null;
  const [row] = await MetaAdCampaign.findOrCreate({
    where: { agencyId, metaCampaignId: campaign.metaCampaignId },
    defaults: {
      agencyId,
      metaCampaignId: campaign.metaCampaignId,
      metaAdAccountId: campaign.metaAdAccountId,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      platform: campaign.platform,
      lastInsights: campaign.insights || {},
      rawPayload: campaign.rawPayload || {},
      lastSyncedAt: new Date(),
    },
  });
  if (!row.isNewRecord) {
    await row.update({
      metaAdAccountId: campaign.metaAdAccountId || row.metaAdAccountId,
      name: campaign.name || row.name,
      status: campaign.status || row.status,
      objective: campaign.objective || row.objective,
      platform: campaign.platform || row.platform,
      lastInsights: campaign.insights || row.lastInsights || {},
      rawPayload: campaign.rawPayload || row.rawPayload || {},
      lastSyncedAt: new Date(),
    });
  }
  return row;
}

async function cacheForm(agencyId, form) {
  if (!form.metaFormId) return null;
  const [row] = await MetaLeadForm.findOrCreate({
    where: { agencyId, metaFormId: form.metaFormId },
    defaults: {
      agencyId,
      metaFormId: form.metaFormId,
      metaPageId: form.metaPageId,
      metaAdAccountId: form.metaAdAccountId,
      name: form.name,
      status: form.status,
      platform: form.platform,
      isSubscribed: form.isSubscribed,
      rawPayload: form.rawPayload || {},
      lastSyncedAt: new Date(),
    },
  });
  if (!row.isNewRecord) {
    await row.update({
      metaPageId: form.metaPageId || row.metaPageId,
      metaAdAccountId: form.metaAdAccountId || row.metaAdAccountId,
      name: form.name || row.name,
      status: form.status || row.status,
      platform: form.platform || row.platform,
      isSubscribed: form.isSubscribed || row.isSubscribed,
      rawPayload: form.rawPayload || row.rawPayload || {},
      lastSyncedAt: new Date(),
    });
  }
  return row;
}

async function listAdAccounts(agencyId) {
  const { tenantToken } = await resolveTenant(agencyId);
  try {
    const response = await marketingOsPartnerService.listTenantMetaAdAccounts(tenantToken);
    return extractArray(response, ['adAccounts', 'accounts', 'items']);
  } catch (err) {
    throwMetaNotConnected(err);
  }
}

async function listCampaigns(agencyId, filters = {}) {
  const { tenantToken } = await resolveTenant(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.listTenantMetaCampaigns(tenantToken, filters);
  } catch (err) {
    throwMetaNotConnected(err);
  }
  const campaigns = extractArray(response, ['campaigns', 'items']).map(normalizeCampaign).filter((item) => item.metaCampaignId);
  await Promise.all(campaigns.map((campaign) => cacheCampaign(agencyId, campaign)));
  if (!campaigns.length) return [];

  const leadCounts = await Lead.findAll({
    attributes: [
      'metaCampaignId',
      [Lead.sequelize.fn('COUNT', Lead.sequelize.col('id')), 'leadCount'],
    ],
    where: {
      agencyId,
      metaCampaignId: { [Op.in]: campaigns.map((campaign) => campaign.metaCampaignId) },
    },
    group: ['metaCampaignId'],
    raw: true,
  });
  const countByCampaign = new Map(leadCounts.map((row) => [row.metaCampaignId, Number(row.leadCount || 0)]));

  return campaigns.map((campaign) => ({
    ...campaign,
    leadCount: countByCampaign.get(campaign.metaCampaignId) || campaign.insights?.leads || 0,
  }));
}

async function getCampaign(agencyId, campaignId) {
  const { tenantToken } = await resolveTenant(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.getTenantMetaCampaign(tenantToken, campaignId);
  } catch (err) {
    throwMetaNotConnected(err);
  }
  const campaign = normalizeCampaign(getData(response));
  await cacheCampaign(agencyId, campaign);
  return campaign;
}

async function getCampaignInsights(agencyId, campaignId, filters = {}) {
  const { tenantToken } = await resolveTenant(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.getTenantMetaCampaignInsights(tenantToken, campaignId, filters);
  } catch (err) {
    throwMetaNotConnected(err);
  }
  const insights = normalizeInsights(response);
  const campaign = await MetaAdCampaign.findOne({ where: { agencyId, metaCampaignId: campaignId } });
  if (campaign) {
    await campaign.update({ lastInsights: insights, lastSyncedAt: new Date() });
  }
  return insights;
}

async function listForms(agencyId, filters = {}) {
  const { tenantToken } = await resolveTenant(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.listTenantMetaForms(tenantToken, filters);
  } catch (err) {
    throwMetaNotConnected(err);
  }
  const forms = extractArray(response, ['forms', 'items']).map(normalizeForm).filter((item) => item.metaFormId);
  await Promise.all(forms.map((form) => cacheForm(agencyId, form)));
  return forms;
}

function fieldEntries(lead = {}) {
  const source = lead.field_data || lead.fieldData || lead.fields || lead.answers || [];
  if (Array.isArray(source)) {
    return source.map((field) => {
      const key = compact(field.name || field.key || field.label || field.question);
      const values = Array.isArray(field.values) ? field.values : [field.value || field.answer].filter(Boolean);
      return [key, values.map((value) => String(value || '').trim()).filter(Boolean).join(', ')];
    }).filter(([key]) => key);
  }
  if (source && typeof source === 'object') {
    return Object.entries(source).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(', ') : String(value || '').trim(),
    ]);
  }
  return [];
}

function normalizeFieldKey(key = '') {
  return String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function extractLeadFields(lead = {}) {
  const fields = {};
  for (const [key, value] of fieldEntries(lead)) {
    const normalized = normalizeFieldKey(key);
    if (normalized && value) fields[normalized] = value;
  }

  const pick = (...keys) => keys.map((key) => fields[key]).find(Boolean) || null;
  const firstName = pick('first_name', 'firstname');
  const lastName = pick('last_name', 'lastname');
  const name = pick('full_name', 'name', 'your_name') || [firstName, lastName].filter(Boolean).join(' ') || null;
  const phone = pick('phone_number', 'phone', 'mobile_number', 'mobile', 'whatsapp_number');
  const email = pick('email', 'email_address');
  const destination = pick('destination', 'travel_destination', 'trip_destination', 'location', 'city', 'place');
  const travelDates = pick('travel_dates', 'travel_date', 'departure_date', 'trip_dates', 'when_do_you_want_to_travel');
  const travellersRaw = pick('travellers', 'travelers', 'number_of_travellers', 'number_of_travelers', 'pax', 'guests');
  const budgetRaw = pick('budget', 'budget_per_person', 'price_range', 'trip_budget');
  const travellers = travellersRaw ? Number.parseInt(String(travellersRaw).replace(/[^\d]/g, ''), 10) : null;
  const budgetNumber = budgetRaw ? Number(String(budgetRaw).replace(/[^\d.]/g, '')) : null;

  return {
    fields,
    name,
    phone,
    email,
    destination,
    travelDates,
    travellers: Number.isFinite(travellers) ? travellers : null,
    budgetPerPerson: Number.isFinite(budgetNumber) ? Math.round(budgetNumber * 100) : null,
  };
}

function safeCustomerPhone(rawPhone, leadgenId) {
  const phone = compact(rawPhone);
  if (phone) return normalizePhone(phone);
  const seed = compact(leadgenId) || crypto.randomUUID();
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 24);
  return `meta_${digest}`;
}

function metaIdsFromPayload(payload = {}, lead = {}) {
  const value = payload.value || {};
  const platform = normalizePlatform(
    payload.platform || lead.platform || lead.publisher_platform || value.platform || value.publisher_platform
  );
  return {
    metaLeadgenId: compact(payload.leadgenId || payload.leadgen_id || payload.lead_id || value.leadgen_id || lead.id || lead.leadgen_id),
    metaFormId: compact(payload.formId || payload.form_id || value.form_id || lead.form_id || lead.formId),
    metaPageId: compact(payload.pageId || payload.page_id || value.page_id || lead.page_id || lead.pageId),
    metaAdAccountId: compact(payload.adAccountId || payload.ad_account_id || lead.ad_account_id || lead.adAccountId),
    metaCampaignId: compact(payload.campaignId || payload.campaign_id || lead.campaign_id || lead.campaignId),
    metaCampaignName: compact(payload.campaignName || payload.campaign_name || lead.campaign_name || lead.campaignName),
    metaAdSetId: compact(payload.adSetId || payload.adset_id || payload.ad_set_id || lead.adset_id || lead.adSetId),
    metaAdSetName: compact(payload.adSetName || payload.adset_name || payload.ad_set_name || lead.adset_name || lead.adSetName),
    metaAdId: compact(payload.adId || payload.ad_id || value.ad_id || lead.ad_id || lead.adId),
    metaAdName: compact(payload.adName || payload.ad_name || lead.ad_name || lead.adName),
    metaPlatform: platform,
  };
}

async function resolveWebhookAgency(payload = {}) {
  const tenantId = compact(payload.tenantId || payload.tenant_id);
  if (tenantId) {
    const agency = await Agency.findOne({ where: { marketingOsTenantId: tenantId } });
    if (agency) return agency;
  }

  const formId = compact(payload.formId || payload.form_id || payload.value?.form_id);
  if (formId) {
    const form = await MetaLeadForm.findOne({ where: { metaFormId: formId }, order: [['updatedAt', 'DESC']] });
    if (form) return Agency.findByPk(form.agencyId);
  }

  throw Object.assign(new Error('Unable to resolve agency for Meta lead event'), {
    statusCode: 400,
    code: 'META_AGENCY_NOT_RESOLVED',
  });
}

async function fetchLeadIfNeeded(agency, payload) {
  if (payload.lead && typeof payload.lead === 'object') return payload.lead;
  if (payload.data?.lead && typeof payload.data.lead === 'object') return payload.data.lead;

  const leadgenId = compact(payload.leadgenId || payload.leadgen_id || payload.lead_id || payload.value?.leadgen_id);
  if (!leadgenId) return {};
  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  const response = await marketingOsPartnerService.getTenantMetaLead(tenantToken, leadgenId);
  return getData(response) || {};
}

async function upsertCustomer(agencyId, mapped, ids) {
  const phone = safeCustomerPhone(mapped.phone, ids.metaLeadgenId);
  const [customer, created] = await Customer.findOrCreate({
    where: { agencyId, phone },
    defaults: {
      agencyId,
      phone,
      name: mapped.name,
      email: mapped.email,
      source: sourceForPlatform(ids.metaPlatform),
    },
  });

  if (!created) {
    const patch = {};
    if (mapped.name && !customer.name) patch.name = mapped.name;
    if (mapped.email && !customer.email) patch.email = mapped.email;
    if (!customer.source || customer.source === 'whatsapp') patch.source = sourceForPlatform(ids.metaPlatform);
    if (Object.keys(patch).length) await customer.update(patch);
  }

  return customer;
}

async function importMetaLead(agencyId, payload = {}, options = {}) {
  const eventType = options.eventType || 'WEBHOOK';
  const agency = options.agency || await Agency.findByPk(agencyId);
  const leadPayload = await fetchLeadIfNeeded(agency, payload);
  const ids = metaIdsFromPayload(payload, leadPayload);
  const mapped = extractLeadFields(leadPayload);
  const syncEvent = await MetaLeadSyncEvent.create({
    agencyId,
    eventType,
    status: 'RECEIVED',
    metaLeadgenId: ids.metaLeadgenId,
    metaFormId: ids.metaFormId,
    metaCampaignId: ids.metaCampaignId,
    payload,
  });

  try {
    if (!ids.metaLeadgenId) {
      throw Object.assign(new Error('Meta leadgen ID is required'), { statusCode: 400, code: 'META_LEADGEN_ID_REQUIRED' });
    }

    const existing = await Lead.findOne({ where: { agencyId, metaLeadgenId: ids.metaLeadgenId } });
    const customer = await upsertCustomer(agencyId, mapped, ids);
    const customTripDetails = {
      metaFields: mapped.fields,
      metaLeadgenId: ids.metaLeadgenId,
      metaFormId: ids.metaFormId,
      campaignName: ids.metaCampaignName || undefined,
      source: sourceForPlatform(ids.metaPlatform),
      submittedAt: compact(leadPayload.created_time || leadPayload.createdTime) || new Date().toISOString(),
    };

    const leadValues = {
      customerId: customer.id,
      agencyId,
      destination: mapped.destination,
      travelDates: mapped.travelDates,
      travellers: mapped.travellers,
      budgetPerPerson: mapped.budgetPerPerson,
      status: 'NEW',
      source: sourceForPlatform(ids.metaPlatform),
      campaignName: ids.metaCampaignName,
      notes: `Imported from Meta Lead Ads${ids.metaFormId ? ` form ${ids.metaFormId}` : ''}.`,
      customTripDetails,
      metaRawPayload: { event: payload, lead: leadPayload },
      ...ids,
    };

    let lead = existing;
    if (existing) {
      const mergedDetails = {
        ...(existing.customTripDetails || {}),
        ...customTripDetails,
        metaFields: {
          ...((existing.customTripDetails || {}).metaFields || {}),
          ...mapped.fields,
        },
      };
      await existing.update({
        ...leadValues,
        status: existing.status,
        assignedAgentId: existing.assignedAgentId,
        customTripDetails: mergedDetails,
      });
      await syncEvent.update({ status: 'DUPLICATE', leadId: existing.id });
    } else {
      lead = await Lead.create(leadValues);
      await syncEvent.update({ status: 'IMPORTED', leadId: lead.id });
      await autoAssignAndNotify(lead, agencyId);
    }

    if (ids.metaCampaignId) {
      await cacheCampaign(agencyId, {
        metaCampaignId: ids.metaCampaignId,
        metaAdAccountId: ids.metaAdAccountId,
        name: ids.metaCampaignName,
        platform: ids.metaPlatform,
        rawPayload: leadPayload,
      });
    }
    if (ids.metaFormId) {
      await cacheForm(agencyId, {
        metaFormId: ids.metaFormId,
        metaPageId: ids.metaPageId,
        metaAdAccountId: ids.metaAdAccountId,
        platform: ids.metaPlatform,
        isSubscribed: true,
        rawPayload: leadPayload,
      });
    }

    return { lead, syncEvent, duplicate: Boolean(existing) };
  } catch (err) {
    await syncEvent.update({
      status: 'FAILED',
      errorMessage: err.message || 'Meta lead import failed',
    });
    throw err;
  }
}

/**
 * Resolve a Click-to-WhatsApp ad ID (referral.source_id) into a readable ad
 * reference: ad name + ad set + campaign. Best-effort — if the partner API has no
 * ad-level lookup, or Meta is not connected, returns null and the caller keeps the
 * ad headline as the display label. Caches the parent campaign when resolvable.
 */
async function resolveAdReference(agencyId, adId) {
  const cleanAdId = compact(adId);
  if (!cleanAdId) return null;

  let tenantToken;
  try {
    ({ tenantToken } = await resolveTenant(agencyId));
  } catch (_err) {
    return null; // Meta not connected — nothing to resolve against.
  }

  let response;
  try {
    response = await marketingOsPartnerService.getTenantMetaAd(tenantToken, cleanAdId);
  } catch (_err) {
    return null; // Endpoint unsupported / ad not found — fall back to headline.
  }

  const item = getData(response) || {};
  const adSet = item.adset || item.adSet || item.ad_set || {};
  const campaign = item.campaign || {};

  const reference = {
    metaAdId: compact(item.id || item.adId || cleanAdId) || cleanAdId,
    metaAdName: compact(item.name || item.adName),
    metaAdSetId: compact(adSet.id || item.adset_id || item.adSetId),
    metaAdSetName: compact(adSet.name || item.adset_name || item.adSetName),
    metaCampaignId: compact(campaign.id || item.campaign_id || item.campaignId),
    metaCampaignName: compact(campaign.name || item.campaign_name || item.campaignName),
    metaAdAccountId: compact(item.account_id || item.adAccountId || item.metaAdAccountId),
    metaPlatform: normalizePlatform(item.platform || item.publisher_platform),
    // The Instagram reel/post this ad was boosted from — lets the caller map a CTWA click to a
    // mapped catalog item. Absent for ads not built from IG media.
    instagramMediaId: compact(item.instagramMediaId || item.instagram_media_id),
    instagramPermalink: compact(item.instagramPermalinkUrl || item.instagram_permalink_url),
  };

  if (reference.metaCampaignId) {
    await cacheCampaign(agencyId, {
      metaCampaignId: reference.metaCampaignId,
      metaAdAccountId: reference.metaAdAccountId,
      name: reference.metaCampaignName,
      platform: reference.metaPlatform,
      rawPayload: item,
    }).catch(() => {});
  }

  return reference;
}

async function handleLeadgenWebhook(payload = {}) {
  const agency = await resolveWebhookAgency(payload);
  return importMetaLead(agency.id, payload, { agency, eventType: 'WEBHOOK' });
}

async function backfillForm(agencyId, formId, payload = {}) {
  const { tenantToken } = await resolveTenant(agencyId);
  let response;
  try {
    response = await marketingOsPartnerService.backfillTenantMetaForm(tenantToken, formId, payload);
  } catch (err) {
    response = await marketingOsPartnerService.listTenantMetaFormLeads(tenantToken, formId, payload);
  }

  const leads = extractArray(response, ['leads', 'items']);
  const results = [];
  for (const lead of leads) {
    const imported = await importMetaLead(agencyId, { formId, lead, leadgenId: lead.id || lead.leadgen_id }, { eventType: 'BACKFILL' });
    results.push({ leadId: imported.lead.id, duplicate: imported.duplicate });
  }

  return {
    imported: results.filter((item) => !item.duplicate).length,
    duplicates: results.filter((item) => item.duplicate).length,
    total: results.length,
    results,
  };
}

/**
 * Ad spend per campaign over an explicit window, for the CAC / ROAS report.
 *
 * Returns null instead of throwing when the agency has no Meta connection: an agency that
 * runs no ads must still get its organic numbers, not a broken report.
 *
 * Two things worth knowing about the numbers:
 *  - Meta reports spend in major currency units; the rest of this system stores money in
 *    paise, so spend is converted here. Skipping this would make ROAS wrong by 100x.
 *  - `window` echoes the range Meta actually reported on (date_start/date_stop). If it
 *    doesn't match what was asked for, the caller is talking to a marketing-os build that
 *    predates explicit-window support and is silently answering with its `last_30d` default.
 */
async function getCampaignSpend(agencyId, { since, until } = {}) {
  let campaigns;
  try {
    campaigns = await listCampaigns(agencyId, since && until ? { since, until } : {});
  } catch (err) {
    return null;
  }

  return campaigns.map((campaign) => {
    const insights = campaign.insights || {};
    const raw = insights.raw || {};
    return {
      campaignId: campaign.metaCampaignId,
      name: campaign.name,
      status: campaign.status || null,
      spend: Math.round(normalizeMetricNumber(insights.spend) * 100),
      impressions: normalizeMetricNumber(insights.impressions),
      clicks: normalizeMetricNumber(insights.clicks),
      metaLeads: normalizeMetricNumber(insights.leads),
      window: { start: raw.date_start || null, end: raw.date_stop || null },
    };
  });
}

module.exports = {
  createConnectSession,
  listAdAccounts,
  listCampaigns,
  getCampaign,
  getCampaignInsights,
  getCampaignSpend,
  listForms,
  backfillForm,
  handleLeadgenWebhook,
  importMetaLead,
  resolveAdReference,
};
