const botSessionRepository = require('../repositories/botSessionRepository');

async function takeOverConversation(customerId, agencyId, agentId) {
  const session = await botSessionRepository.findByCustomerAndAgency(customerId, agencyId);
  if (!session) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  return botSessionRepository.update(session, {
    isHandedOff: true,
    handedOffAt: new Date(),
    handedOffToId: agentId,
  });
}

module.exports = {
  takeOverConversation,
};