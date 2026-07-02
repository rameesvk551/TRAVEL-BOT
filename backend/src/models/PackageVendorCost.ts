const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PackageVendorCost = sequelize.define('PackageVendorCost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    vendorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    serviceLabel: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Committed package cost in paise',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'package_vendor_costs',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'package_id'] },
      { fields: ['vendor_id'] },
      { fields: ['due_date'] },
    ],
  });

  return PackageVendorCost;
};
