// FILE: /backend/src/controllers/brochureController.ts

const brochureService = require('../services/brochureService');
const brochureThemes = require('../services/brochureThemes');
const brochureDoc = require('../services/brochureDoc');

/** Everything the editor needs to boot: page sizes, fonts, merge fields, themes. */
async function getMeta(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        pageSizes: brochureDoc.PAGE_SIZES,
        fonts: brochureDoc.FONTS,
        mergeFields: brochureDoc.MERGE_FIELDS,
        themes: brochureThemes.listThemes(),
        limits: {
          maxPages: brochureDoc.MAX_PAGES,
          maxElementsPerPage: brochureDoc.MAX_ELEMENTS_PER_PAGE,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const brochures = await brochureService.list(req.agency.id);
    res.json({ success: true, data: brochures });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const brochure = await brochureService.getById(req.agency.id, req.params.id);
    res.json({ success: true, data: brochure });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const brochure = await brochureService.create(req.agency.id, req.body);
    res.status(201).json({ success: true, data: brochure, message: 'Brochure created' });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const brochure = await brochureService.update(req.agency.id, req.params.id, req.body);
    res.json({ success: true, data: brochure, message: 'Brochure saved' });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await brochureService.remove(req.agency.id, req.params.id);
    res.json({ success: true, message: 'Brochure deleted' });
  } catch (err) {
    next(err);
  }
}

async function applyTemplate(req, res, next) {
  try {
    const brochure = await brochureService.applyTemplate(req.agency.id, req.params.id, req.body.templateId);
    res.json({ success: true, data: brochure, message: 'Template applied' });
  } catch (err) {
    next(err);
  }
}

// GET /:id/pdf — render on demand and stream it back.
async function downloadPdf(req, res, next) {
  try {
    const { buffer, filename } = await brochureService.render(req.agency.id, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

// POST /:id/render — render + store, returning the shareable public URL.
async function renderToUrl(req, res, next) {
  try {
    const { url, brochure } = await brochureService.render(req.agency.id, req.params.id);
    res.json({ success: true, data: { url, brochure }, message: 'Brochure rendered' });
  } catch (err) {
    next(err);
  }
}

// POST /:id/send — deliver to a lead over WhatsApp.
async function sendToLead(req, res, next) {
  try {
    const result = await brochureService.sendToLead(
      req.agency,
      req.params.id,
      req.body.leadId,
      { agentId: req.agent?.id },
    );
    res.json({ success: true, data: result, message: 'Brochure sent' });
  } catch (err) {
    next(err);
  }
}

// --- assets ---

async function listAssets(req, res, next) {
  try {
    const assets = await brochureService.listAssets(req.agency.id, req.query.brochureId || null);
    res.json({ success: true, data: assets });
  } catch (err) {
    next(err);
  }
}

async function uploadAssets(req, res, next) {
  try {
    const assets = await brochureService.addAssets(
      req.agency.id,
      req.body.brochureId || null,
      req.files,
    );
    res.status(201).json({ success: true, data: assets, message: `${assets.length} image(s) uploaded` });
  } catch (err) {
    next(err);
  }
}

async function reorderAssets(req, res, next) {
  try {
    await brochureService.reorderAssets(req.agency.id, req.body.ids || []);
    res.json({ success: true, message: 'Order saved' });
  } catch (err) {
    next(err);
  }
}

async function deleteAsset(req, res, next) {
  try {
    await brochureService.deleteAsset(req.agency.id, req.params.assetId);
    res.json({ success: true, message: 'Image removed' });
  } catch (err) {
    next(err);
  }
}

// --- templates ---

async function listTemplates(req, res, next) {
  try {
    const templates = await brochureService.listTemplates(req.agency.id);
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

async function saveAsTemplate(req, res, next) {
  try {
    const template = await brochureService.saveAsTemplate(req.agency.id, req.params.id, req.body.name);
    res.status(201).json({ success: true, data: template, message: 'Saved as template' });
  } catch (err) {
    next(err);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    await brochureService.deleteTemplate(req.agency.id, req.params.templateId);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMeta,
  list,
  getById,
  create,
  update,
  remove,
  applyTemplate,
  downloadPdf,
  renderToUrl,
  sendToLead,
  listAssets,
  uploadAssets,
  reorderAssets,
  deleteAsset,
  listTemplates,
  saveAsTemplate,
  deleteTemplate,
};
