const { Op, fn, col, QueryTypes } = require('sequelize');
const {
  sequelize,
  Agency,
  Agent,
  Customer,
  Lead,
  Booking,
  Payment,
  Message,
  BotSession,
  FollowUp,
  PlatformAdmin,
  PlatformAuditLog,
} = require('../models');
const { logPlatformAction } = require('./platformAuditService');

const ACTIVE_CUSTOMER_MINUTES = 15;
const RECENT_CUSTOMER_HOURS = 24;
const MODULE_CATALOG = Object.freeze([
  // Core
  { path: '/leads', label: 'Leads', group: 'Core' },
  { path: '/follow-ups', label: 'Follow-ups', group: 'Core' },
  { path: '/bookings', label: 'Bookings', group: 'Core' },
  { path: '/quotations', label: 'Quotations', group: 'Core' },
  { path: '/customers', label: 'Customers', group: 'Core' },
  { path: '/whatsapp', label: 'WhatsApp', group: 'Core' },
  { path: '/missed-calls', label: 'Missed Calls', group: 'Core' },
  { path: '/agents', label: 'Users', group: 'Core' },
  { path: '/settings', label: 'Settings', group: 'Core' },
  { path: '/settings/vendor-types', label: 'Vendor Types', group: 'Settings' },
  // Workspace
  { path: '/properties', label: 'Properties', group: 'Workspace' },
  { path: '/itineraries', label: 'Itineraries', group: 'Workspace' },
  { path: '/packages', label: 'Packages', group: 'Workspace' },
  { path: '/cruises', label: 'Cruises', group: 'Workspace' },
  { path: '/visas', label: 'Visas', group: 'Workspace' },
  { path: '/services', label: 'Services', group: 'Workspace' },
  { path: '/vendors', label: 'Vendors', group: 'Workspace' },
  { path: '/vendor-payments', label: 'Vendor Payments', group: 'Workspace' },
  { path: '/accounts', label: 'Accounts', group: 'Workspace' },
  { path: '/website-builder', label: 'Website', group: 'Workspace' },
  { path: '/hrm', label: 'HR & Payroll', group: 'Workspace' },
  { path: '/analytics', label: 'Reports', group: 'Workspace' },
  { path: '/activity', label: 'Activity Log', group: 'Workspace' },
  { path: '/revenue', label: 'Revenue Reports', group: 'Workspace' },
  // Marketing
  { path: '/templates', label: 'Templates', group: 'Marketing' },
  { path: '/flows', label: 'Flows', group: 'Marketing' },
  { path: '/campaigns', label: 'Campaigns', group: 'Marketing' },
  { path: '/ads', label: 'Social Ads', group: 'Marketing' },
  { path: '/social', label: 'Social Media', group: 'Marketing' },
  { path: '/reviews', label: 'Reviews', group: 'Marketing' },
]);
const MODULE_PATHS = new Set(MODULE_CATALOG.map((item) => item.path));
const RANGE_DAYS = Object.freeze({
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
});

function subMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function subHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function normalizeRange(value = '30d') {
  const key = String(value || '30d').toLowerCase();
  return RANGE_DAYS[key] ? key : '30d';
}

function rangeStart(range = '30d') {
  const days = RANGE_DAYS[normalizeRange(range)];
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function buildDayBuckets(start) {
  const buckets = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    buckets.push({
      date: iso,
      label: cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeModules(input) {
  if (!Array.isArray(input)) return null;
  const seen = new Set();
  const normalized = input
    .map((value) => String(value || '').trim())
    .filter((value) => MODULE_PATHS.has(value) && !seen.has(value) && seen.add(value));
  return normalized.length > 0 ? normalized : [];
}

function moduleLabels(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return ['All modules'];
  const labels = MODULE_CATALOG
    .filter((item) => paths.includes(item.path))
    .map((item) => item.label);
  return labels.length ? labels : ['Custom'];
}

async function dailyCounts(tableName, dateColumn, start, whereSql = '', replacements = {}) {
  const rows = await sequelize.query(
    `
      select date_trunc('day', ${dateColumn})::date as day, count(*)::int as value
      from ${tableName}
      where ${dateColumn} >= :start
      ${whereSql}
      group by 1
      order by 1 asc
    `,
    { replacements: { start, ...replacements }, type: QueryTypes.SELECT }
  );

  const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), toNumber(row.value)]));
  return buildDayBuckets(start).map((bucket) => ({ ...bucket, value: byDay.get(bucket.date) || 0 }));
}

async function dailyPaymentRevenue(start) {
  const rows = await sequelize.query(
    `
      select date_trunc('day', coalesce(paid_at, created_at))::date as day, coalesce(sum(amount), 0)::bigint as value
      from payments
      where status = 'PAID' and coalesce(paid_at, created_at) >= :start
      group by 1
      order by 1 asc
    `,
    { replacements: { start }, type: QueryTypes.SELECT }
  );

  const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), toNumber(row.value)]));
  return buildDayBuckets(start).map((bucket) => ({ ...bucket, value: byDay.get(bucket.date) || 0 }));
}

async function dailyMessageHealth(start) {
  const [volumeRows, failedRows] = await Promise.all([
    sequelize.query(
      `
        select date_trunc('day', "timestamp")::date as day, count(*)::int as value
        from messages
        where "timestamp" >= :start
        group by 1
        order by 1 asc
      `,
      { replacements: { start }, type: QueryTypes.SELECT }
    ),
    sequelize.query(
      `
        select date_trunc('day', "timestamp")::date as day, count(*)::int as value
        from messages
        where "timestamp" >= :start and status = 'FAILED'
        group by 1
        order by 1 asc
      `,
      { replacements: { start }, type: QueryTypes.SELECT }
    ),
  ]);

  const volumeByDay = new Map(volumeRows.map((row) => [new Date(row.day).toISOString().slice(0, 10), toNumber(row.value)]));
  const failedByDay = new Map(failedRows.map((row) => [new Date(row.day).toISOString().slice(0, 10), toNumber(row.value)]));

  return buildDayBuckets(start).map((bucket) => {
    const messages = volumeByDay.get(bucket.date) || 0;
    const failed = failedByDay.get(bucket.date) || 0;
    return {
      ...bucket,
      messages,
      failed,
      failedRate: messages > 0 ? Math.round((failed / messages) * 100) : 0,
    };
  });
}

function agentStatus(agent) {
  if (agent.isOnline && agent.lastSeenAt && new Date(agent.lastSeenAt) < subHours(8)) {
    return 'STALE_ONLINE';
  }
  if (agent.isOnline) return 'ONLINE';
  if (agent.lastSeenAt && new Date(agent.lastSeenAt) >= subHours(24)) return 'RECENT';
  return 'OFFLINE';
}

function customerActivityStatus(session, lastMessageAt) {
  if (session?.isHandedOff) return 'Handed off';

  const latest = [session?.lastActivityAt, lastMessageAt]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .sort((a, b) => b - a)[0];

  if (!latest) return 'No activity';

  const ageMs = Date.now() - latest;
  if (ageMs <= ACTIVE_CUSTOMER_MINUTES * 60 * 1000) return 'Active now';
  if (ageMs <= RECENT_CUSTOMER_HOURS * 60 * 60 * 1000) return 'Recent';
  return 'Idle';
}

function computeHealthScore(agency, metrics) {
  let score = 100;
  if (!agency.isActive) score -= 35;
  if (agency.whatsappConnectionStatus !== 'CONNECTED') score -= 30;
  score -= Math.min(25, metrics.failedMessages24h * 5);
  score -= Math.min(20, metrics.overdueFollowUps * 3);
  score -= Math.min(10, metrics.staleOnlineAgents * 5);
  return Math.max(0, score);
}

function healthLabel(score) {
  if (score >= 85) return 'Healthy';
  if (score >= 65) return 'Watch';
  if (score >= 40) return 'At risk';
  return 'Critical';
}

async function agencyMetrics(agencyId, range = '30d') {
  const since24h = subHours(24);
  const since15m = subMinutes(ACTIVE_CUSTOMER_MINUTES);
  const sinceRange = rangeStart(range);
  const now = new Date();

  const [
    totalAgents,
    onlineAgents,
    staleOnlineAgents,
    activeCustomers,
    recentCustomers,
    failedMessages24h,
    overdueFollowUps,
    totalLeads,
    totalBookings,
    totalRevenue,
    leadsInRange,
    bookingsInRange,
    paidRevenueInRange,
    pendingPaymentValue,
    failedMessagesInRange,
    lastMessage,
    lastSession,
  ] = await Promise.all([
    Agent.count({ where: { agencyId } }),
    Agent.count({ where: { agencyId, isOnline: true } }),
    Agent.count({ where: { agencyId, isOnline: true, lastSeenAt: { [Op.lt]: subHours(8) } } }),
    BotSession.count({ where: { agencyId, lastActivityAt: { [Op.gte]: since15m } } }),
    BotSession.count({ where: { agencyId, lastActivityAt: { [Op.gte]: since24h } } }),
    Message.count({ where: { agencyId, status: 'FAILED', timestamp: { [Op.gte]: since24h } } }),
    FollowUp.count({ where: { agencyId, status: 'Scheduled', scheduledAt: { [Op.lt]: now } } }),
    Lead.count({ where: { agencyId } }),
    Booking.count({ where: { agencyId } }),
    Payment.sum('amount', { where: { agencyId, status: 'PAID' } }),
    Lead.count({ where: { agencyId, createdAt: { [Op.gte]: sinceRange } } }),
    Booking.count({ where: { agencyId, createdAt: { [Op.gte]: sinceRange } } }),
    Payment.sum('amount', {
      where: {
        agencyId,
        status: 'PAID',
        [Op.or]: [
          { paidAt: { [Op.gte]: sinceRange } },
          { createdAt: { [Op.gte]: sinceRange } },
        ],
      },
    }),
    Payment.sum('amount', { where: { agencyId, status: 'PENDING' } }),
    Message.count({ where: { agencyId, status: 'FAILED', timestamp: { [Op.gte]: sinceRange } } }),
    Message.findOne({ where: { agencyId }, order: [['timestamp', 'DESC']], attributes: ['timestamp'], raw: true }),
    BotSession.findOne({ where: { agencyId }, order: [['lastActivityAt', 'DESC']], attributes: ['lastActivityAt'], raw: true }),
  ]);

  const lastActivityAt = [lastMessage?.timestamp, lastSession?.lastActivityAt]
    .filter(Boolean)
    .map((value) => new Date(value))
    .sort((a, b) => b - a)[0] || null;

  return {
    totalAgents,
    onlineAgents,
    staleOnlineAgents,
    activeCustomers,
    recentCustomers,
    failedMessages24h,
    overdueFollowUps,
    totalLeads,
    totalBookings,
    totalRevenue: totalRevenue || 0,
    leadsInRange,
    bookingsInRange,
    paidRevenueInRange: paidRevenueInRange || 0,
    pendingPaymentValue: pendingPaymentValue || 0,
    failedMessagesInRange,
    lastActivityAt,
  };
}

async function decorateAgency(agency, range = '30d') {
  const metrics = await agencyMetrics(agency.id, range);
  const healthScore = computeHealthScore(agency, metrics);
  const json = agency.toJSON();
  return {
    ...json,
    metrics,
    healthScore,
    healthLabel: healthLabel(healthScore),
    enabledModuleLabels: moduleLabels(json.sidebarPreferences),
  };
}

async function getOverview(range = '30d') {
  const since24h = subHours(24);
  const since15m = subMinutes(ACTIVE_CUSTOMER_MINUTES);
  const sinceToday = rangeStart('today');
  const since7d = rangeStart('7d');
  const since30d = rangeStart('30d');
  const sinceRange = rangeStart(range);
  const now = new Date();

  const [
    totalAgencies,
    activeAgencies,
    connectedWhatsApp,
    agentsOnline,
    activeCustomers,
    failedMessages24h,
    overdueFollowUps,
    paidRevenue,
    pendingPaymentValue,
    leads24h,
    bookings24h,
    leadsToday,
    leads7d,
    leads30d,
    bookingsToday,
    bookings7d,
    bookings30d,
    staleOnlineAgents,
    pendingWhatsApp,
    failedWhatsApp,
    notConnectedWhatsApp,
  ] = await Promise.all([
    Agency.count(),
    Agency.count({ where: { isActive: true } }),
    Agency.count({ where: { whatsappConnectionStatus: 'CONNECTED' } }),
    Agent.count({ where: { isOnline: true } }),
    BotSession.count({ where: { lastActivityAt: { [Op.gte]: since15m } } }),
    Message.count({ where: { status: 'FAILED', timestamp: { [Op.gte]: since24h } } }),
    FollowUp.count({ where: { status: 'Scheduled', scheduledAt: { [Op.lt]: now } } }),
    Payment.sum('amount', { where: { status: 'PAID' } }),
    Payment.sum('amount', { where: { status: 'PENDING' } }),
    Lead.count({ where: { createdAt: { [Op.gte]: since24h } } }),
    Booking.count({ where: { createdAt: { [Op.gte]: since24h } } }),
    Lead.count({ where: { createdAt: { [Op.gte]: sinceToday } } }),
    Lead.count({ where: { createdAt: { [Op.gte]: since7d } } }),
    Lead.count({ where: { createdAt: { [Op.gte]: since30d } } }),
    Booking.count({ where: { createdAt: { [Op.gte]: sinceToday } } }),
    Booking.count({ where: { createdAt: { [Op.gte]: since7d } } }),
    Booking.count({ where: { createdAt: { [Op.gte]: since30d } } }),
    Agent.count({ where: { isOnline: true, lastSeenAt: { [Op.lt]: subHours(8) } } }),
    Agency.count({ where: { whatsappConnectionStatus: 'PENDING' } }),
    Agency.count({ where: { whatsappConnectionStatus: 'FAILED' } }),
    Agency.count({ where: { whatsappConnectionStatus: 'NOT_CONNECTED' } }),
  ]);

  const [
    planBreakdown,
    whatsappBreakdown,
    leadTrend,
    bookingTrend,
    revenueTrend,
    messageTrend,
    agencies,
  ] = await Promise.all([
    Agency.findAll({
      attributes: ['plan', [fn('COUNT', col('id')), 'count']],
      group: ['plan'],
      raw: true,
    }),
    Agency.findAll({
      attributes: ['whatsappConnectionStatus', [fn('COUNT', col('id')), 'count']],
      group: ['whatsappConnectionStatus'],
      raw: true,
    }),
    dailyCounts('leads', 'created_at', sinceRange),
    dailyCounts('bookings', 'created_at', sinceRange),
    dailyPaymentRevenue(sinceRange),
    dailyMessageHealth(sinceRange),
    listAgencies({ limit: 250, range }),
  ]);

  const healthDistribution = ['Healthy', 'Watch', 'At risk', 'Critical'].map((label) => ({
    label,
    count: agencies.filter((agency) => agency.healthLabel === label).length,
  }));

  const riskRadar = agencies
    .map((agency) => {
      const reasons = [];
      if (!agency.isActive) reasons.push('Suspended');
      if (agency.whatsappConnectionStatus !== 'CONNECTED') reasons.push('WhatsApp disconnected');
      if (agency.metrics.failedMessages24h > 0) reasons.push(`${agency.metrics.failedMessages24h} failed messages`);
      if (agency.metrics.overdueFollowUps > 0) reasons.push(`${agency.metrics.overdueFollowUps} overdue follow-ups`);
      if (!agency.metrics.lastActivityAt) reasons.push('No recorded activity');
      else if (new Date(agency.metrics.lastActivityAt) < subHours(72)) reasons.push('No recent activity');
      return {
        id: agency.id,
        name: agency.name,
        email: agency.email,
        plan: agency.plan,
        healthScore: agency.healthScore,
        healthLabel: agency.healthLabel,
        whatsappConnectionStatus: agency.whatsappConnectionStatus,
        lastActivityAt: agency.metrics.lastActivityAt,
        reasons,
      };
    })
    .filter((agency) => agency.reasons.length > 0)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 12);

  return {
    range: normalizeRange(range),
    moduleCatalog: MODULE_CATALOG,
    totals: {
      totalAgencies,
      activeAgencies,
      suspendedAgencies: totalAgencies - activeAgencies,
      connectedWhatsApp,
      pendingWhatsApp,
      failedWhatsApp,
      notConnectedWhatsApp,
      agentsOnline,
      staleOnlineAgents,
      activeCustomers,
      failedMessages24h,
      overdueFollowUps,
      paidRevenue: paidRevenue || 0,
      pendingPaymentValue: pendingPaymentValue || 0,
      leads24h,
      bookings24h,
      leadsToday,
      leads7d,
      leads30d,
      bookingsToday,
      bookings7d,
      bookings30d,
    },
    planBreakdown: planBreakdown.map((row) => ({ label: row.plan || 'UNKNOWN', count: toNumber(row.count) })),
    whatsappBreakdown: whatsappBreakdown.map((row) => ({ label: row.whatsappConnectionStatus || 'UNKNOWN', count: toNumber(row.count) })),
    healthDistribution,
    trends: {
      leads: leadTrend,
      bookings: bookingTrend,
      revenue: revenueTrend,
      messages: messageTrend,
    },
    riskRadar,
  };
}

async function listAgencies(filters = {}) {
  const range = normalizeRange(filters.range);
  const where = {};
  if (filters.status === 'active') where.isActive = true;
  if (filters.status === 'suspended') where.isActive = false;
  if (filters.plan) where.plan = filters.plan;
  if (filters.whatsapp) where.whatsappConnectionStatus = filters.whatsapp;
  if (filters.q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.q}%` } },
      { email: { [Op.iLike]: `%${filters.q}%` } },
      { phone: { [Op.iLike]: `%${filters.q}%` } },
      { whatsappNumber: { [Op.iLike]: `%${filters.q}%` } },
    ];
  }

  const agencies = await Agency.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(parseInt(filters.limit || '100', 10), 250),
  });

  return Promise.all(agencies.map((agency) => decorateAgency(agency, range)));
}

async function getAgencyDetail(agencyId, platformAdminId, req, range = '30d') {
  const normalizedRange = normalizeRange(range);
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'PLATFORM_AGENCY_NOT_FOUND' });
  }

  const decorated = await decorateAgency(agency, normalizedRange);
  const sinceRange = rangeStart(normalizedRange);

  const [agents, recentSessions, latestMessages, failedMessages, overdueFollowUps, leadTrend, bookingTrend, revenueTrend, messageTrend] = await Promise.all([
    Agent.findAll({
      where: { agencyId },
      attributes: ['id', 'name', 'email', 'phone', 'role', 'isOnline', 'lastSeenAt', 'createdAt'],
      order: [['isOnline', 'DESC'], ['lastSeenAt', 'DESC']],
      raw: true,
    }),
    BotSession.findAll({
      where: { agencyId },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'source'] }],
      order: [['lastActivityAt', 'DESC']],
      limit: 30,
    }),
    Message.findAll({
      where: { agencyId },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
      order: [['timestamp', 'DESC']],
      limit: 30,
    }),
    Message.findAll({
      where: { agencyId, status: 'FAILED' },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
      order: [['timestamp', 'DESC']],
      limit: 20,
    }),
    FollowUp.findAll({
      where: { agencyId, status: 'Scheduled', scheduledAt: { [Op.lt]: new Date() } },
      include: [
        { model: Agent, as: 'agent', attributes: ['id', 'name', 'email'] },
        { model: Lead, as: 'lead', attributes: ['id', 'destination', 'status'] },
      ],
      order: [['scheduledAt', 'ASC']],
      limit: 20,
    }),
    dailyCounts('leads', 'created_at', sinceRange, 'and agency_id = :agencyId', { agencyId }),
    dailyCounts('bookings', 'created_at', sinceRange, 'and agency_id = :agencyId', { agencyId }),
    sequelize.query(
      `
        select date_trunc('day', coalesce(paid_at, created_at))::date as day, coalesce(sum(amount), 0)::bigint as value
        from payments
        where status = 'PAID' and coalesce(paid_at, created_at) >= :start and agency_id = :agencyId
        group by 1
        order by 1 asc
      `,
      { replacements: { start: sinceRange, agencyId }, type: QueryTypes.SELECT }
    ).then((rows) => {
      const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), toNumber(row.value)]));
      return buildDayBuckets(sinceRange).map((bucket) => ({ ...bucket, value: byDay.get(bucket.date) || 0 }));
    }),
    sequelize.query(
      `
        select date_trunc('day', "timestamp")::date as day,
               count(*)::int as messages,
               count(*) filter (where status = 'FAILED')::int as failed
        from messages
        where "timestamp" >= :start and agency_id = :agencyId
        group by 1
        order by 1 asc
      `,
      { replacements: { start: sinceRange, agencyId }, type: QueryTypes.SELECT }
    ).then((rows) => {
      const byDay = new Map(rows.map((row) => [new Date(row.day).toISOString().slice(0, 10), row]));
      return buildDayBuckets(sinceRange).map((bucket) => {
        const row = byDay.get(bucket.date) || {};
        const messages = toNumber(row.messages);
        const failed = toNumber(row.failed);
        return { ...bucket, messages, failed, failedRate: messages > 0 ? Math.round((failed / messages) * 100) : 0 };
      });
    }),
  ]);

  const latestByCustomer = {};
  latestMessages.forEach((message) => {
    if (!latestByCustomer[message.customerId]) {
      latestByCustomer[message.customerId] = message.timestamp;
    }
  });

  const customerActivity = recentSessions.map((session) => {
    const json = session.toJSON();
    const lastMessageAt = latestByCustomer[json.customerId] || null;
    return {
      id: json.customer?.id || json.customerId,
      name: json.customer?.name || 'Traveler',
      phone: json.customer?.phone,
      source: json.customer?.source,
      currentStep: json.currentStep,
      isHandedOff: json.isHandedOff,
      handedOffAt: json.handedOffAt,
      lastActivityAt: json.lastActivityAt,
      lastMessageAt,
      status: customerActivityStatus(json, lastMessageAt),
    };
  });

  await logPlatformAction(platformAdminId, 'PLATFORM_AGENCY_VIEW', {
    targetType: 'Agency',
    targetId: agencyId,
    req,
  });

  return {
    range: normalizedRange,
    moduleCatalog: MODULE_CATALOG,
    agency: decorated,
    agents: agents.map((agent) => ({ ...agent, status: agentStatus(agent) })),
    customerActivity,
    recentMessages: latestMessages.map((message) => message.toJSON()),
    failedMessages: failedMessages.map((message) => message.toJSON()),
    overdueFollowUps: overdueFollowUps.map((followUp) => followUp.toJSON()),
    trends: {
      leads: leadTrend,
      bookings: bookingTrend,
      revenue: revenueTrend,
      messages: messageTrend,
    },
  };
}

async function updateAgencyStatus(agencyId, isActive, platformAdminId, req) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'PLATFORM_AGENCY_NOT_FOUND' });
  }

  await agency.update({ isActive: !!isActive });
  await logPlatformAction(platformAdminId, isActive ? 'PLATFORM_AGENCY_REACTIVATE' : 'PLATFORM_AGENCY_SUSPEND', {
    targetType: 'Agency',
    targetId: agency.id,
    metadata: { agencyName: agency.name, isActive: !!isActive },
    req,
  });

  return decorateAgency(agency);
}

async function updateAgencyModules(agencyId, modules, platformAdminId, req) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'PLATFORM_AGENCY_NOT_FOUND' });
  }

  const normalizedModules = normalizeModules(modules);
  if (normalizedModules === null) {
    throw Object.assign(new Error('Modules must be an array of valid module paths'), {
      statusCode: 400,
      code: 'INVALID_PLATFORM_MODULES',
      details: { allowedModules: MODULE_CATALOG },
    });
  }

  await agency.update({ sidebarPreferences: normalizedModules });
  await logPlatformAction(platformAdminId, 'PLATFORM_AGENCY_MODULES_UPDATE', {
    targetType: 'Agency',
    targetId: agency.id,
    metadata: { agencyName: agency.name, sidebarPreferences: normalizedModules },
    req,
  });

  return decorateAgency(agency);
}

async function getHealth() {
  const agencies = await listAgencies({ limit: 250 });
  const urgent = agencies
    .filter((agency) => agency.healthScore < 85 || !agency.isActive || agency.metrics.failedMessages24h > 0 || agency.metrics.overdueFollowUps > 0)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 20);

  return {
    urgent,
    generatedAt: new Date().toISOString(),
  };
}

async function getActivity() {
  const logs = await PlatformAuditLog.findAll({
    include: [{ model: PlatformAdmin, as: 'admin', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  return logs.map((log) => log.toJSON());
}

module.exports = {
  getOverview,
  listAgencies,
  getAgencyDetail,
  updateAgencyStatus,
  updateAgencyModules,
  getHealth,
  getActivity,
  MODULE_CATALOG,
};
