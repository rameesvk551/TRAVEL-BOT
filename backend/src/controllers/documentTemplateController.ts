// FILE: /backend/src/controllers/documentTemplateController.ts
//
// Shared CRUD controller factory for the three document-template types
// (quotation / invoice / receipt). Each new template is seeded from a themed
// layout preset + default visual-builder config so users start from a polished,
// fully-styled document rather than a blank HTML box.

const documentTemplates = require('../services/documentTemplates');

/**
 * @param {object} opts
 * @param {string} opts.docType  'quotation' | 'invoice' | 'receipt'
 * @param {import('sequelize').ModelStatic<any>} opts.Model
 * @param {string} [opts.defaultName]
 */
function createController({ docType, Model, defaultName }) {
  async function list(req, res, next) {
    try {
      const templates = await Model.findAll({
        where: { agencyId: req.agency.id },
        order: [['createdAt', 'DESC']],
      });
      res.json({ success: true, data: templates });
    } catch (err) {
      next(err);
    }
  }

  async function getById(req, res, next) {
    try {
      const template = await Model.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      res.json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }

  // GET /presets — layout catalogue + default config for the builder's pickers.
  async function listPresets(req, res, next) {
    try {
      res.json({
        success: true,
        data: {
          docType,
          presets: documentTemplates.presets(docType),
          defaultConfig: documentTemplates.defaultConfig(docType),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async function create(req, res, next) {
    try {
      const existingCount = await Model.count({ where: { agencyId: req.agency.id } });
      const isDefault = existingCount === 0 || !!req.body.isDefault;

      const config = req.body.config || documentTemplates.defaultConfig(docType);
      const layout = (config && config.layout) || 'modern';
      const htmlContent = (req.body.htmlContent && req.body.htmlContent.trim())
        ? req.body.htmlContent
        : documentTemplates.templateHtml(docType, layout);

      if (isDefault) {
        await Model.update({ isDefault: false }, { where: { agencyId: req.agency.id } });
      }

      const template = await Model.create({
        agencyId: req.agency.id,
        name: req.body.name || defaultName || 'New Template',
        htmlContent,
        config,
        isDefault,
      });

      res.status(201).json({ success: true, data: template, message: 'Template created' });
    } catch (err) {
      next(err);
    }
  }

  async function update(req, res, next) {
    try {
      const template = await Model.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }

      if (req.body.isDefault) {
        await Model.update({ isDefault: false }, { where: { agencyId: req.agency.id } });
      }

      await template.update({
        name: req.body.name !== undefined ? req.body.name : template.name,
        htmlContent: req.body.htmlContent !== undefined ? req.body.htmlContent : template.htmlContent,
        config: req.body.config !== undefined ? req.body.config : template.config,
        isDefault: req.body.isDefault !== undefined ? req.body.isDefault : template.isDefault,
      });

      res.json({ success: true, data: template, message: 'Template updated' });
    } catch (err) {
      next(err);
    }
  }

  async function remove(req, res, next) {
    try {
      const template = await Model.findOne({ where: { id: req.params.id, agencyId: req.agency.id } });
      if (!template) {
        return res.status(404).json({ success: false, error: 'Template not found' });
      }
      await template.destroy();
      res.json({ success: true, message: 'Template deleted' });
    } catch (err) {
      next(err);
    }
  }

  return { list, getById, listPresets, create, update, remove };
}

module.exports = { createController };
