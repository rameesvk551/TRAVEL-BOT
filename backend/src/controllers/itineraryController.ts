const itineraryService = require('../services/itineraryService');

async function list(req, res, next) {
  try {
    const itineraries = await itineraryService.listItineraries(req.agency.id);
    res.json({ success: true, data: itineraries });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const itinerary = await itineraryService.getItineraryById(req.params.id, req.agency.id);
    res.json({ success: true, data: itinerary });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const itinerary = await itineraryService.createItinerary(req.body, req.agency.id);
    res.status(201).json({ success: true, data: itinerary, message: 'Itinerary created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const itinerary = await itineraryService.updateItinerary(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: itinerary, message: 'Itinerary updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await itineraryService.deleteItinerary(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Itinerary deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
