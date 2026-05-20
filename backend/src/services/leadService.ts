// FILE: /backend/src/services/leadService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Lead, Customer, Agent, Package, Property, Campaign, Message, Booking, FollowUp, LeadNote } = require('../models');
const { normalizePhone, isValidIndianPhone } = require('../utils/phoneUtils');
const whatsappService = require('./whatsappService');

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
    .filter((item) => ['PACKAGE', 'PROPERTY'].includes(item.itemType) && item.itemId)
    .filter((item) => {
      const key = `${item.itemType}:${item.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
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
    'checkInDate',
    'checkOutDate',
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
      'departureAirport',
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
    dateFrom,
    dateTo,
    page = 1,
    pageSize = 20,
  } = filters;

  const where = scopedLeadWhere(agencyId, requester);
  const andConditions = [];
  const closedStatuses = ['CONVERTED', 'LOST', 'CANCELLED'];

  if (status) {
    if (Array.isArray(status)) {
      where.status = { [Op.in]: status };
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
  const activeStatusWhere = { status: { [Op.notIn]: closedStatuses } };
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
  const include = [
    { model: Customer, as: 'customer' },
    { model: Agent, as: 'assignedAgent', attributes: ['id', 'name', 'email'] },
    { model: Package, as: 'package', attributes: ['id', 'name', 'basePrice'] },
    { model: Property, as: 'property', attributes: ['id', 'name', 'propertyType', 'location', 'pricePerNight'] },
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
  const countForWhere = (extraWhere = {}) => Lead.count({ where: { ...countBaseWhere, ...extraWhere } });
  const statusKeys = ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'CONVERTED', 'LOST', 'CANCELLED', 'UNKNOWN'];
  const [allCount, attentionCount, convertedCount, lostCount, statusPairs] = await Promise.all([
    countForWhere(),
    countForWhere(attentionWhere),
    countForWhere({ status: 'CONVERTED' }),
    countForWhere({ status: 'LOST' }),
    Promise.all(statusKeys.map(async (key) => [key, await countForWhere({ status: key })])),
  ]);
  const statusCounts = Object.fromEntries(statusPairs);

  return {
    data: rows.map(enrichLeadPayload),
    total: count,
    page: currentPage,
    pageSize: limit,
    counts: {
      'All Leads': allCount,
      'Needs Attention': attentionCount,
      ...statusCounts,
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
      { model: Package, as: 'package' },
      { model: Property, as: 'property' },
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
  });

  if (!isCustomTripLead && leadJson.packageId) selectedPackageIds.add(leadJson.packageId);
  if (leadJson.propertyId) selectedPropertyIds.add(leadJson.propertyId);

  const [followUps, notes, messages, selectedPackages, selectedProperties] = await Promise.all([
    FollowUp.findAll({ where: { leadId, agencyId }, order: [['scheduledAt', 'ASC']] }),
    LeadNote.findAll({ 
      where: { leadId }, 
      include: [{ model: Agent, as: 'agent', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']] 
    }),
    Message.findAll({
      where: { customerId: lead.customerId, agencyId },
      order: [['timestamp', 'DESC']],
      limit: 20,
    }),
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
  ];

  return {
    ...enrichLeadPayload({ ...leadJson, selectedCatalogItems }),
    messages: messages.reverse(),
    followUps,
    notesList: notes,
    selectedPackages,
    selectedProperties,
    selectedCatalogItems,
  };
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
  if (!rawPhone) {
    throw Object.assign(new Error('Customer phone is required'), { statusCode: 400, code: 'CUSTOMER_PHONE_REQUIRED' });
  }

  const phone = normalizePhone(rawPhone);
  if (!isValidIndianPhone(phone)) {
    throw Object.assign(new Error('Invalid customer phone'), { statusCode: 400, code: 'INVALID_CUSTOMER_PHONE' });
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
    travelDates,
    travellers,
    budgetPerPerson,
    interest,
    notes,
    assignedAgentId,
    packageId,
    propertyId,
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
    status = 'NEW',
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

  const lead = await Lead.create({
    customerId: customer.id,
    agencyId,
    assignedAgentId: assignedAgentId || null,
    destination,
    travelDates,
    travellers,
    budgetPerPerson,
    interest,
    packageId: packageId || null,
    propertyId: propertyId || null,
    itemType: itemType || (propertyId ? 'PROPERTY' : packageId ? 'PACKAGE' : null),
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
    status,
    source: data.source || customer.source || 'whatsapp_organic',
  });

  const fullLead = await getLeadById(lead.id, agencyId);

  if (lead.status === 'CONVERTED') {
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  if (assignedAgentId) {
    const agent = fullLead.assignedAgent;
    if (agent && agent.phone) {
      const pkgName = fullLead.package ? fullLead.package.name : 'None';
      const msg = `*New Lead Assigned*\n\nCustomer: ${fullLead.customer?.name || 'Unknown'}\nPhone: ${fullLead.customer?.phone || 'Unknown'}\nDestination: ${fullLead.destination || 'Not specified'}\nPackage: ${pkgName}\nEnquiry Date: ${fullLead.createdAt ? new Date(fullLead.createdAt).toDateString() : new Date().toDateString()}`;
      whatsappService.sendSystemNotificationWhatsApp(agent.phone, msg, { agencyId }).catch(err => {
        console.error('Failed to send agent notification', err);
      });
    }
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

  const allowedFields = [
    'status', 'assignedAgentId', 'destination', 'travelDates',
    'travellers', 'budgetPerPerson', 'packageId', 'propertyId', 'itemType',
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
  if (filtered.tags !== undefined) filtered.tags = normalizeTags(filtered.tags);
  if (filtered.selectedItems !== undefined) filtered.selectedItems = normalizeSelectedItems(filtered.selectedItems);
  if (filtered.customTripDetails !== undefined) filtered.customTripDetails = normalizeCustomTripDetails(filtered.customTripDetails);
  if (filtered.packageId) await assertPackageBelongsToAgency(filtered.packageId, agencyId);
  if (filtered.propertyId) await assertPropertyBelongsToAgency(filtered.propertyId, agencyId);
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
  const shouldNotifyAssignedAgent = !!updates.assignedAgentId && (hasAssignmentUpdate || lead.assignedAgentId !== updates.assignedAgentId);
  await lead.update(filtered);

  if (filtered.status === 'CONVERTED') {
    const customer = await Customer.findByPk(lead.customerId);
    if (customer && !customer.isCustomer) {
      await customer.update({ isCustomer: true });
    }
  }

  if (shouldNotifyAssignedAgent) {
    const fullLead = await getLeadById(lead.id, agencyId, { role: 'ADMIN' });
    const agent = fullLead.assignedAgent;
    if (agent && agent.phone) {
      const pkgName = fullLead.package ? fullLead.package.name : 'None';
      const msg = `*New Lead Assigned*\n\nCustomer: ${fullLead.customer?.name || 'Unknown'}\nPhone: ${fullLead.customer?.phone || 'Unknown'}\nDestination: ${fullLead.destination || 'Not specified'}\nPackage: ${pkgName}\nEnquiry Date: ${fullLead.createdAt ? new Date(fullLead.createdAt).toDateString() : new Date().toDateString()}`;
      whatsappService.sendSystemNotificationWhatsApp(agent.phone, msg, { agencyId }).catch(err => {
        console.error('Failed to send agent notification', err);
      });
    }
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
  const agents = await Agent.findAll({
    where: { agencyId, isOnline: true },
    attributes: ['id', 'name', 'email', 'phone'],
  });

  if (agents.length === 0) return null;

  // Count active leads per agent
  const agentLoads = await Promise.all(
    agents.map(async (agent) => {
      const count = await Lead.count({
        where: {
          assignedAgentId: agent.id,
          status: { [Op.in]: ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
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
  const { scheduledAt, note, agentId } = data;
  const lead = await Lead.findOne({ where: scopedLeadWhere(agencyId, requester, { id: leadId }) });
  if (!lead) throw Object.assign(new Error('Lead not found'), { statusCode: 404 });

  const followUp = await FollowUp.create({
    leadId,
    agencyId,
    agentId: isAdmin(requester) ? (agentId || lead.assignedAgentId || null) : requester?.id,
    scheduledAt,
    note,
    status: 'Scheduled',
  });

  return followUp;
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

  const allowed = ['status', 'scheduledAt', 'note', 'agentId'];
  const filtered = {};
  for(const k of allowed) if (updates[k] !== undefined) filtered[k] = updates[k];
  if (!isAdmin(requester)) delete filtered.agentId;

  await followUp.update(filtered);
  return followUp;
}

async function deleteFollowUp(leadId, followUpId, agencyId, requester = null) {
  const where = { id: followUpId, leadId, agencyId };
  if (!isAdmin(requester)) where.agentId = requester?.id;
  const followUp = await FollowUp.findOne({ where });
  if (!followUp) throw Object.assign(new Error('FollowUp not found'), { statusCode: 404 });
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
async function bulkAssignLeads(leadIds, agentId, agencyId) {
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

  const [updated] = await Lead.update(
    { assignedAgentId: agentId || null },
    { where: { id: { [Op.in]: leadIds }, agencyId } }
  );

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
  updateLead,
  deleteLead,
  findLeastBusyAgent,
  bulkAssignLeads,
  listFollowUps,
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  addNote,
};
