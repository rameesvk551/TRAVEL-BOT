// FILE: /backend/src/services/messageService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Message, Customer, Agent } = require('../models');
const whatsappService = require('./whatsappService');

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
    where.timestamp = { [Op.gt]: new Date(since) };
  }

  return Message.findAll({
    where,
    include: [
      { model: Agent, as: 'agent', attributes: ['id', 'name'] },
    ],
    order: [['timestamp', 'ASC']],
    limit: parseInt(limit),
  });
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

module.exports = {
  listMessages,
  getLiveMessages,
  sendMessage,
};
