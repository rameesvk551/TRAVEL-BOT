// FILE: /backend/src/models/Property.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Property model — represents a property (e.g., Hotel, Resort, Villa)
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Property = sequelize.define('Property', {
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
    propertyType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Hotel',
      comment: 'e.g., Hotel, Resort, Villa, Apartment',
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amenities: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of amenities',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pricePerNight: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Price per night in paise',
    },
    imageUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    images: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of additional image URLs',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'properties',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_active'] },
    ],
  });

  return Property;
};
