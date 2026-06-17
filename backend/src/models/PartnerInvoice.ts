const { DataTypes } = require('sequelize');

/**
 * PartnerInvoice — a billing statement the platform owner raises against a
 * partner for a period, based on the partner's revenue-share / plan terms.
 * v1 generates the invoice; payment is recorded manually.
 */
module.exports = (sequelize) => {
  const PartnerInvoice = sequelize.define('PartnerInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    partnerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    agencyCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'INR',
    },
    // Gross revenue collected by the partner's agencies in the period.
    subtotal: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Platform's revenue-share cut for the period.
    revenueShareAmount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    // Total payable by the partner to the platform (share + per-agency fees).
    amountDue: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    lineItems: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'partner_invoices',
    indexes: [
      { fields: ['partner_id'] },
      { fields: ['partner_id', 'status'] },
      { fields: ['partner_id', 'period_start', 'period_end'] },
    ],
  });

  return PartnerInvoice;
};
