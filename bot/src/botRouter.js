const { shouldHandoff, handoffToAgent, forwardToAgent } = require('./handlers/handoffHandler');
const { handlePaymentMessage } = require('./handlers/paymentHandler');
const { handleReview } = require('./handlers/reviewHandler');
const { handleTravelFlow, createFreshGreetingLead } = require('./handlers/travelFlowHandler');
const { isCampaignAction, handleCampaignAction, tryHandleCampaignTextAction } = require('./handlers/campaignActionHandler');
const { updateSession } = require('./utils/sessionManager');
const GREETING_KEYWORDS = new Set([
  'hi',
  'gi',
  'hii',
  'hiii',
  'hello',
  'hey',
]);

const RESET_TO_MENU_KEYWORDS = new Set([
  'start',
  'menu',
  'main menu',
  'restart',
  'see other',
  'see others',
]);

function extractPackageDeepLinkAction(messageText = '') {
  const text = String(messageText || '').trim();
  const match = text.match(/\b(?:VIEW_PACKAGE|PACKAGE_ID|PKG|PACKAGE)\s*[:#-]?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
  return match ? `pkg_pick:${match[1]}` : '';
}

function getMessageText(incoming) {
  if (typeof incoming === 'string') return incoming;
  return incoming?.text || '';
}

async function routeMessage(session, incoming, customer, agency, options = {}) {
  const messageText = getMessageText(incoming);
  const normalizedText = String(messageText || '').trim().toLowerCase();
  const actionId = String(incoming?.actionId || '').trim();
  const isFirstInboundMessage = options.isFirstInboundMessage === true;
  const packageDeepLinkAction = !actionId ? extractPackageDeepLinkAction(messageText) : '';

  if (packageDeepLinkAction) {
    await handleTravelFlow(
      session,
      { ...(typeof incoming === 'object' && incoming ? incoming : {}), text: messageText, actionId: packageDeepLinkAction },
      customer,
      agency,
      {
        handoffToAgent,
        forwardToAgent,
      }
    );
    return;
  }

  // Explicit menu commands and greetings reset the flow to the welcome menu.
  if (RESET_TO_MENU_KEYWORDS.has(normalizedText) || GREETING_KEYWORDS.has(normalizedText)) {
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

  const menuContext = String(session.collectedData?.menuContext || '').trim();
  const isMenuFallbackReply = session.currentStep === 'MENU'
    && menuContext
    && (
      /^[1-3]$/.test(normalizedText)
      || [
        'visa',
        'visa services',
        'ticketing',
        'visa & ticketing',
        'flight',
        'flight tickets',
        'tour',
        'tour package',
        'tour packages',
        'plan a trip',
        'packages',
        'show packages',
        'staycations',
        'properties',
        'show properties',
        'rail',
        'train',
      ].includes(normalizedText)
    );

  if (!actionId && !isMenuFallbackReply && await tryHandleCampaignTextAction(session, messageText, customer, agency)) {
    return;
  }

  if (!isFirstInboundMessage && !actionId && ['NEW', 'MENU', 'COMPLETE'].includes(session.currentStep) && !isMenuFallbackReply) {
    // Do not auto-open the welcome menu for every free-text message from an
    // existing customer. Explicit menu commands above still work.
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
    await handleReview(session, incoming, customer, agency);
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

    // Template quick replies arrive with an actionId too, but their payload is often
    // just plain text like "View Packages" instead of a campaign_* action id.
    // Give campaign text matching a chance before falling back to the generic flow.
    const isConfiguredFlowAction = actionId.startsWith('flow_') || actionId.startsWith('custom_menu:') || actionId.startsWith('menu_');
    if (!isConfiguredFlowAction && await tryHandleCampaignTextAction(session, messageText || actionId, customer, agency)) {
      return;
    }

    await handleTravelFlow(session, incoming, customer, agency, {
      handoffToAgent,
      forwardToAgent,
    });
    return;
  }

  if (actionId && await tryHandleCampaignTextAction(session, messageText, customer, agency)) {
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
