const MENU_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const INVALID_REPLY_COOLDOWN_MS = 15 * 60 * 1000;

function timestampMs(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCollectedData(session = {}) {
  return session.collectedData && typeof session.collectedData === 'object'
    ? session.collectedData
    : {};
}

function getManualHandoffAt(session = {}) {
  const handoff = getCollectedData(session).manualHandoff;
  return handoff && typeof handoff === 'object' ? timestampMs(handoff.at) : null;
}

function getLastMenuSentAt(session = {}) {
  return timestampMs(getCollectedData(session).lastMenuSentAt);
}

function isWithinCooldown(value, cooldownMs, now = Date.now()) {
  const ms = timestampMs(value);
  return ms !== null && now - ms >= 0 && now - ms < cooldownMs;
}

function isManualPauseActive(session = {}, now = Date.now()) {
  const handoffAt = getManualHandoffAt(session);
  return handoffAt !== null && now - handoffAt >= 0 && now - handoffAt < MENU_COOLDOWN_MS;
}

function canSendMenu(session = {}, { isFirstInboundMessage = false, now = Date.now() } = {}) {
  if (isFirstInboundMessage) return true;
  if (isManualPauseActive(session, now)) return false;

  const lastMenuSentAt = getLastMenuSentAt(session);
  if (lastMenuSentAt === null) return true;

  return now - lastMenuSentAt >= MENU_COOLDOWN_MS;
}

function invalidReplyContext(session = {}) {
  const data = getCollectedData(session);
  const activeFlow = data.activeFlow && typeof data.activeFlow === 'object'
    ? data.activeFlow
    : {};

  return [
    session.currentStep || '',
    data.menuContext || '',
    activeFlow.flowId || '',
    activeFlow.awaitingNodeId || activeFlow.nodeId || '',
    activeFlow.awaitingType || '',
  ].map((item) => String(item || '').trim()).join(':');
}

function shouldSuppressInvalidReply(session = {}, context = invalidReplyContext(session), now = Date.now()) {
  const data = getCollectedData(session);
  return data.lastInvalidAutoReplyContext === context
    && isWithinCooldown(data.lastInvalidAutoReplyAt, INVALID_REPLY_COOLDOWN_MS, now);
}

module.exports = {
  MENU_COOLDOWN_MS,
  INVALID_REPLY_COOLDOWN_MS,
  canSendMenu,
  getCollectedData,
  invalidReplyContext,
  isManualPauseActive,
  shouldSuppressInvalidReply,
};
