// FILE: /backend/src/repositories/visaRepository.ts

const { Visa } = require('../models');

async function findAllByAgency(agencyId, activeOnly = false) {
  const where = { agencyId };
  if (activeOnly) where.isActive = true;

  return Visa.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(visaId, agencyId) {
  return Visa.findOne({ where: { id: visaId, agencyId } });
}

async function create(data) {
  return Visa.create(data);
}

async function update(visa, updates) {
  await visa.update(updates);
  return visa;
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
};
