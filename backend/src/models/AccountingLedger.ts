const { DataTypes } = require('sequelize');

/**
 * Chart-of-accounts ledger for agency-scoped double-entry accounting.
 * Monetary balances are derived from JournalLine rows, not stored here.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const AccountingLedger = sequelize.define('AccountingLedger', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'),
      allowNull: false,
    },
    groupType: {
      type: DataTypes.ENUM('DIRECT', 'INDIRECT'),
      allowNull: true,
    },
    financialStatement: {
      type: DataTypes.ENUM('BALANCE_SHEET', 'PROFIT_AND_LOSS'),
      allowNull: false,
    },
    isGroup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    systemCreated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'INR',
    },
    gstin: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'accounting_ledgers',
    indexes: [
      { unique: true, fields: ['agency_id', 'code'] },
      { fields: ['agency_id', 'parent_id'] },
      { fields: ['agency_id', 'type'] },
      { fields: ['agency_id', 'financial_statement'] },
    ],
  });

  return AccountingLedger;
};
