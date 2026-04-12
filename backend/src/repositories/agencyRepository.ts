const { Agency } = require('../models');

async function findById(id) {
  return Agency.findByPk(id);
}

async function updateById(id, updates) {
  await Agency.update(updates, { where: { id } });
  return findById(id);
}

module.exports = {
  findById,
  updateById,
};