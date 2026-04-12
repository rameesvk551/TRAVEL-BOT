const leadService = require('../services/leadService');

async function list(req, res, next) {
  try {
    const result = await leadService.listLeads(req.agency.id, req.query);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.params.id, req.agency.id);
    res.json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const lead = await leadService.createLead(req.body, req.agency.id);
    res.status(201).json({ success: true, data: lead, message: 'Lead created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const lead = await leadService.updateLead(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: lead, message: 'Lead updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await leadService.deleteLead(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Lead cancelled' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};