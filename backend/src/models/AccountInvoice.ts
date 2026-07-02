const { DataTypes } = require('sequelize');

/**
 * Accounting invoice for TravelBot bookings/manual invoices.
 * Amounts are stored in paise.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const AccountInvoice = sequelize.define('AccountInvoice', {
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
    bookingId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'),
      allowNull: false,
      defaultValue: 'ISSUED',
    },
    taxableAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    gstAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    cgstAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    sgstAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    igstAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    paidAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    gstin: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    supplierGstin: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    supplierStateCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    placeOfSupplyStateCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    gstTreatment: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'UNREGISTERED',
    },
    taxType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NONE',
    },
    gstRateBps: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    taxBreakup: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    narration: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    pdfUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'URL to the generated PDF invoice document',
    },
  }, {
    tableName: 'account_invoices',
    indexes: [
      { unique: true, fields: ['agency_id', 'invoice_number'] },
      { fields: ['agency_id', 'customer_id'] },
      // One auto-invoice per booking. Partial (booking_id NOT NULL) so manual
      // invoices without a booking are unconstrained. Closes the concurrent
      // postBookingInvoice race (webhook + booking-confirm firing together).
      { unique: true, fields: ['agency_id', 'booking_id'], where: { booking_id: { [require('sequelize').Op.ne]: null } }, name: 'account_invoices_agency_booking_unique' },
      { fields: ['agency_id', 'status'] },
    ],
  });

  return AccountInvoice;
};
