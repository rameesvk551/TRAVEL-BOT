const packageService = require('../services/packageService');
const mediaService = require('../services/mediaService');

async function list(req, res, next) {
  try {
    const activeOnly = req.query.active === 'true';
    const packages = await packageService.listPackages(req.agency.id, { ...req.query, activeOnly });
    res.json({ success: true, data: packages });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const pkg = await packageService.getPackageById(req.params.id, req.agency.id);
    res.json({ success: true, data: pkg });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const pkg = await packageService.createPackage(req.body, req.agency.id);
    res.status(201).json({ success: true, data: pkg, message: 'Package created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const pkg = await packageService.updatePackage(req.params.id, req.agency.id, req.body);
    res.json({ success: true, data: pkg, message: 'Package updated' });
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    await packageService.deletePackage(req.params.id, req.agency.id);
    res.json({ success: true, message: 'Package deactivated' });
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

async function uploadBrochure(req, res, next) {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Brochure file is required'), {
        statusCode: 400,
        code: 'MISSING_FILE',
      });
    }

    const uploaded = await mediaService.uploadPackageBrochure(
      req.file.buffer,
      req.agency.id,
      req.file.originalname
    );

    res.status(201).json({
      success: true,
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        fileName: uploaded.originalFilename,
      },
      message: 'Brochure uploaded',
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
  uploadBrochure,
};
