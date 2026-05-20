const { Op, fn, col } = require('sequelize');
const {
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

function subMinutes(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function subHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
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

async function agencyMetrics(agencyId) {
  const since24h = subHours(24);
  const since15m = subMinutes(ACTIVE_CUSTOMER_MINUTES);
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
    lastActivityAt,
  };
}

async function decorateAgency(agency) {
  const metrics = await agencyMetrics(agency.id);
  const healthScore = computeHealthScore(agency, metrics);
  return {
    ...agency.toJSON(),
    metrics,
    healthScore,
    healthLabel: healthLabel(healthScore),
  };
}

async function getOverview() {
  const since24h = subHours(24);
  const since15m = subMinutes(ACTIVE_CUSTOMER_MINUTES);
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
    leads24h,
    bookings24h,
  ] = await Promise.all([
    Agency.count(),
    Agency.count({ where: { isActive: true } }),
    Agency.count({ where: { whatsappConnectionStatus: 'CONNECTED' } }),
    Agent.count({ where: { isOnline: true } }),
    BotSession.count({ where: { lastActivityAt: { [Op.gte]: since15m } } }),
    Message.count({ where: { status: 'FAILED', timestamp: { [Op.gte]: since24h } } }),
    FollowUp.count({ where: { status: 'Scheduled', scheduledAt: { [Op.lt]: now } } }),
    Payment.sum('amount', { where: { status: 'PAID' } }),
    Lead.count({ where: { createdAt: { [Op.gte]: since24h } } }),
    Booking.count({ where: { createdAt: { [Op.gte]: since24h } } }),
  ]);

  const planBreakdown = await Agency.findAll({
    attributes: ['plan', [fn('COUNT', col('id')), 'count']],
    group: ['plan'],
    raw: true,
  });

  const whatsappBreakdown = await Agency.findAll({
    attributes: ['whatsappConnectionStatus', [fn('COUNT', col('id')), 'count']],
    group: ['whatsappConnectionStatus'],
    raw: true,
  });

  return {
    totals: {
      totalAgencies,
      activeAgencies,
      suspendedAgencies: totalAgencies - activeAgencies,
      connectedWhatsApp,
      agentsOnline,
      activeCustomers,
      failedMessages24h,
      overdueFollowUps,
      paidRevenue: paidRevenue || 0,
      leads24h,
      bookings24h,
    },
    planBreakdown,
    whatsappBreakdown,
  };
}

async function listAgencies(filters = {}) {
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

  return Promise.all(agencies.map(decorateAgency));
}

async function getAgencyDetail(agencyId, platformAdminId, req) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) {
    throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'PLATFORM_AGENCY_NOT_FOUND' });
  }

  const decorated = await decorateAgency(agency);

  const [agents, recentSessions, latestMessages, failedMessages, overdueFollowUps] = await Promise.all([
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
    agency: decorated,
    agents: agents.map((agent) => ({ ...agent, status: agentStatus(agent) })),
    customerActivity,
    recentMessages: latestMessages.map((message) => message.toJSON()),
    failedMessages: failedMessages.map((message) => message.toJSON()),
    overdueFollowUps: overdueFollowUps.map((followUp) => followUp.toJSON()),
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
  getHealth,
  getActivity,
};
