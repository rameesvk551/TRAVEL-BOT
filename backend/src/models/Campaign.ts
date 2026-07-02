// FILE: /backend/src/models/Campaign.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * Campaign model — broadcast campaigns sent to segmented audiences via WhatsApp.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const Campaign = sequelize.define('Campaign', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    channelId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'WhatsApp channel used for sending this campaign',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('BROADCAST', 'PROMOTIONAL', 'RE_ENGAGEMENT', 'SEASONAL', 'REVIEW_COLLECTION'),
      allowNull: false,
      defaultValue: 'BROADCAST',
    },
    format: {
      type: DataTypes.ENUM('STANDARD', 'SECTION_CTA', 'ITEM_CAROUSEL'),
      allowNull: false,
      defaultValue: 'STANDARD',
      comment: 'Campaign experience: standard broadcast, section CTA, or item carousel',
    },
    mediaType: {
      type: DataTypes.ENUM('NONE', 'IMAGE', 'VIDEO'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    mediaUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'FK to MessageTemplate',
    },
    messageBody: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Composed message body (may include variables)',
    },
    audienceFilter: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Segment criteria: { statuses, destinations, budgetMin, budgetMax, lastActiveBefore, customerType }',
    },
    linkedPackageIds: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Package IDs linked to this campaign for interactive discovery',
    },
    campaignSections: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Dynamic sections: packages, properties, custom trip entry points',
    },
    carouselConfig: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Carousel item/card config for package/property campaigns',
    },
    ctaConfig: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'CTA labels and routing metadata for section campaigns',
    },
    audienceCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Resolved audience size at send time',
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'FAILED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    totalRecipients: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    delivered: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    read: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    replied: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    failed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'campaigns',
    indexes: [
      { fields: ['agency_id', 'status'] },
      { fields: ['agency_id', 'created_at'] },
      { fields: ['scheduled_at'] },
    ],
  });

  return Campaign;
};
