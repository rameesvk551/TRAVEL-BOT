const leadService = require('../services/leadService');

async function list(req, res, next) {
  try {
    const result = await leadService.listLeads(req.agency.id, req.query, req.agent);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const lead = await leadService.getLeadById(req.params.id, req.agency.id, req.agent);
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
    const lead = await leadService.updateLead(req.params.id, req.agency.id, req.body, req.agent);
    res.json({ success: true, data: lead, message: 'Lead updated' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await leadService.deleteLead(req.params.id, req.agency.id, req.agent);
    res.json({ success: true, message: 'Lead cancelled' });
  } catch (err) {
    next(err);
  }
}

async function listFollowUps(req, res, next) {
  try {
    const result = await leadService.listFollowUps(req.agency.id, req.query, req.agent);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function addFollowUp(req, res, next) {
  try {
    const followUp = await leadService.addFollowUp(req.params.id, req.agency.id, req.body, req.agent);
    res.status(201).json({ success: true, data: followUp, message: 'Follow-up scheduled' });
  } catch (err) {
    next(err);
  }
}

async function updateFollowUp(req, res, next) {
  try {
    const followUp = await leadService.updateFollowUp(req.params.id, req.params.followUpId, req.agency.id, req.body, req.agent);
    res.json({ success: true, data: followUp });
  } catch (err) {
    next(err);
  }
}

async function deleteFollowUp(req, res, next) {
  try {
    await leadService.deleteFollowUp(req.params.id, req.params.followUpId, req.agency.id, req.agent);
    res.json({ success: true, message: 'Follow-up deleted' });
  } catch (err) {
    next(err);
  }
}

async function addNote(req, res, next) {
  try {
    const note = await leadService.addNote(req.params.id, req.agency.id, req.user?.id || req.agent?.id || req.agency?.id, req.body.content);
    res.status(201).json({ success: true, data: note, message: 'Note added' });
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
  listFollowUps,
  addFollowUp,
  updateFollowUp,
  deleteFollowUp,
  addNote,
};
