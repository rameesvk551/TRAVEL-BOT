// FILE: /backend/src/models/Cruise.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Cruise model — representing cruise travel offerings.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Cruise = sequelize.define('Cruise', {
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
    cruiseLine: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    departurePort: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    destinations: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    duration: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    cabinTypes: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    inclusions: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    exclusions: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    basePrice: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Base price in paise',
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    departureDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'cruises',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return Cruise;
};
