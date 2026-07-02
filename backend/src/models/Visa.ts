// FILE: /backend/src/models/Visa.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Visa model — representing visa service offerings with prices and required documents.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Visa = sequelize.define('Visa', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    visaType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    price: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Price in paise',
    },
    processingTime: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    validityPeriod: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    requiredDocuments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of required document strings',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    eligibilityNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'visas',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return Visa;
};
