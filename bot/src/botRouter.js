const { shouldHandoff, handoffToAgent, forwardToAgent } = require('./handlers/handoffHandler');
const { handlePaymentMessage } = require('./handlers/paymentHandler');
const { handleReview } = require('./handlers/reviewHandler');
const { handleTravelFlow } = require('./handlers/travelFlowHandler');

function getMessageText(incoming) {
  if (typeof incoming === 'string') return incoming;
  return incoming?.text || '';
}

async function routeMessage(session, incoming, customer, agency) {
  const messageText = getMessageText(incoming);

  if (session.isHandedOff || session.currentStep === 'HANDOFF') {
    await forwardToAgent(session, messageText, customer, agency);
    return;
  }

  const handoffCheck = shouldHandoff(messageText, session);
  if (handoffCheck.shouldHandoff) {
    await handoffToAgent(session, customer, agency, handoffCheck.reason);
    return;
  }

  switch (session.currentStep) {
    case 'PAYMENT_PENDING':
      await handlePaymentMessage(session, messageText, customer, agency);
      return;

    case 'REVIEW':
      await handleReview(session, messageText, customer, agency);
      return;

    default:
      await handleTravelFlow(session, incoming, customer, agency, {
        handoffToAgent,
        forwardToAgent,
      });
  }
}

module.exports = { routeMessage };
