const bookingService = require('../services/bookingService');

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
    res.status(201).json({ success: true, data: booking, message: 'Booking created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.agency.id, req.body);
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

module.exports = {
  list,
  getById,
  create,
  update,
  timeline,
};