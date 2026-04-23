// FILE: /backend/src/services/instagramAutomationService.js

const { Op } = require('sequelize');
const {
  Agency,
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

function buildPrivateReply(automation, event = {}) {
  const username = getCommenter(event).username || 'there';
  const base = String(automation.privateReplyMessage || '').trim()
    || 'Thanks for commenting. I can send the details here.';
  const followLine = automation.followPromptMode === 'BEFORE_DETAILS'
    ? '\n\nFollow our page for latest travel offers.'
    : '';
  const replies = cleanList(automation.quickReplies);
  const replyLine = replies.length ? `\n\n${replies.map((reply) => `[${reply}]`).join(' ')}` : '';

  return base
    .replace(/\{\{\s*username\s*\}\}/gi, username)
    .replace(/\{\{\s*keyword\s*\}\}/gi, event.matchedKeyword || '')
    + followLine
    + replyLine;
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

  const privateReplyText = buildPrivateReply(automation, { ...event, matchedKeyword: match.keyword });
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
    metadata: event,
  });

  try {
    const response = await sendPrivateReplyForComment(agencyId, {
      accountId,
      commentId,
      text: privateReplyText,
      quickReplies: automation.quickReplies || [],
    });

    await log.update({
      status: 'PRIVATE_REPLY_SENT',
      privateReplyMessageId: response?.data?.messageId || response?.messageId || null,
    });
    await incrementStats(automation, { matched: 1, privateRepliesSent: 1 });
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

module.exports = {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  listLogs,
  processCommentEvent,
  sendPrivateReplyForComment,
  buildPrivateReply,
};
