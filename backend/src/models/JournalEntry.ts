const { DataTypes } = require('sequelize');

/**
 * Journal/voucher header. Lines must balance before creation.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const JournalEntry = sequelize.define('JournalEntry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    createdByAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    referenceNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM(
        'JOURNAL',
        'INVOICE',
        'RECEIPT',
        'PAYMENT',
        'EXPENSE_VOUCHER',
        'OTHER_PURCHASE',
        'OTHER_SALE',
        'INTERNAL_FUND_TRANSFER',
        'CREDIT_NOTE'
      ),
      allowNull: false,
      defaultValue: 'JOURNAL',
    },
    sourceType: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    sourceId: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    tableName: 'journal_entries',
    indexes: [
      { unique: true, fields: ['agency_id', 'reference_number'] },
      { unique: true, fields: ['agency_id', 'source_type', 'source_id', 'type'] },
      { fields: ['agency_id', 'date'] },
      { fields: ['agency_id', 'type'] },
    ],
  });

  return JournalEntry;
};
