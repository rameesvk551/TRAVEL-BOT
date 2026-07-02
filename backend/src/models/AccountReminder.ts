const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AccountReminder = sequelize.define('AccountReminder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    relatedType: {
      type: DataTypes.ENUM('LEDGER', 'INVOICE', 'JOURNAL_ENTRY'),
      allowNull: false,
    },
    relatedId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dueAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'DONE', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  }, {
    tableName: 'account_reminders',
    indexes: [
      { fields: ['agency_id', 'status', 'due_at'] },
      { fields: ['agency_id', 'related_type', 'related_id'] },
    ],
  });

  return AccountReminder;
};
