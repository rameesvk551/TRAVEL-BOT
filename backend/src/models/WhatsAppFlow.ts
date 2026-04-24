const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WhatsAppFlow = sequelize.define('WhatsAppFlow', {
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
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    flowType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP', 'GENERIC'),
      allowNull: false,
      defaultValue: 'GENERIC',
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PUBLISHED', 'FAILED', 'ARCHIVED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    metaFlowId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    endpointUri: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    firstScreenId: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    categories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: ['OTHER'],
    },
    jsonDefinition: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    validationErrors: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    healthStatus: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'whatsapp_flows',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'flow_type'] },
      { fields: ['meta_flow_id'] },
      { fields: ['agency_id', 'name'], unique: true },
    ],
  });

  return WhatsAppFlow;
};
