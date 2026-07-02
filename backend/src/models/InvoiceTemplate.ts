// FILE: /backend/src/models/InvoiceTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * InvoiceTemplate model - stores HTML templates for generating PDF invoices.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const InvoiceTemplate = sequelize.define('InvoiceTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    htmlContent: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Handlebars HTML template for the invoice',
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Configuration for visual builder (e.g. colors, fonts, toggles)',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'invoice_templates',
    indexes: [
      { fields: ['agency_id'] },
    ],
  });

  return InvoiceTemplate;
};
