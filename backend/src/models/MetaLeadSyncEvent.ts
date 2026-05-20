const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MetaLeadSyncEvent = sequelize.define('MetaLeadSyncEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    eventType: {
      type: DataTypes.ENUM('WEBHOOK', 'BACKFILL', 'MANUAL'),
      allowNull: false,
      defaultValue: 'WEBHOOK',
    },
    status: {
      type: DataTypes.ENUM('RECEIVED', 'IMPORTED', 'DUPLICATE', 'FAILED'),
      allowNull: false,
      defaultValue: 'RECEIVED',
    },
    metaLeadgenId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metaFormId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    metaCampaignId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    tableName: 'meta_lead_sync_events',
    indexes: [
      { fields: ['agency_id', 'created_at'] },
      { fields: ['agency_id', 'status'] },
      { fields: ['meta_leadgen_id'] },
      { fields: ['lead_id'] },
    ],
  });

  return MetaLeadSyncEvent;
};
