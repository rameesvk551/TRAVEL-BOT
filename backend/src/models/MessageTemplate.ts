// FILE: /backend/src/models/MessageTemplate.ts
// DEPS: sequelize

const { DataTypes } = require('sequelize');

/**
 * MessageTemplate model — WhatsApp message templates for campaigns and automation.
 * Supports a prebuilt library (agencyId=null) plus agency-specific saved templates.
 * Variables use {{1}}, {{2}} placeholders matching Meta's format.
 * @param {import('sequelize').Sequelize} sequelize
 */
module.exports = (sequelize) => {
  const MessageTemplate = sequelize.define('MessageTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'NULL = prebuilt library template, set = agency-specific',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Template name e.g. "trip_reminder"',
    },
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Human-readable name e.g. "Trip Reminder"',
    },
    category: {
      type: DataTypes.ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION'),
      allowNull: false,
      defaultValue: 'MARKETING',
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'en',
    },
    headerType: {
      type: DataTypes.ENUM('NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'),
      allowNull: false,
      defaultValue: 'NONE',
    },
    headerContent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Header text or media URL',
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Message body with {{1}} {{2}} variable placeholders',
    },
    footer: {
      type: DataTypes.STRING(60),
      allowNull: true,
      comment: 'Optional footer text (max 60 chars)',
    },
    buttons: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Array of button objects: [{ type, text, url/phone }]',
    },
    variableCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Number of {{n}} variables in the body',
    },
    sampleVariables: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: 'Sample values for preview: ["John", "Maldives"]',
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      comment: 'Tags for filtering: ["travel", "seasonal", "follow-up"]',
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Emoji icon for the template card',
    },
    isPrebuilt: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True = part of the prebuilt gallery',
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED'),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metaTemplateId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta-assigned template ID after approval',
    },
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'message_templates',
    indexes: [
      { fields: ['agency_id'] },
      { fields: ['agency_id', 'status'] },
      { fields: ['is_prebuilt'] },
      { fields: ['category'] },
      { fields: ['name', 'agency_id'], unique: true },
    ],
  });

  return MessageTemplate;
};
