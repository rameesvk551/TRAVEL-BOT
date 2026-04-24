const agencyRepository = require('../repositories/agencyRepository');
const { encrypt } = require('../utils/crypto');
const { normalizePhone } = require('../utils/phoneUtils');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const marketingOsPartnerService = require('./marketingOsPartnerService');

const CALLBACK_SECRET = process.env.MARKETING_OS_WEBHOOK_SECRET || '';
const WEBHOOK_APP_SECRET = process.env.WEBHOOK_APP_SECRET || '';
const SESSION_SECRET = process.env.MARKETING_OS_SESSION_SECRET || process.env.JWT_SECRET || 'travelbot_marketing_os_session_secret';
const INTERNAL_BOT_WEBHOOK_URL = process.env.INTERNAL_BOT_WEBHOOK_URL || `http://127.0.0.1:${process.env.BOT_PORT || 3001}/webhook`;

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
    tripFlow: {
      id: agency.whatsappTripFlowId || null,
      name: agency.whatsappTripFlowName || null,
      status: agency.whatsappTripFlowStatus || null,
      errorMessage: agency.whatsappTripFlowError || null,
      lastSyncedAt: agency.whatsappTripFlowLastSyncedAt || null,
    },
  };
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

async function relayMarketingOsMessageWebhook(payload, rawBody) {
  const rawPayload = getRawBodyString(rawBody, payload);
  const headers = {
    'content-type': 'application/json',
  };

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
  return String(headers['x-marketing-os-event'] || '').toLowerCase() === 'message'
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

async function getWhatsAppConnection(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  return serializeWhatsAppConnection(agency);
}

async function createMarketingOsConnectSession(agencyId) {
  const agency = await agencyRepository.findById(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  if (agency.whatsappProvider !== 'MARKETING_OS') {
    await agency.update({
      whatsappProvider: 'MARKETING_OS',
      whatsappConnectionStatus: 'PENDING',
      whatsappConnectionError: null,
    });
  } else {
    await agency.update({
      whatsappConnectionStatus: 'PENDING',
      whatsappConnectionError: null,
    });
  }

  const tenantId = await resolveMarketingOsTenant(agency);
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  const embeddedConfig = await marketingOsPartnerService.getEmbeddedSignupConfig(tenantToken);

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
  });

  return {
    ...connection,
    connectUrl: null,
    embeddedSignup: {
      appId: embeddedConfig.appId,
      configId: embeddedConfig.configId || null,
      sessionToken,
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

  const result = await marketingOsPartnerService.completeEmbeddedSignup(session.tenantToken, {
    code: payload.code,
    state: session.state,
  });

  const providerConnection = result?.connection;
  const displayPhoneNumber = providerConnection?.displayPhoneNumber || null;
  const normalizedWhatsappNumber = displayPhoneNumber ? normalizePhone(displayPhoneNumber) : agency.whatsappNumber;

  await agency.update({
    whatsappProvider: 'MARKETING_OS',
    whatsappConnectionStatus: mapMarketingOsStatus(providerConnection?.status),
    marketingOsTenantId: session.tenantId,
    whatsappBusinessAccountId: providerConnection?.whatsappBusinessAccountId || agency.whatsappBusinessAccountId,
    whatsappPhoneNumberId: providerConnection?.phoneNumberId || agency.whatsappPhoneNumberId,
    whatsappDisplayPhoneNumber: displayPhoneNumber || agency.whatsappDisplayPhoneNumber,
    whatsappNumber: normalizedWhatsappNumber,
    whatsappConnectionError: providerConnection?.errorMessage || null,
    whatsappLastSyncedAt: new Date(),
  });

  const refreshedAgency = await agencyRepository.findById(agencyId);
  return serializeWhatsAppConnection(refreshedAgency);
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

    await relayMarketingOsMessageWebhook(payload, rawPayload);
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
    whatsappChannelId: payload.channelId || agency.whatsappChannelId,
    whatsappBusinessAccountId: payload.businessAccountId || agency.whatsappBusinessAccountId,
    whatsappPhoneNumberId: payload.phoneNumberId || agency.whatsappPhoneNumberId,
    whatsappDisplayPhoneNumber: payload.displayPhoneNumber || payload.whatsappNumber || agency.whatsappDisplayPhoneNumber,
    whatsappConnectionError: payload.status === 'FAILED' ? (payload.errorMessage || 'Marketing OS reported a connection failure') : null,
    whatsappLastSyncedAt: new Date(),
  };

  if (payload.whatsappNumber) {
    nextValues.whatsappNumber = normalizePhone(payload.whatsappNumber);
  }

  await agency.update(nextValues);
  return {
    message: 'Marketing OS callback processed',
    data: serializeWhatsAppConnection(agency),
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
  getWhatsAppConnection,
  createMarketingOsConnectSession,
  completeMarketingOsConnectSession,
  handleMarketingOsCallback,
  getInstagramConnection,
  connectInstagram,
  disconnectInstagram,
};
