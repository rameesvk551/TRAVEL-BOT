// FILE: /backend/src/services/instagramAutomationService.js

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  Agency,
  BotSession,
  Customer,
  InstagramAutomation,
  InstagramAutomationLog,
} = require('../models');
const marketingOsPartnerService = require('./marketingOsPartnerService');

const ALLOWED_FIELDS = [
  'accountId',
  'mediaId',
  'mediaTitle',
  'mediaThumbnailUrl',
  'name',
  'triggerKeywords',
  'matchType',
  'actionType',
  'linkedPackageIds',
  'linkedPropertyIds',
  'privateReplyMessage',
  'quickReplies',
  'followPromptMode',
  'publicReplyEnabled',
  'publicReplyMessage',
  'duplicatePolicy',
  'isActive',
];

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePayload(payload = {}) {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (payload[field] !== undefined) data[field] = payload[field];
  }

  if (data.triggerKeywords !== undefined) {
    data.triggerKeywords = cleanList(data.triggerKeywords).map((keyword) => keyword.toUpperCase());
  }
  if (data.quickReplies !== undefined) {
    data.quickReplies = cleanList(data.quickReplies).slice(0, 4);
  }
  if (data.linkedPackageIds !== undefined) data.linkedPackageIds = cleanList(data.linkedPackageIds);
  if (data.linkedPropertyIds !== undefined) data.linkedPropertyIds = cleanList(data.linkedPropertyIds);

  return data;
}

function getCommentText(event = {}) {
  return String(event.commentText || event.text || event.comment?.text || '').trim();
}

function getCommenter(event = {}) {
  const commenter = event.commenter || event.from || event.user || {};
  return {
    id: String(commenter.id || event.commenterId || ''),
    username: String(commenter.username || commenter.name || event.commenterUsername || ''),
  };
}

function buildInstagramCustomerIdentifier(managedAccountId, senderId) {
  const simple = `ig_${String(senderId || '').trim()}`;
  if (simple.length > 3 && simple.length <= 20) return simple;

  const digest = crypto
    .createHash('sha1')
    .update(`${managedAccountId || 'unknown'}:${senderId || 'unknown'}`)
    .digest('hex')
    .slice(0, 17);
  return `ig_${digest}`;
}

function findMatch(automation, commentText) {
  const matchType = automation.matchType || 'CONTAINS';
  const text = String(commentText || '').trim();
  const upperText = text.toUpperCase();
  const keywords = cleanList(automation.triggerKeywords).map((keyword) => keyword.toUpperCase());

  if (matchType === 'ANY') {
    return { matched: true, keyword: '*' };
  }

  if (!keywords.length) {
    return { matched: false, keyword: null };
  }

  for (const keyword of keywords) {
    if (matchType === 'EXACT' && upperText === keyword) {
      return { matched: true, keyword };
    }
    if (matchType === 'CONTAINS' && upperText.includes(keyword)) {
      return { matched: true, keyword };
    }
  }

  return { matched: false, keyword: null };
}

function uniqueList(items) {
  const seen = new Set();
  return cleanList(items).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function actionDefaults(actionType) {
  switch (actionType) {
    case 'PROPERTY_FLOW':
      return {
        intent: 'PROPERTY',
        step: 'IG_PACKAGE_INTENT',
        quickReplies: ['Show Properties', 'Talk to Agent', 'Show Packages'],
        leadInterest: 'PROPERTY',
      };
    case 'BROCHURE_LINK':
      return {
        intent: 'BROCHURE_LINK',
        step: 'IG_PACKAGE_INTENT',
        quickReplies: ['Send Brochure', 'Show Packages', 'Talk to Agent'],
        leadInterest: 'BROCHURE_LINK',
      };
    case 'AGENT_HANDOFF':
      return {
        intent: 'AGENT_HANDOFF',
        step: 'IG_PACKAGE_INTENT',
        quickReplies: ['Talk to Agent', 'Share Phone', 'Show Packages'],
        leadInterest: 'AGENT_HANDOFF',
      };
    case 'PACKAGE_FLOW':
    default:
      return {
        intent: 'PACKAGES',
        step: 'IG_PACKAGE_INTENT',
        quickReplies: ['Show Packages', 'Custom Trip', 'Talk to Agent'],
        leadInterest: 'PACKAGES',
      };
  }
}

function buildActionQuickReplies(automation) {
  const defaults = actionDefaults(automation.actionType).quickReplies;
  return uniqueList([...defaults, ...(automation.quickReplies || [])]).slice(0, 4);
}

function buildPrivateReply(automation, event = {}) {
  const username = getCommenter(event).username || 'there';
  const base = String(automation.privateReplyMessage || '').trim()
    || 'Thanks for commenting. I can send the details here.';
  const followLine = automation.followPromptMode === 'BEFORE_DETAILS'
    ? '\n\nFollow our page for latest travel offers.'
    : '';
  const replies = cleanList(automation.quickReplies);
  const replyLine = replies.length ? `\n\n${replies.map((reply) => `[${reply}]`).join(' ')}` : '';
  const afterLine = automation.followPromptMode === 'AFTER_DETAILS'
    ? '\n\nFollow our page for more travel deals.'
    : '';

  return base
    .replace(/\{\{\s*username\s*\}\}/gi, username)
    .replace(/\{\{\s*keyword\s*\}\}/gi, event.matchedKeyword || '')
    + followLine
    + replyLine
    + afterLine;
}

function buildPublicReply(automation, event = {}) {
  const username = getCommenter(event).username || 'there';
  const base = String(automation.publicReplyMessage || '').trim() || 'Sent you details in DM.';
  return base
    .replace(/\{\{\s*username\s*\}\}/gi, username)
    .replace(/\{\{\s*keyword\s*\}\}/gi, event.matchedKeyword || '');
}

async function listAutomations(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.mediaId) where.mediaId = filters.mediaId;
  if (filters.activeOnly === true) where.isActive = true;

  return InstagramAutomation.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

async function createAutomation(agencyId, payload) {
  const data = normalizePayload(payload);
  if (!data.accountId) {
    throw Object.assign(new Error('accountId is required'), { statusCode: 400, code: 'ACCOUNT_ID_REQUIRED' });
  }

  return InstagramAutomation.create({
    ...data,
    agencyId,
    name: data.name || 'Comment to DM',
  });
}

async function updateAutomation(agencyId, automationId, payload) {
  const automation = await InstagramAutomation.findOne({ where: { id: automationId, agencyId } });
  if (!automation) {
    throw Object.assign(new Error('Automation not found'), { statusCode: 404, code: 'AUTOMATION_NOT_FOUND' });
  }

  await automation.update(normalizePayload(payload));
  return automation;
}

async function deleteAutomation(agencyId, automationId) {
  const automation = await InstagramAutomation.findOne({ where: { id: automationId, agencyId } });
  if (!automation) {
    throw Object.assign(new Error('Automation not found'), { statusCode: 404, code: 'AUTOMATION_NOT_FOUND' });
  }

  await automation.destroy();
  return { id: automationId };
}

async function listLogs(agencyId, filters = {}) {
  const where = { agencyId };
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.automationId) where.automationId = filters.automationId;

  return InstagramAutomationLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(parseInt(filters.limit || 50, 10), 200),
  });
}

async function hasDuplicate(agencyId, automation, event, commenter) {
  const where = {
    agencyId,
    automationId: automation.id,
    status: { [Op.in]: ['PRIVATE_REPLY_SENT', 'WAITING_FOR_REPLY', 'CONVERTED_TO_DM'] },
  };

  if (automation.duplicatePolicy === 'COMMENT') {
    where.commentId = event.commentId;
  } else {
    where.commenterId = commenter.id || '__unknown__';
    if (automation.duplicatePolicy === 'USER_PER_POST') {
      where.mediaId = event.mediaId || null;
    }
    if (automation.duplicatePolicy === 'USER_24H') {
      where.createdAt = { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }
  }

  const existing = await InstagramAutomationLog.findOne({ where });
  return Boolean(existing);
}

async function incrementStats(automation, patch) {
  const current = automation.stats || {};
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = Number(next[key] || 0) + value;
  }
  await automation.update({ stats: next, lastTriggeredAt: new Date() });
}

async function sendPrivateReplyForComment(agencyId, payload) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency?.marketingOsTenantId) {
    throw Object.assign(new Error('No Instagram provider connected. Go to Settings first.'), {
      statusCode: 400,
      code: 'INSTAGRAM_NOT_CONNECTED',
    });
  }

  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  return marketingOsPartnerService.sendTenantInstagramPrivateReply(tenantToken, payload);
}

async function sendPublicReplyForComment(agencyId, payload) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency?.marketingOsTenantId) {
    throw Object.assign(new Error('No Instagram provider connected. Go to Settings first.'), {
      statusCode: 400,
      code: 'INSTAGRAM_NOT_CONNECTED',
    });
  }

  const tenantToken = await marketingOsPartnerService.getTenantToken(agency.marketingOsTenantId);
  return marketingOsPartnerService.sendTenantInstagramCommentReply(tenantToken, payload);
}

async function prepareAutomationSession(agencyId, automation, event = {}) {
  const accountId = String(event.accountId || event.igAccountId || '');
  const commenter = getCommenter(event);
  if (!accountId || !commenter.id) return null;

  const customerKey = buildInstagramCustomerIdentifier(accountId, commenter.id);
  const defaults = actionDefaults(automation.actionType);
  const [customer] = await Customer.findOrCreate({
    where: { agencyId, phone: customerKey },
    defaults: {
      agencyId,
      phone: customerKey,
      source: 'instagram_comment',
      name: commenter.username || null,
    },
  });

  const customerPatch = {};
  if (customer.source !== 'instagram' && customer.source !== 'instagram_comment') {
    customerPatch.source = 'instagram_comment';
  }
  if (commenter.username && !customer.name) customerPatch.name = commenter.username;
  if (Object.keys(customerPatch).length) await customer.update(customerPatch);

  const [session] = await BotSession.findOrCreate({
    where: { customerId: customer.id },
    defaults: {
      customerId: customer.id,
      agencyId,
      currentStep: defaults.step,
      collectedData: {},
      lastActivityAt: new Date(),
    },
  });

  const collectedData = {
    ...(session.collectedData || {}),
    igFlow: true,
    igIntent: defaults.intent,
    instagramAutomation: {
      id: automation.id,
      actionType: automation.actionType,
      commentId: String(event.commentId || event.id || ''),
      mediaId: String(event.mediaId || ''),
      accountId,
      matchedKeyword: event.matchedKeyword || '',
      linkedPackageIds: cleanList(automation.linkedPackageIds),
      linkedPropertyIds: cleanList(automation.linkedPropertyIds),
    },
    igLead: {
      ...(session.collectedData?.igLead || {}),
      interest: defaults.leadInterest,
    },
  };

  await session.update({
    currentStep: defaults.step,
    collectedData,
    isHandedOff: automation.actionType === 'AGENT_HANDOFF' ? false : session.isHandedOff,
    lastActivityAt: new Date(),
  });

  return { customerId: customer.id, sessionId: session.id, customerKey };
}

async function processCommentEvent(agencyId, event = {}) {
  const accountId = String(event.accountId || event.igAccountId || '');
  const mediaId = String(event.mediaId || '');
  const commentId = String(event.commentId || event.id || '');
  const commentText = getCommentText(event);
  const commenter = getCommenter(event);

  if (!accountId || !commentId) {
    throw Object.assign(new Error('accountId and commentId are required'), {
      statusCode: 400,
      code: 'INVALID_INSTAGRAM_COMMENT_EVENT',
    });
  }

  const candidates = await listAutomations(agencyId, { accountId, activeOnly: true });
  const automation = candidates.find((rule) => {
    if (rule.mediaId && mediaId && rule.mediaId !== mediaId) return false;
    if (rule.mediaId && !mediaId) return false;
    return findMatch(rule, commentText).matched;
  });

  if (!automation) {
    return InstagramAutomationLog.create({
      agencyId,
      accountId,
      mediaId: mediaId || null,
      commentId,
      commenterId: commenter.id || null,
      commenterUsername: commenter.username || null,
      commentText,
      status: 'NO_MATCH',
      metadata: event,
    });
  }

  const match = findMatch(automation, commentText);
  if (await hasDuplicate(agencyId, automation, { commentId, mediaId }, commenter)) {
    return InstagramAutomationLog.create({
      automationId: automation.id,
      agencyId,
      accountId,
      mediaId: mediaId || null,
      commentId,
      commenterId: commenter.id || null,
      commenterUsername: commenter.username || null,
      commentText,
      matchedKeyword: match.keyword,
      status: 'DUPLICATE_SKIPPED',
      metadata: event,
    });
  }

  const actionQuickReplies = buildActionQuickReplies(automation);
  const replyAutomation = {
    ...(typeof automation.get === 'function' ? automation.get({ plain: true }) : automation),
    quickReplies: actionQuickReplies,
  };
  const eventWithMatch = { ...event, matchedKeyword: match.keyword };
  const privateReplyText = buildPrivateReply(replyAutomation, eventWithMatch);
  const log = await InstagramAutomationLog.create({
    automationId: automation.id,
    agencyId,
    accountId,
    mediaId: mediaId || null,
    commentId,
    commenterId: commenter.id || null,
    commenterUsername: commenter.username || null,
    commentText,
    matchedKeyword: match.keyword,
    status: 'MATCHED',
    metadata: {
      ...event,
      actionType: automation.actionType,
      quickReplies: actionQuickReplies,
    },
  });

  try {
    const response = await sendPrivateReplyForComment(agencyId, {
      accountId,
      commentId,
      text: privateReplyText,
      quickReplies: actionQuickReplies,
    });

    let preparedSession = null;
    let sessionError = null;
    try {
      preparedSession = await prepareAutomationSession(agencyId, automation, eventWithMatch);
    } catch (sessionErr) {
      sessionError = sessionErr.message || 'Automation session preparation failed';
    }

    let publicReplyMessageId = null;
    let publicReplySent = false;
    let publicReplyError = null;
    if (automation.publicReplyEnabled) {
      try {
        const publicResponse = await sendPublicReplyForComment(agencyId, {
          accountId,
          commentId,
          text: buildPublicReply(automation, eventWithMatch),
        });
        publicReplySent = true;
        publicReplyMessageId = publicResponse?.data?.messageId
          || publicResponse?.data?.id
          || publicResponse?.messageId
          || publicResponse?.id
          || null;
      } catch (publicErr) {
        publicReplyError = publicErr.response?.data?.error || publicErr.message || 'Public reply failed';
      }
    }

    await log.update({
      status: 'WAITING_FOR_REPLY',
      privateReplyMessageId: response?.data?.messageId || response?.data?.id || response?.messageId || response?.id || null,
      publicReplyMessageId,
      errorMessage: publicReplyError || sessionError,
      metadata: {
        ...(log.metadata || {}),
        preparedSession,
        privateReplyText,
        publicReplyEnabled: Boolean(automation.publicReplyEnabled),
        sessionError,
        publicReplyError,
      },
    });
    await incrementStats(automation, {
      matched: 1,
      privateRepliesSent: 1,
      publicRepliesSent: publicReplySent ? 1 : 0,
      errors: publicReplyError || sessionError ? 1 : 0,
    });
    return log;
  } catch (err) {
    await log.update({
      status: 'FAILED',
      errorMessage: err.response?.data?.error || err.message || 'Private reply failed',
    });
    await incrementStats(automation, { matched: 1, errors: 1 });
    return log;
  }
}

async function findLatestConvertibleLog(agencyId, event = {}, statuses = ['WAITING_FOR_REPLY', 'PRIVATE_REPLY_SENT']) {
  const accountId = String(event.accountId || event.igAccountId || event.recipientId || '');
  const senderId = String(event.senderId || event.commenterId || event.from?.id || '');
  if (!accountId || !senderId) return null;

  return InstagramAutomationLog.findOne({
    where: {
      agencyId,
      accountId,
      commenterId: senderId,
      status: { [Op.in]: statuses },
    },
    order: [['createdAt', 'DESC']],
  });
}

async function markDmReplyReceived(agencyId, event = {}) {
  const log = await findLatestConvertibleLog(agencyId, event);
  if (!log) return null;

  await log.update({
    status: 'CONVERTED_TO_DM',
    metadata: {
      ...(log.metadata || {}),
      convertedToDmAt: new Date().toISOString(),
      dmReply: {
        messageId: event.messageId || null,
        text: event.text || '',
      },
    },
  });

  return log;
}

async function markLeadCreatedFromDm(agencyId, event = {}, lead = null) {
  const accountId = String(event.accountId || event.igAccountId || event.recipientId || '');
  const senderId = String(event.senderId || event.commenterId || event.from?.id || '');
  if (!accountId || !senderId || !lead?.id) return null;

  const logs = await InstagramAutomationLog.findAll({
    where: {
      agencyId,
      accountId,
      commenterId: senderId,
      status: { [Op.in]: ['CONVERTED_TO_DM', 'WAITING_FOR_REPLY', 'PRIVATE_REPLY_SENT'] },
    },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  const log = logs.find((item) => !(item.metadata || {}).leadId);
  if (!log) return null;

  await log.update({
    status: 'CONVERTED_TO_DM',
    metadata: {
      ...(log.metadata || {}),
      leadId: lead.id,
      leadCreatedAt: new Date().toISOString(),
    },
  });

  const automation = log.automationId
    ? await InstagramAutomation.findByPk(log.automationId)
    : null;
  if (automation) await incrementStats(automation, { leadsCreated: 1 });

  return log;
}

module.exports = {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  listLogs,
  processCommentEvent,
  markDmReplyReceived,
  markLeadCreatedFromDm,
  sendPrivateReplyForComment,
  sendPublicReplyForComment,
  buildPrivateReply,
  buildPublicReply,
  buildActionQuickReplies,
};
