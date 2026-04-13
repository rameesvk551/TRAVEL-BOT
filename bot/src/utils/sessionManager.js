// FILE: /bot/src/utils/sessionManager.js
// DEPS: sequelize (shared from backend)

const path = require('path');
const modelsPath = path.resolve(__dirname, '../../../backend/src/models/index.ts');
const { BotSession, Customer, Agency } = require(modelsPath);

/**
 * Loads or creates a bot session for a customer.
 * Also creates the customer record if it doesn't exist.
 * @param {string} phone - Customer phone in E.164 format
 * @param {string} agencyId - Agency ID
 * @returns {Promise<{ session: object, customer: object, agency: object }>}
 */
async function loadOrCreateSession(phone, agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw new Error(`Agency ${agencyId} not found`);
  }

  // Find or create customer
  let [customer] = await Customer.findOrCreate({
    where: { phone, agencyId },
    defaults: { phone, agencyId, source: 'whatsapp' },
  });

  // Find or create session
  let [session] = await BotSession.findOrCreate({
    where: { customerId: customer.id },
    defaults: {
      customerId: customer.id,
      agencyId,
      currentStep: 'NEW',
      collectedData: {},
      lastActivityAt: new Date(),
    },
  });

  // Update last activity
  await session.update({ lastActivityAt: new Date() });

  return { session, customer, agency };
}

/**
 * Updates a bot session's step and collected data.
 * @param {object} session - BotSession instance
 * @param {object} updates - { currentStep?, collectedData?, isHandedOff?, etc. }
 */
async function updateSession(session, updates) {
  const data = { ...updates, lastActivityAt: new Date() };

  // Merge collected data if provided
  if (updates.collectedData) {
    data.collectedData = { ...session.collectedData, ...updates.collectedData };
  }

  await session.update(data);
  return session;
}

/**
 * Resets a session back to initial state.
 * @param {object} session - BotSession instance
 */
async function resetSession(session) {
  await session.update({
    currentStep: 'NEW',
    collectedData: {},
    isHandedOff: false,
    handedOffAt: null,
    handedOffToId: null,
    failedAttempts: 0,
    lastActivityAt: new Date(),
  });
  return session;
}

module.exports = { loadOrCreateSession, updateSession, resetSession };
