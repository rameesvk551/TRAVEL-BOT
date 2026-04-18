const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LeadNote = sequelize.define('LeadNote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    tableName: 'lead_notes',
    indexes: [
      { fields: ['lead_id'] },
    ],
  });

  return LeadNote;
};
