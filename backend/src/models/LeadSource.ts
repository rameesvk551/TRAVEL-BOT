const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LeadSource = sequelize.define('LeadSource', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'lead_sources',
    indexes: [
      { fields: ['agency_id'] },
      { unique: true, fields: ['agency_id', 'name'] },
    ],
  });

  return LeadSource;
};
