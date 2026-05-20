// FILE: /backend/src/models/index.js
// DEPS: sequelize, pg, pg-hstore
// ENV: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

const { Sequelize } = require('sequelize');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME || 'travelbot',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

// Import models
const Agency = require('./Agency')(sequelize);
const Agent = require('./Agent')(sequelize);
const RefreshToken = require('./RefreshToken')(sequelize);
const Customer = require('./Customer')(sequelize);
const Lead = require('./Lead')(sequelize);
const Package = require('./Package')(sequelize);
const Booking = require('./Booking')(sequelize);
const Payment = require('./Payment')(sequelize);
const Message = require('./Message')(sequelize);
const BotSession = require('./BotSession')(sequelize);
const ScheduledJob = require('./ScheduledJob')(sequelize);
const Itinerary = require('./Itinerary')(sequelize);
const FollowUp = require('./FollowUp')(sequelize);
const LeadNote = require('./LeadNote')(sequelize);
const Property = require('./Property')(sequelize);
const InstagramAutomation = require('./InstagramAutomation')(sequelize);
const InstagramAutomationLog = require('./InstagramAutomationLog')(sequelize);
const MetaAdCampaign = require('./MetaAdCampaign')(sequelize);
const MetaLeadForm = require('./MetaLeadForm')(sequelize);
const MetaLeadSyncEvent = require('./MetaLeadSyncEvent')(sequelize);
const WhatsAppFlow = require('./WhatsAppFlow')(sequelize);
const ServiceRoutingRule = require('./ServiceRoutingRule')(sequelize);
const PlatformAdmin = require('./PlatformAdmin')(sequelize);
const PlatformAdminSession = require('./PlatformAdminSession')(sequelize);
const PlatformAuditLog = require('./PlatformAuditLog')(sequelize);

// Marketing models
const MessageTemplate = require('./MessageTemplate')(sequelize);
const Campaign = require('./Campaign')(sequelize);
const CampaignRecipient = require('./CampaignRecipient')(sequelize);
const DripSequence = require('./DripSequence')(sequelize);
const DripStep = require('./DripStep')(sequelize);
const DripEnrollment = require('./DripEnrollment')(sequelize);
const ReferralCode = require('./ReferralCode')(sequelize);
const Review = require('./Review')(sequelize);

// ===== ASSOCIATIONS =====

// Agency has many
Agency.hasMany(Agent, { foreignKey: 'agencyId', as: 'agents' });
Agency.hasMany(Customer, { foreignKey: 'agencyId', as: 'customers' });
Agency.hasMany(Lead, { foreignKey: 'agencyId', as: 'leads' });
Agency.hasMany(Package, { foreignKey: 'agencyId', as: 'packages' });
Agency.hasMany(Booking, { foreignKey: 'agencyId', as: 'bookings' });
Agency.hasMany(Payment, { foreignKey: 'agencyId', as: 'payments' });
Agency.hasMany(Message, { foreignKey: 'agencyId', as: 'messages' });
Agency.hasMany(BotSession, { foreignKey: 'agencyId', as: 'botSessions' });
Agency.hasMany(ScheduledJob, { foreignKey: 'agencyId', as: 'scheduledJobs' });
Agency.hasMany(MessageTemplate, { foreignKey: 'agencyId', as: 'messageTemplates' });
Agency.hasMany(Campaign, { foreignKey: 'agencyId', as: 'campaigns' });
Agency.hasMany(DripSequence, { foreignKey: 'agencyId', as: 'dripSequences' });
Agency.hasMany(DripEnrollment, { foreignKey: 'agencyId', as: 'dripEnrollments' });
Agency.hasMany(ReferralCode, { foreignKey: 'agencyId', as: 'referralCodes' });
Agency.hasMany(Review, { foreignKey: 'agencyId', as: 'reviews' });
Agency.hasMany(Property, { foreignKey: 'agencyId', as: 'properties' });
Agency.hasMany(InstagramAutomation, { foreignKey: 'agencyId', as: 'instagramAutomations' });
Agency.hasMany(InstagramAutomationLog, { foreignKey: 'agencyId', as: 'instagramAutomationLogs' });
Agency.hasMany(MetaAdCampaign, { foreignKey: 'agencyId', as: 'metaAdCampaigns' });
Agency.hasMany(MetaLeadForm, { foreignKey: 'agencyId', as: 'metaLeadForms' });
Agency.hasMany(MetaLeadSyncEvent, { foreignKey: 'agencyId', as: 'metaLeadSyncEvents' });
Agency.hasMany(WhatsAppFlow, { foreignKey: 'agencyId', as: 'whatsappFlows' });
Agency.hasMany(ServiceRoutingRule, { foreignKey: 'agencyId', as: 'serviceRoutingRules' });
Agency.hasMany(PlatformAuditLog, { foreignKey: 'targetId', constraints: false, scope: { targetType: 'Agency' }, as: 'platformAuditLogs' });

// Property belongs to Agency
Property.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Agent belongs to Agency
Agent.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agent.hasMany(RefreshToken, { foreignKey: 'agentId', as: 'refreshTokens' });
Agent.hasMany(Lead, { foreignKey: 'assignedAgentId', as: 'assignedLeads' });
Agent.hasMany(Message, { foreignKey: 'agentId', as: 'sentMessages' });
Agent.hasMany(FollowUp, { foreignKey: 'agentId', as: 'followUps' });
Agent.hasMany(LeadNote, { foreignKey: 'agentId', as: 'leadNotes' });
Agent.hasMany(ServiceRoutingRule, { foreignKey: 'agentId', as: 'serviceRoutingRules' });

// RefreshToken belongs to Agent
RefreshToken.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// Customer belongs to Agency
Customer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Customer.hasMany(Lead, { foreignKey: 'customerId', as: 'leads' });
Customer.hasMany(Booking, { foreignKey: 'customerId', as: 'bookings' });
Customer.hasMany(Message, { foreignKey: 'customerId', as: 'messages' });
Customer.hasOne(BotSession, { foreignKey: 'customerId', as: 'botSession' });
Customer.hasMany(ReferralCode, { foreignKey: 'customerId', as: 'referralCodes' });
Customer.hasMany(Review, { foreignKey: 'customerId', as: 'reviews' });
Customer.hasMany(DripEnrollment, { foreignKey: 'customerId', as: 'dripEnrollments' });
Customer.hasMany(CampaignRecipient, { foreignKey: 'customerId', as: 'campaignRecipients' });

// Lead belongs to Customer, Agency, Agent, Package
Lead.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Lead.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Lead.belongsTo(Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
Lead.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Lead.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
Lead.belongsTo(ReferralCode, { foreignKey: 'referralCodeId', as: 'referralCode' });
Lead.hasOne(Booking, { foreignKey: 'leadId', as: 'booking' });
Lead.hasMany(DripEnrollment, { foreignKey: 'leadId', as: 'dripEnrollments' });
Lead.hasMany(FollowUp, { foreignKey: 'leadId', as: 'followUps' });
Lead.hasMany(LeadNote, { foreignKey: 'leadId', as: 'notesList' });

// Package belongs to Agency
Package.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Package.hasMany(Lead, { foreignKey: 'packageId', as: 'leads' });
Package.hasMany(Booking, { foreignKey: 'packageId', as: 'bookings' });

// Property inventory
Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });

// Instagram automations
InstagramAutomation.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
InstagramAutomation.hasMany(InstagramAutomationLog, { foreignKey: 'automationId', as: 'logs' });
InstagramAutomationLog.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
InstagramAutomationLog.belongsTo(InstagramAutomation, { foreignKey: 'automationId', as: 'automation' });
MetaAdCampaign.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
MetaLeadForm.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
MetaLeadSyncEvent.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
MetaLeadSyncEvent.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

// Booking
Booking.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Booking.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Booking.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Booking.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Booking.hasMany(ScheduledJob, { foreignKey: 'bookingId', as: 'scheduledJobs' });
Booking.hasOne(Review, { foreignKey: 'bookingId', as: 'review' });

// Itinerary
Itinerary.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Itinerary.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Itinerary.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

// Payment
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Payment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Message
Message.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Message.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Message.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// BotSession
BotSession.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
BotSession.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
BotSession.belongsTo(Agent, { foreignKey: 'handedOffToId', as: 'handedOffTo' });

// ScheduledJob
ScheduledJob.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
ScheduledJob.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// MessageTemplate
MessageTemplate.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
WhatsAppFlow.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
ServiceRoutingRule.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
ServiceRoutingRule.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// Platform admin
PlatformAdmin.hasMany(PlatformAdminSession, { foreignKey: 'adminId', as: 'sessions' });
PlatformAdminSession.belongsTo(PlatformAdmin, { foreignKey: 'adminId', as: 'admin' });
PlatformAdmin.hasMany(PlatformAuditLog, { foreignKey: 'adminId', as: 'auditLogs' });
PlatformAuditLog.belongsTo(PlatformAdmin, { foreignKey: 'adminId', as: 'admin' });

// Campaign
Campaign.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Campaign.belongsTo(MessageTemplate, { foreignKey: 'templateId', as: 'template' });
Campaign.hasMany(CampaignRecipient, { foreignKey: 'campaignId', as: 'recipients' });
Campaign.hasMany(Lead, { foreignKey: 'campaignId', as: 'leads' });

// CampaignRecipient
CampaignRecipient.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
CampaignRecipient.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CampaignRecipient.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

// DripSequence
DripSequence.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
DripSequence.hasMany(DripStep, { foreignKey: 'sequenceId', as: 'steps' });
DripSequence.hasMany(DripEnrollment, { foreignKey: 'sequenceId', as: 'enrollments' });

// DripStep
DripStep.belongsTo(DripSequence, { foreignKey: 'sequenceId', as: 'sequence' });
DripStep.belongsTo(MessageTemplate, { foreignKey: 'templateId', as: 'template' });

// DripEnrollment
DripEnrollment.belongsTo(DripSequence, { foreignKey: 'sequenceId', as: 'sequence' });
DripEnrollment.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
DripEnrollment.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
DripEnrollment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// ReferralCode
ReferralCode.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
ReferralCode.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
ReferralCode.hasMany(Lead, { foreignKey: 'referralCodeId', as: 'referredLeads' });

// Review
Review.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Review.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Review.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

// FollowUp
FollowUp.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
FollowUp.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
FollowUp.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// LeadNote
LeadNote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
LeadNote.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

module.exports = {
  sequelize,
  Sequelize,
  Agency,
  Agent,
  RefreshToken,
  Customer,
  Lead,
  Package,
  Booking,
  Payment,
  Message,
  BotSession,
  ScheduledJob,
  MessageTemplate,
  Campaign,
  CampaignRecipient,
  DripSequence,
  DripStep,
  DripEnrollment,
  ReferralCode,
  Review,
  Itinerary,
  FollowUp,
  LeadNote,
  Property,
  InstagramAutomation,
  InstagramAutomationLog,
  MetaAdCampaign,
  MetaLeadForm,
  MetaLeadSyncEvent,
  WhatsAppFlow,
  ServiceRoutingRule,
  PlatformAdmin,
  PlatformAdminSession,
  PlatformAuditLog,
};
