const itemFinanceService = require('../services/itemFinanceService');

async function report(req, res, next) {
  try {
    const data = await itemFinanceService.getItemFinance(req.agency.id, req.params.itemType, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createVendorCost(req, res, next) {
  try {
    const data = await itemFinanceService.createVendorCost(req.agency.id, req.params.itemType, req.params.id, req.body, req.agent?.id);
    res.status(201).json({ success: true, data, message: 'Vendor cost added' });
  } catch (err) {
    next(err);
  }
}

async function updateVendorCost(req, res, next) {
  try {
    const data = await itemFinanceService.updateVendorCost(req.agency.id, req.params.itemType, req.params.id, req.params.costId, req.body, req.agent?.id);
    res.json({ success: true, data, message: 'Vendor cost updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteVendorCost(req, res, next) {
  try {
    await itemFinanceService.deleteVendorCost(req.agency.id, req.params.itemType, req.params.id, req.params.costId);
    res.json({ success: true, message: 'Vendor cost deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  report,
  createVendorCost,
  updateVendorCost,
  deleteVendorCost,
};
