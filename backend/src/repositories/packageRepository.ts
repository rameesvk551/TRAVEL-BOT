const { Package } = require('../models');

async function findAllByAgency(agencyId, activeOnly = false) {
  const where = { agencyId };
  if (activeOnly) where.isActive = true;

  return Package.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(packageId, agencyId) {
  return Package.findOne({ where: { id: packageId, agencyId } });
}

async function create(data) {
  return Package.create(data);
}

async function update(pkg, updates) {
  await pkg.update(updates);
  return pkg;
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
};