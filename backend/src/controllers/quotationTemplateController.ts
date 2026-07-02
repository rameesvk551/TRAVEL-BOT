// FILE: /backend/src/controllers/quotationTemplateController.ts
const { QuotationTemplate } = require('../models');
const { createController } = require('./documentTemplateController');

module.exports = createController({
  docType: 'quotation',
  Model: QuotationTemplate,
  defaultName: 'Standard Quotation',
});
