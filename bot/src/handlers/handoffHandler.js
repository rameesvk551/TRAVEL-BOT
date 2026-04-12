// FILE: /bot/src/handlers/handoffHandler.js
// DEPS: none (uses shared models)

const path = require('path');
const { Agent, Message, BotSession } = require(path.resolve(__dirname, '../../../backend/src/models'));
const { Op } = require('sequelize');
const { updateSession } = require('../utils/sessionManager');
const templates = require('../utils/messageTemplates');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService'));

// Keywords that trigger handoff
const HANDOFF_KEYWORDS = [
  'agent', 'human', 'staff', 'help', 'call me', 'call', 'urgent',
  'talk to someone', 'real person', 'manager', 'complaint', 'speak',
];

const FRUSTRATION_KEYWORDS = [
  'not working', 'useless', 'this is bad', 'angry', 'frustrated',
  'waste', 'terrible', 'worst', 'stupid', 'pathetic',
];

/**
 * Checks if a message should trigger a handoff to a human agent.
 * @param {string} messageText - The incoming message
 * @param {object} session - BotSession instance
 * @returns {{ shouldHandoff: boolean, reason: string }}
 */
function shouldHandoff(messageText, session) {
  const lower = String(messageText || '').toLowerCase().trim();

  // Check handoff keywords
  for (const keyword of HANDOFF_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { shouldHandoff: true, reason: `Keyword detected: "${keyword}"` };
    }
  }

  // Check frustration keywords
  for (const keyword of FRUSTRATION_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { shouldHandoff: true, reason: `Frustration detected: "${keyword}"` };
    }
  }

  // Check failed attempts (3+ unmatched inputs)
  if (session.failedAttempts >= 3) {
    return { shouldHandoff: true, reason: 'Multiple unmatched inputs (3+)' };
  }

  return { shouldHandoff: false, reason: '' };
}

/**
 * Hands off the conversation to a human agent.
 * @param {object} session - BotSession instance
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 * @param {string} reason - Why the handoff was triggered
 */
async function handoffToAgent(session, customer, agency, reason) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const lang = customer.language || 'EN';

  // Find least-busy online agent
  const agents = await Agent.findAll({
    where: { agencyId: agency.id, isOnline: true },
    attributes: ['id', 'name', 'phone'],
  });

  let assignedAgent = null;

  if (agents.length > 0) {
    // Count active handoffs per agent
    const agentLoads = await Promise.all(
      agents.map(async (agent) => {
        const count = await BotSession.count({
          where: {
            agencyId: agency.id,
            handedOffToId: agent.id,
            isHandedOff: true,
          },
        });
        return { agent, count };
      })
    );
    agentLoads.sort((a, b) => a.count - b.count);
    assignedAgent = agentLoads[0].agent;
  }

  // Update session
  await updateSession(session, {
    isHandedOff: true,
    handedOffAt: new Date(),
    handedOffToId: assignedAgent?.id || null,
    currentStep: 'HANDOFF',
  });

  if (!assignedAgent) {
    // No agent available
    const response = templates.noAgentAvailable(agency.phone, lang);
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    return;
  }

  // Notify customer
  const data = session.collectedData || {};
  const summaryParts = [];
  if (data.destination) summaryParts.push(`Destination: ${data.destination}`);
  if (data.budgetLabel || data.budget) summaryParts.push(`Budget: ${data.budgetLabel || data.budget}`);
  if (data.travelType) summaryParts.push(`Travel Type: ${data.travelType}`);
  if (data.datesLabel || data.dates) summaryParts.push(`Dates: ${data.datesLabel || data.dates}`);
  const summary = summaryParts.length ? ` I’ve shared your choices (${summaryParts.join(', ')}) so you won’t need to repeat anything.` : ' I’ve shared your choices so you won’t need to repeat anything.';
  const customerMsg = templates.handoffToCustomer(assignedAgent.name, lang).replace(/\.$/, '') + summary;
  await whatsappService.sendTextMessage(customer.phone, customerMsg, ctx);

  // Get last 3 messages for context
  const lastMessages = await Message.findAll({
    where: { customerId: customer.id, agencyId: agency.id, direction: 'IN' },
    order: [['timestamp', 'DESC']],
    limit: 3,
  });

  const msgPreview = lastMessages
    .reverse()
    .map((m) => `> ${m.content.substring(0, 100)}`)
    .join('\n');

  // Notify agent via WhatsApp
  const agentMsg = templates.agentHandoff(
    customer.name || 'Unknown',
    customer.phone,
    data.destination, data.datesLabel || data.dates, data.travellers, data.budgetLabel || data.budget,
    reason,
    msgPreview
  );

  if (assignedAgent.phone) {
    await whatsappService.sendTextMessage(assignedAgent.phone, agentMsg, ctx);
  }
}

/**
 * Forwards an incoming message to the assigned agent while in handoff mode.
 * @param {object} session - BotSession instance
 * @param {string} messageText - Incoming message
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 */
async function forwardToAgent(session, messageText, customer, agency) {
  // Message is already saved in the webhook handler.
  // Notify the assigned agent about the new message.
  if (session.handedOffToId) {
    const agent = await Agent.findByPk(session.handedOffToId);
    if (agent && agent.phone) {
      const notification = `💬 *${customer.name || customer.phone}*:\n${messageText.substring(0, 200)}`;
      await whatsappService.sendTextMessage(
        agent.phone,
        notification,
        { customerId: customer.id, agencyId: agency.id }
      );
    }
  }
}

/**
 * Resolves a handoff and returns control to the bot.
 * @param {string} sessionId - BotSession ID
 */
async function resolveHandoff(sessionId) {
  const session = await BotSession.findByPk(sessionId);
  if (!session) return;

  await updateSession(session, {
    isHandedOff: false,
    handedOffToId: null,
    currentStep: 'COMPLETE',
  });
}

module.exports = { shouldHandoff, handoffToAgent, forwardToAgent, resolveHandoff };
