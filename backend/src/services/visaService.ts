// FILE: /backend/src/services/visaService.ts

const { Op } = require('sequelize');
const { Visa } = require('../models');
const visaRepository = require('../repositories/visaRepository');

const ALLOWED_UPDATE_FIELDS = [
  'country', 'visaType', 'price', 'processingTime', 'validityPeriod',
  'requiredDocuments', 'description', 'imageUrl', 'eligibilityNotes', 'isActive',
];

function parsePositiveInt(value, fallback, max = 200) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildOrder(sortBy) {
  if (sortBy === 'price_asc') return [['price', 'ASC'], ['createdAt', 'DESC']];
  if (sortBy === 'price_desc') return [['price', 'DESC'], ['createdAt', 'DESC']];
  if (sortBy === 'country' || sortBy === 'name') return [['country', 'ASC']];
  return [['createdAt', 'DESC']];
}

/**
 * Lists all visas for an agency.
 * @param {string} agencyId - Agency ID
 * @param {object|boolean} [options] - Options or activeOnly boolean
 * @returns {Promise<object[]|object>} List or paginated object of visas
 */
async function listVisas(agencyId, options = false) {
  if (typeof options === 'boolean') {
    return visaRepository.findAllByAgency(agencyId, options);
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
  } else if (tab === 'INACTIVE') {
    where.isActive = false;
  } else if (tab === 'ACTIVE') {
    where.isActive = true;
  } else if (tab && tab !== 'ALL') {
    // Filter by specific type (e.g. Tourist, Business)
    where.visaType = tab;
    where.isActive = true;
  }

  if (search) {
    where[Op.or] = [
      { country: { [Op.iLike]: `%${search}%` } },
      { visaType: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { eligibilityNotes: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!isPaginated) {
    return Visa.findAll({ where, order: buildOrder(sortBy) });
  }

  const limit = parsePositiveInt(pageSize, 15);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;

  const { count, rows } = await Visa.findAndCountAll({
    where,
    order: buildOrder(sortBy),
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
}

/**
 * Gets a visa by ID.
 * @param {string} visaId - Visa ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Visa
 */
async function getVisaById(visaId, agencyId) {
  const visa = await visaRepository.findByIdAndAgency(visaId, agencyId);
  if (!visa) {
    throw Object.assign(new Error('Visa not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return visa;
}

/**
 * Creates a new visa.
 * @param {object} data - Visa data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created visa
 */
async function createVisa(data, agencyId) {
  return visaRepository.create({ ...data, agencyId });
}

/**
 * Updates a visa.
 * @param {string} visaId - Visa ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated visa
 */
async function updateVisa(visaId, agencyId, updates) {
  const visa = await getVisaById(visaId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return visaRepository.update(visa, filtered);
}

/**
 * Deletes (deactivates) a visa.
 * @param {string} visaId - Visa ID
 * @param {string} agencyId - Agency ID
 */
async function deleteVisa(visaId, agencyId) {
  const visa = await getVisaById(visaId, agencyId);
  return visaRepository.update(visa, { isActive: false });
}

module.exports = {
  listVisas,
  getVisaById,
  createVisa,
  updateVisa,
  deleteVisa,
};
