const bookingService = require('../services/bookingService');
const documentDeliveryService = require('../services/documentDeliveryService');
const { logActivity } = require('../services/activityService');

async function list(req, res, next) {
  try {
    const result = await bookingService.listBookings(req.agency.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.id, req.agency.id);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const booking = await bookingService.createBooking(req.body, req.agency.id);

    // Auto-send the Booking Confirmation template when the agency enabled it.
    // Best-effort: never block or fail the create on a delivery error.
    if (documentDeliveryService.isAutoSendEnabled(req.agency, 'booking')) {
      documentDeliveryService
        .sendBookingConfirmation(booking.id, req.agency, { agentId: req.agent?.id })
        .catch((err) => console.error('[Booking] auto-send failed:', err.message));
    }

    await logActivity(req, {
      action: 'booking.created',
      module: 'bookings',
      targetType: 'Booking',
      targetId: booking?.id,
      summary: `Created booking ${booking?.bookingReference || booking?.reference || booking?.id || ''}`.trim(),
    });

    res.status(201).json({ success: true, data: booking, message: 'Booking created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.agency.id, req.body);
    const changedFields = Object.keys(req.body || {});
    const statusChanged = changedFields.includes('status');
    await logActivity(req, {
      action: statusChanged ? 'booking.status_changed' : 'booking.updated',
      module: 'bookings',
      targetType: 'Booking',
      targetId: booking?.id || req.params.id,
      summary: statusChanged
        ? `Changed booking ${booking?.bookingReference || booking?.id || ''} status to ${booking?.status ?? 'updated'}`.trim()
        : `Updated booking ${booking?.bookingReference || booking?.id || ''} (${changedFields.join(', ') || 'no fields'})`.trim(),
      metadata: { changedFields },
    });
    res.json({ success: true, data: booking, message: 'Booking updated' });
  } catch (err) {
    next(err);
  }
}

async function timeline(req, res, next) {
  try {
    const timelineData = await bookingService.getBookingTimeline(req.params.id, req.agency.id);
    res.json({ success: true, data: timelineData });
  } catch (err) {
    next(err);
  }
}

async function invoice(req, res, next) {
  try {
    const { pdfBuffer, filename } = await bookingService.getBookingInvoicePdf(req.params.id, req.agency.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  timeline,
  invoice,
};
