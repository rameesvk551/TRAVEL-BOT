// FILE: /backend/src/controllers/itineraryTemplateController.ts
//
// CRUD controller for themed itinerary templates. Reuses the shared
// document-template factory so it behaves identically to the quotation /
// invoice / receipt template builders.

const { ItineraryTemplate } = require('../models');
const { createController } = require('./documentTemplateController');

module.exports = createController({
  docType: 'itinerary',
  Model: ItineraryTemplate,
  defaultName: 'Standard Itinerary',
});
