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
  // Validate and correct pricing natively
  const totals = calculateTotals(data.days || []);
  return itineraryRepository.create({
    ...data,
    agencyId,
    totalCost: totals.cost,
    totalPrice: totals.price,
  });
}

async function updateItinerary(itineraryId, agencyId, updates) {
  const itinerary = await getItineraryById(itineraryId, agencyId);
  
  if (updates.days) {
    const totals = calculateTotals(updates.days);
    updates.totalCost = totals.cost;
    updates.totalPrice = totals.price;
  }

  return itineraryRepository.update(itinerary, updates);
}

async function deleteItinerary(itineraryId, agencyId) {
  // Hard delete or status update
  return itineraryRepository.deleteOne(itineraryId, agencyId);
}

// Ensure cost and price accurately match the days
function calculateTotals(days) {
  let cost = 0;
  let price = 0;

  for (const day of days) {
    (day.hotels || []).forEach(h => {
      cost += Number(h.cost) || 0;
      price += Number(h.price) || 0;
    });
    (day.activities || []).forEach(a => {
      cost += Number(a.cost) || 0;
      price += Number(a.price) || 0;
    });
    (day.transports || []).forEach(t => {
      cost += Number(t.cost) || 0;
      price += Number(t.price) || 0;
    });
  }

  return { cost, price };
}

module.exports = {
  listItineraries,
  getItineraryById,
  createItinerary,
  updateItinerary,
  deleteItinerary,
};
