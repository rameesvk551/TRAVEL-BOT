// FILE: /backend/src/controllers/propertyController.ts

const propertyService = require('../services/propertyService');
const mediaService = require('../services/mediaService');

/**
 * Controller for listing properties
 */
async function listProperties(req, res, next) {
  try {
    const { agencyId } = req.user;
    const activeOnly = req.query.active === 'true';
    const properties = await propertyService.listProperties(agencyId, { ...req.query, activeOnly });
    res.json({ status: 'success', data: properties });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for getting a single property
 */
async function getProperty(req, res, next) {
  try {
    const { agencyId } = req.user;
    const { id } = req.params;
    const property = await propertyService.getPropertyById(id, agencyId);
    res.json({ status: 'success', data: property });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for creating a property
 */
async function createProperty(req, res, next) {
  try {
    const { agencyId } = req.user;
    const property = await propertyService.createProperty(req.body, agencyId);
    res.status(201).json({ status: 'success', data: property });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for updating a property
 */
async function updateProperty(req, res, next) {
  try {
    const { agencyId } = req.user;
    const { id } = req.params;
    const property = await propertyService.updateProperty(id, agencyId, req.body);
    res.json({ status: 'success', data: property });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller for deleting a property
 */
async function deleteProperty(req, res, next) {
  try {
    const { agencyId } = req.user;
    const { id } = req.params;
    await propertyService.deleteProperty(id, agencyId);
    res.json({ status: 'success', message: 'Property deleted successfully' });
  } catch (error) {
    next(error);
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

    const uploaded = await mediaService.uploadPropertyImage(req.file.buffer, req.agency.id);
    res.status(201).json({
      status: 'success',
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
      },
      message: 'Image uploaded',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadImage,
};
