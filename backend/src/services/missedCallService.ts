// FILE: /backend/src/services/missedCallService.js
//
// Inbound WhatsApp (Cloud API) call handling. marketing-os raw-proxies the Meta
// webhook to travel-bot; a `calls` payload (entry[].changes[].value.calls[])
// lands here via agencyService.handleMarketingOsCallback.
//
// travel-bot has no voice/media stack and never answers WhatsApp calls, so every
// user-initiated call is a missed call. An inbound call opens the 24h customer
// service window, so the auto-reply is a free-form text (free) via the partner
// send API — no template needed.

const { Op } = require('sequelize');
const { WhatsAppCall, Customer, Lead, Agency } = require('../models');
const { normalizePhone } = require('../utils/phoneUtils');
const { isApiPrefixAllowed } = require('../constants/modules');
const marketingOsPartnerService = require('./marketingOsPartnerService');
const leadService = require('./leadService');

// Per-agency feature gate. The platform admin enables/disables the "/missed-calls"
// module per agency (agency.sidebarPreferences); when disabled, the whole feature
// is off — no logging, no auto-reply. Agencies with no explicit preference keep it.
const MISSED_CALL_API_PREFIX = '/api/missed-calls';

function isFeatureEnabledForAgency(agency) {
  return isApiPrefixAllowed(agency && agency.sidebarPreferences, MISSED_CALL_API_PREFIX);
}

const DEFAULT_AUTO_REPLY =
  'Sorry we missed your call! 👋 How can we help you today? Reply here and our team will get back to you shortly.';

/**
 * Pull every call object out of a raw Meta webhook body, tagged with the
 * phone_number_id / waba id needed to resolve the owning agency.
 * @returns {Array<{ call: object, phoneNumberId?: string, wabaId?: string }>}
 */
function extractCalls(rawBody) {
  const out = [];
  if (!rawBody || !Array.isArray(rawBody.entry)) return out;
  for (const entry of rawBody.entry) {
    const wabaId = entry && entry.id;
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change && change.value;
      if (!value || !Array.isArray(value.calls) || value.calls.length === 0) continue;
      const phoneNumberId = value.metadata && value.metadata.phone_number_id;
      for (const call of value.calls) {
        out.push({ call, phoneNumberId, wabaId });
      }
    }
  }
  return out;
}

/** Whether a raw webhook body carries any WhatsApp call events. */
function hasCallEvents(rawBody) {
  return extractCalls(rawBody).length > 0;
}

async function resolveAgency(phoneNumberId, wabaId, tenantId) {
  const or = [];
  if (phoneNumberId) or.push({ whatsappPhoneNumberId: String(phoneNumberId) });
  if (wabaId) or.push({ whatsappBusinessAccountId: String(wabaId) });
  if (tenantId) or.push({ marketingOsTenantId: String(tenantId) });
  if (or.length === 0) return null;
  return Agency.findOne({ where: { [Op.or]: or } });
}

function isBusinessInitiated(call) {
  const dir = String(call.direction || '').toUpperCase();
  return dir.includes('BUSINESS') || dir === 'OUTBOUND';
}

/**
 * A call is "terminal" (ended, so we can treat it as missed) when Meta reports a
 * terminate/rejected/unanswered event. A bare 'connect' (still ringing) is not
 * terminal. When no event field is present we assume terminal to avoid dropping
 * a missed call.
 */
function isTerminalEvent(call) {
  const event = String(call.event || call.status || '').toLowerCase();
  if (!event) return true;
  return ['terminate', 'terminated', 'missed', 'reject', 'rejected', 'failed', 'no_answer', 'unanswered', 'completed']
    .some((k) => event.includes(k));
}

function callTimestamp(call) {
  const ts = Number(call.timestamp);
  if (Number.isFinite(ts) && ts > 0) {
    // Meta sends epoch seconds; guard against ms just in case.
    return new Date(ts > 1e12 ? ts : ts * 1000);
  }
  return new Date();
}

async function matchCustomer(agencyId, rawFrom) {
  const normalized = normalizePhone(rawFrom);
  const candidates = [rawFrom, normalized].filter(Boolean).map(String);
  if (candidates.length === 0) return null;
  return Customer.findOne({
    where: { agencyId, phone: { [Op.in]: Array.from(new Set(candidates)) } },
  });
}

async function latestLeadForCustomer(agencyId, customerId) {
  if (!customerId) return null;
  return Lead.findOne({
    where: { agencyId, customerId },
    order: [['createdAt', 'DESC']],
  });
}

async function sendAutoReply(agency, toPhone, providerCallId) {
  const body = String(agency.whatsappMissedCallAutoReplyMessage || '').trim() || DEFAULT_AUTO_REPLY;
  const result = await marketingOsPartnerService.sendMessage(
    agency.marketingOsTenantId,
    { to: toPhone, body },
    { idempotencyKey: providerCallId ? `missed-call-${providerCallId}` : undefined }
  );
  // marketing-os returns { messageId, providerMessageId, ... }
  return result && (result.providerMessageId || result.messageId) || null;
}

/**
 * Process a single call event: upsert the WhatsAppCall row (idempotent on
 * providerCallId), link/create the CRM contact per agency policy, and fire the
 * auto-reply once for a missed inbound call.
 */
async function processSingleCall(agency, entry) {
  const { call } = entry;
  const rawFrom = call.from || call.wa_id || null;
  if (!rawFrom) return null;

  const providerCallId = call.id || `${rawFrom}-${call.timestamp || ''}`;
  const inbound = !isBusinessInitiated(call);

  const [row, created] = await WhatsAppCall.findOrCreate({
    where: { agencyId: agency.id, providerCallId },
    defaults: {
      agencyId: agency.id,
      providerCallId,
      direction: inbound ? 'INBOUND' : 'OUTBOUND',
      callerPhone: String(rawFrom).slice(0, 50),
      businessPhone: call.to ? String(call.to).slice(0, 50) : null,
      status: 'MISSED',
      event: call.event || call.status || null,
      occurredAt: callTimestamp(call),
      rawEvents: [call],
    },
  });

  if (!created) {
    // Another event (e.g. connect → terminate) for the same call. Append and move on.
    const rawEvents = Array.isArray(row.rawEvents) ? row.rawEvents.slice() : [];
    rawEvents.push(call);
    await row.update({ event: call.event || call.status || row.event, rawEvents });
  }

  // Only inbound (customer-placed), ended calls are "missed". Ignore our own
  // outbound calls and calls that are still ringing.
  if (!inbound || !isTerminalEvent(call)) {
    return row;
  }

  // Link to an existing contact; optionally create a lead for unknown callers.
  let customer = await matchCustomer(agency.id, rawFrom);
  let leadId = row.leadId || null;

  if (!customer && agency.whatsappMissedCallUnknownAction === 'CREATE_LEAD') {
    try {
      const lead = await leadService.createLead(
        {
          customerPhone: rawFrom,
          customerName: 'WhatsApp Caller',
          customerSource: 'whatsapp_call',
          enquiryType: 'general',
          notes: 'Auto-created from a missed WhatsApp call.',
        },
        agency.id
      );
      leadId = lead && lead.id ? lead.id : leadId;
      customer = lead && lead.customerId
        ? await Customer.findByPk(lead.customerId)
        : customer;
    } catch (err) {
      console.error('[missedCall] Failed to auto-create lead:', err && err.message);
    }
  }

  if (customer && !leadId) {
    const lead = await latestLeadForCustomer(agency.id, customer.id);
    if (lead) leadId = lead.id;
  }

  const linkUpdates = {};
  if (customer && row.customerId !== customer.id) linkUpdates.customerId = customer.id;
  if (leadId && row.leadId !== leadId) linkUpdates.leadId = leadId;
  if (Object.keys(linkUpdates).length > 0) await row.update(linkUpdates);

  // Fire the auto-reply exactly once. Claim the slot atomically so concurrent
  // duplicate terminate deliveries can't double-send.
  if (row.autoReplyStatus == null) {
    const [claimed] = await WhatsAppCall.update(
      { autoReplyStatus: 'SKIPPED' },
      { where: { id: row.id, autoReplyStatus: null } }
    );

    if (claimed) {
      if (!agency.whatsappMissedCallAutoReplyEnabled) {
        await row.update({ autoReplyStatus: 'DISABLED' });
      } else if (!agency.marketingOsTenantId) {
        await row.update({ autoReplyStatus: 'FAILED', autoReplyError: 'Agency has no Marketing OS tenant configured' });
      } else {
        try {
          const messageId = await sendAutoReply(agency, rawFrom, providerCallId);
          await row.update({
            autoReplyStatus: 'SENT',
            autoReplySentAt: new Date(),
            autoReplyMessageId: messageId,
            autoReplyError: null,
          });
        } catch (err) {
          const detail = (err && err.response && err.response.data && (err.response.data.message || JSON.stringify(err.response.data)))
            || (err && err.message)
            || 'Auto-reply send failed';
          await row.update({ autoReplyStatus: 'FAILED', autoReplyError: String(detail).slice(0, 1000) });
          console.error('[missedCall] Auto-reply send failed:', detail);
        }
      }
    }
  }

  return row.reload ? row.reload() : row;
}

/**
 * Entry point from the webhook. Resolves the agency once per phone_number_id and
 * processes every call in the payload. Never throws to the caller — logs and
 * continues so one bad call can't fail the webhook ack.
 */
async function processCallWebhook(rawBody, context = {}) {
  const entries = extractCalls(rawBody);
  if (entries.length === 0) return { processed: 0 };

  const agencyCache = new Map();
  let processed = 0;

  for (const entry of entries) {
    try {
      const cacheKey = String(entry.phoneNumberId || entry.wabaId || context.tenantId || '');
      let agency = agencyCache.get(cacheKey);
      if (!agency) {
        agency = await resolveAgency(entry.phoneNumberId, entry.wabaId, context.tenantId);
        if (agency) agencyCache.set(cacheKey, agency);
      }
      if (!agency) {
        console.warn('[missedCall] No agency resolved for call webhook', {
          phoneNumberId: entry.phoneNumberId,
          wabaId: entry.wabaId,
          tenantId: context.tenantId,
        });
        continue;
      }
      // The platform admin can disable this feature per agency. When off, drop the
      // event entirely — don't log the call and don't auto-reply.
      if (!isFeatureEnabledForAgency(agency)) {
        continue;
      }
      await processSingleCall(agency, entry);
      processed += 1;
    } catch (err) {
      console.error('[missedCall] Error processing call event:', err && err.message);
    }
  }

  return { processed };
}

/**
 * List WhatsApp calls (missed-calls page). Scoped to the agency.
 * @param {string} agencyId
 * @param {{ status?: string, search?: string, limit?: number, offset?: number }} query
 */
async function listWhatsAppCalls(agencyId, query = {}) {
  const where = { agencyId };

  if (query.status && ['MISSED', 'COMPLETED', 'REJECTED'].includes(String(query.status).toUpperCase())) {
    where.status = String(query.status).toUpperCase();
  }

  if (query.search) {
    where.callerPhone = { [Op.iLike]: `%${String(query.search).trim()}%` };
  }

  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset, 10) || 0, 0);

  const { rows, count } = await WhatsAppCall.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Lead, as: 'lead', attributes: ['id', 'status', 'assignedAgentId'] },
    ],
    order: [['occurredAt', 'DESC']],
    limit,
    offset,
  });

  return { rows, total: count, limit, offset };
}

/**
 * Turn on WhatsApp voice calling for an agency's connected number (via marketing-os
 * → Meta /settings). Required before inbound customer calls can happen at all.
 */
async function enableCallingForAgency(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency || !agency.marketingOsTenantId) {
    throw Object.assign(new Error('WhatsApp is not connected via Marketing OS for this agency'), {
      statusCode: 400,
      code: 'WHATSAPP_NOT_CONNECTED',
    });
  }
  const token = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  try {
    return await marketingOsPartnerService.enableTenantWhatsAppCalling(token);
  } catch (err) {
    // Surface the real reason (Meta's rejection message) instead of a generic 500.
    const data = err && err.response && err.response.data;
    const reason = (data && (data.error?.message || data.error || data.message))
      || (err && err.message)
      || 'Failed to enable calling';
    console.error('[missedCall] enableCalling failed for agency', agencyId, '-', typeof reason === 'string' ? reason : JSON.stringify(reason));
    throw Object.assign(new Error(typeof reason === 'string' ? reason : JSON.stringify(reason)), {
      statusCode: (err && err.response && err.response.status) || 502,
      code: 'CALLING_ENABLE_FAILED',
    });
  }
}

/** Read the agency number's current call settings (calling status etc.). */
async function getCallingStatusForAgency(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency || !agency.marketingOsTenantId) {
    return { connected: false };
  }
  const token = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  const result = await marketingOsPartnerService.getTenantWhatsAppCallingSettings(token);
  return (result && result.data) || result || { connected: false };
}

module.exports = {
  hasCallEvents,
  extractCalls,
  processCallWebhook,
  listWhatsAppCalls,
  enableCallingForAgency,
  getCallingStatusForAgency,
  DEFAULT_AUTO_REPLY,
};
