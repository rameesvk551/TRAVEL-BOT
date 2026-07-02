// FILE: /backend/src/controllers/crmController.ts

const pipelineService = require('../services/pipelineService');

async function listStages(req, res, next) {
  try {
    const data = await pipelineService.listStages(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createStage(req, res, next) {
  try {
    const data = await pipelineService.createStage(req.agency.id, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateStage(req, res, next) {
  try {
    const data = await pipelineService.updateStage(req.agency.id, req.params.id, req.body || {});
    if (!data) return res.status(404).json({ success: false, error: 'Stage not found' });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteStage(req, res, next) {
  try {
    const ok = await pipelineService.deleteStage(req.agency.id, req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Stage not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function reorderStages(req, res, next) {
  try {
    const { orderedIds } = req.body || {};
    const data = await pipelineService.reorderStages(req.agency.id, orderedIds);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
};
