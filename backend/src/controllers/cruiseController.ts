// FILE: /backend/src/controllers/cruiseController.ts

const cruiseService = require('../services/cruiseService');
const mediaService = require('../services/mediaService');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const cruises = await cruiseService.listCruises(req.agency.id, { ...req.query, activeOnly });
    res.json({ success: true, data: cruises });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const cruise = await cruiseService.getCruiseById(req.params.id, req.agency.id);
    res.json({ success: true, data: cruise });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const cruise = await cruiseService.createCruise(req.body, req.agency.id);
    res.status(201).json({ success: true, data: cruise, message: 'Cruise created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const cruise = await cruiseService.updateCruise(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: cruise, message: 'Cruise updated' });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await cruiseService.deleteCruise(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Cruise deactivated' });
  } catch (err) {
    next(err);
  }
}

async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Image file is required'), {
        statusCode: 400,
        code: 'MISSING_FILE',
      });
    }

    const uploaded = await mediaService.uploadPackageImage(req.file.buffer, req.agency.id);
    res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
      },
      message: 'Image uploaded',
    });
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
  uploadImage,
};
