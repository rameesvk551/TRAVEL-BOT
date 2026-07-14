// FILE: /backend/src/models/Brochure.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Brochure model — a multi-page, freeform-designed PDF brochure for a resort or
 * property. `doc` holds the entire design (see services/brochureDoc.ts): pages of
 * absolutely-positioned image/text/shape elements. The same JSON shape is stored in
 * BrochureTemplate, which is what lets a finished brochure be saved back as a
 * reusable template.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Brochure = sequelize.define('Brochure', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'READY'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Optional link to a Property — pre-fills photos, name and price',
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Optional link to a Package',
    },
    doc: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'The full design: { size, pageW, pageH, theme, pages[] }',
    },
    fields: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Merge-field values (property_name, price, about…) bound to text elements',
    },
    pdfUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last rendered PDF, served from public assets',
    },
    renderedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'brochures',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['property_id'] },
    ],
  });

  return Brochure;
};
