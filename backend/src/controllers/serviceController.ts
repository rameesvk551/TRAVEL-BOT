const serviceService = require('../services/serviceService');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const services = await serviceService.listServices(req.agency.id, { ...req.query, activeOnly });
    res.json({ success: true, data: services });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const service = await serviceService.getServiceById(req.params.id, req.agency.id);
    res.json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const service = await serviceService.createService(req.body, req.agency.id);
    res.status(201).json({ success: true, data: service, message: 'Service created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const service = await serviceService.updateService(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: service, message: 'Service updated' });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await serviceService.deleteService(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Service deactivated' });
  } catch (err) {
    next(err);
  }
}

async function reorder(req, res, next) {
  try {
    const services = await serviceService.reorderServices(req.agency.id, req.body.orderedIds);
    res.json({ success: true, data: services, message: 'Services reordered' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  deactivate,
  reorder,
};
