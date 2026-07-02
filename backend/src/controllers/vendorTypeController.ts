const vendorTypeService = require('../services/vendorTypeService');

async function listVendorTypes(req, res) {
  try {
    const filters = {};
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    const types = await vendorTypeService.listVendorTypes(req.agency.id, filters);
    res.json(types);
  } catch (error) {
    console.error('[VendorTypeController.listVendorTypes]', error);
    res.status(500).json({ error: 'Failed to list vendor types' });
  }
}

async function createVendorType(req, res) {
  try {
    const vendorType = await vendorTypeService.createVendorType(req.agency.id, req.body);
    res.status(201).json(vendorType);
  } catch (error) {
    console.error('[VendorTypeController.createVendorType]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create vendor type' });
  }
}

async function updateVendorType(req, res) {
  try {
    const vendorType = await vendorTypeService.updateVendorType(req.agency.id, req.params.id, req.body);
    res.json(vendorType);
  } catch (error) {
    console.error('[VendorTypeController.updateVendorType]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update vendor type' });
  }
}

async function deleteVendorType(req, res) {
  try {
    const result = await vendorTypeService.deleteVendorType(req.agency.id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error('[VendorTypeController.deleteVendorType]', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete vendor type' });
  }
}

module.exports = {
  listVendorTypes,
  createVendorType,
  updateVendorType,
  deleteVendorType,
};
