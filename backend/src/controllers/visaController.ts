// FILE: /backend/src/controllers/visaController.ts

const visaService = require('../services/visaService');
const mediaService = require('../services/mediaService');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const visas = await visaService.listVisas(req.agency.id, { ...req.query, activeOnly });
    res.json({ success: true, data: visas });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const visa = await visaService.getVisaById(req.params.id, req.agency.id);
    res.json({ success: true, data: visa });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const visa = await visaService.createVisa(req.body, req.agency.id);
    res.status(201).json({ success: true, data: visa, message: 'Visa created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const visa = await visaService.updateVisa(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: visa, message: 'Visa updated' });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await visaService.deleteVisa(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Visa deactivated' });
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
