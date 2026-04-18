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
  const { leadId, customerId, packageId, itineraryId, totalAmount, advanceAmount, travelDate, returnDate, travellers, notes } = data;

  let finalCustomerId = customerId;

  // Validate lead if leadId is provided
  let lead = null;
  if (leadId) {
    lead = await Lead.findOne({
      where: { id: leadId, agencyId },
      include: [{ model: Customer, as: 'customer' }],
    });
    if (!lead) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404, code: 'LEAD_NOT_FOUND' });
    }
    finalCustomerId = lead.customerId;
  }

  if (!finalCustomerId) {
    throw Object.assign(new Error('Customer ID is required'), { statusCode: 400, code: 'BAD_REQUEST' });
  }

  const bookingRef = await generateBookingRef(agencyId);

  const booking = await Booking.create({
    leadId: leadId || null,
    customerId: finalCustomerId,
    agencyId,
    packageId: packageId || (lead ? lead.packageId : null),
    itineraryId: itineraryId || null,
    bookingRef,
    status: 'PENDING',
    totalAmount,
    advancePaid: advanceAmount || 0,
    travelDate: new Date(travelDate),
    returnDate: returnDate ? new Date(returnDate) : null,
    travellers: travellers || (lead ? lead.travellers : 1),
    notes,
  });

  // Update lead status
  if (lead && lead.status !== 'CONVERTED') {
    await lead.update({ status: 'CONVERTED' });
    const cust = await Customer.findByPk(finalCustomerId);
    if (cust && !cust.isCustomer) await cust.update({ isCustomer: true });
  }

  try {
    await scheduleBookingReminders(booking);
  } catch (err) {
    console.warn('[BookingService] Could not schedule booking reminders:', err.message);
  }

  // Send WhatsApp confirmation
  try {
    const cust = lead?.customer || await Customer.findByPk(finalCustomerId);
    if (cust && cust.phone) {
      const whatsappService = require('./whatsappService');
      const msg = `🎉 *Booking Confirmed!*\n\nHi ${cust.name || 'Traveler'},\nYour booking is confirmed with reference *${bookingRef}*.\n\nTravel Date: ${new Date(travelDate).toDateString()}\n\nReply with any documents we might need to process your trip!`;
      await whatsappService.sendTextMessage(agencyId, cust.phone, msg);
    }
  } catch (err) {
    console.warn('[BookingService] Could not send WhatsApp confirmation:', err.message);
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
