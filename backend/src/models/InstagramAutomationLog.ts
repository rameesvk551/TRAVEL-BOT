// FILE: /backend/src/models/InstagramAutomationLog.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * InstagramAutomationLog records each comment automation decision.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const InstagramAutomationLog = sequelize.define('InstagramAutomationLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    automationId: {
      type: DataTypes.UUID,
      allowNull: true,
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
    },
    commentId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    commenterId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    commenterUsername: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    commentText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    matchedKeyword: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'MATCHED',
        'PRIVATE_REPLY_SENT',
        'PUBLIC_REPLY_SENT',
        'WAITING_FOR_REPLY',
        'CONVERTED_TO_DM',
        'DUPLICATE_SKIPPED',
        'TOO_OLD',
        'NO_MATCH',
        'FAILED'
      ),
      allowNull: false,
      defaultValue: 'MATCHED',
    },
    privateReplyMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    publicReplyMessageId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    tableName: 'instagram_automation_logs',
    indexes: [
      { fields: ['agency_id', 'account_id'] },
      { fields: ['automation_id'] },
      { fields: ['comment_id'] },
      { fields: ['status'] },
    ],
  });

  return InstagramAutomationLog;
};
