const { BotSession } = require('../models');

async function findByCustomerAndAgency(customerId, agencyId) {
  return BotSession.findOne({
    where: { customerId, agencyId },
  });
}

async function update(session, updates) {
  await session.update(updates);
  return session;
}

module.exports = {
  findByCustomerAndAgency,
  update,
};