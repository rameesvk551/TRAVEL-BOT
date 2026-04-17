// FILE: /backend/src/controllers/referralController.ts

const referralService = require('../services/referralService');

exports.list = async (req, res, next) => {
  try {
    const codes = await referralService.listReferralCodes(req.user.agencyId);
    res.json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
};

exports.stats = async (req, res, next) => {
  try {
    const stats = await referralService.getReferralStats(req.user.agencyId);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { customerId } = req.body;
    const code = await referralService.createReferralCode(req.user.agencyId, customerId, req.body);
    res.status(201).json({ success: true, data: code });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.toggle = async (req, res, next) => {
  try {
    const code = await referralService.toggleReferralCode(req.params.id, req.user.agencyId);
    res.json({ success: true, data: code });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};
