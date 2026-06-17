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
const AgencyChannel = require('./AgencyChannel')(sequelize);
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
const Cruise = require('./Cruise')(sequelize);
const Visa = require('./Visa')(sequelize);
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
const Partner = require('./Partner')(sequelize);
const PartnerInvoice = require('./PartnerInvoice')(sequelize);
const CallLog = require('./CallLog')(sequelize);
const AccountingLedger = require('./AccountingLedger')(sequelize);
const JournalEntry = require('./JournalEntry')(sequelize);
const JournalLine = require('./JournalLine')(sequelize);
const AccountInvoice = require('./AccountInvoice')(sequelize);
const InvoiceTemplate = require('./InvoiceTemplate')(sequelize);
const AccountReminder = require('./AccountReminder')(sequelize);
const CreditNote = require('./CreditNote')(sequelize);
const Service = require('./Service')(sequelize);
const AgencyApiKey = require('./AgencyApiKey')(sequelize);
const Vendor = require('./Vendor')(sequelize);
const VendorPayment = require('./VendorPayment')(sequelize);
const VendorType = require('./VendorType')(sequelize);

// Marketing models
const MessageTemplate = require('./MessageTemplate')(sequelize);
const Campaign = require('./Campaign')(sequelize);
const CampaignRecipient = require('./CampaignRecipient')(sequelize);
const DripSequence = require('./DripSequence')(sequelize);
const DripStep = require('./DripStep')(sequelize);
const DripEnrollment = require('./DripEnrollment')(sequelize);
const ReferralCode = require('./ReferralCode')(sequelize);
const Review = require('./Review')(sequelize);
const PipelineStage = require('./PipelineStage')(sequelize);

// HRM models
const EmployeeProfile = require('./EmployeeProfile')(sequelize);
const Attendance = require('./Attendance')(sequelize);
const LeaveType = require('./LeaveType')(sequelize);
const LeaveRequest = require('./LeaveRequest')(sequelize);
const Holiday = require('./Holiday')(sequelize);
const HrmSetting = require('./HrmSetting')(sequelize);
const Payslip = require('./Payslip')(sequelize);

// ===== ASSOCIATIONS =====

// Agency has many
Agency.hasMany(AgencyChannel, { foreignKey: 'agencyId', as: 'channels' });
AgencyChannel.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
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
Agency.hasMany(CallLog, { foreignKey: 'agencyId', as: 'callLogs' });
Agency.hasMany(AccountingLedger, { foreignKey: 'agencyId', as: 'accountingLedgers' });
Agency.hasMany(JournalEntry, { foreignKey: 'agencyId', as: 'journalEntries' });
Agency.hasMany(JournalLine, { foreignKey: 'agencyId', as: 'journalLines' });
Agency.hasMany(AccountInvoice, { foreignKey: 'agencyId', as: 'accountInvoices' });
Agency.hasMany(AccountReminder, { foreignKey: 'agencyId', as: 'accountReminders' });
Agency.hasMany(CreditNote, { foreignKey: 'agencyId', as: 'creditNotes' });
Agency.hasMany(Service, { foreignKey: 'agencyId', as: 'services' });
Agency.hasMany(Vendor, { foreignKey: 'agencyId', as: 'vendors' });
Agency.hasMany(VendorPayment, { foreignKey: 'agencyId', as: 'vendorPayments' });
Agency.hasMany(VendorType, { foreignKey: 'agencyId', as: 'vendorTypes' });
VendorType.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
VendorType.belongsTo(AccountingLedger, { foreignKey: 'ledgerGroupId', as: 'ledgerGroup' });
Agency.hasMany(InvoiceTemplate, { foreignKey: 'agencyId', as: 'invoiceTemplates' });
Agency.hasMany(Cruise, { foreignKey: 'agencyId', as: 'cruises' });
Cruise.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Cruise.hasMany(Lead, { foreignKey: 'cruiseId', as: 'leads' });
Cruise.hasMany(Booking, { foreignKey: 'cruiseId', as: 'bookings' });
Agency.hasMany(Visa, { foreignKey: 'agencyId', as: 'visas' });
Visa.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Visa.hasMany(Lead, { foreignKey: 'visaId', as: 'leads' });
Visa.hasMany(Booking, { foreignKey: 'visaId', as: 'bookings' });

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
Agent.hasMany(CallLog, { foreignKey: 'agentId', as: 'callLogs' });

// RefreshToken belongs to Agent
RefreshToken.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// Customer belongs to Agency
Customer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Customer.belongsTo(AgencyChannel, { foreignKey: 'channelId', as: 'channel' });
AgencyChannel.hasMany(Customer, { foreignKey: 'channelId', as: 'customers' });
Customer.belongsTo(Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
Agent.hasMany(Customer, { foreignKey: 'assignedAgentId', as: 'assignedCustomers' });
Customer.hasMany(Lead, { foreignKey: 'customerId', as: 'leads' });
Customer.hasMany(Booking, { foreignKey: 'customerId', as: 'bookings' });
Customer.hasMany(Message, { foreignKey: 'customerId', as: 'messages' });
Customer.hasOne(BotSession, { foreignKey: 'customerId', as: 'botSession' });
Customer.hasMany(ReferralCode, { foreignKey: 'customerId', as: 'referralCodes' });
Customer.hasMany(Review, { foreignKey: 'customerId', as: 'reviews' });
Customer.hasMany(DripEnrollment, { foreignKey: 'customerId', as: 'dripEnrollments' });
Customer.hasMany(CampaignRecipient, { foreignKey: 'customerId', as: 'campaignRecipients' });
Customer.hasMany(CallLog, { foreignKey: 'customerId', as: 'callLogs' });
Customer.hasMany(AccountInvoice, { foreignKey: 'customerId', as: 'accountInvoices' });

// Lead belongs to Customer, Agency, Agent, Package
Lead.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Lead.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Lead.belongsTo(Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
Lead.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Lead.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Lead.belongsTo(Visa, { foreignKey: 'visaId', as: 'visa' });
Lead.belongsTo(Cruise, { foreignKey: 'cruiseId', as: 'cruise' });
Lead.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
Lead.belongsTo(ReferralCode, { foreignKey: 'referralCodeId', as: 'referralCode' });
Lead.hasOne(Booking, { foreignKey: 'leadId', as: 'booking' });
Lead.hasMany(DripEnrollment, { foreignKey: 'leadId', as: 'dripEnrollments' });
Lead.hasMany(FollowUp, { foreignKey: 'leadId', as: 'followUps' });
Lead.hasMany(LeadNote, { foreignKey: 'leadId', as: 'notesList' });
Lead.hasMany(CallLog, { foreignKey: 'leadId', as: 'callLogs' });

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
Booking.belongsTo(Cruise, { foreignKey: 'cruiseId', as: 'cruise' });
Booking.belongsTo(Visa, { foreignKey: 'visaId', as: 'visa' });
Booking.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Booking.hasMany(ScheduledJob, { foreignKey: 'bookingId', as: 'scheduledJobs' });
Booking.hasOne(Review, { foreignKey: 'bookingId', as: 'review' });
Booking.hasOne(AccountInvoice, { foreignKey: 'bookingId', as: 'accountInvoice' });

// Itinerary
Itinerary.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Itinerary.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Itinerary.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

// Payment
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Payment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Accounting
AccountingLedger.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AccountingLedger.belongsTo(AccountingLedger, { foreignKey: 'parentId', as: 'parent' });
AccountingLedger.hasMany(AccountingLedger, { foreignKey: 'parentId', as: 'children' });
AccountingLedger.hasMany(JournalLine, { foreignKey: 'ledgerId', as: 'journalLines' });

JournalEntry.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
JournalEntry.belongsTo(Agent, { foreignKey: 'createdByAgentId', as: 'createdByAgent' });
JournalEntry.hasMany(JournalLine, { foreignKey: 'journalEntryId', as: 'lines' });
JournalEntry.hasOne(AccountInvoice, { foreignKey: 'journalEntryId', as: 'invoice' });
JournalEntry.hasOne(CreditNote, { foreignKey: 'journalEntryId', as: 'creditNote' });

JournalLine.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
JournalLine.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });
JournalLine.belongsTo(AccountingLedger, { foreignKey: 'ledgerId', as: 'ledger' });

AccountInvoice.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AccountInvoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
AccountInvoice.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
AccountInvoice.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

AccountReminder.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

CreditNote.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
CreditNote.belongsTo(AccountInvoice, { foreignKey: 'invoiceId', as: 'invoice' });
CreditNote.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

// Service
Service.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Service.hasMany(Lead, { foreignKey: 'serviceId', as: 'leads' });
Service.hasMany(Booking, { foreignKey: 'serviceId', as: 'bookings' });

// AgencyApiKey (publishable keys for the public embed API)
Agency.hasMany(AgencyApiKey, { foreignKey: 'agencyId', as: 'apiKeys' });
AgencyApiKey.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AgencyApiKey.belongsTo(Agent, { foreignKey: 'createdByAgentId', as: 'createdBy' });

// Vendor
Vendor.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Vendor.belongsTo(AccountingLedger, { foreignKey: 'ledgerId', as: 'ledger' });
AccountingLedger.hasOne(Vendor, { foreignKey: 'ledgerId', as: 'vendor' });
Vendor.hasMany(VendorPayment, { foreignKey: 'vendorId', as: 'payments' });

// VendorPayment
VendorPayment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
VendorPayment.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
VendorPayment.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

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

// Partner (white-label reseller)
Partner.hasMany(Agency, { foreignKey: 'partnerId', as: 'agencies' });
Agency.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
Partner.hasMany(PartnerInvoice, { foreignKey: 'partnerId', as: 'invoices' });
PartnerInvoice.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });
PlatformAdmin.hasMany(Partner, { foreignKey: 'createdByAdminId', as: 'partners' });
Partner.belongsTo(PlatformAdmin, { foreignKey: 'createdByAdminId', as: 'createdBy' });

// Platform admin
PlatformAdmin.hasMany(PlatformAdminSession, { foreignKey: 'adminId', as: 'sessions' });
PlatformAdminSession.belongsTo(PlatformAdmin, { foreignKey: 'adminId', as: 'admin' });
PlatformAdmin.hasMany(PlatformAuditLog, { foreignKey: 'adminId', as: 'auditLogs' });
PlatformAuditLog.belongsTo(PlatformAdmin, { foreignKey: 'adminId', as: 'admin' });

// Campaign
Campaign.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Campaign.belongsTo(AgencyChannel, { foreignKey: 'channelId', as: 'channel' });
AgencyChannel.hasMany(Campaign, { foreignKey: 'channelId', as: 'campaigns' });
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

// PipelineStage
Agency.hasMany(PipelineStage, { foreignKey: 'agencyId', as: 'pipelineStages' });
PipelineStage.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// CallLog
CallLog.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
CallLog.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CallLog.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// ===== HRM =====
Agency.hasMany(EmployeeProfile, { foreignKey: 'agencyId', as: 'employeeProfiles' });
EmployeeProfile.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
EmployeeProfile.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });
Agent.hasOne(EmployeeProfile, { foreignKey: 'agentId', as: 'employeeProfile' });

Agency.hasMany(Attendance, { foreignKey: 'agencyId', as: 'attendances' });
Attendance.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Attendance.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });
Agent.hasMany(Attendance, { foreignKey: 'agentId', as: 'attendances' });

Agency.hasMany(LeaveType, { foreignKey: 'agencyId', as: 'leaveTypes' });
LeaveType.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
LeaveType.hasMany(LeaveRequest, { foreignKey: 'leaveTypeId', as: 'leaveRequests' });

Agency.hasMany(LeaveRequest, { foreignKey: 'agencyId', as: 'leaveRequests' });
LeaveRequest.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
LeaveRequest.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });
LeaveRequest.belongsTo(Agent, { foreignKey: 'reviewedByAgentId', as: 'reviewedBy' });
LeaveRequest.belongsTo(LeaveType, { foreignKey: 'leaveTypeId', as: 'leaveType' });
Agent.hasMany(LeaveRequest, { foreignKey: 'agentId', as: 'leaveRequests' });

Agency.hasMany(Holiday, { foreignKey: 'agencyId', as: 'holidays' });
Holiday.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

Agency.hasOne(HrmSetting, { foreignKey: 'agencyId', as: 'hrmSetting' });
HrmSetting.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

Agency.hasMany(Payslip, { foreignKey: 'agencyId', as: 'payslips' });
Payslip.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Payslip.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });
Agent.hasMany(Payslip, { foreignKey: 'agentId', as: 'payslips' });

module.exports = {
  sequelize,
  Sequelize,
  Agency,
  AgencyChannel,
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
  PipelineStage,
  Itinerary,
  FollowUp,
  LeadNote,
  Property,
  Cruise,
  Visa,
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
  Partner,
  PartnerInvoice,
  CallLog,
  AccountingLedger,
  JournalEntry,
  JournalLine,
  AccountInvoice,
  AccountReminder,
  CreditNote,
  Service,
  AgencyApiKey,
  Vendor,
  VendorPayment,
  VendorType,
  EmployeeProfile,
  Attendance,
  LeaveType,
  LeaveRequest,
  Holiday,
  HrmSetting,
  Payslip,
};
