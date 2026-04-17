// FILE: /backend/src/controllers/dripController.ts

const dripService = require('../services/dripService');

exports.list = async (req, res, next) => {
  try {
    const sequences = await dripService.listSequences(req.user.agencyId);
    res.json({ success: true, data: sequences });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const sequence = await dripService.getSequence(req.params.id, req.user.agencyId);
    if (!sequence) return res.status(404).json({ success: false, error: 'Sequence not found' });
    res.json({ success: true, data: sequence });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const sequence = await dripService.createSequence(req.user.agencyId, req.body);
    res.status(201).json({ success: true, data: sequence });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const sequence = await dripService.updateSequence(req.params.id, req.user.agencyId, req.body);
    res.json({ success: true, data: sequence });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const sequence = await dripService.toggleSequence(req.params.id, req.user.agencyId);
    res.json({ success: true, data: sequence });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.enroll = async (req, res, next) => {
  try {
    const { customerId, leadId } = req.body;
    const enrollment = await dripService.enrollCustomer(req.params.id, customerId, leadId, req.user.agencyId);
    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateEnrollment = async (req, res, next) => {
  try {
    const enrollment = await dripService.updateEnrollment(req.params.enrollmentId, req.user.agencyId, req.body.status);
    res.json({ success: true, data: enrollment });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
