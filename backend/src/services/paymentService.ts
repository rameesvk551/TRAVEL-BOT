// FILE: /backend/src/services/paymentService.js
// DEPS: axios
// ENV: (uses agency's own Razorpay keys from DB)

const axios = require('axios');
const crypto = require('crypto');
const { Payment, Booking, Customer, Agency, Package, BotSession } = require('../models');
const { decrypt } = require('../utils/crypto');
const whatsappService = require('./whatsappService');
const accountingService = require('./accountingService');
const documentDeliveryService = require('./documentDeliveryService');

/**
 * Creates a Razorpay payment link and sends it to the customer via WhatsApp.
 * @param {string} bookingId - Booking ID
 * @param {string} agentId - Agent who initiated the request
 * @returns {Promise<object>} Payment record
 */
async function createAndSendPaymentLink(bookingId, agentId) {
  const booking = await Booking.findByPk(bookingId, {
    include: [
      { model: Customer, as: 'customer' },
      { model: Agency, as: 'agency' },
      { model: Package, as: 'package' },
    ],
  });

  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw Object.assign(new Error('Cannot create payment for this booking status'), { statusCode: 400, code: 'INVALID_BOOKING_STATUS' });
  }

  const agency = booking.agency;
  if (!agency.razorpayKeyId || !agency.razorpayKeySecret) {
    throw Object.assign(new Error('Agency has not configured Razorpay keys'), { statusCode: 400, code: 'RAZORPAY_NOT_CONFIGURED' });
  }

  const razorpaySecret = decrypt(agency.razorpayKeySecret);
  const amountDue = booking.totalAmount - booking.advancePaid;

  if (amountDue <= 0) {
    throw Object.assign(new Error('No amount due for this booking'), { statusCode: 400, code: 'NO_AMOUNT_DUE' });
  }

  // Create Razorpay payment link
  const expireBy = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours
  const packageName = booking.package?.name || 'Travel Package';

  let razorpayResponse;
  try {
    razorpayResponse = await axios.post(
      'https://api.razorpay.com/v1/payment_links',
      {
        amount: amountDue,
        currency: 'INR',
        description: `${packageName} — Booking #${booking.bookingRef}`,
        customer: {
          name: booking.customer.name || 'Customer',
          contact: booking.customer.phone,
        },
        expire_by: expireBy,
        notify: { sms: false, email: false },
        callback_url: `${process.env.BASE_URL}/api/payments/webhook`,
        callback_method: 'get',
      },
      {
        auth: {
          username: agency.razorpayKeyId,
          password: razorpaySecret,
        },
        timeout: 15000,
      }
    );
  } catch (err) {
    console.error('[PaymentService] Razorpay API error:', err.response?.data || err.message);
    throw Object.assign(new Error('Failed to create payment link'), { statusCode: 502, code: 'RAZORPAY_API_ERROR' });
  }

  // Save payment record
  const payment = await Payment.create({
    bookingId,
    agencyId: agency.id,
    razorpayPaymentLinkId: razorpayResponse.data.id,
    amount: amountDue,
    status: 'PENDING',
    type: booking.advancePaid > 0 ? 'BALANCE' : 'ADVANCE',
    paymentLinkUrl: razorpayResponse.data.short_url,
    expiresAt: new Date(expireBy * 1000),
  });

  // Send payment link via WhatsApp
  const formattedAmount = `₹${(amountDue / 100).toLocaleString('en-IN')}`;
  await whatsappService.sendTemplateMessage(
    booking.customer.phone,
    'payment_request',
    [booking.customer.name || 'Customer', packageName, formattedAmount, razorpayResponse.data.short_url, '24'],
    { customerId: booking.customerId, agencyId: agency.id }
  );

  await BotSession.update(
    { currentStep: 'PAYMENT_PENDING' },
    { where: { customerId: booking.customerId, agencyId: agency.id } }
  );

  return payment;
}

/**
 * Handles incoming Razorpay webhook events.
 * @param {object} req - Express request with raw body
 * @returns {Promise<object>} { status: 'ok' }
 */
async function handleRazorpayWebhook(req) {
  const { body, headers } = req;
  const signature = headers['x-razorpay-signature'];

  if (!signature || !body) {
    throw Object.assign(new Error('Missing signature or body'), { statusCode: 400 });
  }

  const event = body.event;
  const payload = body.payload;

  if (event === 'payment_link.paid') {
    const paymentLinkId = payload.payment_link?.entity?.id;
    const razorpayPaymentId = payload.payment?.entity?.id;

    const payment = await Payment.findOne({
      where: { razorpayPaymentLinkId: paymentLinkId },
      include: [
        { model: Booking, as: 'booking', include: [{ model: Customer, as: 'customer' }, { model: Package, as: 'package' }] },
        { model: Agency, as: 'agency' },
      ],
    });

    if (!payment) {
      console.error('[PaymentService] Payment not found for link:', paymentLinkId);
      return { status: 'ok' };
    }

    // Verify signature with agency's webhook secret
    const agency = payment.agency;
    if (agency.webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', agency.webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error('[PaymentService] Webhook signature mismatch');
        throw Object.assign(new Error('Invalid signature'), { statusCode: 403 });
      }
    }

    // Update payment
    await payment.update({
      status: 'PAID',
      razorpayPaymentId,
      paidAt: new Date(),
    });

    // Update booking
    const booking = payment.booking;
    await booking.update({
      advancePaid: booking.advancePaid + payment.amount,
      status: 'CONFIRMED',
    });

    // Post to accounting ledgers. The payment is already recorded above; accounting
    // posts are idempotent (deduped by booking/payment) so a failure here is logged
    // and can be safely re-run via backfill — it must never lose a confirmed payment.
    try {
      await accountingService.postBookingInvoice(booking.id, agency.id);
      await accountingService.postPaymentReceipt(payment.id, agency.id);
    } catch (err) {
      console.error('[PaymentService] Accounting post failed (retryable via backfill):', err.message);
    }

    // Send confirmation via WhatsApp
    const formattedAmount = `₹${(payment.amount / 100).toLocaleString('en-IN')}`;
    const balanceDue = `₹${((booking.totalAmount - booking.advancePaid - payment.amount) / 100).toLocaleString('en-IN')}`;

    await whatsappService.sendTemplateMessage(
      booking.customer.phone,
      'booking_confirmed',
      [
        booking.customer.name || 'Customer',
        booking.package?.name || 'Travel Package',
        booking.bookingRef,
        formattedAmount,
        balanceDue,
      ],
      { customerId: booking.customerId, agencyId: agency.id }
    );

    await BotSession.update(
      { currentStep: 'COMPLETE' },
      { where: { customerId: booking.customerId, agencyId: agency.id } }
    );

    // Auto-send a payment receipt PDF to the customer when enabled. Best-effort:
    // a delivery failure must never affect the webhook acknowledgement.
    if (documentDeliveryService.isAutoSendEnabled(agency, 'receipt')) {
      try {
        await documentDeliveryService.sendReceiptForPayment(payment.id, agency);
      } catch (err) {
        console.error('[PaymentService] Receipt auto-send failed:', err.message);
      }
    }
  }

  if (event === 'payment_link.expired') {
    const paymentLinkId = payload.payment_link?.entity?.id;
    const payment = await Payment.findOne({
      where: { razorpayPaymentLinkId: paymentLinkId },
      include: [{ model: Booking, as: 'booking', include: [{ model: Customer, as: 'customer' }] }],
    });

    if (payment) {
      await payment.update({ status: 'EXPIRED' });

      await whatsappService.sendTextMessage(
        payment.booking.customer.phone,
        'Your payment link has expired. Reply RENEW for a new payment link.',
        { customerId: payment.booking.customerId, agencyId: payment.agencyId }
      );
    }
  }

  return { status: 'ok' };
}

/**
 * Gets payment history for a booking.
 * @param {string} bookingId - Booking ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object[]>} Payment records
 */
async function getPaymentsByBooking(bookingId, agencyId) {
  return Payment.findAll({
    where: { bookingId, agencyId },
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Lists all payments for an agency with filtering and pagination.
 * @param {string} agencyId - Agency ID
 * @param {object} filters - { status, type, page, pageSize }
 * @returns {Promise<object>} { data, total, page, pageSize }
 */
async function listPayments(agencyId, filters = {}) {
  const { status, type, page = 1, pageSize = 20 } = filters;
  const where = { agencyId };
  if (status) where.status = status;
  if (type) where.type = type;

  const offset = (page - 1) * pageSize;

  const { count, rows } = await Payment.findAndCountAll({
    where,
    include: [
      { 
        model: Booking, 
        as: 'booking', 
        attributes: ['id', 'bookingRef', 'totalAmount', 'advancePaid'],
        include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }] 
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: parseInt(pageSize),
    offset: parseInt(offset),
  });

  return { data: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) };
}

module.exports = {
  createAndSendPaymentLink,
  handleRazorpayWebhook,
  getPaymentsByBooking,
  listPayments,
};
