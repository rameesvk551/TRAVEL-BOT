// FILE: /backend/src/services/serviceService.js

const { Op } = require('sequelize');
const { Service } = require('../models');
const serviceRepository = require('../repositories/serviceRepository');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'category', 'description', 'icon', 'basePrice',
  'imageUrl', 'pricingType', 'features', 'isActive', 'displayOrder',
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
  if (sortBy === 'order') return [['displayOrder', 'ASC'], ['createdAt', 'DESC']];
  return [['createdAt', 'DESC']];
}

/**
 * Lists all services for an agency with filtering, search, and pagination.
 * @param {string} agencyId
 * @param {object} options
 */
async function listServices(agencyId, options = {}) {
  const {
    activeOnly,
    tab = 'ALL',
    category,
    search,
    sortBy = 'newest',
    page,
    pageSize,
  } = options || {};

  const isPaginated = page !== undefined || pageSize !== undefined || options.paginated === 'true';
  const where = { agencyId };

  if (activeOnly) where.isActive = true;
  if (tab === 'INACTIVE') where.isActive = false;
  else if (tab !== 'ALL' && tab) where.category = { [Op.iLike]: `%${tab}%` };

  if (category && category !== 'ALL') where.category = category;

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { category: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!isPaginated) {
    return Service.findAll({ where, order: buildOrder(sortBy) });
  }

  const limit = parsePositiveInt(pageSize, 15);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;
  const { count, rows } = await Service.findAndCountAll({
    where,
    order: buildOrder(sortBy),
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
}

/**
 * Gets a service by ID.
 * @param {string} serviceId
 * @param {string} agencyId
 */
async function getServiceById(serviceId, agencyId) {
  const service = await serviceRepository.findByIdAndAgency(serviceId, agencyId);
  if (!service) {
    throw Object.assign(new Error('Service not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return service;
}

/**
 * Creates a new service.
 * @param {object} data
 * @param {string} agencyId
 */
async function createService(data, agencyId) {
  return serviceRepository.create({ ...data, agencyId });
}

/**
 * Updates a service with whitelisted fields.
 * @param {string} serviceId
 * @param {string} agencyId
 * @param {object} updates
 */
async function updateService(serviceId, agencyId, updates) {
  const service = await getServiceById(serviceId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return serviceRepository.update(service, filtered);
}

/**
 * Soft-deletes (deactivates) a service.
 * @param {string} serviceId
 * @param {string} agencyId
 */
async function deleteService(serviceId, agencyId) {
  const service = await getServiceById(serviceId, agencyId);
  return serviceRepository.update(service, { isActive: false });
}

/**
 * Reorders services based on an array of IDs.
 * @param {string} agencyId
 * @param {string[]} orderedIds
 */
async function reorderServices(agencyId, orderedIds) {
  const services = await serviceRepository.findAllByAgency(agencyId);
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const updates = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const service = serviceMap.get(orderedIds[i]);
    if (service && service.displayOrder !== i) {
      updates.push(service.update({ displayOrder: i }));
    }
  }

  await Promise.all(updates);
  return serviceRepository.findAllByAgency(agencyId);
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  reorderServices,
};
