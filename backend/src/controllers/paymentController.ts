const paymentService = require('../services/paymentService');
const documentPdfService = require('../services/documentPdfService');
const documentDeliveryService = require('../services/documentDeliveryService');
const { Payment } = require('../models');
const { logActivity } = require('../services/activityService');

async function requestPayment(req, res, next) {
  try {
    const payment = await paymentService.createAndSendPaymentLink(req.body.bookingId, req.agent.id);
    await logActivity(req, {
      action: 'payment.link_sent',
      module: 'payments',
      targetType: 'Payment',
      targetId: payment?.id,
      summary: `Sent a payment link${payment?.amount ? ` for ${payment.amount}` : ''}`,
      metadata: { bookingId: req.body.bookingId },
    });
    res.status(201).json({ success: true, data: payment, message: 'Payment link sent' });
  } catch (err) {
    next(err);
  }
}

async function webhook(req, res) {
  try {
    const result = await paymentService.handleRazorpayWebhook(req);
    res.json(result);
  } catch (err) {
    console.error('[Payments] Webhook error:', err.message);
    res.json({ status: 'ok' });
  }
}

async function byBooking(req, res, next) {
  try {
    const payments = await paymentService.getPaymentsByBooking(req.params.bookingId, req.agency.id);
    res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { status, type, page, pageSize } = req.query;
    const payments = await paymentService.listPayments(req.agency.id, { status, type, page, pageSize });
    res.json({ success: true, ...payments });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:id/receipt - download the rendered receipt PDF
async function downloadReceipt(req, res, next) {
  try {
    const { buffer, filename } = await documentPdfService.generateReceiptPdf(req.params.id, req.agency.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// POST /api/payments/:id/receipt/send-whatsapp - generate + send to the customer
async function sendReceipt(req, res, next) {
  try {
    const payment = await Payment.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    const result = await documentDeliveryService.sendReceiptForPayment(payment.id, req.agency, { agentId: req.agent?.id });
    res.json({ success: true, data: result, message: 'Receipt sent on WhatsApp' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestPayment,
  webhook,
  byBooking,
  list,
  downloadReceipt,
  sendReceipt,
};