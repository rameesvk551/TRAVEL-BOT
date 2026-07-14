// FILE: /backend/src/models/Agent.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Agent model — a user who logs into the dashboard.
 * Can be ADMIN (full access) or AGENT (limited to assigned leads).
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Agent = sequelize.define('Agent', {
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
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Personal WhatsApp for notifications',
    },
    primaryWhatsAppChannelId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'primary_whatsapp_channel_id',
      comment: 'Mapped staff-owned WhatsApp channel used for first outreach',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'AGENT'),
      defaultValue: 'AGENT',
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    sidebarPreferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    resetPasswordTokenHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    resetPasswordExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'agents',
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'is_online'] },
      { fields: ['primary_whatsapp_channel_id'] },
      { fields: ['reset_password_token_hash'] },
    ],
  });

  return Agent;
};
