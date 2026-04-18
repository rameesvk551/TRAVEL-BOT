// FILE: /backend/src/models/Itinerary.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Itinerary model — an internal quoting/itinerary building tool.
 * Stores days and pricing dynamically in JSONB for speed.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Itinerary = sequelize.define('Itinerary', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Link to a pre-defined package template',
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Internal reference name',
    },
    destination: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SENT', 'CONFIRMED'),
      defaultValue: 'DRAFT',
    },
    adults: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
    },
    children: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    travelStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    travelEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'In paise (₹1 = 100 paise)',
    },
    totalPrice: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'In paise (₹1 = 100 paise)',
    },
    totalProfit: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue('totalPrice') - this.getDataValue('totalCost');
      },
    },
    days: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of { id, title, description, date, hotels[], activities[], transports[] }',
    },
    pdfUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    isTemplate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName: 'itineraries',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['lead_id'] },
      { fields: ['customer_id'] },
    ],
  });

  return Itinerary;
};
