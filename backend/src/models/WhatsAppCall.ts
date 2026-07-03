// FILE: /backend/src/models/WhatsAppCall.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * WhatsAppCall model - inbound WhatsApp (Cloud API) voice calls placed by
 * customers. travel-bot has no voice/media stack, so it never answers these
 * calls; every user-initiated call is effectively a missed call. Rows are
 * created from the `entry.changes.value.calls[]` webhook that marketing-os
 * raw-proxies to travel-bot. Kept separate from `call_logs` (Twilio) because
 * a missed call has no lead/customer/agent when the number is unknown.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const WhatsAppCall = sequelize.define('WhatsAppCall', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // Meta call id (`call.id`). Unique per agency so repeated webhook deliveries
    // for the same call are idempotent.
    providerCallId: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    direction: {
      type: DataTypes.ENUM('INBOUND', 'OUTBOUND'),
      allowNull: false,
      defaultValue: 'INBOUND',
    },
    callerPhone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    businessPhone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('MISSED', 'COMPLETED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'MISSED',
    },
    // Last Meta call event seen for this call ('connect' | 'terminate').
    event: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    // Auto-reply lifecycle. null = not attempted yet.
    autoReplyStatus: {
      type: DataTypes.ENUM('SENT', 'FAILED', 'SKIPPED', 'DISABLED'),
      allowNull: true,
    },
    autoReplySentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    autoReplyMessageId: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    autoReplyError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rawEvents: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  }, {
    tableName: 'whatsapp_calls',
    indexes: [
      { fields: ['agency_id', 'occurred_at'] },
      { unique: true, fields: ['agency_id', 'provider_call_id'] },
      { fields: ['caller_phone'] },
      { fields: ['agency_id', 'status'] },
    ],
  });

  return WhatsAppCall;
};
