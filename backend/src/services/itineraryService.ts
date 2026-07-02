const itineraryRepository = require('../repositories/itineraryRepository');

async function listItineraries(agencyId) {
  return itineraryRepository.findAllByAgency(agencyId);
}

async function getItineraryById(itineraryId, agencyId) {
  const itinerary = await itineraryRepository.findByIdAndAgency(itineraryId, agencyId);
  if (!itinerary) {
    throw Object.assign(new Error('Itinerary not found'), { statusCode: 404 });
  }
  return itinerary;
}

async function createItinerary(data, agencyId) {
  return itineraryRepository.create({
    ...data,
    agencyId,
    totalPrice: resolveTotalPrice(data, data.totalPrice),
  });
}

async function updateItinerary(itineraryId, agencyId, updates) {
  const itinerary = await getItineraryById(itineraryId, agencyId);

  const patch = { ...updates };
  // Recompute the stored total (paise) whenever pricing inputs change.
  if (updates.pricing !== undefined || updates.priceRooms !== undefined || updates.totalPrice !== undefined) {
    const current = typeof itinerary.toJSON === 'function' ? itinerary.toJSON() : itinerary;
    patch.totalPrice = resolveTotalPrice({ ...current, ...updates }, updates.totalPrice);
  }

  return itineraryRepository.update(itinerary, patch);
}

async function deleteItinerary(itineraryId, agencyId) {
  // Hard delete or status update
  return itineraryRepository.deleteOne(itineraryId, agencyId);
}

/**
 * Resolves the legacy `totalPrice` column (stored in paise) from the new
 * itinerary pricing model. Priority: pricing.grossTotal (rupees) → price-room
 * sum (rupees) → an explicitly provided paise value → 0.
 */
function resolveTotalPrice(data, explicitPaise) {
  const pricing = data && data.pricing;
  if (pricing && pricing.grossTotal != null && pricing.grossTotal !== '') {
    return Math.round(Number(pricing.grossTotal) * 100) || 0;
  }
  const rooms = Array.isArray(data && data.priceRooms) ? data.priceRooms : [];
  if (rooms.length) {
    const sum = rooms.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    if (sum) return Math.round(sum * 100);
  }
  return Number(explicitPaise) || 0;
}

module.exports = {
  listItineraries,
  getItineraryById,
  createItinerary,
  updateItinerary,
  deleteItinerary,
};
