const { Agent } = require('../models');

async function findAllByAgency(agencyId) {
  return Agent.findAll({
    where: { agencyId },
    attributes: { exclude: ['passwordHash'] },
    order: [['createdAt', 'ASC']],
  });
}

async function create(data) {
  return Agent.create(data);
}

async function findByIdAndAgency(id, agencyId) {
  return Agent.findOne({ where: { id, agencyId } });
}

async function update(agent, updates) {
  await agent.update(updates);
  return agent;
}

async function updateById(id, updates) {
  await Agent.update(updates, { where: { id } });
}

module.exports = {
  findAllByAgency,
  create,
  findByIdAndAgency,
  update,
  updateById,
};