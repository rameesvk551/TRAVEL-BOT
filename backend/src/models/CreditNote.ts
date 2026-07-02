const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreditNote = sequelize.define('CreditNote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    creditNoteNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
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
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ISSUED', 'VOID'),
      allowNull: false,
      defaultValue: 'ISSUED',
    },
  }, {
    tableName: 'credit_notes',
    indexes: [
      { unique: true, fields: ['agency_id', 'credit_note_number'] },
      { fields: ['agency_id', 'invoice_id'] },
    ],
  });

  return CreditNote;
};
