// FILE: /backend/src/models/Lead.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Lead model — a customer enquiry progressing through the sales pipeline.
 * Status: NEW → CONTACTED → QUOTED → NEGOTIATING → BOOKED | LOST | CANCELLED
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Lead = sequelize.define('Lead', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assignedAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    destination: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    travelDates: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Free text e.g. "Dec 15-20"',
    },
    travelStart: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    travelEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    travellers: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    budgetPerPerson: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'In paise (₹1 = 100 paise)',
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'BOOKED', 'LOST', 'CANCELLED'),
      defaultValue: 'NEW',
    },
    lostReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'leads',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'assigned_agent_id'] },
      { fields: ['customer_id'] },
      { fields: ['created_at'] },
    ],
  });

  return Lead;
};
