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
    marketingOsTenantId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Marketing OS tenant slug used for embedded signup orchestration',
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
    whatsappTripFlowId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta WhatsApp Flow ID used for trip/package selection for this agency',
    },
    whatsappTripFlowName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Last known Meta WhatsApp Flow name for this agency',
    },
    whatsappTripFlowStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Trip flow lifecycle state such as DRAFT or PUBLISHED',
    },
    whatsappTripFlowError: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Last publish or validation error reported for the trip flow',
    },
    whatsappTripFlowLastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last time trip flow metadata was updated for this agency',
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
    googleReviewLink: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Google review link for post-trip review redirection',
    },
    whatsappCatalogId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta Commerce Catalog ID for Native WhatsApp E-Commerce',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    tableName: 'agencies',
    indexes: [
      { fields: ['whatsapp_number'], unique: true },
      { fields: ['email'], unique: true },
      { fields: ['phone'], unique: true },
    ],
  });

  return Agency;
};
