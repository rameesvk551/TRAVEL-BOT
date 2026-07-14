const { shouldHandoff, handoffToAgent, forwardToAgent } = require('./handlers/handoffHandler');
const { handlePaymentMessage } = require('./handlers/paymentHandler');
const { handleReview } = require('./handlers/reviewHandler');
const { handleTravelFlow, createFreshGreetingLead, pendingReminderWouldSend } = require('./handlers/travelFlowHandler');
const { isCampaignAction, handleCampaignAction, tryHandleCampaignTextAction, getLatestCampaignRecipient } = require('./handlers/campaignActionHandler');
const { updateSession } = require('./utils/sessionManager');
const { canSendMenu, isManualPauseActive } = require('./utils/automationCooldowns');
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

function hasMetaFlowEntry(agency = {}) {
  const config = agency.whatsappFlowConfig && typeof agency.whatsappFlowConfig === 'object'
    ? agency.whatsappFlowConfig
    : {};
  const flows = Array.isArray(config.flows) ? config.flows : [];
  const entryFlowId = String(config.entryFlowId || flows[0]?.id || '').trim();
  const entryFlow = flows.find((flow) => String(flow?.id || '') === entryFlowId) || flows[0];
  if (!entryFlow || typeof entryFlow !== 'object') return false;
  const nodes = Array.isArray(entryFlow.nodes) ? entryFlow.nodes : [];
  const startNodeId = String(entryFlow.startNodeId || entryFlow.entryNodeId || nodes[0]?.id || '').trim();
  const startNode = nodes.find((node) => String(node?.id || '') === startNodeId) || nodes[0];
  return String(startNode?.type || '') === 'OPEN_META_FLOW';
}

// True when the agency has turned off human agent handoff (flow builder → "Disable
// agent handoff") — no keyword handoff, no forwarding of customer messages to a
// staff member's personal WhatsApp, no bot-pause on business-app replies.
function agentHandoffDisabled(agency = {}) {
  const config = agency.whatsappFlowConfig && typeof agency.whatsappFlowConfig === 'object'
    ? agency.whatsappFlowConfig
    : {};
  return config.disableAgentHandoff === true;
}

async function routeMessage(session, incoming, customer, agency, options = {}) {
  const messageText = getMessageText(incoming);
  const normalizedText = String(messageText || '').trim().toLowerCase();
  const actionId = String(incoming?.actionId || '').trim();
  const isFirstInboundMessage = options.isFirstInboundMessage === true;
  const handoffDisabled = agentHandoffDisabled(agency);
  const packageDeepLinkAction = !actionId ? extractPackageDeepLinkAction(messageText) : '';
  const isForceRestartCommand = normalizedText === 'restart';

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
    if (!isForceRestartCommand && !canSendMenu(session, { isFirstInboundMessage })) {
      if (!handoffDisabled && isManualPauseActive(session) && session.handedOffToId) {
        await forwardToAgent(session, messageText, customer, agency);
      }
      return;
    }

    await createFreshGreetingLead(session, customer, agency);
    await updateSession(session, {
      isHandedOff: false,
      handedOffAt: null,
      handedOffToId: null,
      currentStep: 'NEW',
      failedAttempts: 0,
      collectedData: {
        manualHandoff: null,
        lastInvalidAutoReplyAt: null,
        lastInvalidAutoReplyContext: null,
      },
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
  const hasActiveFlowGraph = menuContext === 'FLOW_GRAPH'
    && session.collectedData?.activeFlow
    && typeof session.collectedData.activeFlow === 'object';
  const hasPendingMetaFlow = session.collectedData?.pendingMetaFlow
    && typeof session.collectedData.pendingMetaFlow === 'object'
    && session.collectedData.pendingMetaFlow.status === 'awaiting_submission';
  const shouldRouteToRequiredMetaEntry = hasMetaFlowEntry(agency)
    && !session.collectedData?.activeLeadId;
  const isStayrouteOnamReply = session.currentStep === 'MENU'
    && menuContext.startsWith('STAYROUTE_ONAM_');
  const isMenuFallbackReply = isStayrouteOnamReply || (session.currentStep === 'MENU'
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
    ));

  if (!actionId && !isMenuFallbackReply && await tryHandleCampaignTextAction(session, messageText, customer, agency)) {
    return;
  }

  if (!isFirstInboundMessage && !actionId && ['NEW', 'MENU', 'COMPLETE'].includes(session.currentStep) && !isMenuFallbackReply && !hasActiveFlowGraph && !hasPendingMetaFlow && !shouldRouteToRequiredMetaEntry) {
    // Do not auto-open the welcome menu for every free-text message from an
    // existing customer. Explicit menu commands above still work.
    return;
  }

  if (actionId === 'flow_submission' || incoming?.flowResponse) {
    await handleTravelFlow(session, incoming, customer, agency, {
      handoffToAgent,
      forwardToAgent,
    });
    return;
  }

  if (handoffDisabled && (session.isHandedOff || session.currentStep === 'HANDOFF')) {
    // Handoff turned off for this agency — release any stale handoff state (from before
    // it was disabled) and let the bot handle the message normally instead of forwarding
    // it to a staff member's personal WhatsApp.
    await updateSession(session, {
      isHandedOff: false,
      handedOffAt: null,
      handedOffToId: null,
      currentStep: session.currentStep === 'HANDOFF' ? 'NEW' : session.currentStep,
      collectedData: { manualHandoff: null },
    });
  } else if (session.isHandedOff || session.currentStep === 'HANDOFF') {
    if (isManualPauseActive(session)) {
      if (session.handedOffToId) {
        await forwardToAgent(session, messageText, customer, agency);
      }
      return;
    }

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

  if (!handoffDisabled) {
    const handoffCheck = shouldHandoff(messageText, session);
    if (handoffCheck.shouldHandoff) {
      await handoffToAgent(session, customer, agency, handoffCheck.reason);
      return;
    }
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

// Predicts whether an inbound message will be SILENTLY DROPPED with no reply —
// i.e. it hits the "do not auto-open the welcome menu for every free-text
// message from an existing customer" early return inside routeMessage above.
//
// The webhook uses this to decide whether to send the WhatsApp read receipt /
// typing indicator. When a message will get no reply, we skip the read receipt
// so the customer's free-text stays UNREAD in the WhatsApp Business App for a
// human to notice and answer (Meta's typing/read call marks the message read —
// there is no way to show typing without also marking read).
//
// CONSERVATIVE BY DESIGN: only returns true when we are certain no reply will be
// sent. Any uncertainty (recent campaign the text might match, lookup error)
// returns false so the old always-mark-read behavior is preserved.
// Keep the flag/isMenuFallbackReply logic below in sync with routeMessage.
async function willDropSilently(session, incoming, customer, agency, options = {}) {
  const messageText = getMessageText(incoming);
  const normalizedText = String(messageText || '').trim().toLowerCase();
  const actionId = String(incoming?.actionId || '').trim();
  const isFirstInboundMessage = options.isFirstInboundMessage === true;

  // These paths all send a reply, so they are never a silent drop.
  if (isFirstInboundMessage || actionId) return false;
  if (extractPackageDeepLinkAction(messageText)) return false;
  // A greeting/menu keyword only replies if we're actually allowed to (re)send the menu.
  // Post-submission (recordMenuSent set the cooldown) a "hi"/"hello" is silently dropped —
  // mirror that here so we don't mark it read + show typing with no reply.
  if (RESET_TO_MENU_KEYWORDS.has(normalizedText) || GREETING_KEYWORDS.has(normalizedText)) {
    const isForceRestart = normalizedText === 'restart';
    if (isForceRestart || canSendMenu(session, { isFirstInboundMessage })) return false;
    // Only a live human-handoff forward would still reply; disabled for handoff-off agencies.
    const forwards = !agentHandoffDisabled(agency) && isManualPauseActive(session) && !!session.handedOffToId;
    return !forwards;
  }
  if (!['NEW', 'MENU', 'COMPLETE'].includes(session.currentStep)) return false;

  const menuContext = String(session.collectedData?.menuContext || '').trim();
  const hasActiveFlowGraph = menuContext === 'FLOW_GRAPH'
    && session.collectedData?.activeFlow
    && typeof session.collectedData.activeFlow === 'object';
  const hasPendingMetaFlow = session.collectedData?.pendingMetaFlow
    && typeof session.collectedData.pendingMetaFlow === 'object'
    && session.collectedData.pendingMetaFlow.status === 'awaiting_submission';
  const shouldRouteToRequiredMetaEntry = hasMetaFlowEntry(agency)
    && !session.collectedData?.activeLeadId;
  const isStayrouteOnamReply = session.currentStep === 'MENU'
    && menuContext.startsWith('STAYROUTE_ONAM_');
  const isMenuFallbackReply = isStayrouteOnamReply || (session.currentStep === 'MENU'
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
    ));

  // A pending form only replies if a reminder would actually be re-sent now; when the
  // reminder is throttled (burst cooldown / cap reached) the message is dropped silently,
  // so it must NOT be marked read with a typing bubble.
  const pendingWillReply = hasPendingMetaFlow && pendingReminderWouldSend(session);
  if (isMenuFallbackReply || hasActiveFlowGraph || pendingWillReply || shouldRouteToRequiredMetaEntry) {
    return false;
  }

  // A recent campaign means this free-text might match a campaign keyword and
  // trigger a reply (tryHandleCampaignTextAction) — keep the read receipt then.
  try {
    const recipient = await getLatestCampaignRecipient(customer, agency);
    if (recipient) return false;
  } catch (err) {
    // On lookup failure, fall back to the old behavior (send the read receipt).
    return false;
  }

  return true;
}

module.exports = { routeMessage, willDropSilently };
