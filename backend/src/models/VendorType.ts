const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorType = sequelize.define('VendorType', {
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
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ledgerGroupId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    tableName: 'vendor_types',
    indexes: [
      { fields: ['agency_id'] },
      { unique: true, fields: ['agency_id', 'name'] },
      { fields: ['ledger_group_id'] },
    ],
  });

  return VendorType;
};
