const { DataTypes } = require('sequelize');

/**
 * Journal line. Debit/credit amounts are stored in paise.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const JournalLine = sequelize.define('JournalLine', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    ledgerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    debit: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    credit: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    isReconciled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    reconciledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    partyType: {
      type: DataTypes.STRING(20),
      allowNull: true, // 'CUSTOMER' | 'SUPPLIER'
    },
    partyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'journal_lines',
    indexes: [
      { fields: ['agency_id', 'journal_entry_id'] },
      { fields: ['agency_id', 'ledger_id'] },
      { fields: ['agency_id', 'is_reconciled'] },
      { fields: ['agency_id', 'party_type', 'party_id'] },
    ],
  });

  return JournalLine;
};
