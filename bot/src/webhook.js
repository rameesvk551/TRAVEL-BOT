// FILE: /bot/src/webhook.js
// DEPS: express, crypto
// ENV: WEBHOOK_VERIFY_TOKEN, WEBHOOK_APP_SECRET

const crypto = require('crypto');
const path = require('path');
const { Op } = require('sequelize');
const { Agency, AgencyChannel, Agent, BotSession, Customer, Lead, Message, Package, Property } = require(path.resolve(__dirname, '../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../backend/src/services/whatsappService.ts'));
const schedulerService = require(path.resolve(__dirname, '../../backend/src/services/schedulerService.ts'));
const { loadOrCreateSession, updateSession } = require('./utils/sessionManager');
const { routeMessage, willDropSilently } = require('./botRouter');
const { handleAgentLeadAction } = require('./handlers/agentLeadHandler');
const { ensureLead, hasInstagramFlowGraph } = require('./handlers/travelFlowHandler');
const { normalizePhone } = require(path.resolve(__dirname, '../../backend/src/utils/phoneUtils.ts'));
const adReferralService = require(path.resolve(__dirname, '../../backend/src/services/adReferralService.ts'));

const ACTIVE_LEAD_STATUSES = [
  'JUST_CONTACTED',
  'PACKAGE_SEARCHED',
  'PACKAGE_INTERESTED',
  'NEW',
  'ENQUIRY',
  'CONTACTED',
  'QUOTED',
  'NEGOTIATING',
];

const LIVE_ECHO_HANDOFF_WINDOW_MS = 15 * 60 * 1000;
const ECHO_CLOCK_SKEW_MS = 60 * 1000;

async function applyWhatsAppProfileName({ profileName, customer, agency, session }) {
  const name = String(profileName || '').trim();
  if (!name || !customer || !agency) return;

  if (name !== customer.name) {
    await customer.update({ name });
    customer.name = name;
  }

  const draftName = String(session?.collectedData?.enquiryDraft?.name || '').trim();
  if (!draftName && session) {
    await updateSession(session, {
      collectedData: {
        enquiryDraft: {
          ...(session.collectedData?.enquiryDraft || {}),
          name,
        },
      },
    });
  }

  const activeLead = await Lead.findOne({
    where: {
      customerId: customer.id,
      agencyId: agency.id,
      // Entry-stage leads carry a null status; match those too.
      [Op.or]: [{ status: null }, { status: ACTIVE_LEAD_STATUSES }],
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!activeLead) return;

  const customTripDetails = activeLead.customTripDetails || {};
  if (String(customTripDetails.name || '').trim()) return;

  await activeLead.update({
    customTripDetails: {
      ...customTripDetails,
      name,
    },
  });
}

/**
 * GET /webhook — Meta verification challenge.
 * Called once when registering the webhook URL in Meta dashboard.
 */
function handleVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  console.error('[Webhook] Verification failed — mode:', mode, 'token:', token);
  return res.sendStatus(403);
}

/**
 * Verifies the X-Hub-Signature-256 header using HMAC-SHA256.
 * @param {Buffer} rawBody - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header value
 * @returns {boolean} Whether the signature is valid
 */
function verifySignature(rawBody, signature) {
  if (!signature || !process.env.WEBHOOK_APP_SECRET) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBHOOK_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function verifyMarketingOsSignature(signature) {
  if (!signature || !process.env.MARKETING_OS_WEBHOOK_SECRET) return false;
  return signature === process.env.MARKETING_OS_WEBHOOK_SECRET;
}

/**
 * POST /webhook — Processes incoming WhatsApp messages.
 * Always returns 200 immediately (Meta requirement), then processes async.
 */
async function handleIncoming(req, res) {
  // Always return 200 immediately — Meta requires this
  res.sendStatus(200);

  try {
    const body = req.body;

    // Verify signature - check Marketing OS first, then Meta
    let signatureValid = false;
    
    // Check for Marketing OS signature
    const marketingOsSecret = req.headers['x-marketing-os-secret'];
    if (marketingOsSecret && process.env.MARKETING_OS_WEBHOOK_SECRET) {
      signatureValid = verifyMarketingOsSignature(marketingOsSecret);
      console.log('[Webhook] Marketing OS signature verification:', signatureValid);
    }
    // Fallback to Meta signature verification
    else if (process.env.WEBHOOK_APP_SECRET && req.rawBody) {
      const metaSignature = req.headers['x-hub-signature-256'];
      signatureValid = verifySignature(req.rawBody, metaSignature);
      console.log('[Webhook] Meta signature verification:', signatureValid);
    }
    
    if (!signatureValid) {
      console.error('[Webhook] Invalid signature from both providers, rejecting');
      return;
    }

    const eventType = req.headers['x-marketing-os-event'];

    // Handle Instagram Proxy Webhooks
    if (eventType === 'instagram_message') {
      const tenantId = req.headers['x-partner-tenant-id'];
      await processInstagramMessage({ ...body, tenantId }).catch((err) => {
        console.error('[Webhook] Error processing IG message:', err.message);
      });
      return;
    }

    if (eventType === 'instagram_comment') {
      const tenantId = req.headers['x-partner-tenant-id'];
      await processInstagramComment({ ...body, tenantId }).catch((err) => {
        console.error('[Webhook] Error processing IG comment:', err.message);
      });
      return;
    }

    // Extract messages from webhook payload (WhatsApp structure)
    const entries = Array.isArray(body.entry) ? body.entry : [];
    if (!entries.length) {
      console.warn('[Webhook] No entry array found in incoming payload');
      return;
    }
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const metadata = value.metadata || {};

        if (change.field === 'account_update' || value.event) {
          await processAccountUpdate(value, entry).catch((err) => {
            console.error('[Webhook] Error processing account update:', err.message);
          });
        }

        if (change.field === 'smb_app_state_sync' || value.state_sync) {
          await processStateSync(value, metadata).catch((err) => {
            console.error('[Webhook] Error processing SMB app state sync:', err.message);
          });
        }

        if (change.field === 'history' || value.history) {
          await processHistorySync(value, metadata).catch((err) => {
            console.error('[Webhook] Error processing history sync:', err.message);
          });
        }

        if (change.field === 'smb_message_echoes' || value.message_echoes) {
          await processMessageEchoes(value, metadata).catch((err) => {
            console.error('[Webhook] Error processing SMB message echoes:', err.message);
          });
        }

        // Handle message status updates (delivered, read)
        if (value.statuses) {
          for (const status of value.statuses) {
            await whatsappService.updateMessageStatus(status.id, status.status, status);
          }
        }

        // Handle incoming messages
        const messages = value.messages || [];

        for (const msg of messages) {
          if (change.field === 'history' && msg.type !== 'edit' && msg.type !== 'revoke') {
            await processHistoryMediaMessage(msg, metadata).catch((err) => {
              console.error('[Webhook] Error processing history media message:', err.message);
            });
            continue;
          }

          if (msg.type === 'edit') {
            await processMessageEdit(msg).catch((err) => {
              console.error('[Webhook] Error processing message edit:', err.message);
            });
            continue;
          }

          if (msg.type === 'revoke') {
            await processMessageRevoke(msg).catch((err) => {
              console.error('[Webhook] Error processing message revoke:', err.message);
            });
            continue;
          }

          await processMessage(msg, metadata, value.contacts || []).catch((err) => {
            console.error('[Webhook] Error processing message:', err.message);
          });
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Error handling incoming:', err.message);
  }
}

async function resolveAgencyFromMetadata(metadata = {}, entry = {}) {
  const displayPhone = metadata.display_phone_number || metadata.phone_number
    ? normalizePhone(metadata.display_phone_number || metadata.phone_number)
    : null;
  const phoneNumberId = metadata.phone_number_id || null;
  const wabaId = entry.id || null;

  const whereCandidates = [];
  if (displayPhone) whereCandidates.push({ whatsappNumber: displayPhone });
  if (phoneNumberId) whereCandidates.push({ whatsappPhoneNumberId: phoneNumberId });
  if (wabaId) whereCandidates.push({ whatsappBusinessAccountId: wabaId });

  for (const where of whereCandidates) {
    const channel = await AgencyChannel.findOne({
      where,
      include: [{ model: Agency, as: 'agency' }],
    });
    if (channel?.agency) return { agency: channel.agency, channel };
  }

  for (const where of whereCandidates) {
    const agency = await Agency.findOne({ where });
    if (agency) return { agency, channel: null };
  }

  return { agency: null, channel: null };
}

async function upsertCustomerContact(agencyId, phone, updates = {}) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return null;

  const [customer] = await Customer.findOrCreate({
    where: { agencyId, phone: normalizedPhone },
    defaults: {
      agencyId,
      phone: normalizedPhone,
      source: updates.source || 'whatsapp_business_app',
      name: updates.name || null,
      notes: updates.notes || null,
      channelId: updates.channelId || null,
    },
  });

  const nextValues = {};
  if (updates.name && updates.name !== customer.name) nextValues.name = updates.name;
  if (updates.source && updates.source !== customer.source) nextValues.source = updates.source;
  if (updates.notes && updates.notes !== customer.notes) nextValues.notes = updates.notes;
  if (updates.channelId && updates.channelId !== customer.channelId) nextValues.channelId = updates.channelId;

  if (Object.keys(nextValues).length) {
    await customer.update(nextValues);
  }

  return customer;
}

function normalizeStoredMessageType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'image' || normalized === 'video') return 'IMAGE';
  if (normalized === 'document') return 'DOCUMENT';
  if (normalized === 'audio' || normalized === 'voice') return 'AUDIO';
  return 'TEXT';
}

function mapHistoryStatus(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ERROR' || normalized === 'FAILED') return 'FAILED';
  if (normalized === 'READ' || normalized === 'PLAYED') return 'READ';
  if (normalized === 'DELIVERED') return 'DELIVERED';
  return 'SENT';
}

function extractMessageContent(msg = {}) {
  if (msg.text?.body) return msg.text.body;
  if (msg.image?.caption) return msg.image.caption;
  if (msg.video?.caption) return msg.video.caption;
  if (msg.document?.caption) return msg.document.caption;
  if (msg.document?.filename) return `[Document: ${msg.document.filename}]`;
  if (msg.image?.id) return `[Image Received: ${msg.image.id}]`;
  if (msg.video?.id) return `[Video Received: ${msg.video.id}]`;
  if (msg.audio?.id) return `[Audio Received: ${msg.audio.id}]`;
  if (msg.type === 'media_placeholder') return '[Media message placeholder]';
  if (msg.type) return `[${String(msg.type).toUpperCase()} message]`;
  return '';
}

async function saveCoexistenceMessage({ agency, channel = null, customerPhone, msg, direction, status, source, agentId = null }) {
  if (!agency || !customerPhone || !msg?.id) return null;

  const existing = await Message.findOne({ where: { waMessageId: msg.id } });
  if (existing) return { message: existing, created: false };

  const customer = await upsertCustomerContact(agency.id, customerPhone, { source, channelId: channel?.id || null });
  if (!customer) return null;

  const message = await Message.create({
    customerId: customer.id,
    agencyId: agency.id,
    agentId,
    direction,
    content: extractMessageContent(msg) || '',
    type: normalizeStoredMessageType(msg.type),
    waMessageId: msg.id,
    status: status || 'SENT',
    timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date(),
  });

  return { message, created: true };
}

function getMetaMessageTimestamp(msg = {}) {
  const timestamp = Number.parseInt(msg.timestamp, 10);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shouldPauseForBusinessAppEcho(savedMessage, msg = {}, now = Date.now()) {
  if (!savedMessage?.created) return false;

  const messageAt = getMetaMessageTimestamp(msg);
  if (!messageAt) return true;

  const ageMs = now - messageAt.getTime();
  return ageMs >= -ECHO_CLOCK_SKEW_MS && ageMs <= LIVE_ECHO_HANDOFF_WINDOW_MS;
}

async function resolveManualReplyAgent(agencyId, customerId) {
  const lead = await Lead.findOne({
    where: {
      agencyId,
      customerId,
      assignedAgentId: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });

  if (lead?.assignedAgentId) {
    const assignedAgent = await Agent.findOne({
      where: { id: lead.assignedAgentId, agencyId },
      attributes: ['id'],
    });
    if (assignedAgent) return assignedAgent.id;
  }

  const fallbackAgent = await Agent.findOne({
    where: { agencyId },
    attributes: ['id'],
    order: [
      ['isOnline', 'DESC'],
      ['role', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  return fallbackAgent?.id || null;
}

async function pauseBotForManualReply({ agency, customerId, agentId, source }) {
  if (!agency?.id || !customerId) return;

  const [session] = await BotSession.findOrCreate({
    where: { customerId },
    defaults: {
      customerId,
      agencyId: agency.id,
      currentStep: 'HANDOFF',
      isHandedOff: true,
      handedOffAt: new Date(),
      handedOffToId: agentId || null,
      collectedData: {
        manualHandoff: {
          source,
          reason: 'whatsapp_business_app_reply',
          at: new Date().toISOString(),
        },
      },
    },
  });

  const collectedData = {
    ...(session.collectedData || {}),
    manualHandoff: {
      source,
      reason: 'whatsapp_business_app_reply',
      at: new Date().toISOString(),
    },
  };

  await updateSession(session, {
    isHandedOff: true,
    handedOffAt: session.handedOffAt || new Date(),
    handedOffToId: agentId || session.handedOffToId || null,
    currentStep: 'HANDOFF',
    collectedData,
    lastActivityAt: new Date(),
  });
}

async function processAccountUpdate(value = {}, entry = {}) {
  const { agency, channel } = await resolveAgencyFromMetadata({ phone_number: value.phone_number }, entry);
  if (!agency) return;

  const event = String(value.event || '').toUpperCase();
  const updates = {
    whatsappCoexistenceLastSyncedAt: new Date(),
  };

  if (event === 'PARTNER_REMOVED' || event === 'ACCOUNT_OFFBOARDED') {
    updates.whatsappConnectionStatus = 'NOT_CONNECTED';
    updates.whatsappCoexistenceStatus = 'DISCONNECTED';
    updates.whatsappConnectionError = value.disconnection_info
      ? JSON.stringify(value.disconnection_info)
      : 'WhatsApp Business App disconnected from Cloud API';
  } else if (event === 'ACCOUNT_RECONNECTED') {
    updates.whatsappConnectionStatus = 'CONNECTED';
    updates.whatsappCoexistenceStatus = 'ACTIVE';
    updates.whatsappConnectionError = null;
  }

  await agency.update(updates);
  if (channel) await channel.update(updates);
}

async function processStateSync(value = {}, metadata = {}) {
  const { agency, channel } = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const contacts = Array.isArray(value.state_sync) ? value.state_sync : [];
  for (const item of contacts) {
    if (item?.type !== 'contact' || !item.contact?.phone_number) continue;

    const fullName = item.action === 'remove'
      ? null
      : (item.contact.full_name || item.contact.first_name || null);

    await upsertCustomerContact(agency.id, item.contact.phone_number, {
      name: fullName,
      source: 'whatsapp_business_app_contact',
      notes: item.action === 'remove' ? 'Removed from WhatsApp Business App contacts' : null,
      channelId: channel?.id || null,
    });
  }

  await agency.update({
    whatsappOnboardingMode: 'COEXISTENCE',
    whatsappCoexistenceStatus: 'ACTIVE',
    whatsappContactSyncStatus: 'COMPLETE',
    whatsappCoexistenceLastSyncedAt: new Date(),
  });
  if (channel) {
    await channel.update({
      whatsappOnboardingMode: 'COEXISTENCE',
      whatsappCoexistenceStatus: 'ACTIVE',
      whatsappContactSyncStatus: 'COMPLETE',
      whatsappCoexistenceLastSyncedAt: new Date(),
    });
  }
}

async function processHistorySync(value = {}, metadata = {}) {
  const { agency, channel } = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const historyItems = Array.isArray(value.history) ? value.history : [];
  let declined = false;
  let maxProgress = null;

  for (const item of historyItems) {
    const errors = Array.isArray(item.errors) ? item.errors : [];
    if (errors.some((error) => Number(error.code) === 2593109)) {
      declined = true;
      continue;
    }

    if (Number.isFinite(Number(item.metadata?.progress))) {
      maxProgress = Math.max(maxProgress || 0, Number(item.metadata.progress));
    }

    const threads = Array.isArray(item.threads) ? item.threads : [];
    for (const thread of threads) {
      const customerPhone = normalizePhone(thread.id);
      const messages = Array.isArray(thread.messages) ? thread.messages : [];
      for (const msg of messages) {
        const fromPhone = normalizePhone(msg.from);
        const businessPhone = normalizePhone(metadata.display_phone_number);
        const direction = businessPhone && fromPhone === businessPhone ? 'OUT' : 'IN';
        const targetPhone = direction === 'OUT' ? (msg.to || customerPhone) : fromPhone;

        await saveCoexistenceMessage({
          agency,
          channel,
          customerPhone: targetPhone || customerPhone,
          msg,
          direction,
          status: mapHistoryStatus(msg.history_context?.status),
          source: 'whatsapp_business_app_history',
        });
      }
    }
  }

  await agency.update({
    whatsappOnboardingMode: 'COEXISTENCE',
    whatsappCoexistenceStatus: 'ACTIVE',
    whatsappHistorySyncStatus: declined ? 'DECLINED' : (maxProgress === 100 ? 'COMPLETE' : 'PENDING'),
    whatsappCoexistenceLastSyncedAt: new Date(),
  });
  if (channel) {
    await channel.update({
      whatsappOnboardingMode: 'COEXISTENCE',
      whatsappCoexistenceStatus: 'ACTIVE',
      whatsappHistorySyncStatus: declined ? 'DECLINED' : (maxProgress === 100 ? 'COMPLETE' : 'PENDING'),
      whatsappCoexistenceLastSyncedAt: new Date(),
    });
  }
}

async function processHistoryMediaMessage(msg = {}, metadata = {}) {
  const { agency, channel } = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const fromPhone = normalizePhone(msg.from);
  const businessPhone = normalizePhone(metadata.display_phone_number);
  const direction = businessPhone && fromPhone === businessPhone ? 'OUT' : 'IN';
  const customerPhone = direction === 'OUT' ? msg.to : fromPhone;

  await saveCoexistenceMessage({
    agency,
    channel,
    customerPhone,
    msg,
    direction,
    status: 'DELIVERED',
    source: 'whatsapp_business_app_history',
  });
}

async function processMessageEchoes(value = {}, metadata = {}) {
  const { agency, channel } = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];
  for (const msg of echoes) {
    const customerPhone = msg.to || msg.recipient || msg.recipient_phone_number || msg.customer_phone;
    const customer = await upsertCustomerContact(agency.id, customerPhone, {
      source: 'whatsapp_business_app_echo',
      channelId: channel?.id || null,
    });
    if (!customer) continue;

    const agentId = await resolveManualReplyAgent(agency.id, customer.id);
    const savedMessage = await saveCoexistenceMessage({
      agency,
      channel,
      customerPhone,
      msg,
      direction: 'OUT',
      status: 'SENT',
      source: 'whatsapp_business_app_echo',
      agentId,
    });

    if (shouldPauseForBusinessAppEcho(savedMessage, msg)) {
      await pauseBotForManualReply({
        agency,
        customerId: customer.id,
        agentId,
        source: 'whatsapp_business_app_echo',
      });
    }
  }

  await agency.update({
    whatsappOnboardingMode: 'COEXISTENCE',
    whatsappCoexistenceStatus: 'ACTIVE',
    whatsappCoexistenceLastSyncedAt: new Date(),
  });
  if (channel) {
    await channel.update({
      whatsappOnboardingMode: 'COEXISTENCE',
      whatsappCoexistenceStatus: 'ACTIVE',
      whatsappCoexistenceLastSyncedAt: new Date(),
    });
  }
}

async function processMessageEdit(msg = {}) {
  const originalMessageId = msg.edit?.original_message_id;
  if (!originalMessageId) return;

  const existing = await Message.findOne({ where: { waMessageId: originalMessageId } });
  if (!existing) return;

  const editedMessage = msg.edit?.message || {};
  const content = extractMessageContent(editedMessage);
  if (!content) return;

  await existing.update({
    content,
    type: normalizeStoredMessageType(editedMessage.type),
  });
}

async function processMessageRevoke(msg = {}) {
  const originalMessageId = msg.revoke?.original_message_id;
  if (!originalMessageId) return;

  const existing = await Message.findOne({ where: { waMessageId: originalMessageId } });
  if (!existing) return;

  await existing.update({
    content: '[Message deleted]',
    status: 'FAILED',
  });
}

function isMetaUnavailableUnsupportedMessage(msg = {}) {
  const type = String(msg.type || '').toLowerCase();
  const unsupportedType = String(msg.unsupported?.type || '').toLowerCase();
  const errors = Array.isArray(msg.errors) ? msg.errors : [];
  return type === 'unsupported'
    && (unsupportedType === 'unknown' || unsupportedType === '')
    && errors.some((error) => String(error?.code || '') === '131060');
}

/**
 * Processes a single incoming WhatsApp message through the bot pipeline.
 * Includes fallback protection — customer always gets a response.
 * @param {object} msg - WhatsApp message object
 * @param {object} metadata - Webhook metadata (contains display_phone_number)
 */
async function processMessage(msg, metadata, contacts = []) {
  const fromPhone = normalizePhone(msg.from);
  const toPhone = normalizePhone(metadata.display_phone_number);
  let incoming = extractIncoming(msg);
  let messageText = incoming.text || '';
  const waMessageId = msg.id;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();
  const isInteractiveReply = ['BUTTON', 'BUTTON_REPLY', 'LIST_REPLY', 'FLOW_REPLY'].includes(incoming.type)
    || ['view deals', 'view other services', 'view packages', 'view properties', 'custom trip'].includes(String(messageText || '').trim().toLowerCase());

  if (isInteractiveReply) {
    console.log('[Webhook] Incoming interaction', {
      from: fromPhone,
      to: toPhone,
      type: incoming.type,
      text: messageText,
      actionId: incoming.actionId || '',
      waMessageId,
    });
  }

  const agencyAttributes = [
    'id',
    'name',
    'phone',
    'email',
    'whatsappNumber',
    'whatsappProvider',
    'whatsappChannelId',
    'whatsappBusinessAccountId',
    'whatsappPhoneNumberId',
    'whatsappDisplayPhoneNumber',
    'whatsappTripFlowId',
    'whatsappTripFlowName',
    'whatsappTripFlowStatus',
    'whatsappCatalogId',
    'welcomeMessage',
    'whatsappMenuLabels',
    'whatsappMenuConfig',
    'whatsappFlowConfig',
    'sidebarPreferences',
    'marketingOsTenantId',
    'isActive',
  ];

  // Find agency by the visible number first, then by Meta's stable IDs.
  let agency = await Agency.findOne({
    where: { whatsappNumber: toPhone },
    attributes: agencyAttributes,
  });

  let channel = null;

  if (!agency) {
    const resolved = await resolveAgencyFromMetadata(metadata);
    if (resolved.agency?.id) {
      agency = await Agency.findByPk(resolved.agency.id, { attributes: agencyAttributes });
      channel = resolved.channel;
    }
  }

  if (!agency) {
    console.error(`[Webhook] No agency found for WhatsApp number: ${toPhone}`);
    return;
  }

  const agent = await Agent.findOne({
    where: { agencyId: agency.id, phone: fromPhone },
    attributes: ['id', 'name', 'phone', 'email', 'agencyId'],
  });

  if (agent) {
    await handleAgentLeadAction({ agent, agency, incoming }).catch((err) => {
      console.error('[Webhook] Error processing agent action:', err.message);
    });
    return;
  }

  // Load or create session + customer
  const { session, customer } = await loadOrCreateSession(fromPhone, agency.id);
  if (channel?.id && customer.channelId !== channel.id) {
    await customer.update({ channelId: channel.id });
  }
  const previousInboundCount = await Message.count({
    where: {
      customerId: customer.id,
      agencyId: agency.id,
      direction: 'IN',
    },
  });
  const isFirstInboundMessage = previousInboundCount === 0;

  const contact = Array.isArray(contacts)
    ? contacts.find((item) => normalizePhone(item?.wa_id || item?.phone || item?.id) === fromPhone) || contacts[0]
    : null;
  const profileName = contact?.profile?.name || msg?.contacts?.[0]?.profile?.name || msg?.profile?.name || '';
  await applyWhatsAppProfileName({ profileName, customer, agency, session });

  // Save incoming message to DB (BEFORE processing — never lose a message)
  const shouldStartFromUnavailableMessage = isFirstInboundMessage
    && isMetaUnavailableUnsupportedMessage(msg)
    && !messageText
    && !incoming.actionId
    && !incoming.mediaId;

  await Message.create({
    customerId: customer.id,
    agencyId: agency.id,
    direction: 'IN',
    content: messageText
      || (incoming.mediaId ? `[Media Received: ${incoming.mediaId}]` : '')
      || (shouldStartFromUnavailableMessage ? '[Unavailable WhatsApp message received]' : ''),
    type: normalizeInboundType(msg.type),
    waMessageId,
    status: 'DELIVERED',
    timestamp,
  });

  if (shouldStartFromUnavailableMessage) {
    console.warn('[Webhook] Unavailable unsupported first inbound; starting welcome fallback', {
      from: fromPhone,
      to: toPhone,
      msgType: msg.type || '',
      waMessageId,
    });
    incoming = { ...incoming, text: 'hi', type: 'TEXT', unavailableFallback: true };
    messageText = incoming.text;
  }

  if (!messageText && !incoming.actionId && !incoming.mediaId && incoming.type !== 'ORDER') {
    console.warn('[Webhook] Empty inbound message payload; ignoring instead of sending menu fallback', {
      from: fromPhone,
      to: toPhone,
      msgType: msg.type || '',
      waMessageId,
    });
    return;
  }

  await ensureLead(session, customer, agency, {
    status: null,
    notes: 'First WhatsApp message received',
    preserveExistingStatus: true,
  }).catch((err) => {
    console.warn('[Webhook] Could not ensure lead before routing:', err.message);
  });

  // Click-to-WhatsApp ad attribution: when this message came from tapping a Meta ad,
  // Meta attaches a `referral` with the unique ad ID. Stamp it onto the lead so the
  // CRM knows which of several same-number ads this contact came from.
  if (msg.referral && (msg.referral.source_id || msg.referral.sourceId)) {
    await adReferralService.applyCtwaReferral(agency.id, customer.id, msg.referral).catch((err) => {
      console.warn('[Webhook] Could not apply ad referral attribution:', err.message);
    });
  }

  try {
    await schedulerService.cancelChatFollowUps(customer.id, agency.id);
  } catch (err) {
    console.warn('[Webhook] Could not cancel pending follow-ups:', err.message);
  }

  await whatsappService.markLatestCampaignReply(customer.id, agency.id).catch((err) => {
    console.warn('[Webhook] Could not mark campaign reply:', err.message);
  });

  // If this is a document or image, sync it to the customer record
  if (incoming.mediaId && (incoming.type === 'DOCUMENT' || incoming.type === 'IMAGE')) {
    try {
      // In a production environment, you would use axios to fetch from graph.facebook.com/v21.0/<mediaId>
      // using the WHATSAPP_CLOUD_API_TOKEN, then pipe that buffer to Cloudinary.
      // For this implementation, we will append a system URL placeholder containing the media ID.
      const mediaUrl = `https://api.whatsapp.com/media/${incoming.mediaId}`;
      const currentDocs = Array.isArray(customer.documents) ? customer.documents : [];
      await customer.update({ documents: [...currentDocs, mediaUrl] });
    } catch (mediaErr) {
      console.warn('[Webhook] Failed to process incoming media for customer:', mediaErr.message);
    }
  }

  // Process through bot with full fallback protection
  try {
    // Free-text that matches no flow/campaign is silently dropped (no reply).
    // Skip the read receipt / typing indicator for those so the message stays
    // UNREAD in the WhatsApp Business App and a human can pick it up. Meta's
    // typing call also marks the message read, so there is no way to keep it
    // unread while still showing typing.
    const willDrop = await willDropSilently(
      session,
      incoming,
      customer,
      agency,
      { isFirstInboundMessage }
    );
    if (!willDrop) {
      await whatsappService.sendTypingIndicator(
        customer.phone,
        waMessageId,
        { customerId: customer.id, agencyId: agency.id }
      );
      await whatsappService.sendProcessingPlaceholder(
        customer.phone,
        { customerId: customer.id, agencyId: agency.id }
      );
      await whatsappService.waitForReplyPacing({ customerId: customer.id, agencyId: agency.id });
    }
    await routeMessage(session, incoming, customer, agency, { isFirstInboundMessage });
  } catch (err) {
    console.error('[Webhook] Bot processing error:', err.message);
    console.error('[Webhook] Error at:', err.stack?.split('\n')[1] || 'Unknown');
    if (err.original) {
      console.error('[Webhook] Original DB error:', err.original.message);
    }

    // FALLBACK: Always respond to the customer — never leave them hanging
    try {
      await whatsappService.sendFallbackMessage(
        customer.phone,
        agency.phone,
        { customerId: customer.id, agencyId: agency.id }
      );
    } catch (fallbackErr) {
      console.error('[Webhook] Even fallback message failed:', fallbackErr.message);
    }
  }
}

function normalizeInstagramText(value = '') {
  return String(value || '').trim();
}

function lowerInstagramText(value = '') {
  return normalizeInstagramText(value).toLowerCase();
}

function buildInstagramCustomerIdentifier(managedAccountId, senderId) {
  const simple = `ig_${String(senderId || '').trim()}`;
  if (simple.length > 3 && simple.length <= 20) return simple;

  const digest = crypto
    .createHash('sha1')
    .update(`${managedAccountId || 'unknown'}:${senderId || 'unknown'}`)
    .digest('hex')
    .slice(0, 17);
  return `ig_${digest}`;
}

function slugifyAgencyName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveAgencyFromInstagramTenant(tenantId = '') {
  const key = String(tenantId || '').trim();
  if (!key) return null;

  const exact = await Agency.findOne({
    where: { marketingOsTenantId: key },
  });
  if (exact) return exact;

  const agencies = await Agency.findAll({
    where: {
      isActive: true,
      marketingOsTenantId: { [Op.ne]: null },
    },
  });

  const matches = agencies
    .map((agency) => ({ agency, slug: slugifyAgencyName(agency.name) }))
    .filter(({ slug }) => slug && (key === slug || key.startsWith(`${slug}-`)))
    .sort((a, b) => b.slug.length - a.slug.length);

  if (matches.length > 0) {
    const resolved = matches[0].agency;
    console.log('[IG Webhook] Resolved tenant slug to agency:', {
      tenantId: key,
      agencyId: resolved.id,
      agencyName: resolved.name,
      marketingOsTenantId: resolved.marketingOsTenantId,
    });
    return resolved;
  }

  return null;
}

function parseInstagramBudget(value = '') {
  const normalized = lowerInstagramText(value).replace(/(?:\u20b9|rs\.?|inr|,|\s)/gi, '');
  if (normalized.includes('under20') || normalized.includes('<20') || normalized.includes('below20')) return 2000000;
  if (normalized.includes('20') && normalized.includes('50')) return 5000000;
  if (normalized.includes('50') && normalized.includes('100')) return 10000000;
  const amount = parseInt(normalized.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount < 100000 ? amount * 100 : amount;
}

function parseInstagramTravellers(value = '') {
  const match = normalizeInstagramText(value).match(/\d+/);
  if (!match) return null;
  const count = parseInt(match[0], 10);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function parseInstagramPhone(value = '') {
  const raw = normalizeInstagramText(value);
  const match = raw.match(/(\+?\d[\d\s().-]{7,}\d)/);
  if (!match) return null;
  const digits = match[1].replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

function instagramButton(label, payload) {
  return { label, title: label, payload };
}

function cleanInstagramIds(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeWhatsAppDeepLinkNumber(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function buildWhatsAppPackageDetailsUrl(agency, pkg) {
  const phone = normalizeWhatsAppDeepLinkNumber(
    agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || agency.phone
  );
  const message = `VIEW_PACKAGE ${pkg.id}`;
  const fallbackUrl = `https://travelbot.wayon.in/packages/${pkg.id}`;
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : fallbackUrl;
}

async function sendInstagramDm(agency, payload) {
  const partnerService = require(path.resolve(__dirname, '../../backend/src/services/marketingOsPartnerService.ts'));
  const tenantToken = await partnerService.getTenantToken(agency.marketingOsTenantId);
  const tenantHeaderId = agency.instagramTenantHeaderId || agency.marketingOsTenantId;
  return partnerService.sendTenantInstagramMessage(tenantToken, {
    tenantId: tenantHeaderId,
    ...payload,
  });
}

async function sendInstagramWelcome({ agency, accountId, senderId, session }) {
  await updateSession(session, {
    currentStep: 'IG_PACKAGE_INTENT',
    collectedData: {
      ...(session.collectedData || {}),
      igFlow: true,
    },
  });

  return sendInstagramDm(agency, {
    accountId,
    recipientId: senderId,
    text: 'Hi! What are you looking for?',
    buttons: [
      instagramButton('Show packages', 'ig_pkg_intent:holiday'),
      instagramButton('Show properties', 'ig_property_intent:show'),
      instagramButton('Custom trip', 'ig_pkg_intent:custom'),
    ],
  });
}

function inferInstagramPackageIntent(text = '', actionId = '') {
  const value = lowerInstagramText(actionId || text);
  if (value.includes('honeymoon')) return 'HONEYMOON';
  if (value.includes('group')) return 'GROUP';
  if (value.includes('budget')) return 'BUDGET';
  if (value.includes('custom')) return 'CUSTOM';
  return 'HOLIDAY';
}

function isInstagramCustomTripIntent(text = '', actionId = '') {
  const value = lowerInstagramText(actionId || text);
  return value === 'ig_pkg_intent:custom'
    || value === 'ig_custom_trip'
    || value === 'custom'
    || value === 'custom trip'
    || value === 'plan custom trip'
    || value === 'plan trip';
}

function extractInstagramSelectedPackageIds(data = {}, text = '', actionId = '') {
  const offeredIds = new Set(
    (Array.isArray(data.packageResults) ? data.packageResults : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  );
  const explicitIds = [];
  const push = (id) => {
    const normalized = String(id || '').trim();
    if (!normalized) return;
    if (offeredIds.size > 0 && !offeredIds.has(normalized)) return;
    if (!explicitIds.includes(normalized)) explicitIds.push(normalized);
  };

  if (Array.isArray(data.selectedPackageIds)) data.selectedPackageIds.forEach(push);
  push(data.selectedPackageId);

  [actionId, text].forEach((value) => {
    const raw = String(value || '').trim();
    const uuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    if (uuid) {
      push(uuid);
    } else if (offeredIds.has(raw)) {
      push(raw);
    }
  });

  return explicitIds;
}

async function sendInstagramPackages({ agency, accountId, senderId, session, intent }) {
  const automationPackageIds = cleanInstagramIds(session.collectedData?.instagramAutomation?.linkedPackageIds);
  const where = { agencyId: agency.id, isActive: true };
  if (automationPackageIds.length) where.id = { [Op.in]: automationPackageIds };

  let packages = await Package.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: 6,
  });

  if (!packages.length && automationPackageIds.length) {
    packages = await Package.findAll({
      where: { agencyId: agency.id, isActive: true },
      order: [['updatedAt', 'DESC']],
      limit: 6,
    });
  }

  if (!packages.length) {
    await sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'I could not find active packages right now. Please share your destination and phone number, and our team will help.',
    });
    await updateSession(session, { currentStep: 'IG_CAPTURE_NAME' });
    return;
  }

  await updateSession(session, {
    currentStep: 'IG_QUALIFY_BUDGET',
    collectedData: {
      ...(session.collectedData || {}),
      igIntent: intent,
      packageResults: packages.map((pkg) => pkg.id),
    },
  });

  await sendInstagramDm(agency, {
    accountId,
    recipientId: senderId,
    products: packages.map((pkg) => {
      const priceRupees = Math.round(Number(pkg.basePrice || 0) / 100);
      return {
        id: pkg.id,
        name: pkg.name,
        ...(priceRupees > 0 ? { price: priceRupees, currency: 'INR' } : {}),
        image: pkg.imageUrl || 'https://travelbot.wayon.in/favicon.ico',
        url: buildWhatsAppPackageDetailsUrl(agency, pkg),
        description: pkg.duration || (Array.isArray(pkg.destinations) ? pkg.destinations.slice(0, 2).join(', ') : ''),
      };
    }),
    ctaLabel: 'View Details',
  });

  return sendInstagramDm(agency, {
    accountId,
    recipientId: senderId,
    text: 'What budget per person should I use?',
    buttons: [
      instagramButton('Under Rs 20k', 'ig_budget:under20'),
      instagramButton('Rs 20k-Rs 50k', 'ig_budget:20_50'),
      instagramButton('Rs 50k+', 'ig_budget:50_plus'),
    ],
  });
}

async function sendInstagramBrochureLinks({ agency, accountId, senderId, session }) {
  const automationPackageIds = cleanInstagramIds(session.collectedData?.instagramAutomation?.linkedPackageIds);
  const where = { agencyId: agency.id, isActive: true };
  if (automationPackageIds.length) where.id = { [Op.in]: automationPackageIds };

  let packages = await Package.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: 4,
  });

  packages = packages.filter((pkg) => pkg.brochureUrl || pkg.id);
  if (!packages.length) {
    await updateSession(session, { currentStep: 'IG_CAPTURE_NAME' });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'I do not have a brochure link ready for this post. Please share your name and phone number, and our team will send the best options.',
      buttons: [
        instagramButton('Show packages', 'ig_pkg_intent:holiday'),
        instagramButton('Talk to agent', 'ig_agent_handoff'),
      ],
    });
  }

  const lines = packages.map((pkg, index) => {
    const url = pkg.brochureUrl || buildWhatsAppPackageDetailsUrl(agency, pkg);
    return `${index + 1}. ${pkg.name}: ${url}`;
  });

  await updateSession(session, {
    currentStep: 'IG_CAPTURE_NAME',
    collectedData: {
      ...(session.collectedData || {}),
      igIntent: 'BROCHURE_LINK',
      packageResults: packages.map((pkg) => pkg.id),
      selectedPackageIds: packages.map((pkg) => pkg.id),
      igLead: {
        ...(session.collectedData?.igLead || {}),
        interest: 'BROCHURE_LINK',
      },
    },
  });

  return sendInstagramDm(agency, {
    accountId,
    recipientId: senderId,
    text: `Here are the brochure links:\n\n${lines.join('\n')}\n\nPlease share your full name so our team can help with availability and pricing.`,
    buttons: [
      instagramButton('Talk to agent', 'ig_agent_handoff'),
      instagramButton('Show packages', 'ig_pkg_intent:holiday'),
    ],
  });
}

async function sendInstagramProperties({ agency, accountId, senderId, session }) {
  const automationPropertyIds = cleanInstagramIds(session.collectedData?.instagramAutomation?.linkedPropertyIds);
  const where = { agencyId: agency.id, isActive: true };
  if (automationPropertyIds.length) where.id = { [Op.in]: automationPropertyIds };

  let properties = await Property.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: 4,
  });

  if (!properties.length && automationPropertyIds.length) {
    properties = await Property.findAll({
      where: { agencyId: agency.id, isActive: true },
      order: [['updatedAt', 'DESC']],
      limit: 4,
    });
  }

  const propertyLines = properties.map((property, index) => {
    const location = property.location ? ` - ${property.location}` : '';
    return `${index + 1}. ${property.name}${location}`;
  });

  await updateSession(session, {
    currentStep: 'IG_CAPTURE_NAME',
    collectedData: {
      ...(session.collectedData || {}),
      igIntent: 'PROPERTY',
      selectedPropertyIds: properties.map((property) => property.id),
      igLead: {
        ...(session.collectedData?.igLead || {}),
        interest: 'PROPERTY',
      },
    },
  });

  return sendInstagramDm(agency, {
    accountId,
    recipientId: senderId,
    text: propertyLines.length
      ? `I found these stays for you:\n\n${propertyLines.join('\n')}\n\nPlease share your full name, phone number, and preferred dates.`
      : 'Sure. Please share your name, phone number, and preferred location. Our team will send matching properties.',
    buttons: [
      instagramButton('Show packages', 'ig_pkg_intent:holiday'),
      instagramButton('Talk to agent', 'ig_agent_handoff'),
    ],
  });
}

async function saveInstagramLead({ agency, customer, session, accountId, senderId }) {
  const data = session.collectedData || {};
  const draft = data.igLead || {};
  const packageIds = extractInstagramSelectedPackageIds(data);
  const primaryPackageId = packageIds[0] || null;
  const propertyIds = cleanInstagramIds(data.selectedPropertyIds);
  const primaryPropertyId = propertyIds[0] || null;
  const isCustomTrip = String(data.igIntent || draft.interest || '').toUpperCase() === 'CUSTOM_TRIP';
  const isProperty = String(data.igIntent || draft.interest || '').toUpperCase() === 'PROPERTY';
  const interest = data.igIntent || draft.interest || (primaryPropertyId ? 'PROPERTY' : primaryPackageId ? 'PACKAGES' : 'CUSTOM_TRIP');
  const itemType = isProperty || primaryPropertyId ? 'PROPERTY' : primaryPackageId ? 'PACKAGE' : 'CUSTOM_TRIP';
  const selectedItems = [
    ...packageIds.map((id) => ({ itemType: 'PACKAGE', itemId: id })),
    ...propertyIds.map((id) => ({ itemType: 'PROPERTY', itemId: id })),
  ];

  if (draft.name && draft.name !== customer.name) {
    await customer.update({ name: draft.name, source: 'instagram' });
  } else if (customer.source !== 'instagram') {
    await customer.update({ source: 'instagram' });
  }

  const notes = [
    isCustomTrip ? 'Instagram custom trip enquiry' : isProperty ? 'Instagram property enquiry' : 'Instagram package enquiry',
    draft.phone ? `Phone: ${draft.phone}` : null,
    draft.budgetText ? `Budget: ${draft.budgetText}` : null,
    draft.travelDates ? `Dates: ${draft.travelDates}` : null,
    draft.travellers ? `Travellers: ${draft.travellers}` : null,
    interest ? `Intent: ${interest}` : null,
  ].filter(Boolean).join('\n');

  let lead = await Lead.findOne({
    where: {
      customerId: customer.id,
      agencyId: agency.id,
      status: ACTIVE_LEAD_STATUSES,
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!lead) {
    lead = await Lead.create({
      customerId: customer.id,
      agencyId: agency.id,
      status: 'ENQUIRY',
      source: 'instagram_dm',
      packageId: itemType === 'PACKAGE' ? primaryPackageId : null,
      propertyId: itemType === 'PROPERTY' ? primaryPropertyId : null,
      itemType,
      interest,
      travelDates: draft.travelDates || null,
      travellers: draft.travellers || null,
      budgetPerPerson: draft.budgetPerPerson || null,
      notes,
      customTripDetails: {
        name: draft.name || customer.name || '',
        phone: draft.phone || '',
        budgetText: draft.budgetText || '',
        budgetPerPerson: draft.budgetPerPerson || null,
        travelDates: draft.travelDates || '',
        travellers: draft.travellers || null,
        interest,
        instagramSenderId: senderId,
        instagramAccountId: accountId,
      },
      selectedItems,
    });
  }

  if (lead) {
    await lead.update({
      status: 'ENQUIRY',
      source: 'instagram_dm',
      packageId: lead.packageId || (itemType === 'PACKAGE' ? primaryPackageId : null),
      propertyId: lead.propertyId || (itemType === 'PROPERTY' ? primaryPropertyId : null),
      itemType: lead.itemType || itemType,
      interest: interest || lead.interest,
      travelDates: draft.travelDates || lead.travelDates,
      travellers: draft.travellers || lead.travellers,
      budgetPerPerson: draft.budgetPerPerson || lead.budgetPerPerson,
      notes,
      customTripDetails: {
        ...(lead.customTripDetails || {}),
        name: draft.name || customer.name || '',
        phone: draft.phone || '',
        budgetText: draft.budgetText || '',
        budgetPerPerson: draft.budgetPerPerson || null,
        travelDates: draft.travelDates || '',
        travellers: draft.travellers || null,
        interest,
        instagramSenderId: senderId,
        instagramAccountId: accountId,
      },
      selectedItems,
    });
  }

  return lead;
}

async function handleInstagramPackageFlow({ agency, accountId, senderId, text, actionId, session, customer }) {
  const normalized = lowerInstagramText(text);
  const payload = lowerInstagramText(actionId);
  const step = session.currentStep;
  const data = session.collectedData || {};

  const selectedPackageIds = extractInstagramSelectedPackageIds(data, text, actionId);
  if (selectedPackageIds.length > 0) {
    await updateSession(session, {
      currentStep: 'IG_QUALIFY_BUDGET',
      collectedData: {
        ...data,
        selectedPackageId: selectedPackageIds[0],
        selectedPackageIds,
        igIntent: data.igIntent || 'PACKAGES',
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Great choice. What budget per person should I use?',
      buttons: [
        instagramButton('Under Rs 20k', 'ig_budget:under20'),
        instagramButton('Rs 20k-Rs 50k', 'ig_budget:20_50'),
        instagramButton('Rs 50k+', 'ig_budget:50_plus'),
      ],
    });
  }

  if (isInstagramCustomTripIntent(text, actionId)) {
    await updateSession(session, {
      currentStep: 'IG_QUALIFY_BUDGET',
      collectedData: {
        ...data,
        igIntent: 'CUSTOM_TRIP',
        packageResults: [],
        selectedPackageId: null,
        selectedPackageIds: [],
        igLead: {
          ...(data.igLead || {}),
          interest: 'CUSTOM_TRIP',
        },
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Sure. I will collect your custom trip details. What budget per person should I use?',
      buttons: [
        instagramButton('Under Rs 20k', 'ig_budget:under20'),
        instagramButton('Rs 20k-Rs 50k', 'ig_budget:20_50'),
        instagramButton('Rs 50k+', 'ig_budget:50_plus'),
      ],
    });
  }

  if (payload === 'ig_brochure_link' || normalized.includes('brochure')) {
    return sendInstagramBrochureLinks({ agency, accountId, senderId, session });
  }

  if (
    payload.startsWith('ig_pkg_intent:')
    || normalized.includes('package')
    || normalized.includes('honeymoon')
    || normalized.includes('holiday')
    || normalized.includes('trip')
  ) {
    return sendInstagramPackages({
      agency,
      accountId,
      senderId,
      session,
      intent: inferInstagramPackageIntent(text, actionId),
    });
  }

  if (payload.startsWith('ig_property_intent:') || normalized.includes('property')) {
    return sendInstagramProperties({ agency, accountId, senderId, session });
  }

  if (payload === 'ig_agent_handoff' || normalized.includes('agent')) {
    await updateSession(session, { currentStep: 'IG_CAPTURE_PHONE' });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Please share your phone number. Our team will call you shortly.',
    });
  }

  if (step === 'IG_QUALIFY_BUDGET' || payload.startsWith('ig_budget:')) {
    const budgetPerPerson = parseInstagramBudget(actionId || text);
    await updateSession(session, {
      currentStep: 'IG_QUALIFY_DATES',
      collectedData: {
        ...(session.collectedData || {}),
        igLead: {
          ...(session.collectedData?.igLead || {}),
          budgetText: text || actionId,
          budgetPerPerson,
        },
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Great. What travel date or month are you planning?',
    });
  }

  if (step === 'IG_QUALIFY_DATES') {
    await updateSession(session, {
      currentStep: 'IG_QUALIFY_TRAVELLERS',
      collectedData: {
        ...(session.collectedData || {}),
        igLead: {
          ...(session.collectedData?.igLead || {}),
          travelDates: text,
        },
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'How many travellers?',
    });
  }

  if (step === 'IG_QUALIFY_TRAVELLERS') {
    await updateSession(session, {
      currentStep: 'IG_CAPTURE_NAME',
      collectedData: {
        ...(session.collectedData || {}),
        igLead: {
          ...(session.collectedData?.igLead || {}),
          travellers: parseInstagramTravellers(text),
        },
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Please share your full name.',
    });
  }

  if (step === 'IG_CAPTURE_NAME') {
    await updateSession(session, {
      currentStep: 'IG_CAPTURE_PHONE',
      collectedData: {
        ...(session.collectedData || {}),
        igLead: {
          ...(session.collectedData?.igLead || {}),
          name: text,
        },
      },
    });
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Please share your phone number so our travel expert can call you.',
    });
  }

  if (step === 'IG_CAPTURE_PHONE') {
    const phone = parseInstagramPhone(text) || text;
    const collectedData = {
      ...(session.collectedData || {}),
      igLead: {
        ...(session.collectedData?.igLead || {}),
        phone,
      },
    };
    await updateSession(session, {
      currentStep: 'IG_COMPLETE',
      collectedData,
    });
    session.collectedData = collectedData;
    const lead = await saveInstagramLead({ agency, customer, session, accountId, senderId });
    try {
      const instagramAutomationService = require(path.resolve(__dirname, '../../backend/src/services/instagramAutomationService.ts'));
      await instagramAutomationService.markLeadCreatedFromDm(agency.id, { accountId, senderId }, lead);
    } catch (err) {
      console.warn('[IG Webhook] Could not update automation lead stats:', err.message);
    }
    return sendInstagramDm(agency, {
      accountId,
      recipientId: senderId,
      text: 'Thanks. Your package enquiry is saved. Our team will call you soon with the best options.',
      buttons: [
        instagramButton('Show packages', 'ig_pkg_intent:holiday'),
        instagramButton('Talk to agent', 'ig_agent_handoff'),
      ],
    });
  }

  if (step === 'IG_PACKAGE_INTENT' || step === 'IG_COMPLETE') {
    return sendInstagramWelcome({ agency, accountId, senderId, session });
  }

  return null;
}

async function processInstagramMessage(data) {
  const { accountId, igAccountId, senderId, recipientId, messageId, text, attachments, timestamp, tenantId } = data;
  
  // Find agency by Instagram account ID or tenant ID
  const agency = await resolveAgencyFromInstagramTenant(tenantId);

  if (!agency) {
    console.error(`[IG Webhook] No agency found for tenant ID: ${tenantId}`);
    return;
  }
  agency.instagramTenantHeaderId = tenantId || agency.marketingOsTenantId;

  // Some agencies are handled entirely by a Marketing OS Instagram away/auto-reply and do NOT want
  // the travel-bot's package/welcome responder ("travel expert") replying on IG. When
  // instagramFlowConfig.autoReplyDisabled is set, the bot stays completely silent on Instagram so
  // only the Marketing OS automation responds. No typing indicator, no reply.
  if (agency.instagramFlowConfig && agency.instagramFlowConfig.autoReplyDisabled) {
    console.log(`[IG Webhook] Auto-reply disabled for agency ${agency.id} (${agency.name}); skipping travel-bot IG handling.`);
    return;
  }

  try {
    const instagramAutomationService = require(path.resolve(__dirname, '../../backend/src/services/instagramAutomationService.ts'));
    await instagramAutomationService.markDmReplyReceived(agency.id, {
      accountId: accountId || igAccountId || recipientId,
      senderId,
      messageId,
      text,
    });
  } catch (err) {
    console.warn('[IG Webhook] Could not update automation DM conversion:', err.message);
  }

  // Keep the customer key compact because older databases sized this column for phone numbers.
  const managedAccountId = igAccountId || accountId || recipientId || 'unknown';
  const fromIdentifier = buildInstagramCustomerIdentifier(managedAccountId, senderId);
  
  // Create an incoming format similar to WhatsApp. A tapped quick-reply chip arrives as a
  // payload (dispatched by Marketing OS as actionId/quickReplyPayload) — surface it as the
  // actionId so the flow engine routes it exactly like a WhatsApp reply button.
  const incoming = {
    text: text || '',
    actionId: data.postbackPayload || data.actionId || data.quickReplyPayload || '',
    type: attachments && attachments.length > 0 ? 'MEDIA' : 'TEXT',
    mediaId: attachments && attachments.length > 0 ? attachments[0].id : null,
  };

  // Load or create session + customer
  const { session, customer } = await loadOrCreateSession(fromIdentifier, agency.id);

  // Was this the customer's first inbound message? (matches the WhatsApp routing contract)
  const priorInboundCount = await Message.count({
    where: { customerId: customer.id, agencyId: agency.id, direction: 'IN' },
  });
  const isFirstInboundMessage = priorInboundCount === 0;

  // Fire a native Instagram seen-receipt + typing bubble immediately (fire-and-forget) so the
  // chat feels responsive while the bot composes its reply. Never block or fail the message on it.
  (async () => {
    try {
      const partnerService = require(path.resolve(__dirname, '../../backend/src/services/marketingOsPartnerService.ts'));
      const tenantToken = await partnerService.getTenantToken(agency.marketingOsTenantId);
      const igActionBase = {
        tenantId: agency.instagramTenantHeaderId || agency.marketingOsTenantId,
        accountId: accountId || igAccountId,
        recipientId: senderId,
      };
      await partnerService.sendTenantInstagramSenderAction(tenantToken, { ...igActionBase, senderAction: 'mark_seen' });
      await partnerService.sendTenantInstagramSenderAction(tenantToken, { ...igActionBase, senderAction: 'typing_on' });
    } catch (err) {
      console.warn('[IG Webhook] typing indicator failed:', err.message);
    }
  })();

  // We don't have the user's name immediately from Instagram message payload in Meta's basic webhook, 
  // but if we do, we could update it. We leave it generic or update if Marketing OS sent a profile name.

  await ensureLead(session, customer, agency, {
    status: null,
    notes: 'First Instagram DM received',
    preserveExistingStatus: true,
  });

  try {
    await schedulerService.cancelChatFollowUps(customer.id, agency.id);
  } catch (err) {
    console.warn('[IG Webhook] Could not cancel pending follow-ups:', err.message);
  }

  // Save incoming message to DB
  await Message.create({
    customerId: customer.id,
    agencyId: agency.id,
    direction: 'IN',
    content: incoming.text || (incoming.mediaId ? `[Media Received: ${incoming.mediaId}]` : ''),
    type: incoming.type,
    waMessageId: messageId, // Reusing waMessageId field for Instagram message ID
    status: 'DELIVERED',
    timestamp: timestamp ? new Date(Number(timestamp) > 1000000000000 ? Number(timestamp) : Number(timestamp) * 1000) : new Date(),
  });

  // Process through bot with fallback protection
  try {
    customer.source = 'instagram';
    await customer.save();

    // When the agency has built a dedicated Instagram flow, drive the conversation through
    // the same unified engine as WhatsApp so the visual flow builder runs natively over IG
    // DMs (quick-reply chips, lists, catalog, enquiries). Agencies without an Instagram flow
    // keep the legacy package/welcome behaviour below.
    if (hasInstagramFlowGraph(agency)) {
      await routeMessage(session, incoming, customer, agency, { isFirstInboundMessage });
      return;
    }

    const handled = await handleInstagramPackageFlow({
      agency,
      accountId: accountId || igAccountId || recipientId,
      senderId,
      text: incoming.text,
      actionId: incoming.actionId,
      session,
      customer,
    });

    if (handled) return;

    if (['hi', 'hello', 'hey', 'hii', 'start', 'menu'].includes(lowerInstagramText(incoming.text))) {
      await sendInstagramWelcome({
        agency,
        accountId: accountId || igAccountId || recipientId,
        senderId,
        session,
      });
      return;
    }

    await sendInstagramDm(agency, {
      accountId: accountId || igAccountId || recipientId,
      recipientId: senderId,
      text: 'I can help with holiday packages. Tap below to continue.',
      buttons: [
        instagramButton('Show packages', 'ig_pkg_intent:holiday'),
        instagramButton('Show properties', 'ig_property_intent:show'),
        instagramButton('Custom trip', 'ig_pkg_intent:custom'),
      ],
    });
  } catch (err) {
    console.error('[IG Webhook] Bot processing error:', err.message);
    
    // FALLBACK
    try {
      // Send fallback using marketingOsPartnerService directly
      const partnerService = require(path.resolve(__dirname, '../../backend/src/services/marketingOsPartnerService.ts'));
      const tenantToken = await partnerService.getTenantToken(agency.marketingOsTenantId);
      
      await partnerService.sendTenantInstagramMessage(tenantToken, {
        tenantId: agency.instagramTenantHeaderId || agency.marketingOsTenantId,
        accountId: accountId || igAccountId,
        recipientId: senderId,
        text: `Sorry, we are currently experiencing issues. Please contact us via phone or email.`
      });
    } catch (fallbackErr) {
      console.error('[IG Webhook] Even fallback message failed:', fallbackErr.message);
    }
  }
}

async function processInstagramComment(data) {
  const { tenantId } = data;
  const agency = await resolveAgencyFromInstagramTenant(tenantId);

  if (!agency) {
    console.error(`[IG Webhook] No agency found for comment tenant ID: ${tenantId}`);
    return;
  }

  const instagramAutomationService = require(path.resolve(__dirname, '../../backend/src/services/instagramAutomationService.ts'));
  await instagramAutomationService.processCommentEvent(agency.id, data);
}

function extractIncoming(msg) {
  if (msg.type === 'order' || msg.order) {
    return {
      text: msg.order?.text || 'Submitted a cart order',
      actionId: 'order_submitted',
      type: 'ORDER',
      order: msg.order,
    };
  }

  const interactive = msg.interactive || {};
  const typedInteractive = interactive.type && interactive[interactive.type]
    ? interactive[interactive.type]
    : null;

  if (interactive.button_reply || (interactive.type === 'button_reply' && typedInteractive)) {
    const reply = interactive.button_reply || typedInteractive;
    return {
      text: reply.title || reply.text || reply.body || '',
      actionId: reply.id || reply.payload || '',
      type: 'BUTTON_REPLY',
    };
  }

  if (interactive.list_reply || (interactive.type === 'list_reply' && typedInteractive)) {
    const reply = interactive.list_reply || typedInteractive;
    return {
      text: reply.title || reply.text || reply.body || '',
      actionId: reply.id || reply.payload || '',
      type: 'LIST_REPLY',
    };
  }

  if (interactive.nfm_reply) {
    return {
      text: interactive.nfm_reply.body || msg.text?.body || '',
      actionId: 'flow_submission',
      type: 'FLOW_REPLY',
      flowResponse: interactive.nfm_reply.response_json || {},
      flowName: interactive.nfm_reply.name || '',
    };
  }

  if (msg.button) {
    return {
      text: msg.button.text || '',
      actionId: msg.button.payload || '',
      type: 'BUTTON',
    };
  }

  return {
    text: (typeof msg.text === 'string' ? msg.text : msg.text?.body)
      || msg.body
      || msg.message?.text?.body
      || msg.message?.body
      || msg.image?.caption
      || msg.document?.caption
      || '',
    actionId: msg.payload || msg.button?.payload || '',
    type: msg.type?.toUpperCase() || 'TEXT',
    mediaId: msg.image?.id || msg.document?.id || msg.audio?.id || null,
  };
}

function normalizeInboundType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'image') return 'IMAGE';
  if (normalized === 'document') return 'DOCUMENT';
  if (normalized === 'audio') return 'AUDIO';
  return 'TEXT';
}

module.exports = { handleVerification, handleIncoming };
