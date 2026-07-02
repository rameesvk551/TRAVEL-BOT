// FILE: /backend/src/controllers/invoiceTemplateController.ts
const { InvoiceTemplate } = require('../models');
const { createController } = require('./documentTemplateController');

module.exports = createController({
  docType: 'invoice',
  Model: InvoiceTemplate,
  defaultName: 'Standard Invoice',
});
