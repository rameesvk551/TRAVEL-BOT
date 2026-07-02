// FILE: /backend/src/services/callService.js
// DEPS: axios, crypto

const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Agent, CallLog, Customer, Lead } = require('../models');
const { normalizePhone } = require('../utils/phoneUtils');

function isAdmin(requester) {
  return requester?.role === 'ADMIN';
}

function scopedLeadWhere(agencyId, requester, extra = {}) {
  const where = { agencyId, ...extra };
  if (requester?.id && !isAdmin(requester)) {
    where.assignedAgentId = requester.id;
  }
  return where;
}

function getPublicBaseUrl() {
  const baseUrl = process.env.PUBLIC_API_BASE_URL || process.env.BASE_URL;
  return String(baseUrl || '').replace(/\/+$/, '');
}

function assertTwilioConfigured() {
  const missing = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']
    .filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw Object.assign(new Error(`Twilio is not configured. Missing: ${missing.join(', ')}`), {
      statusCode: 500,
      code: 'TWILIO_NOT_CONFIGURED',
    });
  }

  if (!getPublicBaseUrl()) {
    throw Object.assign(new Error('PUBLIC_API_BASE_URL or BASE_URL is required for Twilio callbacks'), {
      statusCode: 500,
      code: 'PUBLIC_BASE_URL_REQUIRED',
    });
  }
}

function normalizeTwilioStatus(status) {
  const value = String(status || '').toLowerCase().replace(/-/g, '_');
  if (value === 'no_answer') return 'no_answer';
  if (value === 'in_progress') return 'in_progress';
  if (['initiated', 'queued', 'ringing', 'completed', 'busy', 'failed', 'canceled'].includes(value)) return value;
  return null;
}

// Statuses that mean the call has ended. Once a CallLog reaches one of these we
// never let a late, out-of-order webhook drag it back to a live state.
const TERMINAL_STATUSES = new Set(['completed', 'busy', 'failed', 'no_answer', 'canceled']);

function parseTwilioTimestamp(timestamp) {
  if (!timestamp) return new Date();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toPositiveInt(value) {
  const parsed = parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function appendRawEvent(callLog, type, payload) {
  const events = Array.isArray(callLog.rawEvents) ? callLog.rawEvents : [];
  return [
    ...events.slice(-49),
    {
      type,
      receivedAt: new Date().toISOString(),
      payload,
    },
  ];
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getRequestUrl(req) {
  const configuredBaseUrl = getPublicBaseUrl();
  if (configuredBaseUrl) return `${configuredBaseUrl}${req.originalUrl}`;
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function verifyTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = req.get('X-Twilio-Signature');
  if (!signature) return false;

  const params = { ...(req.body || {}) };
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => `${acc}${key}${params[key]}`, getRequestUrl(req));

  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

// Only Twilio-owned hosts may ever receive our account credentials (the
// recording proxy authenticates to whatever host is stored on the call log).
function isTrustedTwilioUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'twilio.com' || host.endsWith('.twilio.com');
  } catch (err) {
    return false;
  }
}

function assertValidTwilioRequest(req) {
  const isProduction = process.env.NODE_ENV === 'production';
  // The bypass is a local/test convenience only — never honoured in production.
  if (process.env.TWILIO_VALIDATE_WEBHOOKS === 'false' && !isProduction) return;
  if (!process.env.TWILIO_AUTH_TOKEN) {
    // Fail closed in production: without a token we cannot verify the signature,
    // so we must reject rather than trust an unauthenticated caller.
    if (isProduction) {
      throw Object.assign(new Error('Twilio webhook validation is not configured'), {
        statusCode: 500,
        code: 'TWILIO_AUTH_TOKEN_MISSING',
      });
    }
    return;
  }
  if (!verifyTwilioSignature(req)) {
    throw Object.assign(new Error('Invalid Twilio signature'), {
      statusCode: 403,
      code: 'INVALID_TWILIO_SIGNATURE',
    });
  }
}

async function createTwilioCall({ to, url, statusCallback }) {
  assertTwilioConfigured();

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', process.env.TWILIO_PHONE_NUMBER);
  params.append('Url', url);
  params.append('Method', 'POST');
  params.append('StatusCallback', statusCallback);
  params.append('StatusCallbackMethod', 'POST');
  ['initiated', 'ringing', 'answered', 'completed'].forEach((event) => {
    params.append('StatusCallbackEvent', event);
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    params,
    {
      auth: {
        username: accountSid,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

async function startLeadCall(leadId, agencyId, agent) {
  assertTwilioConfigured();

  const lead = await Lead.findOne({
    where: scopedLeadWhere(agencyId, agent, { id: leadId }),
    include: [{ model: Customer, as: 'customer' }],
  });

  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'LEAD_NOT_FOUND' });
  }

  if (!lead.customer?.phone) {
    throw Object.assign(new Error('Customer phone is missing'), {
      statusCode: 400,
      code: 'CUSTOMER_PHONE_MISSING',
    });
  }

  const currentAgent = await Agent.findOne({ where: { id: agent.id, agencyId } });
  if (!currentAgent?.phone) {
    throw Object.assign(new Error('Your agent profile needs a phone number before starting tracked calls'), {
      statusCode: 400,
      code: 'AGENT_PHONE_MISSING',
    });
  }

  const agentPhone = normalizePhone(currentAgent.phone);
  const customerPhone = normalizePhone(lead.customer.phone);
  const callLog = await CallLog.create({
    agencyId,
    leadId: lead.id,
    customerId: lead.customerId,
    agentId: currentAgent.id,
    agentPhone,
    customerPhone,
    status: 'initiated',
    startedAt: new Date(),
  });

  const baseUrl = getPublicBaseUrl();
  let twilioCall;
  try {
    twilioCall = await createTwilioCall({
      to: agentPhone,
      url: `${baseUrl}/api/calls/twiml/connect?callLogId=${encodeURIComponent(callLog.id)}`,
      statusCallback: `${baseUrl}/api/calls/webhooks/status`,
    });
  } catch (err) {
    await callLog.update({
      status: 'failed',
      failureReason: err.response?.data?.message || err.message,
      rawEvents: appendRawEvent(callLog, 'twilio_call_create_failed', err.response?.data || { message: err.message }),
    });
    throw Object.assign(new Error(err.response?.data?.message || 'Failed to start Twilio call'), {
      statusCode: 502,
      code: 'TWILIO_CALL_FAILED',
    });
  }

  await callLog.update({
    agentCallSid: twilioCall.sid,
    parentCallSid: twilioCall.sid,
    status: normalizeTwilioStatus(twilioCall.status) || 'initiated',
    rawEvents: appendRawEvent(callLog, 'twilio_call_created', twilioCall),
  });

  return CallLog.findByPk(callLog.id, {
    include: [
      { model: Lead, as: 'lead' },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Agent, as: 'agent', attributes: ['id', 'name', 'phone'] },
    ],
  });
}

async function buildConnectTwiML(callLogId, req) {
  assertValidTwilioRequest(req);

  const callLog = await CallLog.findByPk(callLogId);
  if (!callLog) {
    throw Object.assign(new Error('Call log not found'), { statusCode: 404, code: 'CALL_LOG_NOT_FOUND' });
  }

  const baseUrl = getPublicBaseUrl();
  const statusCallback = `${baseUrl}/api/calls/webhooks/status`;
  const recordingCallback = `${baseUrl}/api/calls/webhooks/recording`;
  const shouldRecord = process.env.CALL_RECORDING_ENABLED !== 'false';
  const recordAttrs = shouldRecord
    ? ` record="record-from-answer" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : '';

  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    '<Say voice="alice">This call may be recorded for quality and follow up purposes.</Say>',
    `<Dial${recordAttrs}>`,
    `<Number statusCallback="${escapeXml(statusCallback)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(callLog.customerPhone)}</Number>`,
    '</Dial>',
    '</Response>',
  ].join('');

  await callLog.update({
    status: 'agent_answered',
    agentAnsweredAt: callLog.agentAnsweredAt || new Date(),
    rawEvents: appendRawEvent(callLog, 'twiml_connect_requested', req.body || {}),
  });

  return twiml;
}

async function findCallLogForWebhook(payload) {
  const callSid = payload.CallSid;
  const parentCallSid = payload.ParentCallSid;

  return CallLog.findOne({
    where: {
      [Op.or]: [
        { agentCallSid: callSid },
        { customerCallSid: callSid },
        { parentCallSid: callSid },
        ...(parentCallSid ? [{ agentCallSid: parentCallSid }, { parentCallSid }] : []),
      ],
    },
    order: [['createdAt', 'DESC']],
  });
}

async function handleStatusWebhook(req) {
  assertValidTwilioRequest(req);

  const payload = req.body || {};
  const callLog = await findCallLogForWebhook(payload);
  if (!callLog) return null;

  const callSid = payload.CallSid;
  const parentCallSid = payload.ParentCallSid;
  const callStatus = String(payload.CallStatus || '').toLowerCase();
  const timestamp = parseTwilioTimestamp(payload.Timestamp);
  const normalizedStatus = normalizeTwilioStatus(callStatus);
  const isCustomerLeg = Boolean(parentCallSid && parentCallSid === callLog.agentCallSid)
    || (callLog.customerCallSid && callSid === callLog.customerCallSid);
  const isAgentLeg = callSid === callLog.agentCallSid;

  const updates = {
    rawEvents: appendRawEvent(callLog, 'status_callback', payload),
  };

  if (isCustomerLeg) {
    updates.customerCallSid = callSid;
    if (callStatus === 'initiated' || callStatus === 'ringing') updates.status = 'customer_ringing';
    if (callStatus === 'in-progress') {
      updates.status = 'in_progress';
      updates.customerAnsweredAt = callLog.customerAnsweredAt || timestamp;
    }
  } else if (isAgentLeg) {
    if (callStatus === 'in-progress') {
      updates.status = 'agent_answered';
      updates.agentAnsweredAt = callLog.agentAnsweredAt || timestamp;
    } else if (normalizedStatus) {
      updates.status = normalizedStatus;
    }
  } else if (normalizedStatus) {
    updates.status = normalizedStatus;
  }

  if (callStatus === 'completed') {
    updates.completedAt = timestamp;
    // Both legs fire `completed`; keep the longest duration so the customer-leg
    // event can't shrink a call the agent leg already measured.
    const dur = toPositiveInt(payload.CallDuration);
    if (dur != null && (callLog.durationSeconds == null || dur > callLog.durationSeconds)) {
      updates.durationSeconds = dur;
    }
    updates.status = 'completed';
  }

  if (['busy', 'failed', 'no-answer', 'canceled'].includes(callStatus)) {
    updates.completedAt = callLog.completedAt || timestamp;
    updates.status = normalizeTwilioStatus(callStatus) || 'failed';
    updates.failureReason = payload.ErrorMessage || payload.SipResponseCode || callStatus;
  }

  // Guard against out-of-order webhooks: once the call is terminal, a late
  // `ringing`/`in-progress` event must not revive it.
  if (TERMINAL_STATUSES.has(callLog.status) && updates.status && !TERMINAL_STATUSES.has(updates.status)) {
    delete updates.status;
  }

  await callLog.update(updates);
  return callLog;
}

async function handleRecordingWebhook(req) {
  assertValidTwilioRequest(req);

  const payload = req.body || {};
  const callLog = await findCallLogForWebhook(payload);
  if (!callLog) return null;

  // Never persist an attacker-supplied URL: a forged webhook could otherwise
  // point recordingUrl at their own host and later harvest our Twilio creds via
  // the streamRecording proxy.
  if (payload.RecordingUrl && !isTrustedTwilioUrl(payload.RecordingUrl)) {
    throw Object.assign(new Error('Recording URL is not a trusted Twilio host'), {
      statusCode: 400,
      code: 'UNTRUSTED_RECORDING_URL',
    });
  }

  const recordingUrl = payload.RecordingUrl
    ? `${payload.RecordingUrl}.mp3`
    : callLog.recordingUrl;

  await callLog.update({
    recordingSid: payload.RecordingSid || callLog.recordingSid,
    recordingUrl,
    recordingDuration: toPositiveInt(payload.RecordingDuration) ?? callLog.recordingDuration,
    rawEvents: appendRawEvent(callLog, 'recording_callback', payload),
  });

  return callLog;
}

/**
 * Streams a call recording back to an authenticated dashboard user.
 *
 * The stored `recordingUrl` points at api.twilio.com and requires the account's
 * Basic Auth credentials, so it can never be opened directly by the browser.
 * This proxies it: we authenticate to Twilio server-side and pipe the audio
 * through, scoped to the requester's agency (and own calls for non-admins).
 */
async function streamRecording(callLogId, agencyId, requester) {
  const where = { id: callLogId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;

  const callLog = await CallLog.findOne({ where });
  if (!callLog) {
    throw Object.assign(new Error('Call log not found'), { statusCode: 404, code: 'CALL_LOG_NOT_FOUND' });
  }
  if (!callLog.recordingUrl) {
    throw Object.assign(new Error('No recording is available for this call'), {
      statusCode: 404,
      code: 'RECORDING_NOT_AVAILABLE',
    });
  }

  // Defence in depth: only ever send Twilio Basic Auth to a Twilio host, even if
  // a malformed URL slipped into storage before validation existed.
  if (!isTrustedTwilioUrl(callLog.recordingUrl)) {
    throw Object.assign(new Error('Recording URL is not a trusted Twilio host'), {
      statusCode: 400,
      code: 'UNTRUSTED_RECORDING_URL',
    });
  }

  assertTwilioConfigured();

  const response = await axios.get(callLog.recordingUrl, {
    responseType: 'stream',
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID,
      password: process.env.TWILIO_AUTH_TOKEN,
    },
  });

  return {
    stream: response.data,
    contentType: response.headers['content-type'] || 'audio/mpeg',
    contentLength: response.headers['content-length'],
    filename: `call-${callLog.id}.mp3`,
  };
}

/**
 * Builds the TwiML that answers an INBOUND call (customer dialing the Twilio
 * number back). It looks up the customer's most recent tracked call to find the
 * agent who last handled them and bridges the caller straight to that agent,
 * recording the leg. This is the "callback continuity" path — a customer always
 * lands back with their own agent.
 */
async function buildInboundTwiML(req) {
  assertValidTwilioRequest(req);

  const body = req.body || {};
  const fromPhone = normalizePhone(body.From);
  const inboundCallSid = body.CallSid;

  // Most recent tracked call involving this customer number tells us their agent.
  const priorCall = fromPhone
    ? await CallLog.findOne({
        where: { customerPhone: fromPhone },
        include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'phone'] }],
        order: [['createdAt', 'DESC']],
      })
    : null;

  const agentPhone = normalizePhone(priorCall?.agent?.phone || '');

  // No history (or the agent has no phone on file) → apologise and let them know
  // we'll reach out, rather than dumping the caller into silence.
  if (!priorCall || !agentPhone) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      '<Say voice="alice">Thanks for calling. Our team will get back to you shortly. You can also reach us on WhatsApp.</Say>',
      '<Hangup/>',
      '</Response>',
    ].join('');
  }

  const baseUrl = getPublicBaseUrl();
  const statusCallback = `${baseUrl}/api/calls/webhooks/status`;
  const recordingCallback = `${baseUrl}/api/calls/webhooks/recording`;
  const shouldRecord = process.env.CALL_RECORDING_ENABLED !== 'false';
  const recordAttrs = shouldRecord
    ? ` record="record-from-answer" recordingStatusCallback="${escapeXml(recordingCallback)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`
    : '';

  // Log the inbound call so it shows in the lead timeline and the recording
  // webhook can match it (by parentCallSid === inbound CallSid).
  try {
    await CallLog.create({
      agencyId: priorCall.agencyId,
      leadId: priorCall.leadId,
      customerId: priorCall.customerId,
      agentId: priorCall.agentId,
      agentPhone,
      customerPhone: fromPhone,
      parentCallSid: inboundCallSid || null,
      status: 'in_progress',
      startedAt: new Date(),
      rawEvents: [{ type: 'inbound_call', receivedAt: new Date().toISOString(), payload: body }],
    });
  } catch (err) {
    // Logging is best-effort — never block connecting the caller to their agent.
    console.error('[callService] failed to log inbound call:', err.message);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    '<Say voice="alice">Please hold while we connect you with your travel agent. This call may be recorded.</Say>',
    `<Dial${recordAttrs}>`,
    `<Number statusCallback="${escapeXml(statusCallback)}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${escapeXml(agentPhone)}</Number>`,
    '</Dial>',
    '</Response>',
  ].join('');
}

async function listCallLogs(agencyId, filters = {}, requester = null) {
  const where = { agencyId };
  if (filters.leadId) where.leadId = filters.leadId;
  if (!isAdmin(requester)) where.agentId = requester?.id;

  return CallLog.findAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Agent, as: 'agent', attributes: ['id', 'name', 'phone'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: Math.min(parseInt(filters.limit || '25', 10) || 25, 100),
  });
}

module.exports = {
  buildConnectTwiML,
  buildInboundTwiML,
  handleRecordingWebhook,
  handleStatusWebhook,
  listCallLogs,
  startLeadCall,
  streamRecording,
};
