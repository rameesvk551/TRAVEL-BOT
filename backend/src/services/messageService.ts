// FILE: /backend/src/services/messageService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { sequelize, Message, Customer, Agent, BotSession, Lead } = require('../models');
const whatsappService = require('./whatsappService');

function toPlainRecord(record) {
  return typeof record?.get === 'function' ? record.get({ plain: true }) : record;
}

/**
 * Lists messages for a customer with pagination.
 * @param {string} customerId - Customer ID
 * @param {string} agencyId - Agency ID
 * @param {object} options - { limit, since }
 * @returns {Promise<object[]>} Messages
 */
async function listMessages(customerId, agencyId, options = {}) {
  const { limit = 50, since } = options;

  const where = { customerId, agencyId };

  if (since) {
    // Incremental poll: everything newer than `since`, oldest -> newest.
    where.timestamp = { [Op.gt]: new Date(since) };
    return Message.findAll({
      where,
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['timestamp', 'ASC']],
      limit: parseInt(limit),
    });
  }

  // Initial load: the most recent `limit` messages, returned oldest -> newest so
  // the chat renders in order and scrolls to the latest. The old ASC+limit
  // returned the OLDEST N, which hid recent messages (incl. media) in long
  // conversations.
  const rows = await Message.findAll({
    where,
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
    order: [['timestamp', 'DESC']],
    limit: parseInt(limit),
  });
  return rows.reverse();
}

/**
 * Gets the latest incoming messages for the live feed (dashboard).
 * @param {string} agencyId - Agency ID
 * @param {number} [limit=10] - Number of messages
 * @returns {Promise<object[]>} Latest incoming messages
 */
async function getLiveMessages(agencyId, limit = 10) {
  return Message.findAll({
    where: { agencyId, direction: 'IN' },
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
    ],
    order: [['timestamp', 'DESC']],
    limit,
  });
}

/**
 * Lists WhatsApp chat threads with the latest message per customer.
 * @param {string} agencyId - Agency ID
 * @param {object} options - { limit, q }
 * @returns {Promise<object[]>} Conversation summaries
 */
const INSTAGRAM_SOURCES = ['instagram', 'instagram_comment'];
const CLOSED_LEAD_STATUSES = ['BOOKED', 'CONVERTED', 'LOST', 'CANCELLED'];

function channelFilter(channel) {
  switch (channel) {
    case 'instagram':
      return {
        [Op.or]: [
          { source: { [Op.in]: INSTAGRAM_SOURCES } },
          { phone: { [Op.iLike]: 'ig\\_%' } },
        ],
      };
    case 'messenger':
      return { source: 'messenger' };
    case 'whatsapp':
      return {
        [Op.and]: [
          { phone: { [Op.notILike]: 'ig\\_%' } },
          {
            [Op.or]: [
              { source: { [Op.is]: null } },
              { source: { [Op.notIn]: [...INSTAGRAM_SOURCES, 'messenger'] } },
            ],
          },
        ],
      };
    default:
      return null;
  }
}

async function listThreads(agencyId, options = {}) {
  const { limit = 100, q, channelId, channel, requester } = options;
  const where = { agencyId };
  const andConditions = [];

  // Scope non-admin agents to conversations they own plus the shared unassigned
  // pool (chats with no owner yet). Admins see every conversation.
  if (requester && requester.id && requester.role !== 'ADMIN') {
    andConditions.push({
      [Op.or]: [
        { assignedAgentId: requester.id },
        { assignedAgentId: { [Op.is]: null } },
      ],
    });
  }

  if (channelId) {
    where.channelId = channelId;
  }

  const channelCondition = channelFilter(channel);
  if (channelCondition) {
    andConditions.push(channelCondition);
  }

  if (q) {
    andConditions.push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${q}%` } },
        { phone: { [Op.iLike]: `%${q}%` } },
      ],
    });
  }

  if (andConditions.length) {
    where[Op.and] = andConditions;
  }

  const customers = await Customer.findAll({
    where,
    include: [
      {
        model: Message,
        as: 'messages',
        separate: true,
        limit: 1,
        order: [['timestamp', 'DESC']],
        include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      },
      {
        model: BotSession,
        as: 'botSession',
        attributes: ['id', 'currentStep', 'isHandedOff', 'handedOffAt', 'lastActivityAt'],
        required: false,
      },
      {
        model: Agent,
        as: 'assignedAgent',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
    order: [['updatedAt', 'DESC']],
    limit: parseInt(limit, 10),
  });

  return customers
    .map((customerRecord) => {
      const customer = toPlainRecord(customerRecord);
      const [lastMessage] = customer.messages || [];
      const lastActivityAt = lastMessage?.timestamp || customer.botSession?.lastActivityAt || customer.updatedAt;

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          language: customer.language,
          source: customer.source,
        },
        session: customer.botSession || null,
        assignedAgent: customer.assignedAgent
          ? { id: customer.assignedAgent.id, name: customer.assignedAgent.name }
          : null,
        lastMessage: lastMessage || null,
        lastActivityAt,
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));
}

/**
 * Ensures a requester may access a conversation. Admins are unrestricted; a
 * non-admin agent may only touch their own conversations or ones in the shared
 * unassigned pool. Returns the customer record when allowed.
 * @param {string} customerId - Customer ID
 * @param {string} agencyId - Agency ID
 * @param {object} requester - { id, role } of the acting agent
 * @returns {Promise<object>} Customer record
 */
async function assertThreadAccess(customerId, agencyId, requester) {
  const customer = await Customer.findOne({
    where: { id: customerId, agencyId },
    attributes: ['id', 'assignedAgentId'],
  });
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  }
  if (!requester || requester.role === 'ADMIN') {
    return customer;
  }
  const owner = customer.assignedAgentId;
  if (owner && owner !== requester.id) {
    throw Object.assign(new Error('You are not assigned to this conversation'), {
      statusCode: 403,
      code: 'FORBIDDEN_THREAD',
    });
  }
  return customer;
}

/**
 * Claims a conversation for an agent only if it currently has no owner, so a
 * takeover of an unassigned chat pulls it out of the shared pool. No-op when the
 * conversation is already owned.
 * @param {string} customerId - Customer ID
 * @param {string} agencyId - Agency ID
 * @param {string} agentId - Agent claiming the conversation
 * @returns {Promise<boolean>} Whether the conversation was claimed
 */
async function claimThreadIfUnassigned(customerId, agencyId, agentId) {
  if (!agentId) return false;
  const [updated] = await Customer.update(
    { assignedAgentId: agentId },
    { where: { id: customerId, agencyId, assignedAgentId: { [Op.is]: null } } }
  );
  return updated > 0;
}

/**
 * Resolves inbound media for a message and returns a stream for the proxy to
 * pipe to the agent. Enforces conversation access so an agent can only fetch
 * media for a chat they may view.
 * @param {string} messageId - Message ID
 * @param {string} agencyId - Agency ID
 * @param {object} requester - Acting agent { id, role }
 * @returns {Promise<{ stream:any, contentType:string, filename:string|null, isDocument:boolean }>}
 */
async function getMessageMedia(messageId, agencyId, requester) {
  const message = await Message.findOne({
    where: { id: messageId, agencyId },
    attributes: ['id', 'customerId', 'mediaId', 'mimeType', 'mediaFilename', 'type'],
  });
  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404, code: 'MESSAGE_NOT_FOUND' });
  }
  if (!message.mediaId) {
    throw Object.assign(new Error('Message has no media'), { statusCode: 404, code: 'NO_MEDIA' });
  }

  await assertThreadAccess(message.customerId, agencyId, requester);

  const media = await whatsappService.fetchWhatsAppMedia({
    agencyId,
    customerId: message.customerId,
    mediaId: message.mediaId,
  });

  return {
    stream: media.stream,
    contentType: media.contentType || message.mimeType || 'application/octet-stream',
    filename: message.mediaFilename || media.filename || null,
    isDocument: message.type === 'DOCUMENT',
  };
}

/**
 * Sends a text message from an agent to a customer via WhatsApp.
 * @param {object} data - { customerId, content, type }
 * @param {string} agencyId - Agency ID
 * @param {string} agentId - Agent ID
 * @returns {Promise<object>} Sent message record
 */
async function sendMessage(data, agencyId, agentId) {
  const { customerId, content, type = 'TEXT' } = data;

  const customer = await Customer.findOne({ where: { id: customerId, agencyId } });
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  }

  return whatsappService.sendTextMessage(
    customer.phone,
    content,
    { customerId, agencyId, agentId }
  );
}

/**
 * Lists agents that a conversation can be assigned to.
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object[]>} Agents (id, name, isOnline)
 */
async function listAssignableAgents(agencyId) {
  return Agent.findAll({
    where: { agencyId },
    attributes: ['id', 'name', 'isOnline'],
    order: [['name', 'ASC']],
  });
}

/**
 * Assigns (or unassigns) a conversation to an agent.
 * @param {string} customerId - Customer ID
 * @param {string|null} agentId - Agent ID, or null to unassign
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} { id, assignedAgent }
 */
async function assignThread(customerId, agentId, agencyId) {
  let assignedAgent = null;
  let leadAssignmentsUpdated = 0;

  const customer = await sequelize.transaction(async (transaction) => {
    const customerRecord = await Customer.findOne({
      where: { id: customerId, agencyId },
      transaction,
    });
    if (!customerRecord) {
      throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
    }

    if (agentId) {
      assignedAgent = await Agent.findOne({
        where: { id: agentId, agencyId },
        attributes: ['id', 'name'],
        transaction,
      });
      if (!assignedAgent) {
        throw Object.assign(new Error('Agent not found'), { statusCode: 404, code: 'AGENT_NOT_FOUND' });
      }
    }

    customerRecord.assignedAgentId = agentId || null;
    await customerRecord.save({ transaction });

    const [updatedCount] = await Lead.update(
      { assignedAgentId: agentId || null },
      {
        where: {
          customerId: customerRecord.id,
          agencyId,
          [Op.or]: [
            { status: { [Op.notIn]: CLOSED_LEAD_STATUSES } },
            { status: { [Op.is]: null } },
          ],
        },
        transaction,
      }
    );
    leadAssignmentsUpdated = updatedCount;

    return customerRecord;
  });

  return {
    id: customer.id,
    assignedAgent: assignedAgent ? { id: assignedAgent.id, name: assignedAgent.name } : null,
    leadAssignmentsUpdated,
  };
}

module.exports = {
  listMessages,
  listThreads,
  getLiveMessages,
  sendMessage,
  listAssignableAgents,
  assignThread,
  assertThreadAccess,
  claimThreadIfUnassigned,
  getMessageMedia,
};
