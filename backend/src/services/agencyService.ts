const agencyRepository = require('../repositories/agencyRepository');
const { encrypt } = require('../utils/crypto');
const { normalizePhone } = require('../utils/phoneUtils');

const CONNECT_URL_TEMPLATE = process.env.MARKETING_OS_CONNECT_URL_TEMPLATE || '';
const CALLBACK_SECRET = process.env.MARKETING_OS_WEBHOOK_SECRET || '';

function replaceTemplateTokens(template, agency) {
  return template
    .replace(/{{agencyId}}/g, encodeURIComponent(agency.id))
    .replace(/{{agencyName}}/g, encodeURIComponent(agency.name || ''))
    .replace(/{{agencyEmail}}/g, encodeURIComponent(agency.email || ''))
    .replace(/{{agencyPhone}}/g, encodeURIComponent(agency.phone || ''))
    .replace(/{{whatsappNumber}}/g, encodeURIComponent(agency.whatsappNumber || ''));
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
  const canLaunchEmbeddedSignup = agency.whatsappProvider === 'MARKETING_OS' && !!CONNECT_URL_TEMPLATE;

  return {
    provider: agency.whatsappProvider,
    status,
    channelId: agency.whatsappChannelId || null,
    businessAccountId: agency.whatsappBusinessAccountId || null,
    phoneNumberId: agency.whatsappPhoneNumberId || null,
    displayPhoneNumber: agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || null,
    errorMessage: agency.whatsappConnectionError || null,
    lastSyncedAt: agency.whatsappLastSyncedAt || null,
    connectUrl: canLaunchEmbeddedSignup ? replaceTemplateTokens(CONNECT_URL_TEMPLATE, agency) : null,
    canLaunchEmbeddedSignup,
  };
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

  const connectUrl = replaceTemplateTokens(CONNECT_URL_TEMPLATE, agency);
  if (!connectUrl) {
    throw Object.assign(
      new Error('Marketing OS connect URL is not configured. Set MARKETING_OS_CONNECT_URL_TEMPLATE in the backend environment.'),
      { statusCode: 500, code: 'MARKETING_OS_NOT_CONFIGURED' }
    );
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

  const refreshedAgency = await agencyRepository.findById(agencyId);
  const connection = serializeWhatsAppConnection(refreshedAgency);

  return connection;
}

async function handleMarketingOsCallback(headers, payload) {
  if (CALLBACK_SECRET) {
    const headerSecret = headers['x-marketing-os-secret'] || headers.authorization?.replace(/^Bearer\s+/i, '');
    if (headerSecret !== CALLBACK_SECRET) {
      throw Object.assign(new Error('Invalid Marketing OS callback secret'), { statusCode: 401, code: 'INVALID_PROVIDER_SECRET' });
    }
  }

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
  return serializeWhatsAppConnection(agency);
}

module.exports = {
  getCurrentAgency,
  updateCurrentAgency,
  getWhatsAppConnection,
  createMarketingOsConnectSession,
  handleMarketingOsCallback,
};
