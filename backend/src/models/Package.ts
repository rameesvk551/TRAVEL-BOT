// FILE: /backend/src/models/Package.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Package model — a travel package offered by an agency.
 * Prices stored in paise. Itinerary stored as JSON day-by-day array.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Package = sequelize.define('Package', {
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
    duration: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'e.g. "3 Nights 4 Days"',
    },
    destinations: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Array of destination names',
    },
    inclusions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of inclusion strings',
    },
    exclusions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of exclusion strings',
    },
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Per person in paise',
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    itinerary: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Day-by-day array: [{ day: 1, title, description, activities }]',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'packages',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return Package;
};
