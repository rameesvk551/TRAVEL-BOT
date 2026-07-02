// FILE: /backend/src/models/Service.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Service model — a service offered by an agency (e.g. ticketing, visa, insurance).
 * Prices stored in paise. Features stored as JSON array.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Service = sequelize.define('Service', {
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
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'TICKETING, DOCUMENTATION, VISA, INSURANCE, OTHER',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Icon identifier e.g. plane, train, document',
    },
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Price in paise, nullable for variable pricing',
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    pricingType: {
      type: DataTypes.STRING(20),
      defaultValue: 'FIXED',
      comment: 'FIXED, STARTING_FROM, or VARIABLE',
    },
    features: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of feature/inclusion strings',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'services',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return Service;
};
