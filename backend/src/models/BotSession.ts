// FILE: /backend/src/models/BotSession.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * BotSession model — tracks the conversation state machine for each customer.
 * One session per customer per agency. Contains collected data as JSONB.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const BotSession = sequelize.define('BotSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    currentStep: {
      type: DataTypes.STRING(50),
      defaultValue: 'NEW',
      comment: 'e.g. NEW, COLLECTING_NAME, COLLECTING_DESTINATION, COMPLETE',
    },
    collectedData: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: '{ name, destination, dates, travellers, budget }',
    },
    isHandedOff: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    handedOffAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    handedOffToId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to Agent',
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    failedAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Count of consecutive unmatched inputs for handoff detection',
    },
  }, {
    tableName: 'bot_sessions',
    indexes: [
      { unique: true, fields: ['customer_id'] },
      { fields: ['agency_id'] },
      { fields: ['is_handed_off'] },
      { fields: ['last_activity_at'] },
    ],
  });

  return BotSession;
};
