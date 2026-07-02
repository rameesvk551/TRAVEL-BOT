const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorBill = sequelize.define('VendorBill', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    vendorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    itemType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'),
      allowNull: true,
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    cruiseId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    visaId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    customItemName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    customItemDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    billDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'),
      allowNull: false,
      defaultValue: 'ISSUED',
    },
    referenceNumber: {
      type: DataTypes.STRING(255),
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
    tableName: 'vendor_bills',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['vendor_id'] },
      { fields: ['journal_entry_id'] },
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'vendor_id', 'status'] },
      { fields: ['agency_id', 'item_type'] },
    ],
  });

  return VendorBill;
};
