const { Itinerary, Customer, Lead } = require('../models');

async function findAllByAgency(agencyId) {
  return Itinerary.findAll({
    where: { agencyId },
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Lead, as: 'lead', attributes: ['id', 'status', 'budgetPerPerson'] },
    ],
    order: [['createdAt', 'DESC']],
  });
}

async function findByIdAndAgency(itineraryId, agencyId) {
  return Itinerary.findOne({
    where: { id: itineraryId, agencyId },
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: Lead, as: 'lead', attributes: ['id', 'status', 'budgetPerPerson'] },
    ],
  });
}

async function create(data) {
  return Itinerary.create(data);
}

async function update(itinerary, updates) {
  await itinerary.update(updates);
  return itinerary;
}

async function deleteOne(itineraryId, agencyId) {
  return Itinerary.destroy({ where: { id: itineraryId, agencyId } });
}

module.exports = {
  findAllByAgency,
  findByIdAndAgency,
  create,
  update,
  deleteOne,
};
