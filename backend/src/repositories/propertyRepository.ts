// FILE: /backend/src/repositories/propertyRepository.ts

const { Property } = require('../models');

async function findAllByAgency(agencyId, activeOnly = false) {
  const where = { agencyId };
  if (activeOnly) where.isActive = true;

  return Property.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(propertyId, agencyId) {
  return Property.findOne({ where: { id: propertyId, agencyId } });
}

async function create(data) {
  return Property.create(data);
}

async function update(property, updates) {
  await property.update(updates);
  return property;
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
};
