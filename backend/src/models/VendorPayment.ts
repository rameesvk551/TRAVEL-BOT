const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VendorPayment = sequelize.define('VendorPayment', {
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
    vendorBillId: {
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
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    paymentMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentMethodId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    referenceNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'vendor_payments',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['vendor_id'] },
      { fields: ['journal_entry_id'] },
      { fields: ['vendor_bill_id'] },
      { fields: ['payment_method_id'] },
      { fields: ['agency_id', 'item_type'] },
    ],
  });

  return VendorPayment;
};
