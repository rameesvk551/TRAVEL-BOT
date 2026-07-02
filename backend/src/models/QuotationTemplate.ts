// FILE: /backend/src/models/QuotationTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * QuotationTemplate model - stores HTML templates and configuration for generating Quotations/Estimates.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const QuotationTemplate = sequelize.define('QuotationTemplate', {
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
      comment: 'Handlebars HTML template for the quotation',
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Configuration for visual builder (e.g. colors, toggles)',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'quotation_templates',
    indexes: [
      { fields: ['agency_id'] },
    ],
  });

  return QuotationTemplate;
};
