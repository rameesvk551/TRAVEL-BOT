// FILE: /backend/src/models/Customer.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Customer model — end users who interact via WhatsApp only.
 * Unique per (agencyId + phone) so the same phone can be a customer
 * at multiple agencies.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
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
      allowNull: true,
      comment: 'Collected during lead capture',
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'E.164 format: +91XXXXXXXXXX or Instagram ID: ig_XXXXX',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    language: {
      type: DataTypes.ENUM('EN', 'ML'),
      defaultValue: 'EN',
      comment: 'Detected from first message',
    },
    source: {
      type: DataTypes.STRING(50),
      defaultValue: 'whatsapp',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isCustomer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    documents: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  }, {
    tableName: 'customers',
    indexes: [
      { unique: true, fields: ['agency_id', 'phone'] },
      { fields: ['phone'] },
    ],
  });

  return Customer;
};
