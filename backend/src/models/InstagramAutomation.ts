// FILE: /backend/src/models/InstagramAutomation.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * InstagramAutomation stores TravelBot-owned comment-to-DM rules.
 * Marketing OS remains responsible for Meta token handling and delivery.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const InstagramAutomation = sequelize.define('InstagramAutomation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    accountId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mediaId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Instagram post/reel/media ID. Null means all media for this account.',
    },
    mediaTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    mediaThumbnailUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'Comment to DM',
    },
    triggerKeywords: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    matchType: {
      type: DataTypes.ENUM('EXACT', 'CONTAINS', 'ANY'),
      allowNull: false,
      defaultValue: 'CONTAINS',
    },
    actionType: {
      type: DataTypes.ENUM('PACKAGE_FLOW', 'PROPERTY_FLOW', 'BROCHURE_LINK', 'AGENT_HANDOFF'),
      allowNull: false,
      defaultValue: 'PACKAGE_FLOW',
    },
    linkedPackageIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    linkedPropertyIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    privateReplyMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Thanks for commenting. I can send the details here.',
    },
    quickReplies: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['Show Packages', 'Talk to Agent'],
    },
    followPromptMode: {
      type: DataTypes.ENUM('OFF', 'BEFORE_DETAILS', 'AFTER_DETAILS'),
      allowNull: false,
      defaultValue: 'OFF',
    },
    publicReplyEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    publicReplyMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'Sent you details in DM.',
    },
    duplicatePolicy: {
      type: DataTypes.ENUM('USER_PER_POST', 'COMMENT', 'USER_24H'),
      allowNull: false,
      defaultValue: 'USER_PER_POST',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    stats: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        matched: 0,
        privateRepliesSent: 0,
        publicRepliesSent: 0,
        leadsCreated: 0,
        errors: 0,
      },
    },
    lastTriggeredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'instagram_automations',
    indexes: [
      { fields: ['agency_id', 'account_id'] },
      { fields: ['agency_id', 'is_active'] },
      { fields: ['account_id', 'media_id'] },
    ],
  });

  return InstagramAutomation;
};
