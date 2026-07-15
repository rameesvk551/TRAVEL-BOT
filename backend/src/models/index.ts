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
const CatalogMediaLink = require('./CatalogMediaLink')(sequelize);
const MetaAdCampaign = require('./MetaAdCampaign')(sequelize);
const MetaLeadForm = require('./MetaLeadForm')(sequelize);
const MetaLeadSyncEvent = require('./MetaLeadSyncEvent')(sequelize);
const WhatsAppFlow = require('./WhatsAppFlow')(sequelize);
const ServiceRoutingRule = require('./ServiceRoutingRule')(sequelize);
const PlatformAdmin = require('./PlatformAdmin')(sequelize);
const PlatformAdminSession = require('./PlatformAdminSession')(sequelize);
const PlatformAuditLog = require('./PlatformAuditLog')(sequelize);
const ActivityLog = require('./ActivityLog')(sequelize);
const Partner = require('./Partner')(sequelize);
const PartnerInvoice = require('./PartnerInvoice')(sequelize);
const CallLog = require('./CallLog')(sequelize);
const WhatsAppCall = require('./WhatsAppCall')(sequelize);
const AccountingLedger = require('./AccountingLedger')(sequelize);
const AccountingPaymentMethod = require('./AccountingPaymentMethod')(sequelize);
const JournalEntry = require('./JournalEntry')(sequelize);
const JournalLine = require('./JournalLine')(sequelize);
const AccountInvoice = require('./AccountInvoice')(sequelize);
const InvoiceTemplate = require('./InvoiceTemplate')(sequelize);
const QuotationTemplate = require('./QuotationTemplate')(sequelize);
const ItineraryTemplate = require('./ItineraryTemplate')(sequelize);
const ReceiptTemplate = require('./ReceiptTemplate')(sequelize);
const Brochure = require('./Brochure')(sequelize);
const BrochureTemplate = require('./BrochureTemplate')(sequelize);
const BrochureAsset = require('./BrochureAsset')(sequelize);
const Quotation = require('./Quotation')(sequelize);
const AccountReminder = require('./AccountReminder')(sequelize);
const CreditNote = require('./CreditNote')(sequelize);
const Service = require('./Service')(sequelize);
const AgencyApiKey = require('./AgencyApiKey')(sequelize);
const Vendor = require('./Vendor')(sequelize);
const VendorBill = require('./VendorBill')(sequelize);
const VendorPayment = require('./VendorPayment')(sequelize);
const VendorType = require('./VendorType')(sequelize);
const LeadSource = require('./LeadSource')(sequelize);
const LeadForm = require('./LeadForm')(sequelize);
const PackageVendorCost = require('./PackageVendorCost')(sequelize);
const ItemVendorCost = require('./ItemVendorCost')(sequelize);

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
AgencyChannel.hasMany(MessageTemplate, { foreignKey: 'channelId', as: 'messageTemplates' });
MessageTemplate.belongsTo(AgencyChannel, { foreignKey: 'channelId', as: 'channel' });
Agency.hasMany(Campaign, { foreignKey: 'agencyId', as: 'campaigns' });
Agency.hasMany(DripSequence, { foreignKey: 'agencyId', as: 'dripSequences' });
Agency.hasMany(DripEnrollment, { foreignKey: 'agencyId', as: 'dripEnrollments' });
Agency.hasMany(ReferralCode, { foreignKey: 'agencyId', as: 'referralCodes' });
Agency.hasMany(Review, { foreignKey: 'agencyId', as: 'reviews' });
Agency.hasMany(Property, { foreignKey: 'agencyId', as: 'properties' });
Agency.hasMany(InstagramAutomation, { foreignKey: 'agencyId', as: 'instagramAutomations' });
Agency.hasMany(InstagramAutomationLog, { foreignKey: 'agencyId', as: 'instagramAutomationLogs' });
Agency.hasMany(CatalogMediaLink, { foreignKey: 'agencyId', as: 'catalogMediaLinks' });
CatalogMediaLink.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agency.hasMany(MetaAdCampaign, { foreignKey: 'agencyId', as: 'metaAdCampaigns' });
Agency.hasMany(MetaLeadForm, { foreignKey: 'agencyId', as: 'metaLeadForms' });
Agency.hasMany(MetaLeadSyncEvent, { foreignKey: 'agencyId', as: 'metaLeadSyncEvents' });
Agency.hasMany(WhatsAppFlow, { foreignKey: 'agencyId', as: 'whatsappFlows' });
Agency.hasMany(ServiceRoutingRule, { foreignKey: 'agencyId', as: 'serviceRoutingRules' });
Agency.hasMany(PlatformAuditLog, { foreignKey: 'targetId', constraints: false, scope: { targetType: 'Agency' }, as: 'platformAuditLogs' });
Agency.hasMany(CallLog, { foreignKey: 'agencyId', as: 'callLogs' });
Agency.hasMany(AccountingLedger, { foreignKey: 'agencyId', as: 'accountingLedgers' });
Agency.hasMany(AccountingPaymentMethod, { foreignKey: 'agencyId', as: 'accountingPaymentMethods' });
Agency.hasMany(JournalEntry, { foreignKey: 'agencyId', as: 'journalEntries' });
Agency.hasMany(JournalLine, { foreignKey: 'agencyId', as: 'journalLines' });
Agency.hasMany(AccountInvoice, { foreignKey: 'agencyId', as: 'accountInvoices' });
Agency.hasMany(AccountReminder, { foreignKey: 'agencyId', as: 'accountReminders' });
Agency.hasMany(CreditNote, { foreignKey: 'agencyId', as: 'creditNotes' });
Agency.hasMany(Service, { foreignKey: 'agencyId', as: 'services' });
Agency.hasMany(Vendor, { foreignKey: 'agencyId', as: 'vendors' });
Agency.hasMany(VendorBill, { foreignKey: 'agencyId', as: 'vendorBills' });
Agency.hasMany(VendorPayment, { foreignKey: 'agencyId', as: 'vendorPayments' });
Agency.hasMany(VendorType, { foreignKey: 'agencyId', as: 'vendorTypes' });
Agency.hasMany(LeadSource, { foreignKey: 'agencyId', as: 'leadSources' });
LeadSource.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agency.hasMany(LeadForm, { foreignKey: 'agencyId', as: 'leadForms' });
LeadForm.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agency.hasMany(PackageVendorCost, { foreignKey: 'agencyId', as: 'packageVendorCosts' });
Agency.hasMany(ItemVendorCost, { foreignKey: 'agencyId', as: 'itemVendorCosts' });
VendorType.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
VendorType.belongsTo(AccountingLedger, { foreignKey: 'ledgerGroupId', as: 'ledgerGroup' });
Agency.hasMany(InvoiceTemplate, { foreignKey: 'agencyId', as: 'invoiceTemplates' });
Agency.hasMany(QuotationTemplate, { foreignKey: 'agencyId', as: 'quotationTemplates' });
Agency.hasMany(ReceiptTemplate, { foreignKey: 'agencyId', as: 'receiptTemplates' });
Agency.hasMany(Quotation, { foreignKey: 'agencyId', as: 'quotations' });
Agency.hasMany(Cruise, { foreignKey: 'agencyId', as: 'cruises' });
Cruise.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Cruise.hasMany(Lead, { foreignKey: 'cruiseId', as: 'leads' });
Cruise.hasMany(Booking, { foreignKey: 'cruiseId', as: 'bookings' });
Cruise.hasMany(ItemVendorCost, { foreignKey: 'cruiseId', as: 'itemVendorCosts' });
Agency.hasMany(Visa, { foreignKey: 'agencyId', as: 'visas' });
Visa.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Visa.hasMany(Lead, { foreignKey: 'visaId', as: 'leads' });
Visa.hasMany(Booking, { foreignKey: 'visaId', as: 'bookings' });
Visa.hasMany(ItemVendorCost, { foreignKey: 'visaId', as: 'itemVendorCosts' });

// Property belongs to Agency
Property.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Agent belongs to Agency
Agent.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agent.belongsTo(AgencyChannel, { foreignKey: 'primaryWhatsAppChannelId', as: 'primaryWhatsAppChannel' });
AgencyChannel.hasOne(Agent, { foreignKey: 'primaryWhatsAppChannelId', as: 'assignedStaffAgent' });
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
Customer.belongsTo(AccountingLedger, { foreignKey: 'ledgerId', as: 'ledger' });
AccountingLedger.hasOne(Customer, { foreignKey: 'ledgerId', as: 'customer' });
Customer.hasMany(Message, { foreignKey: 'customerId', as: 'messages' });
Customer.hasOne(BotSession, { foreignKey: 'customerId', as: 'botSession' });
Customer.hasMany(ReferralCode, { foreignKey: 'customerId', as: 'referralCodes' });
Customer.hasMany(Review, { foreignKey: 'customerId', as: 'reviews' });
Customer.hasMany(DripEnrollment, { foreignKey: 'customerId', as: 'dripEnrollments' });
Customer.hasMany(CampaignRecipient, { foreignKey: 'customerId', as: 'campaignRecipients' });
Customer.hasMany(CallLog, { foreignKey: 'customerId', as: 'callLogs' });
Customer.hasMany(AccountInvoice, { foreignKey: 'customerId', as: 'accountInvoices' });
Customer.hasMany(Quotation, { foreignKey: 'customerId', as: 'quotations' });

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
Lead.hasMany(Quotation, { foreignKey: 'leadId', as: 'quotations' });

// Quotation
Quotation.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Quotation.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Quotation.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Quotation.belongsTo(QuotationTemplate, { foreignKey: 'templateId', as: 'template' });

// Package belongs to Agency
Package.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Package.hasMany(Lead, { foreignKey: 'packageId', as: 'leads' });
Package.hasMany(Booking, { foreignKey: 'packageId', as: 'bookings' });
Package.hasMany(PackageVendorCost, { foreignKey: 'packageId', as: 'vendorCosts' });
Package.hasMany(ItemVendorCost, { foreignKey: 'packageId', as: 'itemVendorCosts' });

// Property inventory
Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });
Property.hasMany(Booking, { foreignKey: 'propertyId', as: 'bookings' });
Property.hasMany(ItemVendorCost, { foreignKey: 'propertyId', as: 'itemVendorCosts' });

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
Booking.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
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
Itinerary.belongsTo(ItineraryTemplate, { foreignKey: 'templateId', as: 'template' });

// Itinerary templates
Agency.hasMany(ItineraryTemplate, { foreignKey: 'agencyId', as: 'itineraryTemplates' });
ItineraryTemplate.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Brochures (freeform PDF builder)
Agency.hasMany(Brochure, { foreignKey: 'agencyId', as: 'brochures' });
Brochure.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Brochure.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Brochure.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Brochure.hasMany(BrochureAsset, { foreignKey: 'brochureId', as: 'assets' });

// BrochureTemplate.agencyId is nullable — a NULL row is a platform-shipped preset,
// so this association is intentionally optional rather than a required belongsTo.
Agency.hasMany(BrochureTemplate, { foreignKey: 'agencyId', as: 'brochureTemplates' });
BrochureTemplate.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

Agency.hasMany(BrochureAsset, { foreignKey: 'agencyId', as: 'brochureAssets' });
BrochureAsset.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
BrochureAsset.belongsTo(Brochure, { foreignKey: 'brochureId', as: 'brochure' });

// Payment
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Payment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Payment.belongsTo(AccountingPaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });

// Accounting
AccountingLedger.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AccountingLedger.belongsTo(AccountingLedger, { foreignKey: 'parentId', as: 'parent' });
AccountingLedger.hasMany(AccountingLedger, { foreignKey: 'parentId', as: 'children' });
AccountingLedger.hasMany(JournalLine, { foreignKey: 'ledgerId', as: 'journalLines' });
AccountingLedger.hasMany(AccountingPaymentMethod, { foreignKey: 'ledgerId', as: 'paymentMethods' });

AccountingPaymentMethod.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AccountingPaymentMethod.belongsTo(AccountingLedger, { foreignKey: 'ledgerId', as: 'ledger' });

JournalEntry.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
JournalEntry.belongsTo(Agent, { foreignKey: 'createdByAgentId', as: 'createdByAgent' });
JournalEntry.hasMany(JournalLine, { foreignKey: 'journalEntryId', as: 'lines' });
JournalEntry.hasOne(AccountInvoice, { foreignKey: 'journalEntryId', as: 'invoice' });
JournalEntry.hasOne(CreditNote, { foreignKey: 'journalEntryId', as: 'creditNote' });
JournalEntry.hasOne(ItemVendorCost, { foreignKey: 'journalEntryId', as: 'itemVendorCost' });

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
Service.hasMany(ItemVendorCost, { foreignKey: 'serviceId', as: 'itemVendorCosts' });

// AgencyApiKey (publishable keys for the public embed API)
Agency.hasMany(AgencyApiKey, { foreignKey: 'agencyId', as: 'apiKeys' });
AgencyApiKey.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
AgencyApiKey.belongsTo(Agent, { foreignKey: 'createdByAgentId', as: 'createdBy' });

// Vendor
Vendor.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Vendor.belongsTo(AccountingLedger, { foreignKey: 'ledgerId', as: 'ledger' });
AccountingLedger.hasOne(Vendor, { foreignKey: 'ledgerId', as: 'vendor' });
Vendor.hasMany(VendorPayment, { foreignKey: 'vendorId', as: 'payments' });
Vendor.hasMany(VendorBill, { foreignKey: 'vendorId', as: 'bills' });
Vendor.hasMany(PackageVendorCost, { foreignKey: 'vendorId', as: 'packageCosts' });
Vendor.hasMany(ItemVendorCost, { foreignKey: 'vendorId', as: 'itemCosts' });

// VendorBill
VendorBill.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
VendorBill.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
VendorBill.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });
VendorBill.hasMany(VendorPayment, { foreignKey: 'vendorBillId', as: 'payments' });
VendorBill.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
VendorBill.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
VendorBill.belongsTo(Cruise, { foreignKey: 'cruiseId', as: 'cruise' });
VendorBill.belongsTo(Visa, { foreignKey: 'visaId', as: 'visa' });
VendorBill.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// VendorPayment
VendorPayment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
VendorPayment.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
VendorPayment.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });
VendorPayment.belongsTo(VendorBill, { foreignKey: 'vendorBillId', as: 'bill' });
VendorPayment.belongsTo(AccountingPaymentMethod, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });
VendorPayment.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
VendorPayment.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
VendorPayment.belongsTo(Cruise, { foreignKey: 'cruiseId', as: 'cruise' });
VendorPayment.belongsTo(Visa, { foreignKey: 'visaId', as: 'visa' });
VendorPayment.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

// PackageVendorCost
PackageVendorCost.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
PackageVendorCost.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
PackageVendorCost.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

// ItemVendorCost
ItemVendorCost.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
ItemVendorCost.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
ItemVendorCost.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
ItemVendorCost.belongsTo(Cruise, { foreignKey: 'cruiseId', as: 'cruise' });
ItemVendorCost.belongsTo(Visa, { foreignKey: 'visaId', as: 'visa' });
ItemVendorCost.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });
ItemVendorCost.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
ItemVendorCost.belongsTo(JournalEntry, { foreignKey: 'journalEntryId', as: 'journalEntry' });

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
AgencyChannel.belongsTo(MessageTemplate, { foreignKey: 'defaultFirstOutreachTemplateId', as: 'defaultFirstOutreachTemplate' });
MessageTemplate.hasMany(AgencyChannel, { foreignKey: 'defaultFirstOutreachTemplateId', as: 'defaultForChannels' });
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
Lead.belongsTo(PipelineStage, { foreignKey: 'pipelineStageId', as: 'pipelineStage' });
PipelineStage.hasMany(Lead, { foreignKey: 'pipelineStageId', as: 'leads' });

// ActivityLog (per-agency audit trail)
Agency.hasMany(ActivityLog, { foreignKey: 'agencyId', as: 'activityLogs' });
ActivityLog.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
ActivityLog.belongsTo(Agent, { foreignKey: 'actorId', as: 'actor' });
Agent.hasMany(ActivityLog, { foreignKey: 'actorId', as: 'activityLogs' });

// CallLog
CallLog.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
CallLog.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
CallLog.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// WhatsAppCall (inbound WhatsApp Cloud API calls; missed-call tracking)
Agency.hasMany(WhatsAppCall, { foreignKey: 'agencyId', as: 'whatsappCalls' });
WhatsAppCall.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
WhatsAppCall.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
WhatsAppCall.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Customer.hasMany(WhatsAppCall, { foreignKey: 'customerId', as: 'whatsappCalls' });

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

// ---------------------------------------------------------------------------
// Keep the WhatsApp conversation owner in sync with its Lead owner.
// A conversation/inbox thread is a Customer row; a Lead references that Customer
// via customerId. When a lead is assigned or reassigned to a staff member, the
// linked conversation moves to the same agent, so each agent's WhatsApp inbox
// shows the chats for the leads they own. Unassigning a lead (null) returns the
// conversation to the shared unassigned pool. This is the single point of truth
// for the lead -> chat direction; it fires for every write path (manual update,
// creation auto-assign, round-robin, bulk reassign, Meta ad leads, ...).
// The reverse (chat -> lead) is handled directly in messageService.assignThread.
// ---------------------------------------------------------------------------
async function syncCustomerAssignmentFromLead(lead, options) {
  if (!lead || !lead.customerId) return;
  await Customer.update(
    { assignedAgentId: lead.assignedAgentId || null },
    {
      where: { id: lead.customerId, agencyId: lead.agencyId },
      transaction: options && options.transaction,
    }
  );
}

Lead.addHook('afterCreate', 'syncCustomerAssignmentOnCreate', async (lead, options) => {
  // On creation only claim the conversation when the new lead has an owner;
  // never overwrite an existing conversation owner with null.
  if (!lead.assignedAgentId) return;
  await syncCustomerAssignmentFromLead(lead, options);
});

Lead.addHook('afterUpdate', 'syncCustomerAssignmentOnUpdate', async (lead, options) => {
  // Only act when the assignment actually changed, so unrelated lead edits
  // (notes, status, dates) don't reshuffle a conversation that another of the
  // customer's leads already owns.
  const prev = typeof lead.previous === 'function' ? lead.previous('assignedAgentId') : undefined;
  if (prev !== undefined && (prev || null) === (lead.assignedAgentId || null)) return;
  await syncCustomerAssignmentFromLead(lead, options);
});

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
  ItineraryTemplate,
  Brochure,
  BrochureTemplate,
  BrochureAsset,
  FollowUp,
  LeadNote,
  Property,
  Cruise,
  Visa,
  InstagramAutomation,
  InstagramAutomationLog,
  CatalogMediaLink,
  MetaAdCampaign,
  MetaLeadForm,
  MetaLeadSyncEvent,
  WhatsAppFlow,
  ServiceRoutingRule,
  PlatformAdmin,
  PlatformAdminSession,
  PlatformAuditLog,
  ActivityLog,
  Partner,
  PartnerInvoice,
  CallLog,
  WhatsAppCall,
  AccountingLedger,
  AccountingPaymentMethod,
  JournalEntry,
  JournalLine,
  AccountInvoice,
  InvoiceTemplate,
  QuotationTemplate,
  ReceiptTemplate,
  Quotation,
  AccountReminder,
  CreditNote,
  Service,
  AgencyApiKey,
  Vendor,
  VendorBill,
  VendorPayment,
  VendorType,
  LeadSource,
  LeadForm,
  PackageVendorCost,
  ItemVendorCost,
  EmployeeProfile,
  Attendance,
  LeaveType,
  LeaveRequest,
  Holiday,
  HrmSetting,
  Payslip,
};
