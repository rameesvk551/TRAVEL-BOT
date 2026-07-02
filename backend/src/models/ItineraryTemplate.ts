// FILE: /backend/src/models/ItineraryTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * ItineraryTemplate model — stores the themed Handlebars HTML template and
 * visual-builder config for generating multi-section travel itinerary PDFs.
 * Mirrors QuotationTemplate so the shared document-builder UI can drive it.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const ItineraryTemplate = sequelize.define('ItineraryTemplate', {
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
      comment: 'Handlebars HTML template for the itinerary',
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Configuration for visual builder (e.g. colors, section toggles)',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'itinerary_templates',
    indexes: [
      { fields: ['agency_id'] },
    ],
  });

  return ItineraryTemplate;
};
