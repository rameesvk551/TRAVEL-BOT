// FILE: /backend/src/models/Quotation.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Quotation model - stores generated quotations for leads/customers.
 * Amounts are stored as numeric/bigint (e.g. paise) to match AccountInvoice, or just integers.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Quotation = sequelize.define('Quotation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    quotationNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of line items: { name, description, quantity, price, amount }',
    },
    subTotal: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    amountInWords: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
  }, {
    tableName: 'quotations',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['lead_id'] },
      { fields: ['customer_id'] },
      { unique: true, fields: ['agency_id', 'quotation_number'] },
    ],
  });

  return Quotation;
};
