// FILE: /backend/src/models/Agency.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Agency model — represents a travel agency subscribed to TravelBot.
 * Each agency gets its own WhatsApp bot, Razorpay integration, and team.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Agency = sequelize.define('Agency', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    whatsappNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'The WhatsApp Business number customers message',
    },
    whatsappProvider: {
      type: DataTypes.ENUM('SELF_HOSTED', 'INTERAKT', 'MARKETING_OS'),
      allowNull: false,
      defaultValue: 'SELF_HOSTED',
      comment: 'Which provider manages this agency WhatsApp channel',
    },
    whatsappConnectionStatus: {
      type: DataTypes.ENUM('NOT_CONNECTED', 'PENDING', 'CONNECTED', 'FAILED'),
      allowNull: false,
      defaultValue: 'NOT_CONNECTED',
      comment: 'Partner onboarding status for the agency WhatsApp channel',
    },
    whatsappChannelId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Provider-side channel identifier',
    },
    whatsappBusinessAccountId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta WhatsApp Business Account ID from the provider',
    },
    whatsappPhoneNumberId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta phone number ID used for Cloud API sends',
    },
    whatsappDisplayPhoneNumber: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: 'Display phone number returned by the provider',
    },
    whatsappConnectionError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last onboarding or sync error reported by the provider',
    },
    whatsappLastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last successful provider sync timestamp',
    },
    razorpayKeyId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    razorpayKeySecret: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted at rest using AES',
    },
    webhookSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'For Razorpay webhook verification',
    },
    plan: {
      type: DataTypes.ENUM('FREE', 'STARTER', 'PRO'),
      defaultValue: 'FREE',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'agencies',
    indexes: [
      { fields: ['whatsapp_number'] },
      { fields: ['email'] },
    ],
  });

  return Agency;
};
