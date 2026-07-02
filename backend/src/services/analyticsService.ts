// FILE: /backend/src/services/analyticsService.ts
// DEPS: sequelize

const { Op, fn, col, literal, cast } = require('sequelize');
const {
  Lead, Booking, Payment, Package, Customer, Agent,
  Message, Review, Campaign, CampaignRecipient,
  FollowUp, CallLog, sequelize,
} = require('../models');
const pipelineService = require('./pipelineService');

// ─── helpers ────────────────────────────────────────────────────────────────

function defaultRange(from, to) {
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400000);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function prevRange(start, end) {
  const diff = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - diff), end: new Date(start.getTime() - 1) };
}

// ─── 1. SALES REPORT ────────────────────────────────────────────────────────

async function getSalesReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);

  // Total revenue (paid payments)
  const totalRevenue = (await Payment.sum('amount', {
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [start, end] } },
  })) || 0;

  const prevRevenue = (await Payment.sum('amount', {
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [prev.start, prev.end] } },
  })) || 0;

  // Bookings count
  const totalBookings = await Booking.count({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  });

  const prevBookings = await Booking.count({
    where: { agencyId, createdAt: { [Op.between]: [prev.start, prev.end] } },
  });

  // Average booking value
  const avgBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

  // Outstanding balance
  const outstanding = (await Payment.sum('amount', {
    where: { agencyId, status: 'PENDING' },
  })) || 0;

  // Revenue by day
  const revenueByDay = await Payment.findAll({
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('paid_at')), 'date'],
      [fn('SUM', col('amount')), 'revenue'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('paid_at'))],
    order: [[fn('DATE', col('paid_at')), 'ASC']],
    raw: true,
  });

  // Revenue by month
  const revenueByMonth = await Payment.findAll({
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE_TRUNC', 'month', col('paid_at')), 'month'],
      [fn('SUM', col('amount')), 'revenue'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE_TRUNC', 'month', col('paid_at'))],
    order: [[fn('DATE_TRUNC', 'month', col('paid_at')), 'ASC']],
    raw: true,
  });

  // Revenue by package
  const revenueByPackage = await Payment.findAll({
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('SUM', col('Payment.amount')), 'revenue'],
      [fn('COUNT', col('Payment.id')), 'bookingCount'],
    ],
    include: [{
      model: Booking, as: 'booking', attributes: [],
      include: [{ model: Package, as: 'package', attributes: ['id', 'name', 'destinations'] }],
    }],
    group: ['booking.package.id'],
    order: [[literal('"revenue"'), 'DESC']],
    limit: 10,
    raw: false,
    subQuery: false,
  });

  // Revenue by destination (from booking → package → destinations array)
  const revenueByDestination = await sequelize.query(`
    SELECT unnest(p.destinations) AS destination,
           SUM(pay.amount) AS revenue,
           COUNT(DISTINCT b.id) AS booking_count
    FROM payments pay
    JOIN bookings b ON b.id = pay.booking_id
    JOIN packages p ON p.id = b.package_id
    WHERE pay.agency_id = :agencyId
      AND pay.status = 'PAID'
      AND pay.paid_at BETWEEN :start AND :end
      AND p.destinations IS NOT NULL
    GROUP BY unnest(p.destinations)
    ORDER BY revenue DESC
    LIMIT 10
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  return {
    totalRevenue,
    prevRevenue,
    revenueChange: prevRevenue > 0 ? parseFloat(((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)) : null,
    totalBookings,
    prevBookings,
    avgBookingValue,
    outstanding,
    revenueByDay,
    revenueByMonth,
    revenueByPackage,
    revenueByDestination,
  };
}

// ─── 2. LEAD & CONVERSION FUNNEL ────────────────────────────────────────────

async function getLeadFunnelReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);

  const totalLeads = await Lead.count({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  });

  const prevLeads = await Lead.count({
    where: { agencyId, createdAt: { [Op.between]: [prev.start, prev.end] } },
  });

  // Leads by status (only leads created in range)
  const leadsByStatus = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  // Build funnel counts
  const statusMap = {};
  leadsByStatus.forEach((r) => { statusMap[r.status] = parseInt(r.count, 10); });

  const funnel = [
    { stage: 'New Leads', count: totalLeads },
    { stage: 'Enquiry', count: (statusMap.ENQUIRY || 0) + (statusMap.CONTACTED || 0) + (statusMap.QUOTED || 0) + (statusMap.NEGOTIATING || 0) + (statusMap.BOOKED || 0) },
    { stage: 'Contacted', count: (statusMap.CONTACTED || 0) + (statusMap.QUOTED || 0) + (statusMap.NEGOTIATING || 0) + (statusMap.BOOKED || 0) },
    { stage: 'Quoted', count: (statusMap.QUOTED || 0) + (statusMap.NEGOTIATING || 0) + (statusMap.BOOKED || 0) },
    { stage: 'Booked', count: statusMap.BOOKED || 0 },
  ];

  const conversionRate = totalLeads > 0 ? parseFloat(((statusMap.BOOKED || 0) / totalLeads * 100).toFixed(1)) : 0;

  // Leads over time (by day)
  const leadsByDay = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  return {
    totalLeads,
    prevLeads,
    leadsChange: prevLeads > 0 ? parseFloat(((totalLeads - prevLeads) / prevLeads * 100).toFixed(1)) : null,
    leadsByStatus,
    funnel,
    conversionRate,
    leadsByDay,
  };
}

// ─── 3. AGENT PERFORMANCE ───────────────────────────────────────────────────

async function getAgentPerformanceReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // All agents in this agency
  const agents = await Agent.findAll({
    where: { agencyId },
    attributes: ['id', 'name', 'email', 'role'],
    raw: true,
  });

  const agentStats = [];

  for (const agent of agents) {
    // Leads assigned
    const leadsAssigned = await Lead.count({
      where: { agencyId, assignedAgentId: agent.id, createdAt: { [Op.between]: [start, end] } },
    });

    // Leads converted (BOOKED)
    const leadsConverted = await Lead.count({
      where: { agencyId, assignedAgentId: agent.id, status: 'BOOKED', createdAt: { [Op.between]: [start, end] } },
    });

    // Messages sent by agent
    const messagesSent = await Message.count({
      where: { agencyId, agentId: agent.id, direction: 'OUT', timestamp: { [Op.between]: [start, end] } },
    });

    // Revenue — sum payments from bookings where lead was assigned to this agent
    const revenueResult = await sequelize.query(`
      SELECT COALESCE(SUM(pay.amount), 0) AS revenue
      FROM payments pay
      JOIN bookings b ON b.id = pay.booking_id
      JOIN leads l ON l.id = b.lead_id
      WHERE l.assigned_agent_id = :agentId
        AND l.agency_id = :agencyId
        AND pay.status = 'PAID'
        AND pay.paid_at BETWEEN :start AND :end
    `, {
      replacements: { agentId: agent.id, agencyId, start, end },
      type: sequelize.QueryTypes.SELECT,
    });

    const conversionRate = leadsAssigned > 0
      ? parseFloat((leadsConverted / leadsAssigned * 100).toFixed(1))
      : 0;

    agentStats.push({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      leadsAssigned,
      leadsConverted,
      conversionRate,
      messagesSent,
      revenue: parseInt(revenueResult[0]?.revenue || '0', 10),
    });
  }

  // Sort by revenue desc
  agentStats.sort((a, b) => b.revenue - a.revenue);

  return { agents: agentStats };
}

// ─── 4. PACKAGE / DESTINATION REPORTS ────────────────────────────────────────

async function getPackageReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Most booked packages
  const packageStats = await Booking.findAll({
    where: {
      agencyId,
      packageId: { [Op.not]: null },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      'packageId',
      [fn('COUNT', col('Booking.id')), 'bookingCount'],
      [fn('SUM', col('Booking.total_amount')), 'totalRevenue'],
      [fn('AVG', col('Booking.travellers')), 'avgTravellers'],
    ],
    include: [{
      model: Package, as: 'package',
      attributes: ['id', 'name', 'basePrice', 'destinations', 'category', 'imageUrl'],
    }],
    group: ['packageId', 'package.id'],
    order: [[literal('"bookingCount"'), 'DESC']],
    raw: false,
  });

  // Leads per package (interest / enquiry level)
  const leadsByPackage = await Lead.findAll({
    where: {
      agencyId,
      packageId: { [Op.not]: null },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      'packageId',
      [fn('COUNT', col('Lead.id')), 'leadCount'],
    ],
    include: [{
      model: Package, as: 'package',
      attributes: ['id', 'name'],
    }],
    group: ['packageId', 'package.id'],
    order: [[literal('"leadCount"'), 'DESC']],
    raw: false,
  });

  // Merge lead count into package stats for conversion calculation
  const leadMap = {};
  leadsByPackage.forEach((r) => {
    leadMap[r.packageId] = parseInt(r.getDataValue('leadCount'), 10);
  });

  const packages = packageStats.map((r) => {
    const bookingCount = parseInt(r.getDataValue('bookingCount'), 10);
    const leads = leadMap[r.packageId] || 0;
    return {
      package: r.package,
      bookingCount,
      totalRevenue: parseInt(r.getDataValue('totalRevenue') || '0', 10),
      avgTravellers: parseFloat(parseFloat(r.getDataValue('avgTravellers') || '0').toFixed(1)),
      leads,
      conversionRate: leads > 0 ? parseFloat((bookingCount / leads * 100).toFixed(1)) : 0,
    };
  });

  return { packages };
}

// ─── 5. LOST LEADS REPORT ────────────────────────────────────────────────────

async function getLostLeadsReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  const lostCount = await Lead.count({
    where: { agencyId, status: { [Op.in]: ['LOST', 'CANCELLED'] }, createdAt: { [Op.between]: [start, end] } },
  });

  const totalLeads = await Lead.count({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  });

  const lossRate = totalLeads > 0 ? parseFloat((lostCount / totalLeads * 100).toFixed(1)) : 0;

  // Lost reasons breakdown
  const lostReasons = await Lead.findAll({
    where: {
      agencyId,
      status: { [Op.in]: ['LOST', 'CANCELLED'] },
      lostReason: { [Op.not]: null, [Op.ne]: '' },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      'lostReason',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['lostReason'],
    order: [[literal('"count"'), 'DESC']],
    raw: true,
  });

  const noReasonCount = await Lead.count({
    where: {
      agencyId,
      status: { [Op.in]: ['LOST', 'CANCELLED'] },
      [Op.or]: [{ lostReason: null }, { lostReason: '' }],
      createdAt: { [Op.between]: [start, end] },
    },
  });

  // Lost leads over time
  const lostByDay = await Lead.findAll({
    where: {
      agencyId,
      status: { [Op.in]: ['LOST', 'CANCELLED'] },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  return {
    lostCount,
    totalLeads,
    lossRate,
    lostReasons,
    noReasonCount,
    lostByDay,
  };
}

// ─── 6. RESPONSE & FOLLOW-UP REPORTS ────────────────────────────────────────

async function getResponseReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Average response time: time between first IN message and first OUT message per customer
  const avgResponseResult = await sequelize.query(`
    WITH conversations AS (
      SELECT
        customer_id,
        MIN(CASE WHEN direction = 'IN' THEN timestamp END) AS first_in,
        MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) AS first_reply
      FROM messages
      WHERE agency_id = :agencyId
        AND timestamp BETWEEN :start AND :end
      GROUP BY customer_id
      HAVING MIN(CASE WHEN direction = 'IN' THEN timestamp END) IS NOT NULL
         AND MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) IS NOT NULL
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM (first_reply - first_in))) AS avg_response_seconds,
      COUNT(*) AS conversation_count
    FROM conversations
    WHERE first_reply > first_in
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const avgResponseSeconds = parseFloat(avgResponseResult[0]?.avg_response_seconds || '0');
  const avgResponseMinutes = Math.round(avgResponseSeconds / 60);

  // Leads without any outbound message (not followed up)
  const missedFollowUps = await sequelize.query(`
    SELECT COUNT(DISTINCT l.id) AS count
    FROM leads l
    LEFT JOIN messages m ON m.customer_id = l.customer_id
      AND m.agency_id = l.agency_id
      AND m.direction = 'OUT'
      AND m.agent_id IS NOT NULL
    WHERE l.agency_id = :agencyId
      AND l.created_at BETWEEN :start AND :end
      AND l.status NOT IN ('BOOKED', 'LOST', 'CANCELLED')
      AND m.id IS NULL
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  // Response time distribution (buckets)
  const responseDistribution = await sequelize.query(`
    WITH conversations AS (
      SELECT
        customer_id,
        MIN(CASE WHEN direction = 'IN' THEN timestamp END) AS first_in,
        MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) AS first_reply
      FROM messages
      WHERE agency_id = :agencyId
        AND timestamp BETWEEN :start AND :end
      GROUP BY customer_id
      HAVING MIN(CASE WHEN direction = 'IN' THEN timestamp END) IS NOT NULL
         AND MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) IS NOT NULL
    )
    SELECT
      CASE
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 300 THEN 'Under 5 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 900 THEN '5-15 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 3600 THEN '15-60 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 86400 THEN '1-24 hours'
        ELSE 'Over 24 hours'
      END AS bucket,
      COUNT(*) AS count
    FROM conversations
    WHERE first_reply > first_in
    GROUP BY bucket
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  return {
    avgResponseMinutes,
    avgResponseSeconds: Math.round(avgResponseSeconds),
    conversationCount: parseInt(avgResponseResult[0]?.conversation_count || '0', 10),
    missedFollowUps: parseInt(missedFollowUps[0]?.count || '0', 10),
    responseDistribution,
  };
}

// ─── 7. CUSTOMER REVIEW REPORTS ─────────────────────────────────────────────

async function getReviewReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  const totalReviews = await Review.count({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  });

  const avgRatingResult = await Review.findOne({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [[fn('AVG', col('rating')), 'avgRating']],
    raw: true,
  });
  const avgRating = parseFloat(parseFloat(avgRatingResult?.avgRating || '0').toFixed(1));

  // Rating distribution
  const ratingDistribution = await Review.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: ['rating', [fn('COUNT', col('id')), 'count']],
    group: ['rating'],
    order: [['rating', 'DESC']],
    raw: true,
  });

  // Reviews by destination
  const reviewsByDestination = await Review.findAll({
    where: {
      agencyId,
      destination: { [Op.not]: null, [Op.ne]: '' },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      'destination',
      [fn('AVG', col('rating')), 'avgRating'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['destination'],
    order: [[fn('AVG', col('rating')), 'DESC']],
    raw: true,
  });

  // Negative reviews (rating <= 2)
  const negativeReviews = await Review.findAll({
    where: { agencyId, rating: { [Op.lte]: 2 }, createdAt: { [Op.between]: [start, end] } },
    include: [
      { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: 10,
    raw: false,
  });

  return {
    totalReviews,
    avgRating,
    ratingDistribution,
    reviewsByDestination: reviewsByDestination.map((r) => ({
      ...r, avgRating: parseFloat(parseFloat(r.avgRating).toFixed(1)),
    })),
    negativeReviews,
  };
}

// ─── 8. SEASONAL / TREND REPORTS ─────────────────────────────────────────────

async function getSeasonalReport(agencyId) {
  // Full 12 months of current year + previous year
  const now = new Date();
  const yearStart = new Date(now.getFullYear() - 1, 0, 1);

  const bookingsByMonth = await Booking.findAll({
    where: { agencyId, createdAt: { [Op.gte]: yearStart } },
    attributes: [
      [fn('DATE_TRUNC', 'month', col('created_at')), 'month'],
      [fn('COUNT', col('id')), 'bookings'],
      [fn('SUM', col('total_amount')), 'revenue'],
    ],
    group: [fn('DATE_TRUNC', 'month', col('created_at'))],
    order: [[fn('DATE_TRUNC', 'month', col('created_at')), 'ASC']],
    raw: true,
  });

  const leadsByMonth = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.gte]: yearStart } },
    attributes: [
      [fn('DATE_TRUNC', 'month', col('created_at')), 'month'],
      [fn('COUNT', col('id')), 'leads'],
    ],
    group: [fn('DATE_TRUNC', 'month', col('created_at'))],
    order: [[fn('DATE_TRUNC', 'month', col('created_at')), 'ASC']],
    raw: true,
  });

  // Identify peak and slow months
  const monthData = bookingsByMonth.map((b) => ({
    month: b.month,
    bookings: parseInt(b.bookings, 10),
    revenue: parseInt(b.revenue || '0', 10),
  }));

  let peakMonth = null;
  let slowMonth = null;
  if (monthData.length > 0) {
    peakMonth = monthData.reduce((a, b) => b.bookings > a.bookings ? b : a);
    slowMonth = monthData.reduce((a, b) => b.bookings < a.bookings ? b : a);
  }

  return {
    bookingsByMonth: monthData,
    leadsByMonth,
    peakMonth,
    slowMonth,
  };
}

// ─── 9. PROFIT REPORT ───────────────────────────────────────────────────────

async function getProfitReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Profit = selling price (totalAmount on booking) vs basePrice * travellers on package
  // This gives estimated profit per booking
  const profitData = await sequelize.query(`
    SELECT
      p.id AS package_id,
      p.name AS package_name,
      COUNT(b.id) AS bookings,
      SUM(b.total_amount) AS total_selling,
      SUM(p.base_price * b.travellers) AS total_cost_estimate,
      SUM(b.total_amount) - SUM(p.base_price * b.travellers) AS estimated_profit
    FROM bookings b
    JOIN packages p ON p.id = b.package_id
    WHERE b.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
      AND b.package_id IS NOT NULL
    GROUP BY p.id, p.name
    ORDER BY estimated_profit DESC
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const totalSelling = profitData.reduce((s, r) => s + parseInt(r.total_selling || '0', 10), 0);
  const totalCost = profitData.reduce((s, r) => s + parseInt(r.total_cost_estimate || '0', 10), 0);
  const totalProfit = totalSelling - totalCost;
  const profitMargin = totalSelling > 0 ? parseFloat((totalProfit / totalSelling * 100).toFixed(1)) : 0;

  return {
    totalSelling,
    totalCost,
    totalProfit,
    profitMargin,
    byPackage: profitData.map((r) => ({
      packageId: r.package_id,
      packageName: r.package_name,
      bookings: parseInt(r.bookings, 10),
      selling: parseInt(r.total_selling, 10),
      cost: parseInt(r.total_cost_estimate, 10),
      profit: parseInt(r.estimated_profit, 10),
      margin: parseInt(r.total_selling, 10) > 0
        ? parseFloat((parseInt(r.estimated_profit, 10) / parseInt(r.total_selling, 10) * 100).toFixed(1))
        : 0,
    })),
  };
}

// ─── 10. SOURCE REPORT ──────────────────────────────────────────────────────

async function getSourceReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  const leadsBySource = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [
      'source',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['source'],
    order: [[literal('"count"'), 'DESC']],
    raw: true,
  });

  // Conversion by source (booked / total per source)
  const bookedBySource = await Lead.findAll({
    where: { agencyId, status: 'BOOKED', createdAt: { [Op.between]: [start, end] } },
    attributes: [
      'source',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['source'],
    raw: true,
  });

  const bookedMap = {};
  bookedBySource.forEach((r) => { bookedMap[r.source] = parseInt(r.count, 10); });

  const sources = leadsBySource.map((r) => {
    const total = parseInt(r.count, 10);
    const booked = bookedMap[r.source] || 0;
    return {
      source: r.source || 'Unknown',
      leads: total,
      booked,
      conversionRate: total > 0 ? parseFloat((booked / total * 100).toFixed(1)) : 0,
    };
  });

  // Source trend over time
  const sourceByDay = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      'source',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at')), 'source'],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  return { sources, sourceByDay };
}

function isWeakAdLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  return !label
    || label === 'api.whatsapp.com'
    || label === 'whatsapp'
    || label === 'www.whatsapp.com'
    || label.includes('api.whatsapp.com');
}

function summarizeAdBody(value) {
  const firstLine = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return null;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function preferredAdReportName(row, fallbackId) {
  return row.metaAdSetName
    || row.metaCampaignName
    || (!isWeakAdLabel(row.metaAdName) ? row.metaAdName : null)
    || (!isWeakAdLabel(row.adHeadline) ? row.adHeadline : null)
    || summarizeAdBody(row.adBody)
    || fallbackId;
}

/**
 * Click-to-WhatsApp ad attribution: how many leads each Meta ad produced. Groups
 * leads that carry an `adId` (captured from the ad referral) so an agency running
 * several ads to the same number can compare them. The display name prefers the
 * resolved ad set/campaign, then a usable ad name/headline, then the raw ad ID.
 */
async function getLeadsByAd(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  const rows = await Lead.findAll({
    where: {
      agencyId,
      adId: { [Op.ne]: null },
      createdAt: { [Op.between]: [start, end] },
    },
    attributes: [
      'adId',
      'metaAdName',
      'adHeadline',
      'metaAdSetName',
      'metaCampaignName',
      'metaPlatform',
      [fn('COUNT', col('id')), 'count'],
      [fn('COUNT', literal(`CASE WHEN status = 'BOOKED' THEN 1 END`)), 'booked'],
      [literal(`MAX("Lead"."meta_raw_payload" #>> '{ctwaReferral,body}')`), 'adBody'],
    ],
    group: ['adId', 'metaAdName', 'adHeadline', 'metaAdSetName', 'metaCampaignName', 'metaPlatform'],
    order: [[literal('"count"'), 'DESC']],
    raw: true,
  });

  // One ad can span multiple (name, headline) snapshots if enrichment landed late;
  // collapse to a single row per adId.
  const byAd = new Map();
  for (const r of rows) {
    const key = r.adId;
    const leads = parseInt(r.count, 10) || 0;
    const booked = parseInt(r.booked, 10) || 0;
    const existing = byAd.get(key);
    if (existing) {
      existing.leads += leads;
      existing.booked += booked;
      existing.adName = !isWeakAdLabel(existing.adName) ? existing.adName : preferredAdReportName(r, key);
      existing.adSetName = existing.adSetName || r.metaAdSetName;
      existing.campaignName = existing.campaignName || r.metaCampaignName;
    } else {
      byAd.set(key, {
        adId: key,
        adName: preferredAdReportName(r, key),
        adSetName: r.metaAdSetName || null,
        campaignName: r.metaCampaignName || null,
        platform: r.metaPlatform || null,
        leads,
        booked,
      });
    }
  }

  const ads = Array.from(byAd.values())
    .map((a) => ({
      ...a,
      conversionRate: a.leads > 0 ? parseFloat((a.booked / a.leads * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  const totalAttributed = ads.reduce((sum, a) => sum + a.leads, 0);

  return { ads, totalAttributed };
}

// ─── ORIGINAL SUMMARY (kept for dashboard) ──────────────────────────────────

async function getSummary(agencyId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const totalLeads = await Lead.count({ where: { agencyId } });
  const newLeadsToday = await Lead.count({
    where: { agencyId, createdAt: { [Op.gte]: today } },
  });

  const leadsByStatus = await Lead.findAll({
    where: { agencyId },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  const bookedLeads = await Lead.count({ where: { agencyId, status: 'BOOKED' } });
  const conversionRate = totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(1) : 0;

  const confirmedBookings = await Booking.count({
    where: {
      agencyId,
      status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] },
      createdAt: { [Op.gte]: monthStart },
    },
  });

  const totalRevenueResult = await Payment.sum('amount', {
    where: { agencyId, status: 'PAID' },
  });
  const totalRevenue = totalRevenueResult || 0;

  const pendingPayments = await Payment.count({
    where: { agencyId, status: 'PENDING' },
  });

  const topPackages = await Booking.findAll({
    where: { agencyId, packageId: { [Op.not]: null } },
    attributes: ['packageId', [fn('COUNT', col('Booking.id')), 'bookingCount']],
    include: [{ model: Package, as: 'package', attributes: ['name', 'basePrice'] }],
    group: ['packageId', 'package.id'],
    order: [[literal('"bookingCount"'), 'DESC']],
    limit: 5,
    raw: false,
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const revenueByMonth = await Payment.findAll({
    where: {
      agencyId, status: 'PAID',
      paidAt: { [Op.gte]: sixMonthsAgo },
    },
    attributes: [
      [fn('DATE_TRUNC', 'month', col('paid_at')), 'month'],
      [fn('SUM', col('amount')), 'revenue'],
    ],
    group: [fn('DATE_TRUNC', 'month', col('paid_at'))],
    order: [[fn('DATE_TRUNC', 'month', col('paid_at')), 'ASC']],
    raw: true,
  });

  return {
    totalLeads, newLeadsToday, conversionRate: parseFloat(conversionRate),
    totalRevenue, pendingPayments, confirmedBookings,
    topPackages, leadsByStatus, revenueByMonth,
  };
}

// ─── CSV EXPORT ─────────────────────────────────────────────────────────────

async function exportReport(agencyId, reportType, from, to) {
  let data;
  let headers;
  let rows;

  switch (reportType) {
    case 'sales': {
      data = await getSalesReport(agencyId, from, to);
      headers = ['Date', 'Revenue (₹)', 'Transactions'];
      rows = data.revenueByDay.map((r) => [r.date, (parseInt(r.revenue, 10) / 100).toFixed(2), r.count]);
      break;
    }
    case 'leads': {
      data = await getLeadFunnelReport(agencyId, from, to);
      headers = ['Date', 'Leads'];
      rows = data.leadsByDay.map((r) => [r.date, r.count]);
      break;
    }
    case 'agents': {
      data = await getAgentPerformanceReport(agencyId, from, to);
      headers = ['Agent', 'Leads Assigned', 'Leads Converted', 'Conversion %', 'Messages Sent', 'Revenue (₹)'];
      rows = data.agents.map((a) => [a.name, a.leadsAssigned, a.leadsConverted, a.conversionRate, a.messagesSent, (a.revenue / 100).toFixed(2)]);
      break;
    }
    case 'packages': {
      data = await getPackageReport(agencyId, from, to);
      headers = ['Package', 'Bookings', 'Revenue (₹)', 'Leads', 'Conversion %'];
      rows = data.packages.map((p) => [p.package?.name, p.bookingCount, (p.totalRevenue / 100).toFixed(2), p.leads, p.conversionRate]);
      break;
    }
    case 'lost': {
      data = await getLostLeadsReport(agencyId, from, to);
      headers = ['Reason', 'Count'];
      rows = data.lostReasons.map((r) => [r.lostReason, r.count]);
      if (data.noReasonCount > 0) rows.push(['No reason given', data.noReasonCount]);
      break;
    }
    default:
      headers = [];
      rows = [];
  }

  // Build CSV string
  const csvLines = [headers.join(',')];
  rows.forEach((row) => {
    csvLines.push(row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));
  });

  return csvLines.join('\n');
}

// ─── 11. BOOKING REPORT ─────────────────────────────────────────────────────

async function getBookingReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);

  // Total bookings in range
  const totalBookings = await Booking.count({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  });
  const prevBookings = await Booking.count({
    where: { agencyId, createdAt: { [Op.between]: [prev.start, prev.end] } },
  });

  // Bookings by status
  const bookingsByStatus = await Booking.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  // Confirmed bookings
  const confirmed = await Booking.count({
    where: { agencyId, status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] }, createdAt: { [Op.between]: [start, end] } },
  });

  // Cancelled bookings + cancellation rate
  const cancelled = await Booking.count({
    where: { agencyId, status: 'CANCELLED', createdAt: { [Op.between]: [start, end] } },
  });
  const cancellationRate = totalBookings > 0 ? parseFloat((cancelled / totalBookings * 100).toFixed(1)) : 0;

  // Average travellers per booking
  const avgTravellersResult = await Booking.findOne({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [[fn('AVG', col('travellers')), 'avg']],
    raw: true,
  });
  const avgTravellers = parseFloat(parseFloat(avgTravellersResult?.avg || '0').toFixed(1));

  // Total revenue from bookings in range
  const totalRevenue = (await Booking.sum('total_amount', {
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
  })) || 0;

  // Bookings over time (daily)
  const bookingsByDay = await Booking.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    group: [fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  // Top destinations from bookings
  const topDestinations = await sequelize.query(`
    SELECT unnest(p.destinations) AS destination,
           COUNT(DISTINCT b.id) AS booking_count,
           SUM(b.travellers) AS total_travellers,
           SUM(b.total_amount) AS revenue
    FROM bookings b
    JOIN packages p ON p.id = b.package_id
    WHERE b.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
      AND p.destinations IS NOT NULL
    GROUP BY unnest(p.destinations)
    ORDER BY booking_count DESC
    LIMIT 10
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  // Upcoming departures (next 30 days from now)
  const upcomingStart = new Date();
  const upcomingEnd = new Date();
  upcomingEnd.setDate(upcomingEnd.getDate() + 30);

  const upcomingDepartures = await Booking.findAll({
    where: {
      agencyId,
      travelDate: { [Op.between]: [upcomingStart, upcomingEnd] },
      status: { [Op.in]: ['PENDING', 'CONFIRMED'] },
    },
    include: [
      { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
      { model: Package, as: 'package', attributes: ['name', 'destinations'] },
    ],
    order: [['travelDate', 'ASC']],
    limit: 15,
    raw: false,
  });

  // Bookings by status for pie chart
  const statusBreakdown = bookingsByStatus.map((r) => ({
    status: r.status,
    count: parseInt(r.count, 10),
  }));

  return {
    totalBookings,
    prevBookings,
    bookingsChange: prevBookings > 0 ? parseFloat(((totalBookings - prevBookings) / prevBookings * 100).toFixed(1)) : null,
    confirmed,
    cancelled,
    cancellationRate,
    avgTravellers,
    totalRevenue,
    bookingsByDay,
    statusBreakdown,
    topDestinations,
    upcomingDepartures,
  };
}

// ─── 12. CUSTOMER LIFETIME VALUE REPORT ────────────────────────────────────

async function getCustomerLtvReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Customers with multiple bookings
  const repeatCustomers = await sequelize.query(`
    SELECT
      c.id,
      c.name,
      c.phone,
      COUNT(b.id) AS total_bookings,
      SUM(b.total_amount) AS total_spent,
      MIN(b.created_at) AS first_booking,
      MAX(b.created_at) AS last_booking,
      AVG(b.total_amount) AS avg_booking_value
    FROM customers c
    JOIN bookings b ON b.customer_id = c.id
    WHERE c.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
    GROUP BY c.id, c.name, c.phone
    HAVING COUNT(b.id) >= 1
    ORDER BY total_spent DESC
    LIMIT 50
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const totalCustomers = repeatCustomers.length;
  const totalRevenue = repeatCustomers.reduce((s, r) => s + parseInt(r.total_spent || '0', 10), 0);
  const avgLtv = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

  const repeatCount = repeatCustomers.filter((r) => parseInt(r.total_bookings, 10) > 1).length;
  const repeatRate = totalCustomers > 0 ? parseFloat((repeatCount / totalCustomers * 100).toFixed(1)) : 0;

  // Cohort: bookings per month for customers who first booked in each month
  const cohortData = await sequelize.query(`
    WITH first_bookings AS (
      SELECT
        customer_id,
        DATE_TRUNC('month', MIN(created_at)) AS cohort_month
      FROM bookings
      WHERE agency_id = :agencyId
      GROUP BY customer_id
    )
    SELECT
      fb.cohort_month,
      DATE_TRUNC('month', b.created_at) AS booking_month,
      COUNT(DISTINCT b.customer_id) AS customers,
      COUNT(b.id) AS bookings,
      SUM(b.total_amount) AS revenue
    FROM first_bookings fb
    JOIN bookings b ON b.customer_id = fb.customer_id
    WHERE b.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
    GROUP BY fb.cohort_month, DATE_TRUNC('month', b.created_at)
    ORDER BY fb.cohort_month, booking_month
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  return {
    totalCustomers,
    avgLtv,
    repeatRate,
    topCustomers: repeatCustomers.slice(0, 20).map((r) => ({
      id: r.id,
      name: r.name || 'Anonymous',
      phone: r.phone,
      totalBookings: parseInt(r.total_bookings, 10),
      totalSpent: parseInt(r.total_spent, 10),
      avgBookingValue: Math.round(parseFloat(r.avg_booking_value || '0')),
      firstBooking: r.first_booking,
      lastBooking: r.last_booking,
    })),
    cohortData: cohortData.map((r) => ({
      cohortMonth: r.cohort_month,
      bookingMonth: r.booking_month,
      customers: parseInt(r.customers, 10),
      bookings: parseInt(r.bookings, 10),
      revenue: parseInt(r.revenue, 10),
    })),
  };
}

// ─── 13. CUSTOMER ACQUISITION COST (CAC) REPORT ─────────────────────────────

async function getCacReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Leads by source in period
  const leadsBySource = await Lead.findAll({
    where: { agencyId, createdAt: { [Op.between]: [start, end] } },
    attributes: ['source', [fn('COUNT', col('id')), 'count']],
    group: ['source'],
    raw: true,
  });

  // Booked leads by source in period
  const bookedBySource = await Lead.findAll({
    where: { agencyId, status: 'BOOKED', createdAt: { [Op.between]: [start, end] } },
    attributes: ['source', [fn('COUNT', col('id')), 'count']],
    group: ['source'],
    raw: true,
  });

  // Revenue by source (through bookings)
  const revenueBySource = await sequelize.query(`
    SELECT
      l.source,
      SUM(b.total_amount) AS revenue,
      COUNT(b.id) AS bookings
    FROM bookings b
    JOIN leads l ON l.id = b.lead_id
    WHERE l.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
    GROUP BY l.source
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const bookedMap = {};
  bookedBySource.forEach((r) => { bookedMap[r.source || 'Unknown'] = parseInt(r.count, 10); });
  const revenueMap = {};
  revenueBySource.forEach((r) => { revenueMap[r.source || 'Unknown'] = parseInt(r.revenue || '0', 10); });

  // NOTE: spend data should come from ad spend tracking. For now, we estimate.
  const sources = leadsBySource.map((r) => {
    const source = r.source || 'Unknown';
    const leads = parseInt(r.count, 10);
    const booked = bookedMap[source] || 0;
    const revenue = revenueMap[source] || 0;
    return {
      source,
      leads,
      booked,
      revenue,
      conversionRate: leads > 0 ? parseFloat((booked / leads * 100).toFixed(1)) : 0,
      // Placeholder for when ad spend is tracked
      estimatedSpend: 0,
      estimatedCac: booked > 0 ? 0 : 0,
      roas: 0,
    };
  });

  const totalLeads = sources.reduce((s, r) => s + r.leads, 0);
  const totalBooked = sources.reduce((s, r) => s + r.booked, 0);
  const totalRevenue = sources.reduce((s, r) => s + r.revenue, 0);

  return {
    totalLeads,
    totalBooked,
    totalRevenue,
    avgConversionRate: totalLeads > 0 ? parseFloat((totalBooked / totalLeads * 100).toFixed(1)) : 0,
    sources,
    note: 'Connect ad spend data to see real CAC and ROAS. Estimated values shown as placeholders.',
  };
}

// ─── 14. OPERATIONAL EXCELLENCE REPORT ──────────────────────────────────────

async function getOperationalReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Response time metrics
  const responseMetrics = await sequelize.query(`
    WITH conversations AS (
      SELECT
        customer_id,
        MIN(CASE WHEN direction = 'IN' THEN timestamp END) AS first_in,
        MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) AS first_reply
      FROM messages
      WHERE agency_id = :agencyId
        AND timestamp BETWEEN :start AND :end
      GROUP BY customer_id
      HAVING MIN(CASE WHEN direction = 'IN' THEN timestamp END) IS NOT NULL
         AND MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) IS NOT NULL
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM (first_reply - first_in))) AS avg_response_seconds,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_reply - first_in))) AS median_response_seconds,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_reply - first_in))) AS p90_response_seconds,
      COUNT(*) AS conversation_count
    FROM conversations
    WHERE first_reply > first_in
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const avgResponseMinutes = Math.round(parseFloat(responseMetrics[0]?.avg_response_seconds || '0') / 60);
  const medianResponseMinutes = Math.round(parseFloat(responseMetrics[0]?.median_response_seconds || '0') / 60);
  const p90ResponseMinutes = Math.round(parseFloat(responseMetrics[0]?.p90_response_seconds || '0') / 60);

  // Response distribution buckets
  const responseDistribution = await sequelize.query(`
    WITH conversations AS (
      SELECT
        customer_id,
        MIN(CASE WHEN direction = 'IN' THEN timestamp END) AS first_in,
        MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) AS first_reply
      FROM messages
      WHERE agency_id = :agencyId
        AND timestamp BETWEEN :start AND :end
      GROUP BY customer_id
      HAVING MIN(CASE WHEN direction = 'IN' THEN timestamp END) IS NOT NULL
         AND MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) IS NOT NULL
    )
    SELECT
      CASE
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 300 THEN 'Under 5 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 900 THEN '5-15 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 3600 THEN '15-60 min'
        WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 86400 THEN '1-24 hours'
        ELSE 'Over 24 hours'
      END AS bucket,
      COUNT(*) AS count
    FROM conversations
    WHERE first_reply > first_in
    GROUP BY bucket
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  // Missed follow-ups (leads without any outbound agent message)
  const missedFollowUps = await sequelize.query(`
    SELECT COUNT(DISTINCT l.id) AS count
    FROM leads l
    LEFT JOIN messages m ON m.customer_id = l.customer_id
      AND m.agency_id = l.agency_id
      AND m.direction = 'OUT'
      AND m.agent_id IS NOT NULL
      AND m.timestamp BETWEEN :start AND :end
    WHERE l.agency_id = :agencyId
      AND l.created_at BETWEEN :start AND :end
      AND l.status NOT IN ('BOOKED', 'LOST', 'CANCELLED')
      AND m.id IS NULL
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  // Agent workload distribution
  const agentWorkload = await sequelize.query(`
    SELECT
      a.id,
      a.name,
      COUNT(DISTINCT l.id) AS leads_assigned,
      COUNT(DISTINCT m.id) AS messages_sent,
      COUNT(DISTINCT CASE WHEN l.status = 'BOOKED' THEN l.id END) AS conversions,
      COALESCE(SUM(pay.amount), 0) AS revenue
    FROM agents a
    LEFT JOIN leads l ON l.assigned_agent_id = a.id AND l.created_at BETWEEN :start AND :end
    LEFT JOIN messages m ON m.agent_id = a.id AND m.direction = 'OUT' AND m.timestamp BETWEEN :start AND :end
    LEFT JOIN bookings b ON b.lead_id = l.id
    LEFT JOIN payments pay ON pay.booking_id = b.id AND pay.status = 'PAID'
    WHERE a.agency_id = :agencyId
    GROUP BY a.id, a.name
    ORDER BY revenue DESC
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  // SLA compliance: % of first replies under 15 minutes
  const slaCompliance = await sequelize.query(`
    WITH conversations AS (
      SELECT
        customer_id,
        MIN(CASE WHEN direction = 'IN' THEN timestamp END) AS first_in,
        MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) AS first_reply
      FROM messages
      WHERE agency_id = :agencyId
        AND timestamp BETWEEN :start AND :end
      GROUP BY customer_id
      HAVING MIN(CASE WHEN direction = 'IN' THEN timestamp END) IS NOT NULL
         AND MIN(CASE WHEN direction = 'OUT' AND agent_id IS NOT NULL THEN timestamp END) IS NOT NULL
    )
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (first_reply - first_in)) <= 900 THEN 1 END) AS within_sla
    FROM conversations
    WHERE first_reply > first_in
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const totalConv = parseInt(slaCompliance[0]?.total || '0', 10);
  const withinSla = parseInt(slaCompliance[0]?.within_sla || '0', 10);
  const slaRate = totalConv > 0 ? parseFloat((withinSla / totalConv * 100).toFixed(1)) : 0;

  return {
    avgResponseMinutes,
    medianResponseMinutes,
    p90ResponseMinutes,
    conversationCount: parseInt(responseMetrics[0]?.conversation_count || '0', 10),
    missedFollowUps: parseInt(missedFollowUps[0]?.count || '0', 10),
    slaRate,
    slaTarget: 80,
    responseDistribution: responseDistribution.map((r) => ({
      bucket: r.bucket,
      count: parseInt(r.count, 10),
    })),
    agentWorkload: agentWorkload.map((a) => ({
      id: a.id,
      name: a.name,
      leadsAssigned: parseInt(a.leads_assigned || '0', 10),
      messagesSent: parseInt(a.messages_sent || '0', 10),
      conversions: parseInt(a.conversions || '0', 10),
      revenue: parseInt(a.revenue || '0', 10),
    })),
  };
}

// ─── 15. CAMPAIGN ROI REPORT ────────────────────────────────────────────────

async function getCampaignRoiReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);

  // Campaigns in period
  const campaigns = await Campaign.findAll({
    where: { agencyId, sentAt: { [Op.between]: [start, end] } },
    attributes: ['id', 'name', 'type', 'totalRecipients', 'sent', 'delivered', 'read', 'replied', 'failed', 'createdAt'],
    order: [['sentAt', 'DESC']],
    raw: true,
  });

  // Leads generated by campaign
  const leadsByCampaign = await Lead.findAll({
    where: { agencyId, campaignId: { [Op.not]: null }, createdAt: { [Op.between]: [start, end] } },
    attributes: ['campaignId', [fn('COUNT', col('id')), 'count']],
    group: ['campaignId'],
    raw: true,
  });

  // Bookings from campaign leads
  const bookingsFromCampaigns = await sequelize.query(`
    SELECT
      l.campaign_id,
      COUNT(b.id) AS bookings,
      SUM(b.total_amount) AS revenue
    FROM bookings b
    JOIN leads l ON l.id = b.lead_id
    WHERE l.agency_id = :agencyId
      AND l.campaign_id IS NOT NULL
      AND b.created_at BETWEEN :start AND :end
    GROUP BY l.campaign_id
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const leadMap = {};
  leadsByCampaign.forEach((r) => { leadMap[r.campaignId] = parseInt(r.count, 10); });
  const bookingMap = {};
  bookingsFromCampaigns.forEach((r) => {
    bookingMap[r.campaign_id] = {
      bookings: parseInt(r.bookings, 10),
      revenue: parseInt(r.revenue || '0', 10),
    };
  });

  const enrichedCampaigns = campaigns.map((c) => {
    const leads = leadMap[c.id] || 0;
    const booked = bookingMap[c.id]?.bookings || 0;
    const revenue = bookingMap[c.id]?.revenue || 0;
    return {
      ...c,
      leadsGenerated: leads,
      bookings: booked,
      revenue,
      conversionRate: c.totalRecipients > 0 ? parseFloat((leads / c.totalRecipients * 100).toFixed(1)) : 0,
      bookingRate: c.totalRecipients > 0 ? parseFloat((booked / c.totalRecipients * 100).toFixed(1)) : 0,
      revenuePerRecipient: c.totalRecipients > 0 ? Math.round(revenue / c.totalRecipients) : 0,
      readRate: c.delivered > 0 ? parseFloat((c.read / c.delivered * 100).toFixed(1)) : 0,
      replyRate: c.delivered > 0 ? parseFloat((c.replied / c.delivered * 100).toFixed(1)) : 0,
    };
  });

  const totalSent = enrichedCampaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalDelivered = enrichedCampaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const totalRead = enrichedCampaigns.reduce((s, c) => s + (c.read || 0), 0);
  const totalReplied = enrichedCampaigns.reduce((s, c) => s + (c.replied || 0), 0);
  const totalRevenue = enrichedCampaigns.reduce((s, c) => s + c.revenue, 0);
  const totalLeads = enrichedCampaigns.reduce((s, c) => s + c.leadsGenerated, 0);
  const totalBookings = enrichedCampaigns.reduce((s, c) => s + c.bookings, 0);

  return {
    totalCampaigns: campaigns.length,
    totalSent,
    totalDelivered,
    totalRead,
    totalReplied,
    totalRevenue,
    totalLeads,
    totalBookings,
    avgDeliveryRate: totalSent > 0 ? parseFloat((totalDelivered / totalSent * 100).toFixed(1)) : 0,
    avgReadRate: totalDelivered > 0 ? parseFloat((totalRead / totalDelivered * 100).toFixed(1)) : 0,
    avgReplyRate: totalDelivered > 0 ? parseFloat((totalReplied / totalDelivered * 100).toFixed(1)) : 0,
    avgLeadRate: totalSent > 0 ? parseFloat((totalLeads / totalSent * 100).toFixed(1)) : 0,
    avgBookingRate: totalSent > 0 ? parseFloat((totalBookings / totalSent * 100).toFixed(1)) : 0,
    campaigns: enrichedCampaigns,
  };
}

// ─── 16. GROWTH & PIPELINE VELOCITY REPORT ──────────────────────────────────

async function getGrowthReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);

  // Current period metrics
  const totalLeads = await Lead.count({ where: { agencyId, createdAt: { [Op.between]: [start, end] } } });
  const prevLeads = await Lead.count({ where: { agencyId, createdAt: { [Op.between]: [prev.start, prev.end] } } });

  const totalBookings = await Booking.count({ where: { agencyId, createdAt: { [Op.between]: [start, end] } } });
  const prevBookings = await Booking.count({ where: { agencyId, createdAt: { [Op.between]: [prev.start, prev.end] } } });

  const totalRevenue = (await Payment.sum('amount', {
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [start, end] } },
  })) || 0;
  const prevRevenue = (await Payment.sum('amount', {
    where: { agencyId, status: 'PAID', paidAt: { [Op.between]: [prev.start, prev.end] } },
  })) || 0;

  // Conversion funnel velocity: avg days from lead creation to booking
  const velocityResult = await sequelize.query(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (b.created_at - l.created_at)) / 86400) AS avg_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (b.created_at - l.created_at)) / 86400) AS median_days,
      COUNT(*) AS count
    FROM bookings b
    JOIN leads l ON l.id = b.lead_id
    WHERE l.agency_id = :agencyId
      AND b.created_at BETWEEN :start AND :end
      AND b.created_at > l.created_at
  `, {
    replacements: { agencyId, start, end },
    type: sequelize.QueryTypes.SELECT,
  });

  const avgVelocityDays = parseFloat(parseFloat(velocityResult[0]?.avg_days || '0').toFixed(1));
  const medianVelocityDays = parseFloat(parseFloat(velocityResult[0]?.median_days || '0').toFixed(1));

  // Pipeline distribution (current snapshot)
  const pipelineSnapshot = await Lead.findAll({
    where: { agencyId },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  // Monthly growth trend
  const monthlyTrend = await sequelize.query(`
    SELECT
      DATE_TRUNC('month', created_at) AS month,
      COUNT(*) AS leads,
      SUM(CASE WHEN status = 'BOOKED' THEN 1 ELSE 0 END) AS booked
    FROM leads
    WHERE agency_id = :agencyId
      AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
  `, {
    replacements: { agencyId },
    type: sequelize.QueryTypes.SELECT,
  });

  return {
    totalLeads,
    leadsChange: prevLeads > 0 ? parseFloat(((totalLeads - prevLeads) / prevLeads * 100).toFixed(1)) : null,
    totalBookings,
    bookingsChange: prevBookings > 0 ? parseFloat(((totalBookings - prevBookings) / prevBookings * 100).toFixed(1)) : null,
    totalRevenue,
    revenueChange: prevRevenue > 0 ? parseFloat(((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)) : null,
    avgVelocityDays,
    medianVelocityDays,
    pipelineSnapshot: pipelineSnapshot.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    monthlyTrend: monthlyTrend.map((r) => ({
      month: r.month,
      leads: parseInt(r.leads, 10),
      booked: parseInt(r.booked, 10),
    })),
  };
}

// ─── CRM REPORT (dynamic dashboard) ───────────────────────────────────────────

function pctChange(curr, prev) {
  if (!prev) return curr > 0 ? 100 : null;
  return parseFloat((((curr - prev) / prev) * 100).toFixed(1));
}

/**
 * getCrmReport — single payload powering the whole CRM dashboard tab.
 * Lead-volume metrics respect the [from,to] range; the "Month at a Glance" and
 * "Won this month" blocks use calendar months; the action lists (needs
 * attention, today's schedule, smart suggestions) are live (not range-bound).
 */
async function getCrmReport(agencyId, from, to) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);
  const now = new Date();
  const inRange = { [Op.between]: [start, end] };

  // ── Configurable pipeline → status buckets ──
  const stages = await pipelineService.listStages(agencyId);
  const activeStages = stages.filter((s) => s.isActive);
  const dedupe = (arr) => [...new Set(arr)];
  const safe = (arr, fallback) => (arr.length ? arr : fallback);
  const wonStatuses = safe(dedupe(stages.filter((s) => s.kind === 'WON').flatMap((s) => s.leadStatuses)), ['BOOKED', 'CONVERTED']);
  const lostStatuses = safe(dedupe(stages.filter((s) => s.kind === 'LOST').flatMap((s) => s.leadStatuses)), ['LOST', 'CANCELLED']);
  const openStatuses = safe(
    dedupe(activeStages.filter((s) => s.kind === 'OPEN').flatMap((s) => s.leadStatuses)),
    ['JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'UNKNOWN']
  );

  // ── Lead counts grouped by status, within range ──
  const statusRows = await Lead.findAll({
    where: { agencyId, createdAt: inRange },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const countByStatus = {};
  // Entry-stage leads carry a null status; bucket them under JUST_CONTACTED.
  statusRows.forEach((r) => { countByStatus[r.status || 'JUST_CONTACTED'] = (countByStatus[r.status || 'JUST_CONTACTED'] || 0) + parseInt(r.count, 10); });
  const sumOf = (statuses) => statuses.reduce((acc, s) => acc + (countByStatus[s] || 0), 0);

  const totalLeads = Object.values(countByStatus).reduce((a, b) => a + b, 0);
  const openDeals = activeStages
    .filter((s) => s.kind === 'OPEN')
    .reduce((acc, s) => acc + sumOf(s.leadStatuses), 0);
  const wonInRange = sumOf(wonStatuses);
  const lostInRange = sumOf(lostStatuses);
  const conversion = (wonInRange + lostInRange) > 0
    ? parseFloat(((wonInRange / (wonInRange + lostInRange)) * 100).toFixed(1))
    : 0;

  // ── Funnel (per configured stage, within range) ──
  const funnel = activeStages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    kind: s.kind,
    count: sumOf(s.leadStatuses),
  }));

  // ── Hot leads (live): high score, still open ──
  const hotCount = await Lead.count({
    where: { agencyId, status: { [Op.in]: openStatuses }, leadScore: { [Op.gte]: 70 } },
  });

  // ── Month at a Glance (calendar months) ──
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart.getTime() - 1);
  const monthName = (d) => d.toLocaleString('en-US', { month: 'long' });

  const countLeads = (where) => Lead.count({ where: { agencyId, ...where } });
  const [
    newThis, newLast,
    wonThis, wonLast,
    lostThis, lostLast,
  ] = await Promise.all([
    countLeads({ createdAt: { [Op.gte]: monthStart } }),
    countLeads({ createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] } }),
    countLeads({ status: { [Op.in]: wonStatuses }, updatedAt: { [Op.gte]: monthStart } }),
    countLeads({ status: { [Op.in]: wonStatuses }, updatedAt: { [Op.between]: [lastMonthStart, lastMonthEnd] } }),
    countLeads({ status: { [Op.in]: lostStatuses }, updatedAt: { [Op.gte]: monthStart } }),
    countLeads({ status: { [Op.in]: lostStatuses }, updatedAt: { [Op.between]: [lastMonthStart, lastMonthEnd] } }),
  ]);

  const monthAtGlance = {
    thisMonthLabel: monthName(monthStart),
    lastMonthLabel: monthName(lastMonthStart),
    newLeads: { value: newThis, change: pctChange(newThis, newLast) },
    won: { value: wonThis, change: pctChange(wonThis, wonLast) },
    lost: { value: lostThis, change: pctChange(lostThis, lostLast) },
  };

  // ── Won vs Lost — last 8 weeks (normalized buckets) ──
  const wonVsLostRows = await sequelize.query(`
    SELECT gs::date AS week_start,
           COALESCE(b.won, 0)  AS won,
           COALESCE(b.lost, 0) AS lost
    FROM generate_series(
      date_trunc('week', NOW()) - interval '7 weeks',
      date_trunc('week', NOW()),
      interval '1 week'
    ) gs
    LEFT JOIN (
      SELECT date_trunc('week', updated_at) AS week,
             SUM(CASE WHEN status IN (:wonStatuses)  THEN 1 ELSE 0 END) AS won,
             SUM(CASE WHEN status IN (:lostStatuses) THEN 1 ELSE 0 END) AS lost
      FROM leads
      WHERE agency_id = :agencyId
        AND updated_at >= date_trunc('week', NOW()) - interval '7 weeks'
      GROUP BY 1
    ) b ON b.week = gs
    ORDER BY gs
  `, {
    replacements: { agencyId, wonStatuses, lostStatuses },
    type: sequelize.QueryTypes.SELECT,
  });
  const wonVsLost8w = wonVsLostRows.map((r) => ({
    weekStart: r.week_start,
    won: parseInt(r.won, 10),
    lost: parseInt(r.lost, 10),
  }));

  // ── Top sources (within range) ──
  const sourceRows = await Lead.findAll({
    where: { agencyId, createdAt: inRange },
    attributes: ['source', [fn('COUNT', col('id')), 'count']],
    group: ['source'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true,
  });
  const topSources = sourceRows.map((r) => ({ source: r.source || 'unknown', count: parseInt(r.count, 10) }));

  // ── Needs attention (live) ──
  const staleThreshold = new Date(now.getTime() - 7 * 86400000);
  const [overdueCount, staleCount] = await Promise.all([
    FollowUp.count({ where: { agencyId, status: 'Scheduled', scheduledAt: { [Op.lt]: now } } }),
    Lead.count({ where: { agencyId, status: { [Op.in]: openStatuses }, updatedAt: { [Op.lt]: staleThreshold } } }),
  ]);
  const needsAttention = { hot: hotCount, overdue: overdueCount, stale: staleCount };

  // ── Top performers (closed-won, last 30 days) ──
  const performerRows = await sequelize.query(`
    SELECT a.id AS "agentId", a.name AS name, COUNT(l.id) AS won
    FROM leads l
    JOIN agents a ON a.id = l.assigned_agent_id
    WHERE l.agency_id = :agencyId
      AND l.status IN (:wonStatuses)
      AND l.updated_at >= NOW() - interval '30 days'
    GROUP BY a.id, a.name
    ORDER BY won DESC
    LIMIT 5
  `, {
    replacements: { agencyId, wonStatuses },
    type: sequelize.QueryTypes.SELECT,
  });
  const topPerformers = performerRows.map((r) => ({ agentId: r.agentId, name: r.name, won: parseInt(r.won, 10) }));

  // ── Today's schedule (live) ──
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000 - 1);
  const todayWindow = { [Op.between]: [dayStart, dayEnd] };
  const [callsToday, followUpsToday] = await Promise.all([
    CallLog.count({ where: { agencyId, startedAt: todayWindow } }),
    FollowUp.count({ where: { agencyId, scheduledAt: todayWindow } }),
  ]);
  const scheduleRows = await FollowUp.findAll({
    where: { agencyId, scheduledAt: todayWindow },
    include: [{ model: Lead, as: 'lead', attributes: ['id'], include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }] }],
    order: [['scheduledAt', 'ASC']],
    limit: 6,
  });
  const todaySchedule = {
    calls: callsToday,
    followUps: followUpsToday,
    overdue: overdueCount,
    items: scheduleRows.map((f) => ({
      id: f.id,
      at: f.scheduledAt,
      note: f.note,
      status: f.status,
      who: f.lead?.customer?.name || f.lead?.customer?.phone || 'Lead',
      leadId: f.leadId,
    })),
  };

  // ── Recent activity (live, merged) ──
  const recentRows = await sequelize.query(`
    SELECT * FROM (
      SELECT 'note' AS type, ln.content AS detail, ln.created_at AS at, c.name AS who, l.id AS "leadId"
        FROM lead_notes ln
        JOIN leads l ON l.id = ln.lead_id
        LEFT JOIN customers c ON c.id = l.customer_id
        WHERE l.agency_id = :agencyId
      UNION ALL
      SELECT 'call' AS type, cl.status::text AS detail, cl.started_at AS at, c.name AS who, cl.lead_id AS "leadId"
        FROM call_logs cl
        LEFT JOIN customers c ON c.id = cl.customer_id
        WHERE cl.agency_id = :agencyId
      UNION ALL
      SELECT 'followup' AS type, fu.note AS detail, fu.scheduled_at AS at, c.name AS who, fu.lead_id AS "leadId"
        FROM follow_ups fu
        JOIN leads l2 ON l2.id = fu.lead_id
        LEFT JOIN customers c ON c.id = l2.customer_id
        WHERE fu.agency_id = :agencyId
    ) x
    ORDER BY at DESC NULLS LAST
    LIMIT 8
  `, {
    replacements: { agencyId },
    type: sequelize.QueryTypes.SELECT,
  });
  const recentActivity = recentRows.map((r) => ({
    type: r.type,
    detail: r.detail,
    at: r.at,
    who: r.who || 'Lead',
    leadId: r.leadId,
  }));

  // ── Activity pulse (this calendar year, by month + best weekday) ──
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const pulseRows = await sequelize.query(`
    SELECT EXTRACT(MONTH FROM at)::int AS month, COUNT(*) AS events
    FROM (
      SELECT created_at AS at FROM leads      WHERE agency_id = :agencyId AND created_at >= :yearStart
      UNION ALL
      SELECT started_at AS at FROM call_logs  WHERE agency_id = :agencyId AND started_at >= :yearStart
      UNION ALL
      SELECT scheduled_at AS at FROM follow_ups WHERE agency_id = :agencyId AND scheduled_at >= :yearStart
    ) e
    GROUP BY 1
    ORDER BY 1
  `, {
    replacements: { agencyId, yearStart },
    type: sequelize.QueryTypes.SELECT,
  });
  const monthlyVolume = Array.from({ length: 12 }, (_, i) => {
    const row = pulseRows.find((r) => r.month === i + 1);
    return { month: i + 1, events: row ? parseInt(row.events, 10) : 0 };
  });
  const totalEvents = monthlyVolume.reduce((a, b) => a + b.events, 0);

  const weekdayRows = await sequelize.query(`
    SELECT EXTRACT(DOW FROM at)::int AS dow, COUNT(*) AS events
    FROM (
      SELECT created_at AS at FROM leads      WHERE agency_id = :agencyId AND created_at >= :yearStart
      UNION ALL
      SELECT started_at AS at FROM call_logs  WHERE agency_id = :agencyId AND started_at >= :yearStart
      UNION ALL
      SELECT scheduled_at AS at FROM follow_ups WHERE agency_id = :agencyId AND scheduled_at >= :yearStart
    ) e
    GROUP BY 1
    ORDER BY events DESC
    LIMIT 1
  `, {
    replacements: { agencyId, yearStart },
    type: sequelize.QueryTypes.SELECT,
  });
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const activityPulse = {
    year: now.getFullYear(),
    totalEvents,
    monthlyVolume,
    bestWeekday: weekdayRows.length ? WEEKDAYS[weekdayRows[0].dow] : null,
  };

  // ── Smart suggestions (stale open leads worth a nudge) ──
  const suggestionLeads = await Lead.findAll({
    where: { agencyId, status: { [Op.in]: openStatuses } },
    include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
    order: [['updatedAt', 'ASC']],
    limit: 5,
  });
  const smartSuggestions = suggestionLeads.map((l) => {
    const days = Math.max(0, Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / 86400000));
    return {
      leadId: l.id,
      name: l.customer?.name || l.customer?.phone || 'Lead',
      daysSinceContact: days,
      leadScore: l.leadScore,
      priority: l.leadScore >= 70 || days >= 7 ? 'High' : 'Medium',
      reason: `Lead hasn't been contacted in ${days} day${days === 1 ? '' : 's'}`,
    };
  });

  return {
    range: { from: start, to: end },
    cards: {
      totalLeads,
      activeLeads: openDeals,
      openDeals,
      won: wonThis,
      conversion,
      wonInRange,
      lostInRange,
      hot: hotCount,
    },
    stages,
    funnel,
    monthAtGlance,
    wonVsLost8w,
    topSources,
    needsAttention,
    topPerformers,
    todaySchedule,
    recentActivity,
    activityPulse,
    smartSuggestions,
  };
}

// ─── CALLING REPORT ───────────────────────────────────────────────────────
// A tracked-call analytics report: KPIs, daily volume trend, status & hour
// breakdowns, per-staff and per-lead rollups, recent call log, and rule-based
// recommendations. Non-admin agents are scoped to their own calls.

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// A call counts as "connected" if the customer leg answered, or it completed
// with real talk time. Everything else (no_answer, busy, failed, canceled,
// ringing-only) is a miss.
function isCallConnected(c) {
  if (c.customerAnsweredAt) return true;
  return c.status === 'completed' && Number(c.durationSeconds || 0) > 0;
}

function pctChange(cur, prev) {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  return cur > 0 ? 100 : 0;
}

// Open pipeline statuses worth a phone call (used for "never called" nudges).
const CALLABLE_LEAD_STATUSES = [
  'JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'NEW', 'ENQUIRY',
  'CONTACTED', 'QUOTED', 'NEGOTIATING',
];

async function getCallingReport(agencyId, from, to, opts = {}) {
  const { start, end } = defaultRange(from, to);
  const prev = prevRange(start, end);

  const requester = opts.requester || null;
  const isAdmin = requester?.role === 'ADMIN';

  // Scope: non-admins only ever see their own calls; admins may filter by staff.
  const scopeAgentId = !isAdmin ? requester?.id : (opts.agentId || null);

  const rangeWhere = { agencyId, startedAt: { [Op.between]: [start, end] } };
  if (scopeAgentId) rangeWhere.agentId = scopeAgentId;
  if (opts.leadId) rangeWhere.leadId = opts.leadId;

  const calls = await CallLog.findAll({
    where: rangeWhere,
    include: [
      { model: Agent, as: 'agent', attributes: ['id', 'name'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Lead, as: 'lead', attributes: ['id', 'status'] },
    ],
    order: [['startedAt', 'DESC']],
    limit: 5000,
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  let connected = 0;
  let totalTalk = 0;
  let recorded = 0;
  let ttaSum = 0;
  let ttaCount = 0;
  const calledLeadIds = new Set();

  for (const c of calls) {
    const conn = isCallConnected(c);
    if (conn) {
      connected += 1;
      totalTalk += Number(c.durationSeconds || 0);
      if (c.customerAnsweredAt && c.startedAt) {
        const tta = (new Date(c.customerAnsweredAt).getTime() - new Date(c.startedAt).getTime()) / 1000;
        if (tta >= 0 && tta < 600) { ttaSum += tta; ttaCount += 1; }
      }
    }
    if (c.recordingUrl) recorded += 1;
    if (c.leadId) calledLeadIds.add(c.leadId);
  }

  const total = calls.length;
  const missed = total - connected;
  const answerRate = total ? parseFloat(((connected / total) * 100).toFixed(1)) : 0;
  const avgTalkSec = connected ? Math.round(totalTalk / connected) : 0;
  const avgTimeToAnswerSec = ttaCount ? Math.round(ttaSum / ttaCount) : 0;

  // Previous period (for deltas) — light count queries.
  const prevWhere = { agencyId, startedAt: { [Op.between]: [prev.start, prev.end] } };
  if (scopeAgentId) prevWhere.agentId = scopeAgentId;
  if (opts.leadId) prevWhere.leadId = opts.leadId;
  const connectedClause = {
    [Op.or]: [
      { customerAnsweredAt: { [Op.ne]: null } },
      { status: 'completed', durationSeconds: { [Op.gt]: 0 } },
    ],
  };
  const prevTotal = await CallLog.count({ where: prevWhere });
  const prevConnected = await CallLog.count({ where: { ...prevWhere, ...connectedClause } });
  const prevAnswerRate = prevTotal ? (prevConnected / prevTotal) * 100 : 0;

  // ── Daily volume trend (continuous days) ────────────────────────────────────
  const dayMap = new Map();
  for (const c of calls) {
    const key = dayKey(c.startedAt);
    if (!dayMap.has(key)) dayMap.set(key, { date: key, total: 0, connected: 0, missed: 0 });
    const row = dayMap.get(key);
    row.total += 1;
    if (isCallConnected(c)) row.connected += 1; else row.missed += 1;
  }
  const byDay = [];
  for (let t = new Date(start.getFullYear(), start.getMonth(), start.getDate()); t <= end; t.setDate(t.getDate() + 1)) {
    const key = dayKey(t);
    byDay.push(dayMap.get(key) || { date: key, total: 0, connected: 0, missed: 0 });
  }

  // ── Status breakdown ────────────────────────────────────────────────────────
  const statusMap = new Map();
  for (const c of calls) statusMap.set(c.status, (statusMap.get(c.status) || 0) + 1);
  const byStatus = [...statusMap.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // ── Hour-of-day connect rate (best call window) ─────────────────────────────
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, total: 0, connected: 0 }));
  for (const c of calls) {
    const h = new Date(c.startedAt).getHours();
    byHour[h].total += 1;
    if (isCallConnected(c)) byHour[h].connected += 1;
  }
  let bestWindow = null;
  for (const b of byHour) {
    if (b.total < 3) continue;
    const rate = b.connected / b.total;
    if (!bestWindow || rate > bestWindow.rate) {
      bestWindow = { hour: b.hour, rate, connectRate: Math.round(rate * 100), calls: b.total };
    }
  }

  // ── Per-staff rollup ────────────────────────────────────────────────────────
  const agentMap = new Map();
  for (const c of calls) {
    const id = c.agentId;
    if (!agentMap.has(id)) {
      agentMap.set(id, { agentId: id, name: c.agent?.name || 'Unknown', total: 0, connected: 0, missed: 0, talk: 0 });
    }
    const a = agentMap.get(id);
    a.total += 1;
    if (isCallConnected(c)) { a.connected += 1; a.talk += Number(c.durationSeconds || 0); } else { a.missed += 1; }
  }
  const agentStats = [...agentMap.values()]
    .map((a) => ({
      agentId: a.agentId,
      name: a.name,
      total: a.total,
      connected: a.connected,
      missed: a.missed,
      answerRate: a.total ? parseFloat(((a.connected / a.total) * 100).toFixed(1)) : 0,
      totalTalkSec: a.talk,
      avgTalkSec: a.connected ? Math.round(a.talk / a.connected) : 0,
    }))
    .sort((x, y) => y.total - x.total);

  // ── Per-lead rollup ─────────────────────────────────────────────────────────
  const leadMap = new Map();
  for (const c of calls) {
    const id = c.leadId;
    if (!leadMap.has(id)) {
      leadMap.set(id, {
        leadId: id,
        customerName: c.customer?.name || c.customerPhone || 'Lead',
        customerPhone: c.customerPhone,
        leadStatus: c.lead?.status || null,
        total: 0, connected: 0, missed: 0, lastCallAt: null, lastStatus: null,
      });
    }
    const l = leadMap.get(id);
    l.total += 1;
    if (isCallConnected(c)) l.connected += 1; else l.missed += 1;
    if (!l.lastCallAt || new Date(c.startedAt) > new Date(l.lastCallAt)) {
      l.lastCallAt = c.startedAt;
      l.lastStatus = c.status;
    }
  }
  const leadStats = [...leadMap.values()].sort((a, b) => b.total - a.total);

  // ── Recent call log (for the table; recordings streamed via /calls/:id/recording) ──
  const recentCalls = calls.slice(0, 50).map((c) => ({
    id: c.id,
    startedAt: c.startedAt,
    status: c.status,
    durationSeconds: c.durationSeconds,
    connected: isCallConnected(c),
    hasRecording: Boolean(c.recordingUrl),
    agentName: c.agent?.name || null,
    customerName: c.customer?.name || null,
    customerPhone: c.customerPhone,
    leadId: c.leadId,
  }));

  // ── Rule-based recommendations ──────────────────────────────────────────────
  const suggestions = [];

  // 1. Leads attempted 2+ times but never reached.
  const neverReached = leadStats.filter((l) => l.total >= 2 && l.connected === 0);
  if (neverReached.length) {
    const top = neverReached[0];
    suggestions.push({
      id: 'never-reached',
      severity: 'critical',
      title: `${neverReached.length} lead${neverReached.length === 1 ? '' : 's'} attempted but never reached`,
      detail: `e.g. ${top.customerName} — ${top.total} tries, 0 connects. Try a different time of day or confirm the number.`,
      leadId: top.leadId,
    });
  }

  // 2. Open pipeline leads that have never been called at all.
  const uncalledWhere = { agencyId, [Op.or]: [{ status: { [Op.is]: null } }, { status: { [Op.in]: CALLABLE_LEAD_STATUSES } }] };
  if (scopeAgentId) uncalledWhere.assignedAgentId = scopeAgentId;
  if (calledLeadIds.size) uncalledWhere.id = { [Op.notIn]: [...calledLeadIds] };
  const uncalledCount = await Lead.count({ where: uncalledWhere });
  if (uncalledCount > 0) {
    const sample = await Lead.findAll({
      where: uncalledWhere,
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
      limit: 1,
    });
    suggestions.push({
      id: 'uncalled-open',
      severity: 'warning',
      title: `${uncalledCount} open lead${uncalledCount === 1 ? '' : 's'} never called`,
      detail: sample[0]
        ? `Start with ${sample[0].customer?.name || 'the newest lead'} — open in your pipeline with no call logged.`
        : 'Open leads in your pipeline have no call logged yet.',
      leadId: sample[0]?.id || null,
    });
  }

  // 3. Coaching: agents whose answer rate trails the team (admin view only).
  if (isAdmin && !scopeAgentId && agentStats.length > 1) {
    const laggard = agentStats.find((a) => a.total >= 5 && a.answerRate < answerRate - 15);
    if (laggard) {
      suggestions.push({
        id: `coach-${laggard.agentId}`,
        severity: 'warning',
        title: `${laggard.name}'s answer rate is ${fmtRate(laggard.answerRate)} vs team ${fmtRate(answerRate)}`,
        detail: 'Review call timing and talk-time — a coaching opportunity.',
        agentId: laggard.agentId,
      });
    }
  }

  // 4. Best call window (positive, actionable).
  if (bestWindow) {
    suggestions.push({
      id: 'best-window',
      severity: 'positive',
      title: `Best time to call: ${pad2(bestWindow.hour)}:00–${pad2((bestWindow.hour + 1) % 24)}:00`,
      detail: `${bestWindow.connectRate}% of calls in this hour connect (${bestWindow.calls} calls). Schedule attempts here.`,
    });
  }

  // 5. Recordings worth reviewing.
  if (recorded > 0) {
    suggestions.push({
      id: 'review-recordings',
      severity: 'neutral',
      title: `${recorded} call${recorded === 1 ? '' : 's'} recorded this period`,
      detail: 'Review the longest calls for coaching and to capture follow-up commitments.',
    });
  }

  const staff = isAdmin
    ? await Agent.findAll({ where: { agencyId }, attributes: ['id', 'name'], order: [['name', 'ASC']], raw: true })
    : [];

  return {
    range: { from: start, to: end },
    kpis: {
      totalCalls: total,
      connectedCalls: connected,
      missedCalls: missed,
      answerRate,
      totalTalkSec: totalTalk,
      avgTalkSec,
      avgTimeToAnswerSec,
      recordedCalls: recorded,
      uniqueLeadsCalled: calledLeadIds.size,
    },
    deltas: {
      totalCalls: pctChange(total, prevTotal),
      answerRate: prevAnswerRate ? Math.round(answerRate - prevAnswerRate) : (answerRate > 0 ? answerRate : 0),
    },
    byDay,
    byStatus,
    byHour,
    bestWindow,
    agentStats,
    leadStats,
    recentCalls,
    suggestions,
    staff: staff.map((s) => ({ id: s.id, name: s.name })),
  };
}

function fmtRate(n) {
  return `${Math.round(Number(n) || 0)}%`;
}

module.exports = {
  getSummary,
  getCallingReport,
  getCrmReport,
  getSalesReport,
  getLeadFunnelReport,
  getAgentPerformanceReport,
  getPackageReport,
  getLostLeadsReport,
  getResponseReport,
  getReviewReport,
  getSeasonalReport,
  getProfitReport,
  getSourceReport,
  getLeadsByAd,
  getBookingReport,
  getCustomerLtvReport,
  getCacReport,
  getOperationalReport,
  getCampaignRoiReport,
  getGrowthReport,
  exportReport,
};
