const { Customer } = require('../models');

async function list(req, res, next) {
  try {
    const customers = await Customer.findAll({
      where: {
        agencyId: req.agency.id,
        isCustomer: true
      },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: customers });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, phone, notes } = req.body;
    let customer = await Customer.findOne({
      where: { agencyId: req.agency.id, phone }
    });

    if (customer) {
      // Update existing customer to be marked as isCustomer
      await customer.update({ name: name || customer.name, notes: notes || customer.notes, isCustomer: true });
    } else {
      customer = await Customer.create({
        agencyId: req.agency.id,
        name,
        phone,
        notes,
        isCustomer: true,
        source: 'manual'
      });
    }

    res.status(201).json({ success: true, data: customer, message: 'Customer created' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
};
