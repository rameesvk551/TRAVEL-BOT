const { shouldHandoff, handoffToAgent, forwardToAgent } = require('./handlers/handoffHandler');
const { handlePaymentMessage } = require('./handlers/paymentHandler');
const { handleReview } = require('./handlers/reviewHandler');
const { handleTravelFlow, createFreshGreetingLead } = require('./handlers/travelFlowHandler');
const { isCampaignAction, handleCampaignAction } = require('./handlers/campaignActionHandler');
const { updateSession } = require('./utils/sessionManager');

const RESET_TO_MENU_KEYWORDS = new Set([
  'hi',
  'gi',
  'hii',
  'hiii',
  'hello',
  'hey',
  'start',
  'menu',
  'main menu',
  'restart',
]);

function getMessageText(incoming) {
  if (typeof incoming === 'string') return incoming;
  return incoming?.text || '';
}

async function routeMessage(session, incoming, customer, agency) {
  const messageText = getMessageText(incoming);
  const normalizedText = String(messageText || '').trim().toLowerCase();
  const actionId = String(incoming?.actionId || '').trim();

  // Greetings and menu keywords should always bring the user back to the main menu.
  if (RESET_TO_MENU_KEYWORDS.has(normalizedText)) {
    await createFreshGreetingLead(session, customer, agency);
    await updateSession(session, {
      isHandedOff: false,
      handedOffAt: null,
      handedOffToId: null,
      currentStep: 'NEW',
      failedAttempts: 0,
    });

    await handleTravelFlow(
      session,
      { ...(typeof incoming === 'object' && incoming ? incoming : {}), text: normalizedText, actionId: '' },
      customer,
      agency,
      {
        handoffToAgent,
        forwardToAgent,
      }
    );
    return;
  }

  if (session.isHandedOff || session.currentStep === 'HANDOFF') {
    if (!session.handedOffToId) {
      await updateSession(session, {
        isHandedOff: false,
        handedOffAt: null,
        currentStep: 'NEW',
      });
    } else {
      await forwardToAgent(session, messageText, customer, agency);
      return;
    }
  }

  // Handle Meta Commerce cart orders first
  if (incoming.type === 'ORDER') {
    const { handleOrder } = require('./handlers/orderHandler');
    await handleOrder(session, incoming, customer, agency);
    return;
  }

  if (session.currentStep === 'REVIEW' || session.currentStep === 'REVIEW_TESTIMONIAL') {
    await handleReview(session, messageText, customer, agency);
    return;
  }

  // Interactive WhatsApp replies should reach the flow handler first so CTA clicks
  // like "Call Now" or Flow submissions are not mistaken for generic handoff keywords.
  if (actionId) {
    // Campaign broadcast button clicks (View Packages, Call Us, etc.)
    if (isCampaignAction(actionId)) {
      await handleCampaignAction(session, actionId, customer, agency);
      return;
    }

    await handleTravelFlow(session, incoming, customer, agency, {
      handoffToAgent,
      forwardToAgent,
    });
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

    default:
      await handleTravelFlow(session, incoming, customer, agency, {
        handoffToAgent,
        forwardToAgent,
      });
  }
}

module.exports = { routeMessage };
