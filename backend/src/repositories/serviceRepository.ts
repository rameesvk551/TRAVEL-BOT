const { Service } = require('../models');

async function findAllByAgency(agencyId, activeOnly = false) {
  const where = { agencyId };
  if (activeOnly) where.isActive = true;

  return Service.findAll({
    where,
    order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(serviceId, agencyId) {
  return Service.findOne({ where: { id: serviceId, agencyId } });
}

async function create(data) {
  return Service.create(data);
}

async function update(service, updates) {
  await service.update(updates);
  return service;
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
};
