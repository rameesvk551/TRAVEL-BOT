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
    industry: {
      type: DataTypes.ENUM('TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY'),
      allowNull: false,
      defaultValue: 'TRAVEL',
      comment: 'Business vertical. Drives frontend labels/menu only; backend logic is industry-agnostic. Defaults to TRAVEL so existing tenants are unchanged.',
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
    whatsappOnboardingMode: {
      type: DataTypes.ENUM('STANDARD', 'COEXISTENCE'),
      allowNull: false,
      defaultValue: 'STANDARD',
      comment: 'Whether the channel was onboarded directly or via WhatsApp Business App coexistence',
    },
    whatsappCoexistenceStatus: {
      type: DataTypes.ENUM('NOT_ENABLED', 'PENDING', 'ACTIVE', 'DISCONNECTED', 'FAILED'),
      allowNull: false,
      defaultValue: 'NOT_ENABLED',
      comment: 'Current coexistence lifecycle state for WhatsApp Business App + Cloud API',
    },
    whatsappContactSyncStatus: {
      type: DataTypes.ENUM('NOT_STARTED', 'PENDING', 'COMPLETE', 'FAILED'),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
      comment: 'Status of WhatsApp Business App contact synchronization',
    },
    whatsappHistorySyncStatus: {
      type: DataTypes.ENUM('NOT_STARTED', 'PENDING', 'COMPLETE', 'FAILED', 'DECLINED'),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
      comment: 'Status of WhatsApp Business App history synchronization',
    },
    whatsappCoexistenceLastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Last coexistence-specific webhook or sync update timestamp',
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
    upiId: {
      type: DataTypes.STRING(120),
      allowNull: true,
      comment: 'UPI VPA (name@bank) used to render a balance-payment QR on invoices',
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
    partnerId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'White-label reseller this agency belongs to. Null = direct agency owned by the platform.',
    },
    googleReviewLink: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Google review link for post-trip review redirection',
    },
    autoReviewCollectionEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to automatically collect reviews after a trip',
    },
    autoReviewDelayDays: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      comment: 'Days after return date to request a review',
    },
    followUpReminderEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether to send Whatsapp reminders to agents before follow ups',
    },
    whatsappMissedCallAutoReplyEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Auto-send a WhatsApp message when a customer WhatsApp call is missed',
    },
    whatsappMissedCallAutoReplyMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Free-form text sent back on a missed WhatsApp call (uses a default when empty)',
    },
    whatsappMissedCallUnknownAction: {
      type: DataTypes.ENUM('LOG_ONLY', 'CREATE_LEAD'),
      allowNull: false,
      defaultValue: 'LOG_ONLY',
      comment: 'What to do when a missed call comes from a number with no matching customer',
    },
    followUpReminderMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30,
      comment: 'Minutes before follow up to send reminder',
    },
    whatsappCatalogId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Meta Commerce Catalog ID for Native WhatsApp E-Commerce',
    },
    welcomeMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Custom WhatsApp welcome message shown before the fixed service menu',
    },
    whatsappMenuLabels: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Tenant-controlled labels for fixed WhatsApp welcome menu actions',
    },
    whatsappMenuConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Tenant-controlled WhatsApp welcome menu items and routing rules',
    },
    whatsappFlowConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Tenant-controlled nested WhatsApp menu tree and response flow routing',
    },
    instagramFlowConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Tenant-controlled Instagram DM conversational flow graph (mirrors whatsappFlowConfig; executed over IG DMs via Marketing OS, never published to Meta)',
    },
    sidebarPreferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Array of enabled sidebar module paths, e.g. ["/properties", "/packages"]',
    },
    staffWhatsAppEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'staff_whatsapp_enabled',
      comment: 'Whether this agency can manage staff-owned WhatsApp coexistence numbers and first-outreach templates',
    },
    instagramCommentAutomationEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'instagram_comment_automation_enabled',
      comment: 'Whether comment-to-DM rules actually run. Defaults OFF: these rules never fired '
        + '(Marketing OS sent the raw Meta comment shape, which the service could not read), so '
        + 'every saved rule is dormant. Turning the pipe on without a per-agency opt-in would fire '
        + 'years of stale rules at real commenters at once.',
    },
    instagramReelDefaultAction: {
      type: DataTypes.ENUM('LEAD_FORM', 'WHATSAPP', 'DM_PDF'),
      allowNull: false,
      defaultValue: 'WHATSAPP',
      field: 'instagram_reel_default_action',
      comment: 'What a comment on a MAPPED reel does by default: send a lead-form link, a '
        + 'click-to-WhatsApp handoff link, or the item PDF straight in the DM. A per-reel '
        + 'CatalogMediaLink.actionOverride wins over this.',
    },
    instagramReelWhatsappTemplate: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'instagram_reel_whatsapp_template',
      comment: 'Prefilled wa.me text for a reel WhatsApp handoff. Supports {{item}} and {{code}}; '
        + 'the code is appended if omitted. Null uses a sensible default (see reelRefCode).',
    },
    leadRoutingStrategy: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'INTENT',
      comment: "Lead auto-assignment strategy: 'INTENT' (route by enquiry type) or 'ROUND_ROBIN' (rotate new contacts across all staff). When ROUND_ROBIN, manual assignment is hidden in the UI.",
    },
    roundRobinCursorAgentId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Last agent assigned via round-robin rotation; the next new contact goes to the agent after this one.',
    },
    companyLogoUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'URL of the agency company logo',
    },
    companySealUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'URL of the agency company seal',
    },
    authorizedSignatureUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      comment: 'URL of the agency authorized signature',
    },
    gstin: {
      type: DataTypes.STRING(32),
      allowNull: true,
      comment: 'Company GSTIN used on Indian tax invoices',
    },
    stateCode: {
      type: DataTypes.STRING(2),
      allowNull: true,
      comment: 'Indian GST state code for deciding CGST/SGST vs IGST',
    },
    accountingSettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Accounting configuration such as default GST treatment and rates',
    },
    documentSettings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Document delivery config, e.g. { autoSend: { quotation, invoice, receipt }, captions: {...} }",
    },
    features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "Paid add-on entitlements, e.g. { brochureBuilder: true }. Deny-by-default: "
        + 'an absent key means off. Distinct from sidebarPreferences, whose empty state means '
        + 'unrestricted — see middleware/requireFeature.ts.',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // Website Builder fields
    subdomain: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
      comment: 'Unique subdomain for the agency public website, e.g. myagency',
    },
    customDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      comment: 'Customer-owned domain for the public website, e.g. www.myagency.com',
    },
    websiteEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether the public website is enabled/published',
    },
    websiteTheme: {
      type: DataTypes.ENUM(
        'MODERN',
        'CLASSIC',
        'MINIMAL',
        'VIBRANT',
        'LUXURY_ESCAPE',
        'ADVENTURE_TREK',
        'FAMILY_HOLIDAY',
        'HONEYMOON',
        'CORPORATE_TRAVEL',
        'PILGRIMAGE'
      ),
      defaultValue: 'MODERN',
      comment: 'Visual theme for the generated public website',
    },
    websiteTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Public website page title / brand name',
    },
    websiteDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Short description shown on the public website hero',
    },
    websiteLogoUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'Logo image URL for the public website',
    },
    websitePrimaryColor: {
      type: DataTypes.STRING(7),
      allowNull: true,
      defaultValue: '#00A884',
      comment: 'Hex primary brand color for the public website',
    },
    websiteHeroImageUrl: {
      type: DataTypes.STRING(512),
      allowNull: true,
      comment: 'Hero background image URL for the public website',
    },
    websiteContactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Contact phone shown on the public website',
    },
    websiteContactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Contact email shown on the public website',
    },
    websiteSocialLinks: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Social media links object {facebook, instagram, twitter, youtube, linkedin}',
    },
    websiteSeoMeta: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'SEO meta tags object {title, description, keywords}',
    },
    websiteCustomCss: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Optional custom CSS injected into the public website',
    },
    websitePublishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When the website was last published',
    },
    leadFormConfig: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Public lead-capture form config {enabled, title, description, successMessage, submitLabel, fields[]}',
    },
  }, {
    tableName: 'agencies',
    indexes: [
      { fields: ['whatsapp_number'], unique: true },
      { fields: ['email'], unique: true },
      { fields: ['phone'], unique: true },
      { fields: ['subdomain'], unique: true },
      { fields: ['custom_domain'], unique: true },
    ],
  });

  return Agency;
};
