// FILE: /backend/src/services/leadService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Lead, Customer, Agent, Package, Property, Service, Visa, Cruise, Campaign, Message, Booking, FollowUp, LeadNote, MessageTemplate, CallLog, Payment } = require('../models');
const { normalizePhone, isValidIndianPhone } = require('../utils/phoneUtils');
const whatsappService = require('./whatsappService');
const serviceRoutingService = require('./serviceRoutingService');
const pipelineService = require('./pipelineService');
const { resolveLeadSource } = require('./leadSource');
const { PipelineStage } = require('../models');

/**
 * Lists leads for an agency with filtering and pagination.
 * @param {string} agencyId - Agency ID
 * @param {object} filters - { status, agentId, search, dateFrom, dateTo, page, pageSize }
 * @returns {Promise<object>} { data, total, page, pageSize }
 */
function isAdmin(requester) {
  return requester?.role === 'ADMIN';
}

function scopedLeadWhere(agencyId, requester, extra = {}) {
  const where = { agencyId, ...extra };
  if (requester?.id && !isAdmin(requester)) {
    where.assignedAgentId = requester?.id;
  }
  return where;
}

function valueOrFallback(value, fallback = 'Not shared yet') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatBudgetForNotification(amountPaise) {
  const amount = Number(amountPaise || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not shared yet';
  return `₹${Math.round(amount / 100).toLocaleString('en-IN')}`;
}

function formatStatusForActivity(status = '') {
  return String(status || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown';
}

function formatDateTimeForActivity(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function requesterAgentId(requester = null) {
  return requester?.id || requester?.agentId || null;
}

async function appendLeadActivityNote(leadId, agentId, content) {
  const text = String(content || '').trim();
  if (!leadId || !text) return null;
  return LeadNote.create({
    leadId,
    agentId: agentId || null,
    content: text,
  });
}

function compactText(value = '', max = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function pushTimelineEvent(events, event) {
  if (!event?.time) return;
  events.push({
    id: event.id,
    type: event.type || 'activity',
    title: event.title || 'Activity',
    description: event.description || '',
    note: event.note || null,
    actor: event.actor || null,
    status: event.status || null,
    time: event.time,
    metadata: event.metadata || [],
    source: event.source || null,
  });
}

function buildLeadTimeline({ lead, followUps = [], notes = [], messages = [], callLogs = [], payments = [] }) {
  const events = [];
  const customerName = lead.customer?.name || 'Unnamed Lead';

  pushTimelineEvent(events, {
    id: `lead-created-${lead.id}`,
    type: 'lead_created',
    title: `Lead created via ${formatStatusForActivity(lead.source || 'source')}`,
    description: `Lead ${customerName} was created.`,
    time: lead.createdAt,
    metadata: [
      lead.assignedAgent?.name ? `Assigned to ${lead.assignedAgent.name}` : '',
      lead.destination ? `Destination ${lead.destination}` : '',
    ].filter(Boolean),
  });

  if (lead.booking) {
    pushTimelineEvent(events, {
      id: `booking-${lead.booking.id}`,
      type: 'booking',
      title: `Booking ${formatStatusForActivity(lead.booking.status)}`,
      description: `Booking ${lead.booking.bookingRef || ''} created for ${customerName}`.trim(),
      note: lead.booking.notes || null,
      time: lead.booking.createdAt,
      status: lead.booking.status,
      metadata: [
        lead.booking.totalAmount ? `Amount ${formatBudgetForNotification(lead.booking.totalAmount)}` : '',
        lead.booking.travelDate ? `Travel ${formatDateTimeForActivity(lead.booking.travelDate)}` : '',
      ].filter(Boolean),
    });
  }

  payments.forEach((payment) => {
    pushTimelineEvent(events, {
      id: `payment-${payment.id}`,
      type: 'payment',
      title: `Payment ${formatStatusForActivity(payment.status)}`,
      description: `${formatStatusForActivity(payment.type)} payment ${formatBudgetForNotification(payment.amount)}`,
      time: payment.paidAt || payment.createdAt,
      status: payment.status,
      metadata: [
        payment.expiresAt ? `Expires ${formatDateTimeForActivity(payment.expiresAt)}` : '',
      ].filter(Boolean),
    });
  });

  followUps.forEach((followUp) => {
    const actorName = followUp.agent?.name || lead.assignedAgent?.name || 'Staff';
    const status = followUp.status || 'Scheduled';
    const isDone = status === 'Done';
    const isCancelled = status === 'Cancelled';
    const actionTime = isDone || isCancelled ? followUp.updatedAt : followUp.createdAt;
    
    let title = `${actorName} scheduled a follow-up for ${formatDateTimeForActivity(followUp.scheduledAt)}`;
    if (isDone) title = `${actorName} completed a follow-up`;
    if (isCancelled) title = `${actorName} cancelled a follow-up`;

    pushTimelineEvent(events, {
      id: `follow-up-${followUp.id}-${status}`,
      type: 'follow_up',
      title,
      description: followUp.note ? `Note: ${compactText(followUp.note, 220)}` : '',
      note: followUp.note || null,
      actor: actorName,
      status,
      time: actionTime || followUp.scheduledAt,
      metadata: [`Status ${status}`],
    });
  });

  notes.forEach((note) => {
    const actorName = note.agent?.name || 'Staff';
    const content = String(note.content || '');
    const isSystemLog = content.startsWith('Lead status updated:') ||
                        content.startsWith('Assignment updated:') ||
                        content.startsWith('Lead details updated:');
    const isOutcomeLog = content.startsWith('Follow-up Outcome:');
    // Auto-generated follow-up lifecycle logs (assigned / rescheduled / completed /
    // cancelled / deleted / note updated) are already represented by the FollowUp
    // event itself, so skip them here to avoid duplicate, mislabeled "note" rows.
    const isFollowUpSystemLog = !isOutcomeLog && /^Follow-up\b/i.test(content);

    if (isFollowUpSystemLog) {
      return;
    }

    if (isSystemLog) {
      pushTimelineEvent(events, {
        id: `audit-${note.id}`,
        type: 'audit_log',
        title: `${actorName} ${content.split(':')[0].toLowerCase()}`,
        description: content,
        actor: actorName,
        time: note.createdAt,
      });
    } else if (isOutcomeLog) {
      pushTimelineEvent(events, {
        id: `outcome-${note.id}`,
        type: 'follow_up',
        title: `${actorName} logged a follow-up outcome`,
        description: content.replace('Follow-up Outcome:', '').trim(),
        actor: actorName,
        time: note.createdAt,
      });
    } else {
      // A genuine manual note — show the note body once, as a clean quote.
      pushTimelineEvent(events, {
        id: `note-${note.id}`,
        type: 'note',
        title: `${actorName} added a note`,
        note: content,
        actor: actorName,
        time: note.createdAt,
      });
    }
  });

  // WhatsApp messages are intentionally excluded from the timeline — they have
  // their own dedicated Messages tab and only clutter the activity story here.

  callLogs.forEach((callLog) => {
    const duration = Number(callLog.durationSeconds || 0);
    const actorName = callLog.agent?.name || 'Staff';
    pushTimelineEvent(events, {
      id: `call-${callLog.id}`,
      type: 'call',
      title: `${actorName} logged a call`,
      description: [
        `Called ${callLog.customer?.name || customerName}`,
        duration > 0 ? `Duration ${duration}s` : '',
        callLog.failureReason || '',
      ].filter(Boolean).join('. '),
      actor: actorName,
      status: callLog.status,
      time: callLog.startedAt || callLog.createdAt,
      source: {
        id: callLog.id,
        recordingUrl: callLog.recordingUrl || null,
      },
    });
  });

  return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

function valuesDiffer(beforeValue, afterValue) {
  const before = beforeValue === undefined ? null : beforeValue;
  const after = afterValue === undefined ? null : afterValue;
  if (before instanceof Date || after instanceof Date) {
    const beforeTime = before ? new Date(before).getTime() : null;
    const afterTime = after ? new Date(after).getTime() : null;
    return beforeTime !== afterTime;
  }
  if (typeof before === 'object' || typeof after === 'object') {
    return JSON.stringify(before || null) !== JSON.stringify(after || null);
  }
  return String(before ?? '') !== String(after ?? '');
}

function changedLeadFieldLabels(beforeLead, filtered, customerUpdates = {}) {
  const labels = {
    destination: 'destination',
    travelDates: 'travel dates',
    travellers: 'travellers',
    budgetPerPerson: 'budget per person',
    packageId: 'package',
    propertyId: 'property',
    serviceId: 'service',
    visaId: 'visa',
    cruiseId: 'cruise',
    itemType: 'item type',
    campaignId: 'campaign',
    campaignName: 'campaign name',
    campaignAction: 'campaign action',
    notes: 'lead notes',
    lostReason: 'lost reason',
    travelStart: 'travel start',
    travelEnd: 'travel end',
    interest: 'interest',
    source: 'source',
    tags: 'tags',
    selectedItems: 'selected items',
    customTripDetails: 'captured details',
    metaLeadgenId: 'Meta lead ID',
    metaFormId: 'Meta form',
    metaCampaignName: 'Meta campaign',
    metaAdName: 'Meta ad',
  };

  const ignored = new Set(['status', 'assignedAgentId']);
  const changed = Object.entries(filtered)
    .filter(([key, value]) => !ignored.has(key) && valuesDiffer(beforeLead[key], value))
    .map(([key]) => labels[key] || key);

  Object.entries(customerUpdates).forEach(([key, value]) => {
    if (value !== undefined) changed.push(key === 'name' ? 'contact name' : key === 'phone' ? 'contact phone' : 'contact email');
  });

  return [...new Set(changed)];
}

async function findApprovedAgentTemplate(agencyId, suffix) {
  if (!agencyId || !suffix) return null;
  return MessageTemplate.findOne({
    where: {
      agencyId,
      status: 'APPROVED',
      name: { [Op.iLike]: `%${suffix}` },
    },
    order: [['updatedAt', 'DESC']],
  });
}

async function notifyAssignedAgent(fullLead, agencyId, contextLabel = 'lead assignment') {
  const agent = fullLead?.assignedAgent;
  if (!agent?.phone) return;

  const pkgName = fullLead.package ? fullLead.package.name : 'None';
  const variables = [
    valueOrFallback(fullLead.customer?.name, 'Unknown'),
    valueOrFallback(fullLead.customer?.phone, 'Unknown'),
    valueOrFallback(pkgName, 'Not selected'),
    valueOrFallback(fullLead.travelDates || fullLead.travelStart),
    valueOrFallback(fullLead.travellers),
    formatBudgetForNotification(fullLead.budgetPerPerson),
    valueOrFallback(fullLead.notes),
  ];
  const fallback = `*New Lead Assigned*\n\nCustomer: ${variables[0]}\nPhone: ${variables[1]}\nDestination: ${fullLead.destination || 'Not specified'}\nPackage: ${pkgName}\nEnquiry Date: ${fullLead.createdAt ? new Date(fullLead.createdAt).toDateString() : new Date().toDateString()}`;

  try {
    const template = await findApprovedAgentTemplate(agencyId, 'agent_new_enquiry_assignment');
    if (template) {
      const result = await whatsappService.sendTemplateMessage(
        agent.phone,
        template.name,
        variables,
        { agencyId, customerId: fullLead.customerId },
        { template }
      );
      if (result?.status !== 'FAILED') return;
    }

    await whatsappService.sendSystemNotificationWhatsApp(agent.phone, fallback, { agencyId, customerId: fullLead.customerId });
  } catch (err) {
    console.error(`Failed to send ${contextLabel} notification`, err);
  }
}

function parsePositiveInt(value, fallback, max = 200) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function getDateRangeBounds(range) {
  const now = new Date();
  if (range === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }
  if (range === 'year') {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  return {};
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .map((tag) => tag.slice(0, 40))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function normalizeSelectedItems(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();

  return items
    .map((item) => ({
      itemType: String(item?.itemType || item?.type || '').trim().toUpperCase(),
      itemId: String(item?.itemId || item?.id || '').trim(),
    }))
    .filter((item) => ['PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE'].includes(item.itemType) && item.itemId)
    .filter((item) => {
      const key = `${item.itemType}:${item.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

function normalizeFlowSubmissions(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const answers = item.answers && typeof item.answers === 'object' && !Array.isArray(item.answers)
        ? Object.fromEntries(
          Object.entries(item.answers)
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
            .map(([key, value]) => [String(key).slice(0, 80), String(value).trim().slice(0, 1000)])
        )
        : {};
      const submittedAt = item.submittedAt ? new Date(item.submittedAt) : null;
      return {
        key: String(item.key || '').trim().slice(0, 80),
        title: String(item.title || '').trim().slice(0, 120),
        itemType: String(item.itemType || '').trim().toUpperCase().slice(0, 40),
        itemId: String(item.itemId || '').trim().slice(0, 120),
        itemName: String(item.itemName || item.name || '').trim().slice(0, 255),
        category: String(item.category || '').trim().slice(0, 120),
        routingIntentKey: String(item.routingIntentKey || '').trim().slice(0, 120),
        submittedAt: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.toISOString() : new Date().toISOString(),
        answers,
      };
    })
    .filter((item) => item && (item.title || item.itemName || Object.keys(item.answers).length))
    .slice(-30);
}

function normalizeCustomTripDetails(details = {}) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};

  const normalized = {};
  const stringFields = [
    'name',
    'phone',
    'destination',
    'travelDate',
    'travelDates',
    'travellersText',
    'budgetText',
    'notes',
    'campaignName',
    'source',
    'interest',
    'metaLeadgenId',
    'metaFormId',
    'service',
    'serviceCategory',
    'serviceDetails',
    'staycationInterest',
    'staycationViewedAt',
    'propertyLocation',
    'propertyName',
    'propertyType',
    'stayType',
    'checkInDate',
    'checkOutDate',
    'groupType',
    'rooms',
    'routingIntentKey',
    'routingIntentLabel',
  ];

  for (const field of stringFields) {
    const value = details[field];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) normalized[field] = text.slice(0, 1000);
  }

  const travellers = Number.parseInt(String(details.travellers || ''), 10);
  if (Number.isFinite(travellers) && travellers > 0) normalized.travellers = travellers;

  ['adults', 'children6To12', 'childrenBelow5'].forEach((field) => {
    const value = Number.parseInt(String(details[field] || ''), 10);
    if (Number.isFinite(value) && value >= 0) normalized[field] = value;
  });

  const budgetPerPerson = Number.parseInt(String(details.budgetPerPerson || ''), 10);
  if (Number.isFinite(budgetPerPerson) && budgetPerPerson >= 0) normalized.budgetPerPerson = budgetPerPerson;

  if (details.submittedAt) {
    const submittedAt = new Date(details.submittedAt);
    if (!Number.isNaN(submittedAt.getTime())) normalized.submittedAt = submittedAt.toISOString();
  }

  if (details.travelReadiness && typeof details.travelReadiness === 'object' && !Array.isArray(details.travelReadiness)) {
    const readiness = {};
    const readinessStringFields = [
      'travellerCount',
      'travelerCount',
      'bookingReadiness',
      'tripType',
      'departureAirport',
      'roomType',
    ];

    for (const field of readinessStringFields) {
      const value = details.travelReadiness[field];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) readiness[field] = text.slice(0, 500);
    }

    if (details.travelReadiness.submittedAt) {
      const submittedAt = new Date(details.travelReadiness.submittedAt);
      if (!Number.isNaN(submittedAt.getTime())) readiness.submittedAt = submittedAt.toISOString();
    }

    if (Object.keys(readiness).length) normalized.travelReadiness = readiness;
  }

  if (details.metaFields && typeof details.metaFields === 'object' && !Array.isArray(details.metaFields)) {
    normalized.metaFields = details.metaFields;
  }

  [
    'flowAnswers',
    'flowEnquiry',
    'customTripEnquiry',
    'packageEnquiry',
    'propertyEnquiry',
    'serviceEnquiry',
    'visaEnquiry',
    'cruiseEnquiry',
  ].forEach((field) => {
    if (details[field] && typeof details[field] === 'object' && !Array.isArray(details[field])) {
      normalized[field] = details[field];
    }
  });

  const flowSubmissions = normalizeFlowSubmissions(details.flowSubmissions);
  if (flowSubmissions.length) normalized.flowSubmissions = flowSubmissions;

  return normalized;
}

function calculateLeadScore(lead) {
  let score = 10;
  const status = String(lead?.status || '');
  const budget = Number(lead?.budgetPerPerson || 0);
  const travellers = Number(lead?.travellers || 1);
  const tags = normalizeTags(lead?.tags);
  const selectedCount = Number(
    lead?.selectedCatalogItems?.length
    || normalizeSelectedItems(lead?.selectedItems).length
    || 0
  );
  const hasPackageOrProperty = Boolean(lead?.packageId || lead?.propertyId || selectedCount > 0);

  if (lead?.assignedAgentId) score += 8;
  if (hasPackageOrProperty) score += 15;
  if (lead?.destination) score += 8;
  if (budget > 0) score += Math.min(18, Math.round(budget / 500000));
  if (travellers > 1) score += Math.min(10, travellers * 2);
  if (lead?.travelStart || lead?.travelDates) score += 6;
  if (tags.some((tag) => /urgent|hot|vip|high/i.test(tag))) score += 12;

  if (['PACKAGE_INTERESTED', 'ENQUIRY', 'QUOTED'].includes(status)) score += 18;
  if (['CONTACTED', 'NEGOTIATING'].includes(status)) score += 10;
  if (status === 'CONVERTED' || status === 'BOOKED') score = 100;
  if (status === 'LOST' || status === 'CANCELLED') score = Math.min(score, 15);

  return Math.max(0, Math.min(100, score));
}

function enrichLeadPayload(lead) {
  const payload = lead?.toJSON ? lead.toJSON() : { ...lead };
  payload.tags = normalizeTags(payload.tags);
  payload.selectedItems = normalizeSelectedItems(payload.selectedItems);
  payload.customTripDetails = normalizeCustomTripDetails(payload.customTripDetails);

  const capturedPhone = String(payload.customTripDetails?.phone || '').trim();
  if (capturedPhone && payload.customer) {
    payload.customer = {
      ...payload.customer,
      phone: capturedPhone,
      channelContactId: payload.customer.phone,
    };
  }

  if (String(payload.source || '').toLowerCase() === 'instagram_dm') {
    payload.source = 'instagram';
  }

  payload.leadScore = calculateLeadScore(payload);
  return payload;
}

async function listLeads(agencyId, filters = {}, requester = null) {
  const {
    status,
    agentId,
    search,
    source,
    tag,
    attention,
    sortBy = 'newest',
    dateRange,
    metaCampaignId,
    metaPlatform,
    metaFormId,
    adId,
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
    channelId,
  } = filters;

  const where = scopedLeadWhere(agencyId, requester);
  const andConditions = [];
  const closedStatuses = ['CONVERTED', 'LOST', 'CANCELLED'];

  // Guard against non-UUID stage filters (e.g. a stale browser URL carrying an
  // old status key like PACKAGE_INTERESTED) — Postgres would 500 on a bad uuid.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const stageFilter = Array.isArray(filters.pipelineStageId)
    ? filters.pipelineStageId.filter((value) => UUID_RE.test(String(value)))
    : (UUID_RE.test(String(filters.pipelineStageId || '')) ? filters.pipelineStageId : null);

  if (Array.isArray(stageFilter) ? stageFilter.length : stageFilter) {
    where.pipelineStageId = Array.isArray(stageFilter) ? { [Op.in]: stageFilter } : stageFilter;
  } else if (status) {
    // The retired 'JUST_CONTACTED' key is an alias for the empty (null) status.
    if (Array.isArray(status)) {
      const hasEntry = status.includes('JUST_CONTACTED');
      const rest = status.filter((s) => s !== 'JUST_CONTACTED');
      if (hasEntry && rest.length) where.status = { [Op.or]: [{ [Op.is]: null }, { [Op.in]: rest }] };
      else if (hasEntry) where.status = { [Op.is]: null };
      else where.status = { [Op.in]: rest };
    } else if (status === 'JUST_CONTACTED') {
      where.status = { [Op.is]: null };
    } else {
      where.status = status;
    }
  }

  if (agentId === 'mine' && requester?.id) where.assignedAgentId = requester.id;
  else if (agentId === 'unassigned') where.assignedAgentId = null;
  else if (agentId && isAdmin(requester)) where.assignedAgentId = agentId;

  if (source) {
    if (Array.isArray(source)) {
      where.source = { [Op.in]: source };
    } else if (source === 'direct') {
      andConditions.push({
        [Op.or]: [
          { source: null },
          { source: { [Op.iLike]: '%direct%' } },
          { source: { [Op.iLike]: '%organic%' } },
        ],
      });
    } else if (source === 'facebook_ad' || source === 'instagram_ad') {
      where.source = source;
    } else if (String(source).includes(',')) {
      where.source = { [Op.in]: String(source).split(',').map((item) => item.trim()).filter(Boolean) };
    } else {
      where.source = { [Op.iLike]: `%${source}%` };
    }
  }

  if (tag) where.tags = { [Op.contains]: [String(tag)] };

  if (metaCampaignId) where.metaCampaignId = metaCampaignId;
  if (metaPlatform) where.metaPlatform = String(metaPlatform).toLowerCase();
  if (metaFormId) where.metaFormId = metaFormId;
  // Filter by a specific Click-to-WhatsApp ad. 'any' = every ad-attributed lead.
  if (adId === 'any') where.adId = { [Op.ne]: null };
  else if (adId) where.adId = adId;

  const rangeBounds = getDateRangeBounds(dateRange);
  const effectiveDateFrom = dateFrom || rangeBounds.from;
  const effectiveDateTo = dateTo || rangeBounds.to;
  if (effectiveDateFrom || effectiveDateTo) {
    where.createdAt = {};
    if (effectiveDateFrom) where.createdAt[Op.gte] = new Date(effectiveDateFrom);
    if (effectiveDateTo) where.createdAt[Op.lte] = new Date(effectiveDateTo);
  }

  const searchText = String(search || '').trim();
  if (searchText) {
    const [matchingCustomers, matchingAgents] = await Promise.all([
      Customer.findAll({
        attributes: ['id'],
        where: {
          agencyId,
          [Op.or]: [
            { name: { [Op.iLike]: `%${searchText}%` } },
            { phone: { [Op.iLike]: `%${searchText}%` } },
            { email: { [Op.iLike]: `%${searchText}%` } },
          ],
        },
        raw: true,
      }),
      Agent.findAll({
        attributes: ['id'],
        where: {
          agencyId,
          name: { [Op.iLike]: `%${searchText}%` },
        },
        raw: true,
      }),
    ]);
    const customerIds = matchingCustomers.map((customer) => customer.id).filter(Boolean);
    const agentIds = matchingAgents.map((agent) => agent.id).filter(Boolean);

    andConditions.push({
      [Op.or]: [
        { destination: { [Op.iLike]: `%${searchText}%` } },
        { source: { [Op.iLike]: `%${searchText}%` } },
        { metaCampaignName: { [Op.iLike]: `%${searchText}%` } },
        { metaAdName: { [Op.iLike]: `%${searchText}%` } },
        { metaFormId: { [Op.iLike]: `%${searchText}%` } },
        ...(customerIds.length ? [{ customerId: { [Op.in]: customerIds } }] : []),
        ...(agentIds.length ? [{ assignedAgentId: { [Op.in]: agentIds } }] : []),
      ],
    });
  }

  const scheduledFollowUps = await FollowUp.findAll({
    attributes: ['leadId', 'scheduledAt'],
    where: { agencyId, status: 'Scheduled' },
    raw: true,
  });
  const scheduledLeadIds = [...new Set(scheduledFollowUps.map((followUp) => followUp.leadId).filter(Boolean))];
  const overdueCutoff = endOfToday().getTime();
  const overdueLeadIds = [
    ...new Set(
      scheduledFollowUps
        .filter((followUp) => new Date(followUp.scheduledAt).getTime() <= overdueCutoff)
        .map((followUp) => followUp.leadId)
        .filter(Boolean)
    ),
  ];
  const activeStatusWhere = { [Op.or]: [{ status: { [Op.is]: null } }, { status: { [Op.notIn]: closedStatuses } }] };
  const noScheduledFollowUpWhere = scheduledLeadIds.length
    ? { id: { [Op.notIn]: scheduledLeadIds }, ...activeStatusWhere }
    : activeStatusWhere;
  const attentionWhere = {
    [Op.or]: [
      {
        assignedAgentId: null,
        ...activeStatusWhere,
      },
      noScheduledFollowUpWhere,
      ...(overdueLeadIds.length ? [{ id: { [Op.in]: overdueLeadIds } }] : []),
      {
        leadScore: { [Op.gte]: 75 },
        ...activeStatusWhere,
      },
    ],
  };

  if (attention === 'true' || attention === true || attention === '1') {
    andConditions.push(attentionWhere);
  }

  if (andConditions.length > 0) where[Op.and] = andConditions;

  const limit = parsePositiveInt(pageSize, 20);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;
  const customerWhere = {};
  if (channelId) customerWhere.channelId = channelId;

  const include = [
    { model: Customer, as: 'customer', where: Object.keys(customerWhere).length ? customerWhere : undefined },
    { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email'] },
    { model: PipelineStage, as: 'pipelineStage', attributes: ['id', 'name', 'color', 'kind', 'position'], required: false },
    { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
    { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location', 'pricePerNight'] },
    { model: Service, as: 'service', attributes: ['id', 'name', 'category', 'basePrice'] },
    { model: Visa, as: 'visa', attributes: ['id', 'country', 'visaType', 'processingTime', 'price'] },
    { model: Cruise, as: 'cruise', attributes: ['id', 'name', 'cruiseLine', 'duration', 'basePrice'] },
    {
      model: FollowUp,
      as: 'followUps',
      required: false,
      separate: true,
      where: { status: 'Scheduled' },
      order: [['scheduledAt', 'ASC']],
    },
  ];
  const order = (() => {
    if (sortBy === 'oldest') return [['createdAt', 'ASC']];
    if (sortBy === 'highestBudget') return [['budgetPerPerson', 'DESC'], ['createdAt', 'DESC']];
    if (sortBy === 'nextFollowUp' || sortBy === 'overdue') return [['updatedAt', 'DESC'], ['createdAt', 'DESC']];
    if (sortBy === 'hot') return [['leadScore', 'DESC'], ['createdAt', 'DESC']];
    return [['createdAt', 'DESC']];
  })();

  const { count, rows } = await Lead.findAndCountAll({
    where,
    include,
    distinct: true,
    order,
    limit,
    offset,
  });

  const countBaseWhere = { ...where };
  delete countBaseWhere.status;
  const countForWhere = (extraWhere = {}) => Lead.count({ 
    where: { ...countBaseWhere, ...extraWhere },
    include: Object.keys(customerWhere).length ? [{ model: Customer, as: 'customer', where: customerWhere }] : []
  });
  const statusKeys = ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN'];
  const [allCount, attentionCount, convertedCount, lostCount, statusPairs] = await Promise.all([
    countForWhere(),
    countForWhere(attentionWhere),
    countForWhere({ status: 'CONVERTED' }),
    countForWhere({ status: 'LOST' }),
    Promise.all(statusKeys.map(async (key) => [key, await countForWhere(key === 'JUST_CONTACTED' ? { status: { [Op.is]: null } } : { status: key })])),
  ]);
  const statusCounts = Object.fromEntries(statusPairs);

  // Per-stage counts for the agency's custom funnel tabs. Keyed by stage id so
  // the frontend tabs (which use stage ids as keys) get their badge numbers.
  const countBaseForStages = { ...where };
  delete countBaseForStages.status;
  delete countBaseForStages.pipelineStageId;
  const agencyStages = await PipelineStage.findAll({
    where: { agencyId },
    attributes: ['id'],
    order: [['position', 'ASC']],
  });
  const stagePairs = await Promise.all(
    agencyStages.map(async (stage) => [
      stage.id,
      await Lead.count({
        where: { ...countBaseForStages, pipelineStageId: stage.id },
        include: Object.keys(customerWhere).length ? [{ model: Customer, as: 'customer', where: customerWhere }] : [],
      }),
    ])
  );
  const stageCounts = Object.fromEntries(stagePairs);

  return {
    data: rows.map(enrichLeadPayload),
    total: count,
    page: currentPage,
    pageSize: limit,
    counts: {
      'All Leads': allCount,
      'Needs Attention': attentionCount,
      ...statusCounts,
      ...stageCounts,
    },
    metrics: {
      totalDeals: allCount,
      attention: attentionCount,
      won: convertedCount,
      lost: lostCount,
    },
  };
}

/**
 * Gets a single lead with full details including messages and booking.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID (for scoping)
 * @returns {Promise<object>} Lead with all relations
 */
async function getLeadById(leadId, agencyId, requester = null) {
  const lead = await Lead.findOne({
    where: scopedLeadWhere(agencyId, requester, { id: leadId }),
    include: [
      { model: Customer, as: 'customer' },
      { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email', 'phone'] },
      { model: PipelineStage, as: 'pipelineStage', attributes: ['id', 'name', 'color', 'kind', 'position'], required: false },
      { model: Package, as: 'package' },
      { model: Property, as: 'property' },
      { model: Service, as: 'service' },
      { model: Visa, as: 'visa' },
      { model: Cruise, as: 'cruise' },
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'name', 'linkedPackageIds', 'campaignSections'],
      },
      { model: Booking, as: 'booking' },
    ],
  });

  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  // Get followups and notes
  const leadJson = enrichLeadPayload(lead);
  const selectedPackageIds = new Set();
  const selectedPropertyIds = new Set();
  const selectedServiceIds = new Set();
  const selectedVisaIds = new Set();
  const selectedCruiseIds = new Set();
  const normalizedSelectedItems = normalizeSelectedItems(leadJson.selectedItems);
  const leadInterest = String(leadJson.customTripDetails?.interest || leadJson.interest || '').toUpperCase();
  const leadItemType = String(leadJson.itemType || '').toUpperCase();
  const leadSource = String(leadJson.source || '').toLowerCase();
  const leadNotes = String(leadJson.notes || '').toLowerCase();
  const isCustomTripLead = leadItemType === 'CUSTOM_TRIP'
    || leadInterest === 'CUSTOM_TRIP'
    || (leadSource === 'instagram' && leadInterest === 'CUSTOM')
    || leadNotes.includes('custom trip');

  normalizedSelectedItems.forEach((item) => {
    if (isCustomTripLead && item.itemType === 'PACKAGE') return;
    if (item.itemType === 'PACKAGE') selectedPackageIds.add(item.itemId);
    if (item.itemType === 'PROPERTY') selectedPropertyIds.add(item.itemId);
    if (item.itemType === 'SERVICE') selectedServiceIds.add(item.itemId);
    if (item.itemType === 'VISA') selectedVisaIds.add(item.itemId);
    if (item.itemType === 'CRUISE') selectedCruiseIds.add(item.itemId);
  });

  if (!isCustomTripLead && leadJson.packageId) selectedPackageIds.add(leadJson.packageId);
  if (leadJson.propertyId) selectedPropertyIds.add(leadJson.propertyId);
  if (leadJson.serviceId) selectedServiceIds.add(leadJson.serviceId);
  if (leadJson.visaId) selectedVisaIds.add(leadJson.visaId);
  if (leadJson.cruiseId) selectedCruiseIds.add(leadJson.cruiseId);

  const [followUps, notes, messages, callLogs, payments, selectedPackages, selectedProperties, selectedServices, selectedVisas, selectedCruises] = await Promise.all([
    FollowUp.findAll({
      where: { leadId, agencyId },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] }],
      order: [['scheduledAt', 'ASC']],
    }),
    LeadNote.findAll({ 
      where: { leadId }, 
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']] 
    }),
    Message.findAll({
      where: { customerId: lead.customerId, agencyId },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['timestamp', 'DESC']],
      limit: 20,
    }),
    CallLog.findAll({
      where: { leadId, agencyId },
      include: [
        { model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      ],
      order: [['startedAt', 'DESC']],
      limit: 20,
    }),
    lead.booking?.id
      ? Payment.findAll({
        where: { agencyId, bookingId: lead.booking.id },
        order: [['createdAt', 'DESC']],
        limit: 20,
      })
      : [],
    selectedPackageIds.size
      ? Package.findAll({
        where: { agencyId, id: { [Op.in]: [...selectedPackageIds] } },
        attributes: ['id', 'name', 'category', 'duration', 'basePrice'],
      })
      : [],
    selectedPropertyIds.size
      ? Property.findAll({
        where: { agencyId, id: { [Op.in]: [...selectedPropertyIds] } },
        attributes: ['id', 'name', 'propertyType', 'location', 'pricePerNight'],
      })
      : [],
    selectedServiceIds.size
      ? Service.findAll({
        where: { agencyId, id: { [Op.in]: [...selectedServiceIds] } },
        attributes: ['id', 'name', 'category', 'basePrice'],
      })
      : [],
    selectedVisaIds.size
      ? Visa.findAll({
        where: { agencyId, id: { [Op.in]: [...selectedVisaIds] } },
        attributes: ['id', 'country', 'visaType', 'processingTime', 'price'],
      })
      : [],
    selectedCruiseIds.size
      ? Cruise.findAll({
        where: { agencyId, id: { [Op.in]: [...selectedCruiseIds] } },
        attributes: ['id', 'name', 'cruiseLine', 'duration', 'basePrice'],
      })
      : [],
  ]);

  const selectedCatalogItems = [
    ...selectedPackages.map((pkg) => ({
      id: pkg.id,
      itemType: 'PACKAGE',
      name: pkg.name,
      subtitle: [pkg.category, pkg.duration].filter(Boolean).join(' | ') || null,
      price: pkg.basePrice || null,
    })),
    ...selectedProperties.map((property) => ({
      id: property.id,
      itemType: 'PROPERTY',
      name: property.name,
      subtitle: [property.propertyType, property.location].filter(Boolean).join(' | ') || null,
      price: property.pricePerNight || null,
    })),
    ...selectedServices.map((service) => ({
      id: service.id,
      itemType: 'SERVICE',
      name: service.name,
      subtitle: service.category || null,
      price: service.basePrice || null,
    })),
    ...selectedVisas.map((visa) => ({
      id: visa.id,
      itemType: 'VISA',
      name: [visa.country, visa.visaType].filter(Boolean).join(' - ') || 'Visa',
      subtitle: visa.processingTime || null,
      price: visa.price || null,
    })),
    ...selectedCruises.map((cruise) => ({
      id: cruise.id,
      itemType: 'CRUISE',
      name: cruise.name,
      subtitle: [cruise.cruiseLine, cruise.duration].filter(Boolean).join(' | ') || null,
      price: cruise.basePrice || null,
    })),
  ];

  return {
    ...enrichLeadPayload({ ...leadJson, selectedCatalogItems }),
    messages: messages.reverse(),
    followUps,
    notesList: notes,
    timeline: buildLeadTimeline({
      lead: leadJson,
      followUps,
      notes,
      messages,
      callLogs,
      payments,
    }),
    selectedPackages,
    selectedProperties,
    selectedServices,
    selectedVisas,
    selectedCruises,
    selectedCatalogItems,
  };
}

/**
 * Builds a unified activity timeline for a customer by merging the timelines of
 * every lead/enquiry that customer has ever had. Reuses buildLeadTimeline so the
 * "who did what, when" data stays identical to the lead drawer.
 */
async function getCustomerActivity(customerId, agencyId) {
  const customer = await Customer.findOne({
    where: { id: customerId, agencyId },
    attributes: ['id', 'name', 'phone', 'source', 'createdAt'],
  });
  if (!customer) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const leads = await Lead.findAll({
    where: { customerId, agencyId },
    include: [
      { model: Agent, as: 'assignedAgent', attributes: ['id', 'name'] },
      { model: Booking, as: 'booking' },
    ],
    order: [['createdAt', 'ASC']],
  });

  const enquiries = leads.map((lead) => ({
    id: lead.id,
    label: lead.destination || lead.place || 'Enquiry',
    status: lead.status,
    createdAt: lead.createdAt,
  }));

  if (!leads.length) {
    return { customer: customer.toJSON(), enquiries, timeline: [] };
  }

  const leadIds = leads.map((lead) => lead.id);
  const bookingIds = leads.map((lead) => lead.booking?.id).filter(Boolean);

  const [followUps, notes, callLogs, payments] = await Promise.all([
    FollowUp.findAll({
      where: { leadId: { [Op.in]: leadIds }, agencyId },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
    }),
    LeadNote.findAll({
      where: { leadId: { [Op.in]: leadIds } },
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
    }),
    CallLog.findAll({
      where: { leadId: { [Op.in]: leadIds }, agencyId },
      include: [
        { model: Agent, as: 'agent', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
      ],
    }),
    bookingIds.length
      ? Payment.findAll({ where: { agencyId, bookingId: { [Op.in]: bookingIds } } })
      : [],
  ]);

  let timeline = [];
  leads.forEach((lead) => {
    const leadJson = lead.toJSON();
    leadJson.customer = { name: customer.name };
    const enquiryLabel = leadJson.destination || leadJson.place || 'Enquiry';
    const events = buildLeadTimeline({
      lead: leadJson,
      followUps: followUps.filter((item) => item.leadId === lead.id),
      notes: notes.filter((item) => item.leadId === lead.id),
      callLogs: callLogs.filter((item) => item.leadId === lead.id),
      payments: lead.booking?.id ? payments.filter((item) => item.bookingId === lead.booking.id) : [],
    });
    events.forEach((event) => {
      event.enquiryId = lead.id;
      event.enquiryLabel = enquiryLabel;
      event.enquiryStatus = leadJson.status;
    });
    timeline = timeline.concat(events);
  });

  timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return { customer: customer.toJSON(), enquiries, timeline };
}

/**
 * Creates a new lead.
 * @param {object} data - Lead data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created lead
 */
async function resolveCustomer(data, agencyId) {
  if (data.customerId) {
    const customer = await Customer.findOne({ where: { id: data.customerId, agencyId } });
    if (!customer) {
      throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
    }
    return customer;
  }

  const rawPhone = String(data.customerPhone || '').trim();
  let phone;
  if (!rawPhone) {
    phone = `anon_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  } else {
    const normalized = normalizePhone(rawPhone);
    if (isValidIndianPhone(normalized) || normalized.startsWith('ig_') || normalized.startsWith('fb_')) {
      phone = normalized;
    } else {
      phone = rawPhone.substring(0, 50);
    }
  }

  const customerName = String(data.customerName || '').trim() || null;
  const customerEmail = String(data.customerEmail || '').trim() || null;
  const customerSource = String(data.customerSource || 'manual').trim() || 'manual';

  const [customer, created] = await Customer.findOrCreate({
    where: { agencyId, phone },
    defaults: {
      agencyId,
      phone,
      name: customerName,
      email: customerEmail,
      source: customerSource,
    },
  });

  if (!created) {
    const customerUpdates = {};
    if (customerName && customer.name !== customerName) customerUpdates.name = customerName;
    if (customerEmail && customer.email !== customerEmail) customerUpdates.email = customerEmail;
    if (!customer.source && customerSource) customerUpdates.source = customerSource;

    if (Object.keys(customerUpdates).length > 0) {
      await customer.update(customerUpdates);
    }
  }

  return customer;
}

async function createLead(data, agencyId) {
  const {
    destination,
    place,
    travelDates,
    travellers,
    budgetPerPerson,
    interest,
    enquiryType,
    notes,
    assignedAgentId,
    packageId,
    propertyId,
    serviceId,
    visaId,
    cruiseId,
    itemType,
    campaignId,
    campaignName,
    campaignAction,
    lostReason,
    tags,
    selectedItems,
    customTripDetails,
    travelStart,
    travelEnd,
    status,
    skipAutoAssign,
  } = data;

  const customer = await resolveCustomer(data, agencyId);

  if (assignedAgentId) {
    const agent = await Agent.findOne({ where: { id: assignedAgentId, agencyId } });
    if (!agent) {
      throw Object.assign(new Error('Assigned agent not found'), { statusCode: 404, code: 'AGENT_NOT_FOUND' });
    }
  }

  if (packageId) {
    const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
    if (!pkg) {
      throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'PACKAGE_NOT_FOUND' });
    }
  }

  if (propertyId) {
    const property = await Property.findOne({ where: { id: propertyId, agencyId } });
    if (!property) {
      throw Object.assign(new Error('Property not found'), { statusCode: 404, code: 'PROPERTY_NOT_FOUND' });
    }
  }

  if (serviceId) {
    const service = await Service.findOne({ where: { id: serviceId, agencyId } });
    if (!service) {
      throw Object.assign(new Error('Service not found'), { statusCode: 404, code: 'SERVICE_NOT_FOUND' });
    }
  }

  if (visaId) {
    const visa = await Visa.findOne({ where: { id: visaId, agencyId } });
    if (!visa) {
      throw Object.assign(new Error('Visa not found'), { statusCode: 404, code: 'VISA_NOT_FOUND' });
    }
  }

  if (cruiseId) {
    const cruise = await Cruise.findOne({ where: { id: cruiseId, agencyId } });
    if (!cruise) {
      throw Object.assign(new Error('Cruise not found'), { statusCode: 404, code: 'CRUISE_NOT_FOUND' });
    }
  }

  let finalAssignedAgentId = assignedAgentId || null;
  let finalInterest = enquiryType || interest;

  // Auto-assign when no explicit agent was provided. Always ask the routing
  // service for an owner so even a bare "hi" is claimed by a staff member.
  // Agencies whose conversation flow defers ownership until the customer submits
  // an enquiry (flow builder → "Assign leads only after enquiry") pass
  // skipAutoAssign, so a bare message lands unassigned and the flow's staff-notify
  // step claims it once the form is submitted.
  if (!assignedAgentId && !skipAutoAssign) {
    const routedAgent = await serviceRoutingService.resolveAgentForIntent(agencyId, enquiryType);
    if (routedAgent) {
      finalAssignedAgentId = routedAgent.id;
    }
  }

  const source = resolveLeadSource(data, customer);

  // Leads captured automatically from WhatsApp/Instagram conversations enter the CRM
  // with no pipeline status — an agent triages them before they join the funnel. Only
  // the entry status is suppressed: an explicit later-stage status (e.g. the bot
  // reporting PACKAGE_SEARCHED) is kept, as is any status from other channels.
  const AUTO_CHANNEL_SOURCES = ['whatsapp_organic', 'whatsapp', 'instagram', 'instagram_dm'];
  // 'JUST_CONTACTED' is retired in favour of an empty (null) status for the entry
  // stage, so normalise it (and '') to null on every write.
  const normalizedStatus = (status === 'JUST_CONTACTED' || status === '') ? null : status;
  const isEntryStatus = normalizedStatus == null || normalizedStatus === 'NEW';
  const finalStatus = (status === 'JUST_CONTACTED' || status === '')
    ? null
    : (AUTO_CHANNEL_SOURCES.includes(String(source).toLowerCase()) && isEntryStatus)
      ? null
      : (normalizedStatus || 'NEW');

  // Land the lead in the agency's matching pipeline stage. A status-less lead
  // (finalStatus == null) resolves to null — it joins no stage until triaged.
  const resolvedStageId = await pipelineService.resolveStageIdForStatus(agencyId, finalStatus);

  const lead = await Lead.create({
    customerId: customer.id,
    agencyId,
    assignedAgentId: finalAssignedAgentId,
    pipelineStageId: resolvedStageId === undefined ? null : resolvedStageId,
    destination,
    place,
    travelDates,
    travellers,
    budgetPerPerson,
    interest: finalInterest,
    packageId: packageId || null,
    propertyId: propertyId || null,
    serviceId: serviceId || null,
    visaId: visaId || null,
    cruiseId: cruiseId || null,
    itemType: itemType || (serviceId ? 'SERVICE' : visaId ? 'VISA' : cruiseId ? 'CRUISE' : propertyId ? 'PROPERTY' : packageId ? 'PACKAGE' : null),
    campaignId: campaignId || null,
    campaignName: campaignName || null,
    campaignAction: campaignAction || null,
    notes,
    lostReason,
    tags: normalizeTags(tags),
    selectedItems: normalizeSelectedItems(selectedItems),
    customTripDetails: normalizeCustomTripDetails(customTripDetails),
    travelStart,
    travelEnd,
    status: finalStatus,
    source,
  });

  const fullLead = await getLeadById(lead.id, agencyId);

  if (lead.status === 'CONVERTED') {
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  // Notify whenever the lead ends up owned by an agent — whether assigned
  // explicitly or auto-routed (round-robin / intent). Sends the approved
  // template, falling back to a free-form message inside the 24h window.
  if (finalAssignedAgentId) {
    await notifyAssignedAgent(fullLead, agencyId, 'agent').catch(err => {
      console.error('Failed to send agent notification', err);
    });
  }

  return fullLead;
}

async function assertPackageBelongsToAgency(packageId, agencyId) {
  if (!packageId) return null;
  const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
  if (!pkg) {
    throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'PACKAGE_NOT_FOUND' });
  }
  return pkg;
}

async function assertPropertyBelongsToAgency(propertyId, agencyId) {
  if (!propertyId) return null;
  const property = await Property.findOne({ where: { id: propertyId, agencyId } });
  if (!property) {
    throw Object.assign(new Error('Property not found'), { statusCode: 404, code: 'PROPERTY_NOT_FOUND' });
  }
  return property;
}

async function assertServiceBelongsToAgency(serviceId, agencyId) {
  if (!serviceId) return null;
  const service = await Service.findOne({ where: { id: serviceId, agencyId } });
  if (!service) {
    throw Object.assign(new Error('Service not found'), { statusCode: 404, code: 'SERVICE_NOT_FOUND' });
  }
  return service;
}

async function assertVisaBelongsToAgency(visaId, agencyId) {
  if (!visaId) return null;
  const visa = await Visa.findOne({ where: { id: visaId, agencyId } });
  if (!visa) {
    throw Object.assign(new Error('Visa not found'), { statusCode: 404, code: 'VISA_NOT_FOUND' });
  }
  return visa;
}

async function assertCruiseBelongsToAgency(cruiseId, agencyId) {
  if (!cruiseId) return null;
  const cruise = await Cruise.findOne({ where: { id: cruiseId, agencyId } });
  if (!cruise) {
    throw Object.assign(new Error('Cruise not found'), { statusCode: 404, code: 'CRUISE_NOT_FOUND' });
  }
  return cruise;
}

/**
 * Updates a lead's fields.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Allowed fields to update
 * @returns {Promise<object>} Updated lead
 */
async function updateLead(leadId, agencyId, updates, requester = null) {
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  const beforeLead = lead.toJSON ? lead.toJSON() : { ...lead };

  const allowedFields = [
    'status', 'pipelineStageId', 'assignedAgentId', 'destination', 'place', 'travelDates',
    'travellers', 'budgetPerPerson', 'packageId', 'propertyId', 'serviceId', 'visaId', 'cruiseId', 'itemType',
    'campaignId', 'campaignName', 'campaignAction', 'notes', 'lostReason',
    'travelStart', 'travelEnd', 'interest', 'source', 'tags', 'selectedItems',
    'customTripDetails', 'metaLeadgenId', 'metaFormId', 'metaPageId', 'metaAdAccountId',
    'metaCampaignId', 'metaCampaignName', 'metaAdSetId', 'metaAdSetName',
    'metaAdId', 'metaAdName', 'metaPlatform', 'metaRawPayload',
  ];

  const filtered = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }
  // 'JUST_CONTACTED'/'' map to the empty (null) entry status.
  if (filtered.status === 'JUST_CONTACTED' || filtered.status === '') filtered.status = null;
  if (filtered.tags !== undefined) filtered.tags = normalizeTags(filtered.tags);
  if (filtered.selectedItems !== undefined) filtered.selectedItems = normalizeSelectedItems(filtered.selectedItems);
  if (filtered.customTripDetails !== undefined) filtered.customTripDetails = normalizeCustomTripDetails(filtered.customTripDetails);
  if (filtered.packageId) await assertPackageBelongsToAgency(filtered.packageId, agencyId);
  if (filtered.propertyId) await assertPropertyBelongsToAgency(filtered.propertyId, agencyId);
  if (filtered.serviceId) await assertServiceBelongsToAgency(filtered.serviceId, agencyId);
  if (filtered.visaId) await assertVisaBelongsToAgency(filtered.visaId, agencyId);
  if (filtered.cruiseId) await assertCruiseBelongsToAgency(filtered.cruiseId, agencyId);
  // Reconcile custom pipeline stage <-> legacy status. pipelineStageId is the
  // source of truth the UI writes; status is the internal signal we keep aligned.
  if (updates.pipelineStageId !== undefined) {
    const stage = await pipelineService.getStageById(agencyId, updates.pipelineStageId);
    if (updates.pipelineStageId && !stage) {
      throw Object.assign(new Error('Pipeline stage not found'), { statusCode: 404, code: 'STAGE_NOT_FOUND' });
    }
    filtered.pipelineStageId = stage ? stage.id : null;
    filtered.status = stage ? pipelineService.primaryStatusForStage(stage) : null;
  } else if (filtered.status !== undefined) {
    const resolvedStageId = await pipelineService.resolveStageIdForStatus(agencyId, filtered.status);
    if (resolvedStageId !== undefined) filtered.pipelineStageId = resolvedStageId;
  }

  if (filtered.status === 'LOST' && !String(filtered.lostReason || lead.lostReason || '').trim()) {
    throw Object.assign(new Error('Lost reason is required when marking a lead lost'), {
      statusCode: 400,
      code: 'LOST_REASON_REQUIRED',
    });
  }

  // Handle Customer updates
  const customerUpdates = {};
  if (updates.customerName !== undefined) customerUpdates.name = updates.customerName;
  if (updates.customerPhone !== undefined) customerUpdates.phone = updates.customerPhone;
  if (updates.customerEmail !== undefined) customerUpdates.email = updates.customerEmail;

  if (Object.keys(customerUpdates).length > 0) {
    const customer = await Customer.findByPk(lead.customerId);
    if (customer) {
      await customer.update(customerUpdates);
    }
  }

  const hasAssignmentUpdate = Object.prototype.hasOwnProperty.call(updates, 'assignedAgentId');
  // Callers that immediately send their own staff message after claiming ownership
  // (e.g. the flow's NOTIFY_STAFF / new-enquiry notification) pass
  // suppressAssignmentNotification so the agent isn't double-pinged on their personal number.
  const shouldNotifyAssignedAgent = !updates.suppressAssignmentNotification
    && !!updates.assignedAgentId && (hasAssignmentUpdate || lead.assignedAgentId !== updates.assignedAgentId);
  await lead.update(filtered);

  const activityNotes = [];
  if (hasAssignmentUpdate && valuesDiffer(beforeLead.assignedAgentId, lead.assignedAgentId)) {
    const [fromAgent, toAgent] = await Promise.all([
      beforeLead.assignedAgentId ? Agent.findOne({ where: { id: beforeLead.assignedAgentId, agencyId }, attributes: ['name'] }) : null,
      lead.assignedAgentId ? Agent.findOne({ where: { id: lead.assignedAgentId, agencyId }, attributes: ['name'] }) : null,
    ]);
    activityNotes.push(`Assignment updated: ${fromAgent?.name || 'Unassigned'} -> ${toAgent?.name || 'Unassigned'}.`);
  }

  if (filtered.status !== undefined && valuesDiffer(beforeLead.status, lead.status)) {
    activityNotes.push(`Lead status updated: ${formatStatusForActivity(beforeLead.status)} -> ${formatStatusForActivity(lead.status)}${lead.lostReason ? `. Reason: ${lead.lostReason}` : '.'}`);
  }

  const changedFields = changedLeadFieldLabels(beforeLead, filtered, customerUpdates);
  if (changedFields.length) {
    activityNotes.push(`Lead details updated: ${changedFields.join(', ')}.`);
  }

  if (activityNotes.length) {
    await appendLeadActivityNote(lead.id, requesterAgentId(requester), activityNotes.join('\n'));
  }

  if (filtered.status === 'CONVERTED') {
    const customer = await Customer.findByPk(lead.customerId);
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  if (shouldNotifyAssignedAgent) {
    const fullLead = await getLeadById(lead.id, agencyId, { role: 'ADMIN' });
    await notifyAssignedAgent(fullLead, agencyId, 'agent').catch(err => {
      console.error('Failed to send agent notification', err);
    });
  }

  return getLeadById(lead.id, agencyId, { role: 'ADMIN' });
}

/**
 * Soft-deletes a lead by setting status to CANCELLED.
 * @param {string} leadId - Lead ID
 * @param {string} agencyId - Agency ID
 */
async function deleteLead(leadId, agencyId, requester = null) {
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  await lead.update({ status: 'CANCELLED' });
  return lead;
}

/**
 * Finds the least-busy online agent for an agency.
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object|null>} Agent or null
 */
async function findLeastBusyAgent(agencyId) {
  // Prefer front-line AGENT staff; admins are excluded so a rarely-loaded admin
  // isn't picked as "least busy" and handed every new enquiry. Fall back to any
  // online staff (incl. admin) only when the agency has no agents at all.
  let agents = await Agent.findAll({
    where: { agencyId, isOnline: true, role: 'AGENT' },
    attributes: ['id', 'name', 'email', 'phone', 'role'],
  });

  if (agents.length === 0) {
    agents = await Agent.findAll({
      where: { agencyId, isOnline: true },
      attributes: ['id', 'name', 'email', 'phone', 'role'],
    });
  }

  if (agents.length === 0) return null;

  // Count active leads per agent
  const agentLoads = await Promise.all(
    agents.map(async (agent) => {
      const count = await Lead.count({
        where: {
          assignedAgentId: agent.id,
          [Op.or]: [
            { status: { [Op.is]: null } },
            { status: { [Op.in]: ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] } },
          ],
        },
      });
      return { agent, count };
    })
  );

  // Sort by load ascending, return least busy
  agentLoads.sort((a, b) => a.count - b.count);
  return agentLoads[0].agent;
}

/**
 * Follow Ups
 */
async function addFollowUp(leadId, agencyId, data, requester = null) {
  const { scheduledAt, note, agentId, type, isRecurring, recurringInterval, recurringEndDate } = data;
  if (!note || !String(note).trim()) {
    throw Object.assign(new Error('A note is required when scheduling a follow-up.'), { statusCode: 400, code: 'NOTE_REQUIRED' });
  }
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) throw Object.assign(new Error('Lead not found'), { statusCode: 404 });

  const assignedAgentId = isAdmin(requester) ? (agentId || lead.assignedAgentId || null) : requester?.id;
  const followUp = await FollowUp.create({
    leadId,
    agencyId,
    agentId: assignedAgentId,
    scheduledAt,
    note,
    status: 'Scheduled',
    type,
    isRecurring: !!isRecurring,
    recurringInterval,
    recurringEndDate,
  });

  const assignedAgent = assignedAgentId
    ? await Agent.findOne({ where: { id: assignedAgentId, agencyId }, attributes: ['id', 'name', 'email', 'phone'] })
    : null;
  await appendLeadActivityNote(
    leadId,
    requesterAgentId(requester),
    [
      `Follow-up assigned${assignedAgent?.name ? ` to ${assignedAgent.name}` : ''} for ${formatDateTimeForActivity(scheduledAt)}.`,
      note ? `Note: ${note}` : '',
    ].filter(Boolean).join('\n')
  );

  return FollowUp.findByPk(followUp.id, {
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] }],
  });
}

async function listFollowUps(agencyId, filters = {}, requester = null) {
  const {
    status,
    agentId,
    search,
    dateFrom,
    dateTo,
    due,
    page = 1,
    pageSize = 50,
  } = filters;

  const where = { agencyId };
  const leadWhere = { agencyId };

  if (status && status !== 'All') where.status = status;
  if (isAdmin(requester) && agentId) where.agentId = agentId;
  if (!isAdmin(requester)) where.agentId = requester?.id;

  if (dateFrom || dateTo) {
    where.scheduledAt = {};
    if (dateFrom) where.scheduledAt[Op.gte] = new Date(dateFrom);
    if (dateTo) where.scheduledAt[Op.lte] = new Date(dateTo);
  }

  if (due === 'overdue') {
    where.scheduledAt = { ...(where.scheduledAt || {}), [Op.lt]: new Date() };
  }

  if (due === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    where.scheduledAt = { ...(where.scheduledAt || {}), [Op.between]: [start, end] };
  }

  if (search) {
    const matchedLeads = await Lead.findAll({
      attributes: ['id'],
      where: {
        agencyId,
        [Op.or]: [
          { destination: { [Op.iLike]: `%${search}%` } },
          { '$customer.name$': { [Op.iLike]: `%${search}%` } },
          { '$customer.phone$': { [Op.iLike]: `%${search}%` } },
          { '$customer.email$': { [Op.iLike]: `%${search}%` } },
        ],
      },
      include: [{ model: Customer, as: 'customer', attributes: [], required: false }],
      raw: true,
    });
    where.leadId = { [Op.in]: matchedLeads.map((lead) => lead.id) };
  }

  const metricWhere = { agencyId };
  if (where.agentId) metricWhere.agentId = where.agentId;
  if (where.leadId) metricWhere.leadId = where.leadId;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const [scheduledMetric, overdueMetric, todayMetric, doneMetric] = await Promise.all([
    FollowUp.count({ where: { ...metricWhere, status: 'Scheduled' } }),
    FollowUp.count({ where: { ...metricWhere, status: 'Scheduled', scheduledAt: { [Op.lt]: new Date() } } }),
    FollowUp.count({ where: { ...metricWhere, status: 'Scheduled', scheduledAt: { [Op.between]: [todayStart, todayEnd] } } }),
    FollowUp.count({ where: { ...metricWhere, status: 'Done' } }),
  ]);

  const limit = parsePositiveInt(pageSize, 50);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;

  const { count, rows } = await FollowUp.findAndCountAll({
    where,
    include: [
      {
        model: Lead,
        as: 'lead',
        required: true,
        where: leadWhere,
        include: [
          { model: Customer, as: 'customer' },
          { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
          { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email'] },
        ],
      },
      { model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] },
    ],
    order: [['scheduledAt', 'ASC']],
    limit,
    offset,
  });

  return {
    data: rows,
    total: count,
    page: currentPage,
    pageSize: limit,
    metrics: {
      scheduled: scheduledMetric,
      overdue: overdueMetric,
      today: todayMetric,
      done: doneMetric,
    },
  };
}

async function updateFollowUp(leadId, followUpId, agencyId, updates, requester = null) {
  const where = { id: followUpId, leadId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;
  const followUp = await FollowUp.findOne({ where });
  if (!followUp) throw Object.assign(new Error('FollowUp not found'), { statusCode: 404 });
  const beforeFollowUp = followUp.toJSON ? followUp.toJSON() : { ...followUp };

  const allowed = ['status', 'scheduledAt', 'note', 'agentId', 'type', 'outcome', 'isRecurring', 'recurringInterval', 'recurringEndDate'];
  const filtered = {};
  for(const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];
  if (!isAdmin(requester)) delete filtered.agentId;

  // Closing out a follow-up (Done/Cancelled) must carry an outcome/note explaining
  // what happened, so the activity story is never left blank.
  const isClosing = filtered.status && ['Done', 'Cancelled'].includes(filtered.status) && valuesDiffer(beforeFollowUp.status, filtered.status);
  if (isClosing) {
    const hasOutcome = String(filtered.outcome || '').trim() || String(filtered.note || '').trim();
    if (!hasOutcome) {
      throw Object.assign(new Error('A note is required when completing or cancelling a follow-up.'), { statusCode: 400, code: 'NOTE_REQUIRED' });
    }
  }

  await followUp.update(filtered);

  const notes = [];
  if (filtered.status !== undefined && valuesDiffer(beforeFollowUp.status, followUp.status)) {
    if (followUp.status === 'Done') {
      notes.push(`Follow-up completed for ${formatDateTimeForActivity(followUp.scheduledAt)}.`);
    } else if (followUp.status === 'Cancelled') {
      notes.push(`Follow-up cancelled for ${formatDateTimeForActivity(followUp.scheduledAt)}.`);
    } else {
      notes.push(`Follow-up status updated: ${beforeFollowUp.status} -> ${followUp.status}.`);
    }
  }
  if (filtered.scheduledAt !== undefined && valuesDiffer(beforeFollowUp.scheduledAt, followUp.scheduledAt)) {
    notes.push(`Follow-up rescheduled: ${formatDateTimeForActivity(beforeFollowUp.scheduledAt)} -> ${formatDateTimeForActivity(followUp.scheduledAt)}.`);
  }
  if (filtered.agentId !== undefined && valuesDiffer(beforeFollowUp.agentId, followUp.agentId)) {
    const [fromAgent, toAgent] = await Promise.all([
      beforeFollowUp.agentId ? Agent.findOne({ where: { id: beforeFollowUp.agentId, agencyId }, attributes: ['name'] }) : null,
      followUp.agentId ? Agent.findOne({ where: { id: followUp.agentId, agencyId }, attributes: ['name'] }) : null,
    ]);
    notes.push(`Follow-up owner updated: ${fromAgent?.name || 'Unassigned'} -> ${toAgent?.name || 'Unassigned'}.`);
  }
  if (filtered.note !== undefined && valuesDiffer(beforeFollowUp.note, followUp.note)) {
    notes.push(`Follow-up note updated: ${followUp.note || 'No note'}.`);
  } else if (followUp.note && notes.length) {
    notes.push(`Note: ${followUp.note}`);
  }

  if (notes.length) {
    await appendLeadActivityNote(leadId, requesterAgentId(requester), notes.join('\n'));
  }

  // Handle recurring follow-ups
  if (filtered.status === 'Done' && followUp.isRecurring && followUp.recurringInterval) {
    const nextDate = new Date(followUp.scheduledAt);
    if (followUp.recurringInterval === 'daily') nextDate.setDate(nextDate.getDate() + 1);
    else if (followUp.recurringInterval === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
    else if (followUp.recurringInterval === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
    else if (followUp.recurringInterval === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

    if (!followUp.recurringEndDate || nextDate <= new Date(followUp.recurringEndDate)) {
      await FollowUp.create({
        leadId,
        agencyId,
        agentId: followUp.agentId,
        scheduledAt: nextDate,
        note: followUp.note, // Or leave empty for fresh follow up
        status: 'Scheduled',
        type: followUp.type,
        isRecurring: true,
        recurringInterval: followUp.recurringInterval,
        recurringEndDate: followUp.recurringEndDate,
      });
      await appendLeadActivityNote(leadId, requesterAgentId(requester), `Recurring follow-up scheduled for ${formatDateTimeForActivity(nextDate)}.`);
    }
  }

  return FollowUp.findByPk(followUp.id, {
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name', 'email', 'phone'] }],
  });
}

async function deleteFollowUp(leadId, followUpId, agencyId, requester = null) {
  const where = { id: followUpId, leadId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;
  const followUp = await FollowUp.findOne({ where });
  if (!followUp) throw Object.assign(new Error('FollowUp not found'), { statusCode: 404 });
  await appendLeadActivityNote(
    leadId,
    requesterAgentId(requester),
    [
      `Follow-up deleted for ${formatDateTimeForActivity(followUp.scheduledAt)}.`,
      followUp.note ? `Note: ${followUp.note}` : '',
    ].filter(Boolean).join('\n')
  );
  await followUp.destroy();
  return { success: true };
}

/**
 * Lead Notes
 */
async function addNote(leadId, agencyId, agentId, content) {
  const lead = await Lead.findOne({ where: { id: leadId, agencyId } });
  if (!lead) throw Object.assign(new Error('Lead not found'), { statusCode: 404 });

  const note = await LeadNote.create({
    leadId,
    agentId,
    content,
  });

  return LeadNote.findByPk(note.id, {
    include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }]
  });
}

/**
 * Bulk-assign multiple leads to a single agent.
 * @param {string[]} leadIds - Array of lead IDs to assign
 * @param {string} agentId - Agent ID to assign leads to (null to unassign)
 * @param {string} agencyId - Agency ID for scoping
 * @returns {Promise<object>} { updated: number }
 */
async function bulkAssignLeads(leadIds, agentId, agencyId, requester = null) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw Object.assign(new Error('leadIds must be a non-empty array'), { statusCode: 400, code: 'INVALID_INPUT' });
  }

  if (leadIds.length > 100) {
    throw Object.assign(new Error('Cannot bulk-assign more than 100 leads at once'), { statusCode: 400, code: 'TOO_MANY_LEADS' });
  }

  let agent = null;
  if (agentId) {
    agent = await Agent.findOne({ where: { id: agentId, agencyId } });
    if (!agent) {
      throw Object.assign(new Error('Agent not found'), { statusCode: 404, code: 'AGENT_NOT_FOUND' });
    }
  }

  const existingLeads = await Lead.findAll({
    where: { id: { [Op.in]: leadIds }, agencyId },
    attributes: ['id', 'assignedAgentId'],
  });

  const [updated] = await Lead.update(
    { assignedAgentId: agentId || null },
    // individualHooks so the Lead afterUpdate hook fires per row and each linked
    // WhatsApp conversation follows its lead to the new owner.
    { where: { id: { [Op.in]: leadIds }, agencyId }, individualHooks: true }
  );

  if (updated > 0) {
    const previousAgentIds = [...new Set(existingLeads.map((lead) => lead.assignedAgentId).filter(Boolean))];
    const previousAgents = previousAgentIds.length
      ? await Agent.findAll({ where: { id: { [Op.in]: previousAgentIds }, agencyId }, attributes: ['id', 'name'] })
      : [];
    const previousAgentNameById = new Map(previousAgents.map((previousAgent) => [previousAgent.id, previousAgent.name]));
    const toName = agent?.name || 'Unassigned';
    await Promise.all(existingLeads.map((existingLead) => {
      if (!valuesDiffer(existingLead.assignedAgentId, agentId || null)) return null;
      const fromName = existingLead.assignedAgentId ? (previousAgentNameById.get(existingLead.assignedAgentId) || 'Unknown staff') : 'Unassigned';
      return appendLeadActivityNote(
        existingLead.id,
        requesterAgentId(requester),
        `Assignment updated: ${fromName} -> ${toName}.`
      );
    }));
  }

  // Send a single notification to the assigned agent
  if (agent && agent.phone && updated > 0) {
    const leads = await Lead.findAll({
      where: { id: { [Op.in]: leadIds }, agencyId },
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
    });

    const leadSummary = leads
      .map((l, i) => `${i + 1}. ${l.customer?.name || 'Unknown'} — ${l.destination || 'No destination'}`)
      .join('\n');

    const msg = `*${updated} Leads Assigned To You*\n\n${leadSummary}\n\nPlease follow up at your earliest convenience.`;
    whatsappService.sendSystemNotificationWhatsApp(agent.phone, msg, { agencyId }).catch(err => {
      console.error('Failed to send bulk-assign notification', err);
    });
  }

  return { updated };
}

module.exports = {
  listLeads,
  getLeadById,
  createLead,
  notifyAssignedAgent,
  updateLead,
  deleteLead,
  findLeastBusyAgent,
  bulkAssignLeads,
  getCustomerActivity,
  listFollowUps,
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  addNote,
};
