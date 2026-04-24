const flowService = require('../services/flowService');

exports.list = async (req, res, next) => {
  try {
    const flows = await flowService.listFlows(req.user.agencyId, req.query);
    res.json({ success: true, data: flows });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const flow = await flowService.getFlow(req.params.id, req.user.agencyId);
    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow not found' });
    }
    res.json({ success: true, data: flow });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const flow = await flowService.createFlow(req.user.agencyId, req.body);
    res.status(201).json({ success: true, data: flow });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const flow = await flowService.updateFlow(req.params.id, req.user.agencyId, req.body);
    res.json({ success: true, data: flow });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await flowService.deleteFlow(req.params.id, req.user.agencyId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.publish = async (req, res, next) => {
  try {
    const flow = await flowService.publishFlow(req.params.id, req.user.agencyId);
    res.json({ success: true, data: flow });
  } catch (err) {
    next(err);
  }
};

exports.sync = async (req, res, next) => {
  try {
    const result = await flowService.syncFlows(req.user.agencyId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
