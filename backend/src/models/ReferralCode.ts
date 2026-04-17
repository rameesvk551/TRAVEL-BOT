// FILE: /backend/src/models/ReferralCode.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * ReferralCode — referral tracking for customer-to-customer referrals.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const ReferralCode = sequelize.define('ReferralCode', {
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
      allowNull: false,
      comment: 'The referrer (customer who owns this code)',
    },
    code: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
      comment: 'Unique referral code e.g. "RAHUL2026"',
    },
    discountType: {
      type: DataTypes.ENUM('FLAT', 'PERCENT'),
      allowNull: false,
      defaultValue: 'FLAT',
    },
    discountValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Flat = paise, Percent = 1-100',
    },
    maxUses: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    usedCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    revenueGenerated: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Total revenue attributed in paise',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'referral_codes',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['customer_id'] },
      { unique: true, fields: ['code'] },
    ],
  });

  return ReferralCode;
};
