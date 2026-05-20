const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MetaAdCampaign = sequelize.define('MetaAdCampaign', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metaCampaignId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    metaAdAccountId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    objective: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    lastInsights: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    rawPayload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'meta_ad_campaigns',
    indexes: [
      { unique: true, fields: ['agency_id', 'meta_campaign_id'] },
      { fields: ['agency_id', 'meta_ad_account_id'] },
      { fields: ['agency_id', 'status'] },
    ],
  });

  return MetaAdCampaign;
};
