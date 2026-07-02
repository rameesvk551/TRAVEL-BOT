// FILE: /backend/src/services/bookingService.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Booking, Lead, Customer, Package, Property, Cruise, Visa, Service, Payment, ScheduledJob, AccountInvoice } = require('../models');
const { generateBookingRef } = require('../utils/bookingRefGenerator');
const { scheduleBookingReminders } = require('./schedulerService');
const accountingService = require('./accountingService');

function optionalInclude(model, as, attributes) {
  return model ? { model, as, ...(attributes ? { attributes } : {}) } : null;
}

function compactIncludes(includes) {
  return includes.filter(Boolean);
}

const ITEM_PRICE_FIELD = {
  PACKAGE: 'basePrice',
  PROPERTY: 'pricePerNight',
  CRUISE: 'basePrice',
  VISA: 'price',
  SERVICE: 'basePrice',
};

function toPositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeItemType(value) {
  const itemType = String(value || 'PACKAGE').toUpperCase();
  return ['PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'].includes(itemType) ? itemType : 'PACKAGE';
}

async function findCatalogItem(agencyId, itemType, itemId) {
  const modelByType = { PACKAGE: Package, PROPERTY: Property, CRUISE: Cruise, VISA: Visa, SERVICE: Service };
  const model = modelByType[itemType];
  if (!model || !itemId) return null;
  return model.findOne({ where: { id: itemId, agencyId } });
}

/**
 * Creates a booking from a lead.
 * @param {object} data - Booking data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created booking
 */
async function createBooking(data, agencyId) {
  const { 
    leadId, customerId, newCustomer, 
    itemType = 'PACKAGE', packageId, propertyId, cruiseId, visaId, serviceId, customItemName, customItemDescription,
    itineraryId, basePrice, totalAmount, advanceAmount, paymentMode = 'FULL', paymentMethodId,
    settlementType = 'FULL_COLLECTION', commissionAmount,
    travelDate, returnDate, travellers, notes
  } = data;
  const isCommissionOnly = settlementType === 'COMMISSION_ONLY';
  const normalizedItemType = normalizeItemType(itemType);

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

  if (!finalCustomerId && newCustomer && newCustomer.name && newCustomer.phone) {
    let customer = await Customer.findOne({
      where: { agencyId, phone: newCustomer.phone }
    });
    if (!customer) {
      customer = await Customer.create({
        agencyId,
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email || null,
        isCustomer: true,
        source: 'manual'
      });
    }
    finalCustomerId = customer.id;
  }

  if (!finalCustomerId) {
    throw Object.assign(new Error('Customer ID or newCustomer details required'), { statusCode: 400, code: 'BAD_REQUEST' });
  }

  const finalTravellers = toPositiveInt(travellers) || toPositiveInt(lead?.travellers) || 1;
  const resolvedItemIds = {
    PACKAGE: packageId || lead?.packageId || null,
    PROPERTY: propertyId || lead?.propertyId || null,
    CRUISE: cruiseId || lead?.cruiseId || null,
    VISA: visaId || lead?.visaId || null,
    SERVICE: serviceId || lead?.serviceId || null,
  };

  const selectedItem = await findCatalogItem(agencyId, normalizedItemType, resolvedItemIds[normalizedItemType]);
  if (normalizedItemType !== 'CUSTOM' && resolvedItemIds[normalizedItemType] && !selectedItem) {
    throw Object.assign(new Error(`${normalizedItemType.toLowerCase()} not found`), { statusCode: 404, code: 'ITEM_NOT_FOUND' });
  }

  const catalogBasePrice = selectedItem ? toPositiveInt(selectedItem[ITEM_PRICE_FIELD[normalizedItemType]]) : 0;
  const finalBasePrice = toPositiveInt(basePrice) || catalogBasePrice || null;
  const finalTotalAmount = finalBasePrice ? finalBasePrice * finalTravellers : toPositiveInt(totalAmount);
  if (!finalTotalAmount) {
    throw Object.assign(new Error('Total amount or base price is required'), { statusCode: 400, code: 'BAD_REQUEST' });
  }

  // For COMMISSION_ONLY the agency only ever collects its commission (the advance);
  // the rest is paid by the customer at the property and stays off the books.
  const finalCommission = isCommissionOnly
    ? (toPositiveInt(commissionAmount) || toPositiveInt(advanceAmount) || 0)
    : null;

  // Determine advance paid and status
  let advancePaid = 0;
  if (isCommissionOnly) {
    advancePaid = finalCommission;
  } else if (paymentMode === 'FULL') {
    advancePaid = finalTotalAmount;
  } else if (paymentMode === 'ADVANCE') {
    advancePaid = advanceAmount || 0;
  }

  // The agency has its cut on a commission-only booking, so it is confirmed outright.
  const status = (isCommissionOnly || paymentMode === 'FULL') ? 'CONFIRMED' : 'PENDING';

  let booking = null;
  let bookingRef = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    bookingRef = await generateBookingRef(agencyId);
    try {
      booking = await Booking.create({
        leadId: leadId || null,
        customerId: finalCustomerId,
        agencyId,
        itemType: normalizedItemType,
        packageId: normalizedItemType === 'PACKAGE' ? resolvedItemIds.PACKAGE : null,
        propertyId: normalizedItemType === 'PROPERTY' ? resolvedItemIds.PROPERTY : null,
        cruiseId: normalizedItemType === 'CRUISE' ? resolvedItemIds.CRUISE : null,
        visaId: normalizedItemType === 'VISA' ? resolvedItemIds.VISA : null,
        serviceId: normalizedItemType === 'SERVICE' ? resolvedItemIds.SERVICE : null,
        customItemName: normalizedItemType === 'CUSTOM' ? customItemName : null,
        customItemDescription: normalizedItemType === 'CUSTOM' ? customItemDescription : null,
        paymentMode,
        settlementType,
        commissionAmount: finalCommission,
        itineraryId: itineraryId || null,
        bookingRef,
        status,
        basePrice: finalBasePrice,
        totalAmount: finalTotalAmount,
        advancePaid,
        travelDate: travelDate ? new Date(travelDate) : null,
        returnDate: returnDate ? new Date(returnDate) : null,
        travellers: finalTravellers,
        notes,
      });
      break;
    } catch (error) {
      const fields = error?.fields || {};
      const isBookingRefConflict = error?.name === 'SequelizeUniqueConstraintError'
        && (fields.bookingRef || fields.booking_ref || String(error?.message || '').includes('booking_ref'));
      if (!isBookingRefConflict || attempt === 2) throw error;
    }
  }

  let upfrontPayment = null;

  // Create payment record if money was paid upfront
  if (advancePaid > 0) {
    upfrontPayment = await Payment.create({
      bookingId: booking.id,
      agencyId,
      amount: advancePaid,
      paymentMethodId: paymentMethodId || null,
      status: 'PAID',
      type: paymentMode === 'FULL' ? 'FULL' : 'ADVANCE',
      paidAt: new Date()
    });
  }

  // Every booking creates the receivable immediately. Any upfront money also
  // posts the receipt, so unpaid and partially paid bookings show in accounts.
  try {
    await accountingService.postBookingInvoice(booking.id, agencyId);
    if (upfrontPayment) {
      await accountingService.postPaymentReceipt(upfrontPayment.id, agencyId);
    }
  } catch (err) {
    console.warn('[BookingService] Could not post booking accounting:', err.message);
  }

  // Update lead status
  if (lead && lead.status !== 'CONVERTED') {
    await lead.update({ status: 'CONVERTED' });
  }
  const cust = await Customer.findByPk(finalCustomerId);
  if (cust && !cust.isCustomer) await cust.update({ isCustomer: true });

  try {
    await scheduleBookingReminders(booking);
  } catch (err) {
    console.warn('[BookingService] Could not schedule booking reminders:', err.message);
  }

  // WhatsApp confirmation is delivered only via approved templates:
  //   • booking-confirmation template — bookingController (autoSend.booking)
  //   • invoice PDF as DOCUMENT header — accountingService (autoSend.invoice)
  // No hardcoded plain-text message is sent here.

  return booking;
}

/**
 * Lists bookings for an agency with filtering and pagination.
 * @param {string} agencyId - Agency ID
 * @param {object} filters - { status, dateFrom, dateTo, page, pageSize, customerId, packageId, serviceId, itemType }
 * @returns {Promise<object>} { data, total, page, pageSize, stats }
 */
async function listBookings(agencyId, filters = {}) {
  const { status, dateFrom, dateTo, page = 1, pageSize = 20, customerId, packageId, propertyId, serviceId, itemType } = filters;

  const where = { agencyId };
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;
  if (packageId) where.packageId = packageId;
  if (propertyId) where.propertyId = propertyId;
  if (serviceId) where.serviceId = serviceId;
  
  if (itemType) {
    if (itemType === 'EXT') {
      where.itemType = 'CUSTOM';
    } else {
      where.itemType = itemType;
    }
  }

  if (dateFrom || dateTo) {
    where.travelDate = {};
    if (dateFrom) where.travelDate[Op.gte] = new Date(dateFrom);
    if (dateTo) where.travelDate[Op.lte] = new Date(dateTo);
  }

  const offset = (page - 1) * pageSize;

  const { count, rows } = await Booking.findAndCountAll({
    where,
    include: compactIncludes([
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Package, as: 'package', attributes: ['id', 'name', 'duration'] },
      optionalInclude(Property, 'property', ['id', 'name', 'propertyType', 'location']),
      optionalInclude(Cruise, 'cruise', ['id', 'name']),
      optionalInclude(Visa, 'visa', ['id', 'country', 'visaType']),
      optionalInclude(Service, 'service', ['id', 'name', 'category']),
      optionalInclude(AccountInvoice, 'accountInvoice', ['id', 'invoiceNumber', 'status', 'pdfUrl']),
    ]),
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset,
  });

  // Settlement-aware stats: for COMMISSION_ONLY bookings the agency's revenue is only its
  // commission and nothing is due to the agency (the package balance is paid by the customer
  // at the property — that sits in balanceAtProperty, not on the agency's books).
  const statRows = await Booking.findAll({
    where,
    attributes: ['totalAmount', 'advancePaid', 'settlementType', 'commissionAmount'],
    raw: true,
  });
  let totalRevenue = 0;
  let totalAdvance = 0;
  let totalBalanceDue = 0;
  for (const b of statRows) {
    const advance = Number(b.advancePaid) || 0;
    const isCommissionOnly = b.settlementType === 'COMMISSION_ONLY';
    const revenue = isCommissionOnly
      ? (b.commissionAmount != null ? Number(b.commissionAmount) : advance)
      : (Number(b.totalAmount) || 0);
    totalRevenue += revenue;
    totalAdvance += advance;
    totalBalanceDue += Math.max(0, revenue - advance);
  }

  const stats = {
    totalBookings: count,
    totalRevenue,
    totalAdvancePaid: totalAdvance,
    totalBalanceDue,
  };

  return { data: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize), stats };
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
    include: compactIncludes([
      { model: Customer, as: 'customer' },
      { model: Package, as: 'package' },
      optionalInclude(Property, 'property'),
      optionalInclude(Cruise, 'cruise'),
      optionalInclude(Visa, 'visa'),
      optionalInclude(Service, 'service'),
      { model: Lead, as: 'lead' },
      { model: Payment, as: 'payments', order: [['createdAt', 'DESC']] },
      { model: ScheduledJob, as: 'scheduledJobs' },
      { model: AccountInvoice, as: 'accountInvoice' },
    ]),
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

  // When an agent confirms a booking (not via online payment), recognise the
  // receivable by posting the invoice journal. Idempotent — safe if already posted
  // by the payment webhook, and never blocks the status update.
  if (filtered.status === 'CONFIRMED') {
    try {
      await accountingService.postBookingInvoice(booking.id, agencyId);
    } catch (err) {
      console.warn('[BookingService] Could not post booking invoice:', err.message);
    }
  }

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

async function getBookingInvoicePdf(bookingId, agencyId) {
  const booking = await Booking.findOne({
    where: { id: bookingId, agencyId },
    include: [{ model: AccountInvoice, as: 'accountInvoice' }],
  });

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }

  const invoice = booking.accountInvoice || await accountingService.postBookingInvoice(booking.id, agencyId);
  const invoicePdfService = require('./invoicePdfService');
  const pdfBuffer = await invoicePdfService.generateInvoicePdf(booking.id, invoice, agencyId);

  return {
    pdfBuffer,
    invoice,
    filename: invoicePdfService.invoiceFileName(invoice, booking),
  };
}

module.exports = {
  createBooking,
  listBookings,
  getBookingById,
  updateBooking,
  getBookingTimeline,
  getBookingInvoicePdf,
};
