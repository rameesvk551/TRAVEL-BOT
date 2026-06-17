const partnerService = require('../services/partnerService');
const mediaService = require('../services/mediaService');

const PARTNER_ASSET_TYPES = new Set(['logo', 'favicon', 'login-image']);

async function uploadAsset(req, res, next) {
  try {
    if (!req.file) {
      throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    }
    const assetType = String(req.query.assetType || req.body?.assetType || 'logo');
    if (!PARTNER_ASSET_TYPES.has(assetType)) {
      throw Object.assign(new Error('Invalid asset type'), { statusCode: 400, code: 'INVALID_ASSET_TYPE' });
    }
    const uploaded = await mediaService.uploadPartnerAsset(req.file.buffer, assetType);
    res.status(201).json({ success: true, data: { url: uploaded.secureUrl }, message: 'Asset uploaded' });
  } catch (err) { next(err); }
}

async function list(_req, res, next) {
  try {
    const data = await partnerService.listPartners();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function detail(req, res, next) {
  try {
    const data = await partnerService.getPartner(req.params.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = await partnerService.createPartner(req.body, req.platformAdmin.id, req);
    res.status(201).json({ success: true, data, message: 'Partner created' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = await partnerService.updatePartner(req.params.id, req.body, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Partner updated' });
  } catch (err) { next(err); }
}

async function assignAgency(req, res, next) {
  try {
    const data = await partnerService.assignAgency(req.params.id, req.body.agencyId, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Agency assigned to partner' });
  } catch (err) { next(err); }
}

async function unassignAgency(req, res, next) {
  try {
    const data = await partnerService.unassignAgency(req.params.agencyId, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Agency removed from partner' });
  } catch (err) { next(err); }
}

async function generateInvoice(req, res, next) {
  try {
    const data = await partnerService.generateInvoice(req.params.id, req.body, req.platformAdmin.id, req);
    res.status(201).json({ success: true, data, message: 'Invoice generated' });
  } catch (err) { next(err); }
}

async function updateInvoiceStatus(req, res, next) {
  try {
    const data = await partnerService.updateInvoiceStatus(req.params.invoiceId, req.body.status, req.platformAdmin.id, req);
    res.json({ success: true, data, message: 'Invoice updated' });
  } catch (err) { next(err); }
}

module.exports = {
  list,
  detail,
  create,
  update,
  uploadAsset,
  assignAgency,
  unassignAgency,
  generateInvoice,
  updateInvoiceStatus,
};
