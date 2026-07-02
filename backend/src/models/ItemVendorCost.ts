const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ItemVendorCost = sequelize.define('ItemVendorCost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    itemType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE'),
      allowNull: false,
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
      comment: 'Committed cost in paise for this catalog item',
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'item_vendor_costs',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'item_type'] },
      { fields: ['agency_id', 'item_type', 'package_id'] },
      { fields: ['agency_id', 'item_type', 'property_id'] },
      { fields: ['agency_id', 'item_type', 'cruise_id'] },
      { fields: ['agency_id', 'item_type', 'visa_id'] },
      { fields: ['agency_id', 'item_type', 'service_id'] },
      { fields: ['vendor_id'] },
      { fields: ['journal_entry_id'] },
      { fields: ['due_date'] },
    ],
  });

  return ItemVendorCost;
};
