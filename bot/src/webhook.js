// FILE: /bot/src/webhook.js
// DEPS: express, crypto
// ENV: WEBHOOK_VERIFY_TOKEN, WEBHOOK_APP_SECRET

const crypto = require('crypto');
const path = require('path');
const { Agency, Agent, Message } = require(path.resolve(__dirname, '../../backend/src/models/index.ts'));
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

/**
 * POST /webhook — Processes incoming WhatsApp messages.
 * Always returns 200 immediately (Meta requirement), then processes async.
 */
async function handleIncoming(req, res) {
  // Always return 200 immediately — Meta requires this
  res.sendStatus(200);

  try {
    const body = req.body;

    // Verify signature if APP_SECRET is configured
    if (process.env.WEBHOOK_APP_SECRET && req.rawBody) {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(req.rawBody, signature)) {
        console.error('[Webhook] Invalid signature, rejecting');
        return;
      }
    }

    // Extract messages from webhook payload
    const entries = Array.isArray(body.entry) ? body.entry : [];
    if (!entries.length) {
      console.warn('[Webhook] No entry array found in incoming payload');
      return;
    }
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};

        // Handle message status updates (delivered, read)
        if (value.statuses) {
          for (const status of value.statuses) {
            await whatsappService.updateMessageStatus(status.id, status.status);
          }
        }

        // Handle incoming messages
        const messages = value.messages || [];
        const metadata = value.metadata || {};

        for (const msg of messages) {
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
    content: messageText,
    type: normalizeInboundType(msg.type),
    waMessageId,
    status: 'DELIVERED',
    timestamp,
  });

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
    await routeMessage(session, incoming, customer, agency);
  } catch (err) {
    console.error('[Webhook] Bot processing error:', err.message);

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
    text: msg.text?.body || '',
    actionId: '',
    type: msg.type?.toUpperCase() || 'TEXT',
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
