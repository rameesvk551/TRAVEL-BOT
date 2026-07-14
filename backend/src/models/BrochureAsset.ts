// FILE: /backend/src/models/BrochureAsset.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * BrochureAsset model — the agency's brochure image library.
 *
 * A bulk upload of 30 resort photos lands here once and can then be reused across
 * decks, rather than being re-uploaded per brochure. `sortOrder` is the tray order,
 * which is also the order photos fill a template's slots.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const BrochureAsset = sequelize.define('BrochureAsset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    brochureId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Uploaded for this brochure; NULL = general library asset',
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    publicId: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Cloudinary public_id, for deletion',
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'brochure_assets',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['brochure_id'] },
    ],
  });

  return BrochureAsset;
};
