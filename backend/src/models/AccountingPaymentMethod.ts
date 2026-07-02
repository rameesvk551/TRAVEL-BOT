const { DataTypes } = require('sequelize');

/**
 * Tenant-owned payment methods mapped to cash/bank ledgers.
 * Examples: Cash, HDFC Current Account, UPI - Razorpay.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const AccountingPaymentMethod = sequelize.define('AccountingPaymentMethod', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ledgerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    methodType: {
      type: DataTypes.ENUM('CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'),
      allowNull: false,
      defaultValue: 'BANK',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'accounting_payment_methods',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'ledger_id'] },
      { fields: ['agency_id', 'is_active'] },
      { unique: true, fields: ['agency_id', 'name'] },
    ],
  });

  return AccountingPaymentMethod;
};
