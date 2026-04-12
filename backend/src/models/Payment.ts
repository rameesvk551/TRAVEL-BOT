// FILE: /backend/src/models/Payment.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Payment model — tracks Razorpay payment links and their statuses.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bookingId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    razorpayPaymentLinkId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    razorpayPaymentId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'In paise',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED'),
      defaultValue: 'PENDING',
    },
    type: {
      type: DataTypes.ENUM('ADVANCE', 'BALANCE', 'FULL'),
      allowNull: false,
    },
    paymentLinkUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'payments',
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['agency_id'] },
      { fields: ['razorpay_payment_link_id'] },
      { fields: ['status'] },
    ],
  });

  return Payment;
};
