// FILE: /backend/src/services/propertyService.ts

const { Op } = require('sequelize');
const { Property } = require('../models');
const propertyRepository = require('../repositories/propertyRepository');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'propertyType', 'location', 'address', 'amenities',
  'description', 'pricePerNight', 'imageUrl', 'images', 'isActive',
  'brochureUrl', 'brochureFileName',
];

/**
 * Lists all properties for an agency.
 * @param {string} agencyId - Agency ID
 * @param {boolean} [activeOnly=false] - Only return active properties
 * @returns {Promise<object[]>} List of properties
 */
function parsePositiveInt(value, fallback, max = 200) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildOrder(sortBy) {
  if (sortBy === 'price_asc') return [['pricePerNight', 'ASC'], ['createdAt', 'DESC']];
  if (sortBy === 'price_desc') return [['pricePerNight', 'DESC'], ['createdAt', 'DESC']];
  if (sortBy === 'name') return [['name', 'ASC']];
  return [['createdAt', 'DESC']];
}

async function listProperties(agencyId, options = false) {
  if (typeof options === 'boolean') {
    return propertyRepository.findAllByAgency(agencyId, options);
  }

  const {
    active,
    activeOnly = active === 'true',
    tab = 'ALL',
    type,
    search,
    sortBy = 'newest',
    page,
    pageSize,
  } = options || {};

  const isPaginated = page !== undefined || pageSize !== undefined || options.paginated === 'true';
  const where = { agencyId };

  if (activeOnly) where.isActive = true;
  if (tab === 'FOR_SALE') where.isActive = true;
  else if (tab === 'FOR_RENT') where.id = null;
  else if (tab === 'INACTIVE') where.isActive = false;

  if (type && type !== 'ALL') where.propertyType = type;

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } },
      { propertyType: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!isPaginated) {
    return Property.findAll({ where, order: buildOrder(sortBy) });
  }

  const limit = parsePositiveInt(pageSize, 15);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;
  const { count, rows } = await Property.findAndCountAll({
    where,
    order: buildOrder(sortBy),
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
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
