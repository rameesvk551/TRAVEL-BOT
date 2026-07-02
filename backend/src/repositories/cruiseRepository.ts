// FILE: /backend/src/repositories/cruiseRepository.ts

const { Cruise } = require('../models');

async function findAllByAgency(agencyId, activeOnly = false) {
  const where = { agencyId };
  if (activeOnly) where.isActive = true;

  return Cruise.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(cruiseId, agencyId) {
  return Cruise.findOne({ where: { id: cruiseId, agencyId } });
}

async function create(data) {
  return Cruise.create(data);
}

async function update(cruise, updates) {
  await cruise.update(updates);
  return cruise;
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
};
