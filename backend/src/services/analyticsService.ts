// FILE: /backend/src/services/analyticsService.ts
// DEPS: sequelize

const { Op, fn, col, literal, cast } = require('sequelize');
const {
  Lead, Booking, Payment, Package, Customer, Agent,
  Message, Review, Campaign, CampaignRecipient, sequelize,
} = require('../models');

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

module.exports = {
  getSummary,
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
  getBookingReport,
  exportReport,
};
