// FILE: /backend/src/controllers/receiptTemplateController.ts
const { ReceiptTemplate } = require('../models');
const { createController } = require('./documentTemplateController');

module.exports = createController({
  docType: 'receipt',
  Model: ReceiptTemplate,
  defaultName: 'Standard Receipt',
});
