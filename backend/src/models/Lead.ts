// FILE: /backend/src/models/Lead.js
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Lead model — a customer enquiry progressing through the sales pipeline.
 * Status: JUST_CONTACTED → NEW → ENQUIRY → CONTACTED → QUOTED → NEGOTIATING → BOOKED | LOST | CANCELLED
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Lead = sequelize.define('Lead', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assignedAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    destination: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    travelDates: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Free text e.g. "Dec 15-20"',
    },
    travelStart: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    travelEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    travellers: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    budgetPerPerson: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'In paise (₹1 = 100 paise)',
    },
    packageId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to Property when lead originated from a property enquiry',
    },
    itemType: {
      type: DataTypes.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP'),
      allowNull: true,
      comment: 'Campaign item type that generated this lead',
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Campaign that generated this lead',
    },
    campaignName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    campaignAction: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'CTA/action that generated or updated this lead',
    },
    interest: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Travel interest selected by the customer, e.g. DOMESTIC or INTERNATIONAL',
    },
    status: {
      type: DataTypes.ENUM(
        'JUST_CONTACTED',
        'PACKAGE_SEARCHED',
        'PACKAGE_INTERESTED',
        'NEW',
        'ENQUIRY',
        'CONTACTED',
        'QUOTED',
        'NEGOTIATING',
        'BOOKED',
        'CONVERTED',
        'LOST',
        'CANCELLED',
        'UNKNOWN'
      ),
      defaultValue: 'JUST_CONTACTED',
    },
    lostReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'whatsapp_organic',
      comment: 'Lead origin: whatsapp_organic, instagram_ad, facebook_ad, referral, qr_code, website, manual',
    },
    referralCodeId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to ReferralCode if lead came from referral',
    },
    leadScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Predicted conversion score 0-100',
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Labels used by agents to segment and prioritize leads',
    },
    adId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta Ad ID if the lead originated from a Click-to-WhatsApp ad',
    },
    adHeadline: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    adSourceUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'leads',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'assigned_agent_id'] },
      { fields: ['customer_id'] },
      { fields: ['created_at'] },
      { fields: ['campaign_id'] },
      { fields: ['property_id'] },
    ],
  });

  return Lead;
};
