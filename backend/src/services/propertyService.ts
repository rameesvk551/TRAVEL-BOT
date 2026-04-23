// FILE: /backend/src/services/propertyService.ts

const propertyRepository = require('../repositories/propertyRepository');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'propertyType', 'location', 'address', 'amenities',
  'description', 'pricePerNight', 'imageUrl', 'images', 'isActive',
];

/**
 * Lists all properties for an agency.
 * @param {string} agencyId - Agency ID
 * @param {boolean} [activeOnly=false] - Only return active properties
 * @returns {Promise<object[]>} List of properties
 */
async function listProperties(agencyId, activeOnly = false) {
  return propertyRepository.findAllByAgency(agencyId, activeOnly);
}

/**
 * Gets a property by ID.
 * @param {string} propertyId - Property ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Property
 */
async function getPropertyById(propertyId, agencyId) {
  const property = await propertyRepository.findByIdAndAgency(propertyId, agencyId);
  if (!property) {
    throw Object.assign(new Error('Property not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return property;
}

/**
 * Creates a new property.
 * @param {object} data - Property data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created property
 */
async function createProperty(data, agencyId) {
  return propertyRepository.create({ ...data, agencyId });
}

/**
 * Updates a property.
 * @param {string} propertyId - Property ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated property
 */
async function updateProperty(propertyId, agencyId, updates) {
  const property = await getPropertyById(propertyId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return propertyRepository.update(property, filtered);
}

/**
 * Deletes (deactivates) a property.
 * @param {string} propertyId - Property ID
 * @param {string} agencyId - Agency ID
 */
async function deleteProperty(propertyId, agencyId) {
  const property = await getPropertyById(propertyId, agencyId);
  return propertyRepository.update(property, { isActive: false });
}

module.exports = {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
};
