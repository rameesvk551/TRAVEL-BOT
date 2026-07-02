// FILE: /backend/src/services/cruiseService.ts

const { Op } = require('sequelize');
const { Cruise } = require('../models');
const cruiseRepository = require('../repositories/cruiseRepository');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'cruiseLine', 'departurePort', 'destinations', 'duration',
  'cabinTypes', 'inclusions', 'exclusions', 'basePrice', 'imageUrl',
  'departureDate', 'capacity', 'summary', 'isActive',
];

function parsePositiveInt(value, fallback, max = 200) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildOrder(sortBy) {
  if (sortBy === 'price_asc') return [['basePrice', 'ASC'], ['createdAt', 'DESC']];
  if (sortBy === 'price_desc') return [['basePrice', 'DESC'], ['createdAt', 'DESC']];
  if (sortBy === 'name') return [['name', 'ASC']];
  return [['createdAt', 'DESC']];
}

/**
 * Lists all cruises for an agency.
 * @param {string} agencyId - Agency ID
 * @param {object|boolean} [options] - Options or activeOnly boolean
 * @returns {Promise<object[]|object>} List or paginated object of cruises
 */
async function listCruises(agencyId, options = false) {
  if (typeof options === 'boolean') {
    return cruiseRepository.findAllByAgency(agencyId, options);
  }

  const {
    active,
    activeOnly = active === 'true',
    tab = 'ALL',
    search,
    sortBy = 'newest',
    page,
    pageSize,
  } = options || {};

  const isPaginated = page !== undefined || pageSize !== undefined || options.paginated === 'true';
  const where = { agencyId };

  if (activeOnly) {
    where.isActive = true;
  } else if (tab === 'ACTIVE') {
    where.isActive = true;
  } else if (tab === 'INACTIVE') {
    where.isActive = false;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { cruiseLine: { [Op.iLike]: `%${search}%` } },
      { departurePort: { [Op.iLike]: `%${search}%` } },
      { summary: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!isPaginated) {
    return Cruise.findAll({ where, order: buildOrder(sortBy) });
  }

  const limit = parsePositiveInt(pageSize, 15);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;

  const { count, rows } = await Cruise.findAndCountAll({
    where,
    order: buildOrder(sortBy),
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
}

/**
 * Gets a cruise by ID.
 * @param {string} cruiseId - Cruise ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Cruise
 */
async function getCruiseById(cruiseId, agencyId) {
  const cruise = await cruiseRepository.findByIdAndAgency(cruiseId, agencyId);
  if (!cruise) {
    throw Object.assign(new Error('Cruise not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return cruise;
}

/**
 * Creates a new cruise.
 * @param {object} data - Cruise data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created cruise
 */
async function createCruise(data, agencyId) {
  return cruiseRepository.create({ ...data, agencyId });
}

/**
 * Updates a cruise.
 * @param {string} cruiseId - Cruise ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated cruise
 */
async function updateCruise(cruiseId, agencyId, updates) {
  const cruise = await getCruiseById(cruiseId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return cruiseRepository.update(cruise, filtered);
}

/**
 * Deletes (deactivates) a cruise.
 * @param {string} cruiseId - Cruise ID
 * @param {string} agencyId - Agency ID
 */
async function deleteCruise(cruiseId, agencyId) {
  const cruise = await getCruiseById(cruiseId, agencyId);
  return cruiseRepository.update(cruise, { isActive: false });
}

module.exports = {
  listCruises,
  getCruiseById,
  createCruise,
  updateCruise,
  deleteCruise,
};
