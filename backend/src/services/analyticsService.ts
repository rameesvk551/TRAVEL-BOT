// FILE: /backend/src/services/analyticsService.js
// DEPS: sequelize

const { Op, fn, col, literal } = require('sequelize');
const { Lead, Booking, Payment, Package, sequelize } = require('../models');

/**
 * Gets analytics summary for an agency dashboard.
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Analytics summary object
 */
async function getSummary(agencyId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Total leads
  const totalLeads = await Lead.count({ where: { agencyId } });

  // New leads today
  const newLeadsToday = await Lead.count({
    where: {
      agencyId,
      createdAt: { [Op.gte]: today },
    },
  });

  // Leads by status
  const leadsByStatus = await Lead.findAll({
    where: { agencyId },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  // Conversion rate
  const bookedLeads = await Lead.count({ where: { agencyId, status: 'BOOKED' } });
  const conversionRate = totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(1) : 0;

  // Confirmed bookings this month
  const confirmedBookings = await Booking.count({
    where: {
      agencyId,
      status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] },
      createdAt: { [Op.gte]: monthStart },
    },
  });

  // Total revenue (sum of paid payments)
  const totalRevenueResult = await Payment.sum('amount', {
    where: { agencyId, status: 'PAID' },
  });
  const totalRevenue = totalRevenueResult || 0;

  // Pending payments
  const pendingPayments = await Payment.count({
    where: { agencyId, status: 'PENDING' },
  });

  // Top 5 packages by booking count
  const topPackages = await Booking.findAll({
    where: { agencyId, packageId: { [Op.not]: null } },
    attributes: ['packageId', [fn('COUNT', col('Booking.id')), 'bookingCount']],
    include: [{ model: Package, as: 'package', attributes: ['name', 'basePrice'] }],
    group: ['packageId', 'package.id'],
    order: [[literal('"bookingCount"'), 'DESC']],
    limit: 5,
    raw: false,
  });

  // Revenue by month (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const revenueByMonth = await Payment.findAll({
    where: {
      agencyId,
      status: 'PAID',
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
    totalLeads,
    newLeadsToday,
    conversionRate: parseFloat(conversionRate),
    totalRevenue,
    pendingPayments,
    confirmedBookings,
    topPackages,
    leadsByStatus,
    revenueByMonth,
  };
}

module.exports = { getSummary };
