const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AgencyChannel = sequelize.define('AgencyChannel', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    usageType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'AGENCY',
    },
    whatsappNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: true,
    },
    whatsappProvider: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'SELF_HOSTED',
    },
    whatsappPhoneNumberId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    whatsappBusinessAccountId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    whatsappDisplayPhoneNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    whatsappAccessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    whatsappCatalogId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    whatsappOnboardingMode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'STANDARD',
    },
    whatsappConnectionStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_CONNECTED',
    },
    whatsappCoexistenceStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_ENABLED',
    },
    whatsappContactSyncStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
    },
    whatsappHistorySyncStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
    },
    whatsappCoexistenceLastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    whatsappConnectionError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    whatsappLastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    marketingOsTenantId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    defaultFirstOutreachTemplateId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'agency_channels',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_default'] },
      { fields: ['agency_id', 'usage_type'] },
      { fields: ['whatsapp_phone_number_id'] },
    ],
  });

  return AgencyChannel;
};
