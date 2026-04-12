const agentService = require('../services/agentService');

async function list(req, res, next) {
  try {
    const agents = await agentService.listAgents(req.agency.id);
    res.json({ success: true, data: agents });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const agent = await agentService.createAgent(req.body, req.agency.id);
    res.status(201).json({ success: true, data: agent, message: 'Agent created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const data = await agentService.updateAgent(req.params.id, req.agency.id, req.agent, req.body);
    res.json({ success: true, data, message: 'Agent updated' });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    await agentService.updateMyStatus(req.agent.id, req.body?.isOnline);
    res.json({
      success: true,
      message: req.body?.isOnline ? 'You are now online' : 'You are now offline',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  update,
  updateStatus,
};