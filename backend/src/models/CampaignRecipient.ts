// FILE: /backend/src/models/CampaignRecipient.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * CampaignRecipient — tracks per-recipient delivery status for campaigns.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const CampaignRecipient = sequelize.define('CampaignRecipient', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    waMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    repliedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clickedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clickedAction: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    selectedItemType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP'),
      allowNull: true,
    },
    selectedItemId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    flowSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'campaign_recipients',
    indexes: [
      { fields: ['campaign_id', 'status'] },
      { fields: ['campaign_id', 'customer_id'], unique: true },
      { fields: ['wa_message_id'] },
      { fields: ['campaign_id', 'clicked_action'] },
      { fields: ['lead_id'] },
    ],
  });

  return CampaignRecipient;
};
