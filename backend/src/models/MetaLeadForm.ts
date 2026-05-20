const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MetaLeadForm = sequelize.define('MetaLeadForm', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    metaFormId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    metaPageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    isSubscribed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'meta_lead_forms',
    indexes: [
      { unique: true, fields: ['agency_id', 'meta_form_id'] },
      { fields: ['agency_id', 'meta_page_id'] },
      { fields: ['agency_id', 'status'] },
    ],
  });

  return MetaLeadForm;
};
