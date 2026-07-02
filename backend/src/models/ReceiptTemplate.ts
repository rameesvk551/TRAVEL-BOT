// FILE: /backend/src/models/ReceiptTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * ReceiptTemplate model - stores Handlebars HTML templates and visual-builder
 * configuration for generating payment receipts (sent to customers on payment).
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const ReceiptTemplate = sequelize.define('ReceiptTemplate', {
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
      comment: 'Handlebars HTML template for the receipt',
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
    tableName: 'receipt_templates',
    indexes: [
      { fields: ['agency_id'] },
    ],
  });

  return ReceiptTemplate;
};
