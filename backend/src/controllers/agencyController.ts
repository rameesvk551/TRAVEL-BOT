const agencyService = require('../services/agencyService');

async function me(req, res, next) {
  try {
    const data = await agencyService.getCurrentAgency(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const data = await agencyService.updateCurrentAgency(req.agency.id, req.body);
    res.json({ success: true, data, message: 'Agency updated' });
  } catch (err) {
    next(err);
  }
}

async function getWhatsAppConnection(req, res, next) {
  try {
    const data = await agencyService.getWhatsAppConnection(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getWhatsAppChannels(req, res, next) {
  try {
    const data = await agencyService.getWhatsAppChannels(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteWhatsAppChannel(req, res, next) {
  try {
    const data = await agencyService.deleteWhatsAppChannel(req.agency.id, req.params.channelId);
    res.json({ success: true, data, message: 'WhatsApp channel removed' });
  } catch (err) {
    next(err);
  }
}

async function createWhatsAppConnectSession(req, res, next) {
  try {
    const data = await agencyService.createMarketingOsConnectSession(req.agency.id, req.body || {});
    res.json({ success: true, data, message: 'Marketing OS connect session created' });
  } catch (err) {
    next(err);
  }
}

async function getWebsiteStatus(req, res, next) {
  try {
    const data = await agencyService.getWebsiteStatus(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateWebsite(req, res, next) {
  try {
    const data = await agencyService.updateWebsite(req.agency.id, req.body || {});
    res.json({ success: true, data, message: 'Website settings updated' });
  } catch (err) {
    next(err);
  }
}

async function publishWebsite(req, res, next) {
  try {
    const data = await agencyService.publishWebsite(req.agency.id);
    res.json({ success: true, data, message: 'Website published' });
  } catch (err) {
    next(err);
  }
}

async function unpublishWebsite(req, res, next) {
  try {
    const data = await agencyService.unpublishWebsite(req.agency.id);
    res.json({ success: true, data, message: 'Website unpublished' });
  } catch (err) {
    next(err);
  }
}

async function completeWhatsAppConnectSession(req, res, next) {
  try {
    const data = await agencyService.completeMarketingOsConnectSession(req.agency.id, req.body);
    res.json({ success: true, data, message: 'Marketing OS signup completed' });
  } catch (err) {
    next(err);
  }
}

async function handleMarketingOsCallback(req, res, next) {
  try {
    const result = await agencyService.handleMarketingOsCallback(req.headers, req.body, req.rawBody);
    res.json({
      success: true,
      message: result?.message || 'Marketing OS callback processed',
      data: result?.data || null,
    });
  } catch (err) {
    next(err);
  }
}

async function getInstagramConnection(req, res, next) {
  try {
    const data = await agencyService.getInstagramConnection(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function connectInstagram(req, res, next) {
  try {
    const data = await agencyService.connectInstagram(req.agency.id, req.body);
    res.json({ success: true, data, message: 'Instagram connected' });
  } catch (err) {
    next(err);
  }
}

async function disconnectInstagram(req, res, next) {
  try {
    const data = await agencyService.disconnectInstagram(req.agency.id, req.params.accountId);
    res.json({ success: true, data, message: 'Instagram disconnected' });
  } catch (err) {
    next(err);
  }
}

async function uploadCompanyLogo(req, res, next) {
  try {
    if (!req.file) throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    const mediaService = require('../services/mediaService');
    const agencyService = require('../services/agencyService');
    const uploaded = await mediaService.uploadCompanyAsset(req.file.buffer, req.agency.id, 'logo');
    await agencyService.updateCurrentAgency(req.agency.id, { companyLogoUrl: uploaded.secureUrl });
    res.status(201).json({ success: true, data: { url: uploaded.secureUrl }, message: 'Logo uploaded' });
  } catch (err) { next(err); }
}

async function uploadCompanySeal(req, res, next) {
  try {
    if (!req.file) throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    const mediaService = require('../services/mediaService');
    const agencyService = require('../services/agencyService');
    const uploaded = await mediaService.uploadCompanyAsset(req.file.buffer, req.agency.id, 'seal');
    await agencyService.updateCurrentAgency(req.agency.id, { companySealUrl: uploaded.secureUrl });
    res.status(201).json({ success: true, data: { url: uploaded.secureUrl }, message: 'Seal uploaded' });
  } catch (err) { next(err); }
}

async function uploadAuthorizedSignature(req, res, next) {
  try {
    if (!req.file) throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    const mediaService = require('../services/mediaService');
    const agencyService = require('../services/agencyService');
    const uploaded = await mediaService.uploadCompanyAsset(req.file.buffer, req.agency.id, 'signature');
    await agencyService.updateCurrentAgency(req.agency.id, { authorizedSignatureUrl: uploaded.secureUrl });
    res.status(201).json({ success: true, data: { url: uploaded.secureUrl }, message: 'Signature uploaded' });
  } catch (err) { next(err); }
}

// Uploads an arbitrary branding image (e.g. a per-document logo) and just
// returns the hosted URL without binding it to a fixed agency column. The
// caller stores the URL wherever it likes (e.g. a template's config.brand.logoUrl).
async function uploadDocumentAsset(req, res, next) {
  try {
    if (!req.file) throw Object.assign(new Error('Image file is required'), { statusCode: 400, code: 'MISSING_FILE' });
    const mediaService = require('../services/mediaService');
    const uploaded = await mediaService.uploadCompanyAsset(req.file.buffer, req.agency.id, 'doc-asset');
    res.status(201).json({ success: true, data: { url: uploaded.secureUrl }, message: 'Asset uploaded' });
  } catch (err) { next(err); }
}

module.exports = {
  me,
  updateMe,
  uploadDocumentAsset,
  getWebsiteStatus,
  updateWebsite,
  publishWebsite,
  unpublishWebsite,
  getWhatsAppConnection,
  getWhatsAppChannels,
  deleteWhatsAppChannel,
  createWhatsAppConnectSession,
  completeWhatsAppConnectSession,
  handleMarketingOsCallback,
  getInstagramConnection,
  connectInstagram,
  disconnectInstagram,
  uploadCompanyLogo,
  uploadCompanySeal,
  uploadAuthorizedSignature,
};
