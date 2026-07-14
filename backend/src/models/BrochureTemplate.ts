// FILE: /backend/src/models/BrochureTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * BrochureTemplate model — a reusable brochure design.
 *
 * `doc` is the same shape as Brochure.doc, but with image slots emptied (see
 * brochureDoc.toTemplateDoc). Applying a template to a new set of photos is
 * brochureDoc.fillDoc(): slots refill in document order, merge fields repopulate.
 *
 * A NULL agencyId marks a platform-shipped preset, visible to every agency with the
 * brochure add-on enabled. An agency's own saved designs carry their agencyId.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const BrochureTemplate = sequelize.define('BrochureTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'NULL = platform-shipped preset, shared across agencies',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    doc: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    slotCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'How many photos this design expects — shown in the template picker',
    },
  }, {
    tableName: 'brochure_templates',
    indexes: [
      { fields: ['agency_id'] },
    ],
  });

  return BrochureTemplate;
};
