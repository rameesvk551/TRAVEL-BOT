const paymentService = require('../services/paymentService');

async function requestPayment(req, res, next) {
  try {
    const payment = await paymentService.createAndSendPaymentLink(req.body.bookingId, req.agent.id);
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

module.exports = {
  requestPayment,
  webhook,
  byBooking,
};