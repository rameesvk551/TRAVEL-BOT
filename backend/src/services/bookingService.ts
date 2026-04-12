// FILE: /backend/src/services/bookingService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Booking, Lead, Customer, Package, Payment, ScheduledJob } = require('../models');
const { generateBookingRef } = require('../utils/bookingRefGenerator');
const { scheduleBookingReminders } = require('./schedulerService');

/**
 * Creates a booking from a lead.
 * @param {object} data - Booking data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created booking
 */
async function createBooking(data, agencyId) {
  const { leadId, packageId, totalAmount, advanceAmount, travelDate, returnDate, travellers, notes } = data;

  // Validate lead
  const lead = await Lead.findOne({
    where: { id: leadId, agencyId },
    include: [{ model: Customer, as: 'customer' }],
  });
  if (!lead) {
    throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'LEAD_NOT_FOUND' });
  }

  // Check no existing booking
  const existingBooking = await Booking.findOne({ where: { leadId } });
  if (existingBooking) {
    throw Object.assign(new Error('A booking already exists for this lead'), { statusCode: 409, code: 'BOOKING_EXISTS' });
  }

  const bookingRef = await generateBookingRef(agencyId);

  const booking = await Booking.create({
    leadId,
    customerId: lead.customerId,
    agencyId,
    packageId: packageId || lead.packageId,
    bookingRef,
    status: 'PENDING',
    totalAmount,
    advancePaid: advanceAmount || 0,
    travelDate: new Date(travelDate),
    returnDate: new Date(returnDate),
    travellers: travellers || lead.travellers,
    notes,
  });

  // Update lead status
  await lead.update({ status: 'BOOKED' });

  try {
    await scheduleBookingReminders(booking);
  } catch (err) {
    console.warn('[BookingService] Could not schedule booking reminders:', err.message);
  }

  return booking;
}

/**
 * Lists bookings for an agency with filtering and pagination.
 * @param {string} agencyId - Agency ID
 * @param {object} filters - { status, dateFrom, dateTo, page, pageSize }
 * @returns {Promise<object>} { data, total, page, pageSize }
 */
async function listBookings(agencyId, filters = {}) {
  const { status, dateFrom, dateTo, page = 1, pageSize = 20 } = filters;

  const where = { agencyId };
  if (status) where.status = status;

  if (dateFrom || dateTo) {
    where.travelDate = {};
    if (dateFrom) where.travelDate[Op.gte] = new Date(dateFrom);
    if (dateTo) where.travelDate[Op.lte] = new Date(dateTo);
  }

  const offset = (page - 1) * pageSize;

  const { count, rows } = await Booking.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Package, as: 'package', attributes: ['id', 'name', 'duration'] },
    ],
    order: [['travelDate', 'ASC']],
    limit: pageSize,
    offset,
  });

  return { data: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) };
}

/**
 * Gets a booking by ID with full details.
 * @param {string} bookingId - Booking ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Booking with relations
 */
async function getBookingById(bookingId, agencyId) {
  const booking = await Booking.findOne({
    where: { id: bookingId, agencyId },
    include: [
      { model: Customer, as: 'customer' },
      { model: Package, as: 'package' },
      { model: Lead, as: 'lead' },
      { model: Payment, as: 'payments', order: [['createdAt', 'DESC']] },
      { model: ScheduledJob, as: 'scheduledJobs' },
    ],
  });

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  return booking;
}

/**
 * Updates a booking's fields.
 * @param {string} bookingId - Booking ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Allowed fields
 * @returns {Promise<object>} Updated booking
 */
async function updateBooking(bookingId, agencyId, updates) {
  const booking = await Booking.findOne({ where: { id: bookingId, agencyId } });
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const allowedFields = ['status', 'notes', 'travelDate', 'returnDate'];
  const filtered = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  await booking.update(filtered);
  return booking;
}

/**
 * Gets the timeline of events for a booking.
 * @param {string} bookingId - Booking ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object[]>} Ordered event log
 */
async function getBookingTimeline(bookingId, agencyId) {
  const booking = await Booking.findOne({
    where: { id: bookingId, agencyId },
    include: [
      { model: Payment, as: 'payments' },
      { model: ScheduledJob, as: 'scheduledJobs' },
    ],
  });

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const events = [];

  // Booking created
  events.push({
    type: 'BOOKING_CREATED',
    title: 'Booking created',
    description: `Ref: ${booking.bookingRef}`,
    timestamp: booking.createdAt,
  });

  // Payment events
  for (const payment of booking.payments) {
    events.push({
      type: `PAYMENT_${payment.status}`,
      title: `Payment ${payment.type.toLowerCase()} — ${payment.status.toLowerCase()}`,
      description: `₹${(payment.amount / 100).toLocaleString('en-IN')}`,
      timestamp: payment.paidAt || payment.createdAt,
    });
  }

  // Scheduled job events
  for (const job of booking.scheduledJobs) {
    events.push({
      type: `REMINDER_${job.status}`,
      title: job.jobType.replace(/_/g, ' '),
      description: `Status: ${job.status}`,
      timestamp: job.scheduledAt,
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return events;
}

module.exports = {
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  getBookingTimeline,
};
