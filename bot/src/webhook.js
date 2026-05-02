// FILE: /bot/src/webhook.js
// DEPS: express, crypto
// ENV: WEBHOOK_VERIFY_TOKEN, WEBHOOK_APP_SECRET

const crypto = require('crypto');
const path = require('path');
const { Agency, Agent, Customer, Message } = require(path.resolve(__dirname, '../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../backend/src/services/whatsappService.ts'));
const schedulerService = require(path.resolve(__dirname, '../../backend/src/services/schedulerService.ts'));
const { loadOrCreateSession } = require('./utils/sessionManager');
const { routeMessage } = require('./botRouter');
const { handleAgentLeadAction } = require('./handlers/agentLeadHandler');
const { ensureLead } = require('./handlers/travelFlowHandler');
const { normalizePhone } = require(path.resolve(__dirname, '../../backend/src/utils/phoneUtils.ts'));

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
            await whatsappService.updateMessageStatus(status.id, status.status);
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

          await processMessage(msg, metadata).catch((err) => {
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
    const agency = await Agency.findOne({ where });
    if (agency) return agency;
  }

  return null;
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
    },
  });

  const nextValues = {};
  if (updates.name && updates.name !== customer.name) nextValues.name = updates.name;
  if (updates.source && updates.source !== customer.source) nextValues.source = updates.source;
  if (updates.notes && updates.notes !== customer.notes) nextValues.notes = updates.notes;

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

async function saveCoexistenceMessage({ agency, customerPhone, msg, direction, status, source }) {
  if (!agency || !customerPhone || !msg?.id) return null;

  const existing = await Message.findOne({ where: { waMessageId: msg.id } });
  if (existing) return existing;

  const customer = await upsertCustomerContact(agency.id, customerPhone, { source });
  if (!customer) return null;

  return Message.create({
    customerId: customer.id,
    agencyId: agency.id,
    direction,
    content: extractMessageContent(msg) || '',
    type: normalizeStoredMessageType(msg.type),
    waMessageId: msg.id,
    status: status || 'SENT',
    timestamp: msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date(),
  });
}

async function processAccountUpdate(value = {}, entry = {}) {
  const agency = await resolveAgencyFromMetadata({ phone_number: value.phone_number }, entry);
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
}

async function processStateSync(value = {}, metadata = {}) {
  const agency = await resolveAgencyFromMetadata(metadata);
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
    });
  }

  await agency.update({
    whatsappOnboardingMode: 'COEXISTENCE',
    whatsappCoexistenceStatus: 'ACTIVE',
    whatsappContactSyncStatus: 'COMPLETE',
    whatsappCoexistenceLastSyncedAt: new Date(),
  });
}

async function processHistorySync(value = {}, metadata = {}) {
  const agency = await resolveAgencyFromMetadata(metadata);
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
}

async function processHistoryMediaMessage(msg = {}, metadata = {}) {
  const agency = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const fromPhone = normalizePhone(msg.from);
  const businessPhone = normalizePhone(metadata.display_phone_number);
  const direction = businessPhone && fromPhone === businessPhone ? 'OUT' : 'IN';
  const customerPhone = direction === 'OUT' ? msg.to : fromPhone;

  await saveCoexistenceMessage({
    agency,
    customerPhone,
    msg,
    direction,
    status: 'DELIVERED',
    source: 'whatsapp_business_app_history',
  });
}

async function processMessageEchoes(value = {}, metadata = {}) {
  const agency = await resolveAgencyFromMetadata(metadata);
  if (!agency) return;

  const echoes = Array.isArray(value.message_echoes) ? value.message_echoes : [];
  for (const msg of echoes) {
    await saveCoexistenceMessage({
      agency,
      customerPhone: msg.to,
      msg,
      direction: 'OUT',
      status: 'SENT',
      source: 'whatsapp_business_app_echo',
    });
  }

  await agency.update({
    whatsappOnboardingMode: 'COEXISTENCE',
    whatsappCoexistenceStatus: 'ACTIVE',
    whatsappCoexistenceLastSyncedAt: new Date(),
  });
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

/**
 * Processes a single incoming WhatsApp message through the bot pipeline.
 * Includes fallback protection — customer always gets a response.
 * @param {object} msg - WhatsApp message object
 * @param {object} metadata - Webhook metadata (contains display_phone_number)
 */
async function processMessage(msg, metadata) {
  const fromPhone = normalizePhone(msg.from);
  const toPhone = normalizePhone(metadata.display_phone_number);
  const incoming = extractIncoming(msg);
  const messageText = incoming.text || '';
  const waMessageId = msg.id;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  // Find agency by WhatsApp number
  const agency = await Agency.findOne({
    where: { whatsappNumber: toPhone },
    // Keep attributes minimal to tolerate partial production schemas.
    attributes: [
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
      'marketingOsTenantId',
      'isActive',
    ],
  });

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
  const previousInboundCount = await Message.count({
    where: {
      customerId: customer.id,
      agencyId: agency.id,
      direction: 'IN',
    },
  });
  const isFirstInboundMessage = previousInboundCount === 0;

  const profileName = msg?.contacts?.[0]?.profile?.name || msg?.profile?.name || '';
  if (profileName && profileName !== customer.name) {
    await customer.update({ name: profileName });
  }

  await ensureLead(session, customer, agency, {
    status: 'JUST_CONTACTED',
    notes: 'First WhatsApp message received',
    preserveExistingStatus: true,
  });

  try {
    await schedulerService.cancelChatFollowUps(customer.id, agency.id);
  } catch (err) {
    console.warn('[Webhook] Could not cancel pending follow-ups:', err.message);
  }

  // Save incoming message to DB (BEFORE processing — never lose a message)
  await Message.create({
    customerId: customer.id,
    agencyId: agency.id,
    direction: 'IN',
    content: messageText || (incoming.mediaId ? `[Media Received: ${incoming.mediaId}]` : ''),
    type: normalizeInboundType(msg.type),
    waMessageId,
    status: 'DELIVERED',
    timestamp,
  });

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

async function processInstagramMessage(data) {
  const { accountId, igAccountId, senderId, recipientId, messageId, text, attachments, timestamp, tenantId } = data;
  
  // Find agency by Instagram account ID or tenant ID
  const agency = await Agency.findOne({
    where: { marketingOsTenantId: tenantId || '' },
  });

  if (!agency) {
    console.error(`[IG Webhook] No agency found for tenant ID: ${tenantId}`);
    return;
  }

  // Use account + sender as the unique identifier so the same person can DM multiple managed pages.
  const managedAccountId = igAccountId || accountId || recipientId || 'unknown';
  const fromIdentifier = `ig_${managedAccountId}:${senderId}`;
  
  // Create an incoming format similar to WhatsApp
  const incoming = {
    text: text || '',
    actionId: data.postbackPayload || data.actionId || '',
    type: attachments && attachments.length > 0 ? 'MEDIA' : 'TEXT',
    mediaId: attachments && attachments.length > 0 ? attachments[0].id : null,
  };

  // Load or create session + customer
  const { session, customer } = await loadOrCreateSession(fromIdentifier, agency.id);

  // We don't have the user's name immediately from Instagram message payload in Meta's basic webhook, 
  // but if we do, we could update it. We leave it generic or update if Marketing OS sent a profile name.

  await ensureLead(session, customer, agency, {
    status: 'JUST_CONTACTED',
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
    timestamp: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date(),
  });

  // Process through bot with fallback protection
  try {
    // For Instagram, we can simulate typing indicator via Marketing OS proxy if it's supported.
    // For now, directly route the message.
    
    // We add a flag to identify this as an Instagram channel to botRouter if it needs it.
    customer.source = 'instagram'; 
    await customer.save();

    await routeMessage(session, incoming, customer, agency);
  } catch (err) {
    console.error('[IG Webhook] Bot processing error:', err.message);
    
    // FALLBACK
    try {
      // Send fallback using marketingOsPartnerService directly
      const partnerService = require(path.resolve(__dirname, '../../backend/src/services/marketingOsPartnerService.ts'));
      const tenantToken = await partnerService.getTenantToken(agency.marketingOsTenantId);
      
      await partnerService.sendTenantInstagramMessage(tenantToken, {
        accountId: igAccountId,
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
  const agency = await Agency.findOne({
    where: { marketingOsTenantId: tenantId || '' },
  });

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

  if (interactive.button_reply) {
    return {
      text: interactive.button_reply.title || '',
      actionId: interactive.button_reply.id || '',
      type: 'BUTTON_REPLY',
    };
  }

  if (interactive.list_reply) {
    return {
      text: interactive.list_reply.title || '',
      actionId: interactive.list_reply.id || '',
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
    text: msg.text?.body || msg.image?.caption || msg.document?.caption || '',
    actionId: '',
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
