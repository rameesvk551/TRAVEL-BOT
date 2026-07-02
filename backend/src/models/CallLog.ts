// FILE: /backend/src/models/CallLog.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * CallLog model - tracked phone calls bridged through Twilio.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const CallLog = sequelize.define('CallLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agentPhone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    customerPhone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    parentCallSid: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    agentCallSid: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    customerCallSid: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        'initiated',
        'queued',
        'ringing',
        'agent_answered',
        'customer_ringing',
        'in_progress',
        'completed',
        'busy',
        'failed',
        'no_answer',
        'canceled'
      ),
      allowNull: false,
      defaultValue: 'initiated',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    agentAnsweredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    customerAnsweredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    recordingSid: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    recordingUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    recordingDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawEvents: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  }, {
    tableName: 'call_logs',
    indexes: [
      { fields: ['agency_id', 'lead_id'] },
      { fields: ['agency_id', 'agent_id'] },
      { fields: ['agent_call_sid'] },
      { fields: ['customer_call_sid'] },
      { fields: ['parent_call_sid'] },
      { fields: ['created_at'] },
    ],
  });

  return CallLog;
};
