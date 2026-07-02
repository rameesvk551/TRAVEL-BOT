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
    channelId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'WhatsApp channel/number this customer last used',
    },
    assignedAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Agent who owns this conversation in the inbox',
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
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Real contact phone collected in-flow (e.g. via a Question node on Instagram, where `phone` holds the ig_ identity rather than a dialable number)',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'Customer GSTIN for Indian B2B invoices',
    },
    ledgerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Accounting ledger under Trade Debtors',
    },
    stateCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'Customer place-of-supply GST state code when known',
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
