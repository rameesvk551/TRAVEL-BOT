// FILE: /backend/src/routes/agencies.js

const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const agencyController = require('../controllers/agencyController');
const { PERMISSIONS } = require('../constants/permissions');
const multer = require('multer');
const path = require('path');

const router = Router();

const IMAGE_FILE_SIZE_LIMIT = 5 * 1024 * 1024;
const imageExtensions = new Set(['.avif', '.gif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);

function hasAllowedExtension(file, allowedExtensions) {
  return allowedExtensions.has(path.extname(file.originalname || '').toLowerCase());
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_FILE_SIZE_LIMIT,
  },
  fileFilter: (_req, file, cb) => {
    const isImageMime = String(file.mimetype || '').startsWith('image/');
    if (!isImageMime && !hasAllowedExtension(file, imageExtensions)) {
      cb(Object.assign(new Error('Only image files are allowed'), {
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
      }));
      return;
    }
    cb(null, true);
  },
});

const menuLabelSchema = z.object({
  visaTicketing: z.string().trim().max(20).optional(),
  planTrip: z.string().trim().max(20).optional(),
  staycations: z.string().trim().max(20).optional(),
  flight: z.string().trim().max(20).optional(),
  rail: z.string().trim().max(20).optional(),
  domestic: z.string().trim().max(20).optional(),
  international: z.string().trim().max(20).optional(),
  customTrip: z.string().trim().max(20).optional(),
}).partial();

const menuConfigItemSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(24),
  description: z.string().trim().max(72).optional(),
  type: z.enum(['PACKAGE_CATEGORY', 'PROPERTY', 'SERVICE', 'CUSTOM_TRIP']),
  value: z.string().trim().max(80).optional(),
}).passthrough();

const flowMenuItemSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(24),
  description: z.string().trim().max(72).optional(),
  action: z.enum([
    'OPEN_PACKAGE_CATEGORY_MENU',
    'OPEN_PROPERTY_FLOW',
    'OPEN_SERVICE_MENU',
    'OPEN_CUSTOM_TRIP_FLOW',
    'SHOW_TOUR_TYPE_LIST',
    'OPEN_PACKAGE_FLOW',
    'CAPTURE_SERVICE_DETAILS',
  ]),
  category: z.string().trim().max(32).optional(),
  tourType: z.string().trim().max(80).optional(),
  value: z.string().trim().max(80).optional(),
}).passthrough();

const whatsappFlowConfigSchema = z.object({
  welcomeMenu: z.array(flowMenuItemSchema).max(10).optional(),
  packageCategories: z.array(flowMenuItemSchema).max(3).optional(),
  tourTypes: z.array(flowMenuItemSchema).max(10).optional(),
  serviceMenu: z.array(flowMenuItemSchema).max(10).optional(),
}).passthrough();

const updateAgencySchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  googleReviewLink: z.string().optional(),
  autoReviewCollectionEnabled: z.boolean().optional(),
  autoReviewDelayDays: z.number().int().min(0).max(30).optional(),
  razorpayKeyId: z.string().optional(),
  razorpayKeySecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PRO']).optional(),
  whatsappTripFlowId: z.string().optional(),
  whatsappTripFlowName: z.string().optional(),
  whatsappTripFlowStatus: z.string().optional(),
  whatsappTripFlowError: z.string().nullable().optional(),
  whatsappCatalogId: z.string().optional(),
  welcomeMessage: z.string().trim().max(900).nullable().optional(),
  whatsappMenuLabels: menuLabelSchema.optional(),
  whatsappMenuConfig: z.array(menuConfigItemSchema).max(10).optional(),
  whatsappFlowConfig: whatsappFlowConfigSchema.optional(),
  instagramFlowConfig: whatsappFlowConfigSchema.optional(),
  sidebarPreferences: z.array(z.string()).optional(),
  companyLogoUrl: z.string().url().max(1000).nullable().optional(),
  companySealUrl: z.string().url().max(1000).nullable().optional(),
  authorizedSignatureUrl: z.string().url().max(1000).nullable().optional(),
  gstin: z.string().trim().max(32).nullable().optional(),
  upiId: z.string().trim().max(120).nullable().optional(),
  stateCode: z.string().trim().regex(/^\d{2}$/).nullable().optional(),
  accountingSettings: z.object({
    gst: z.object({
      defaultSalesRateBps: z.number().int().min(0).max(4000).optional(),
      taxInclusive: z.boolean().optional(),
      defaultTreatment: z.enum(['REGISTERED', 'UNREGISTERED', 'EXPORT', 'SEZ', 'EXEMPT']).optional(),
    }).partial().optional(),
  }).passthrough().optional(),
  documentSettings: z.object({
    autoSend: z.object({
      booking: z.boolean().optional(),
      quotation: z.boolean().optional(),
      invoice: z.boolean().optional(),
      receipt: z.boolean().optional(),
      itinerary: z.boolean().optional(),
    }).partial().passthrough().optional(),
    captions: z.object({
      quotation: z.string().max(900).optional(),
      invoice: z.string().max(900).optional(),
      receipt: z.string().max(900).optional(),
      itinerary: z.string().max(900).optional(),
    }).partial().passthrough().optional(),
    templates: z.object({
      booking: z.string().max(120).optional(),
      quotation: z.string().max(120).optional(),
      invoice: z.string().max(120).optional(),
      receipt: z.string().max(120).optional(),
    }).partial().passthrough().optional(),
  }).passthrough().optional(),
});

const websiteSocialLinksSchema = z.object({
  facebook: z.string().trim().max(500).optional().or(z.literal('')),
  instagram: z.string().trim().max(500).optional().or(z.literal('')),
  youtube: z.string().trim().max(500).optional().or(z.literal('')),
  linkedin: z.string().trim().max(500).optional().or(z.literal('')),
  twitter: z.string().trim().max(500).optional().or(z.literal('')),
}).partial();

const websiteSeoMetaSchema = z.object({
  title: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(260).optional().or(z.literal('')),
  keywords: z.string().trim().max(500).optional().or(z.literal('')),
}).partial();

const websiteSettingsSchema = z.object({
  subdomain: z.string().trim().max(80).optional().or(z.literal('')),
  customDomain: z.string().trim().max(255).optional().or(z.literal('')),
  websiteTheme: z.enum([
    'MODERN',
    'CLASSIC',
    'MINIMAL',
    'VIBRANT',
    'LUXURY_ESCAPE',
    'ADVENTURE_TREK',
    'FAMILY_HOLIDAY',
    'HONEYMOON',
    'CORPORATE_TRAVEL',
    'PILGRIMAGE',
  ]).optional(),
  websiteTitle: z.string().trim().max(255).optional().or(z.literal('')),
  websiteDescription: z.string().trim().max(1200).optional().or(z.literal('')),
  websiteLogoUrl: z.string().trim().max(512).optional().or(z.literal('')),
  websitePrimaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal('')),
  websiteHeroImageUrl: z.string().trim().max(512).optional().or(z.literal('')),
  websiteContactPhone: z.string().trim().max(30).optional().or(z.literal('')),
  websiteContactEmail: z.string().trim().email().max(255).optional().or(z.literal('')),
  websiteSocialLinks: websiteSocialLinksSchema.optional(),
  websiteSeoMeta: websiteSeoMetaSchema.optional(),
  websiteCustomCss: z.string().trim().max(8000).optional().or(z.literal('')),
});

const marketingOsCallbackSchema = z.object({
  agencyId: z.string().uuid(),
  status: z.enum(['NOT_CONNECTED', 'PENDING', 'CONNECTED', 'FAILED']),
  whatsappNumber: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
  businessAccountId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  channelId: z.string().optional(),
  errorMessage: z.string().optional(),
});

const marketingOsCompleteSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  sessionToken: z.string().min(1, 'Session token is required'),
  phoneNumberId: z.string().nullable().optional(),
  wabaId: z.string().nullable().optional(),
  businessId: z.string().nullable().optional(),
  sessionInfo: z.object({
    phone_number_id: z.string().optional(),
    waba_id: z.string().optional(),
    business_id: z.string().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

const marketingOsConnectSchema = z.object({
  onboardingMode: z.enum(['standard', 'coexistence']).optional(),
});

/**
 * GET /api/agencies/me - Get current agency details
 */
router.get('/me', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.me);

/**
 * GET /api/agencies/me/whatsapp-connection - Get partner onboarding status
 */
router.get('/me/whatsapp-connection', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getWhatsAppConnection);

/**
 * GET /api/agencies/me/whatsapp-channels - Get all connected WhatsApp numbers
 */
router.get('/me/whatsapp-channels', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getWhatsAppChannels);

/**
 * POST /api/agencies/me/whatsapp-channels
 */
router.post('/me/whatsapp-channels', authenticate, validateBody(z.object({
  marketingOsTenantId: z.string().optional(),
})), agencyController.completeWhatsAppConnectSession);

/**
 * DELETE /api/agencies/me/whatsapp-channels/:channelId - Disable a non-default WhatsApp number
 */
router.delete(
  '/me/whatsapp-channels/:channelId',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.deleteWhatsAppChannel
);

router.get('/me/website', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getWebsiteStatus);

router.patch(
  '/me/website',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(websiteSettingsSchema),
  agencyController.updateWebsite
);

router.post(
  '/me/website/publish',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.publishWebsite
);

router.post(
  '/me/website/unpublish',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.unpublishWebsite
);

/**
 * POST /api/agencies/me/whatsapp-connection/connect - Create partner connect session
 */
router.post(
  '/me/whatsapp-connection/connect',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(marketingOsConnectSchema),
  agencyController.createWhatsAppConnectSession
);

/**
 * POST /api/agencies/me/whatsapp-connection/complete - Complete provider embedded signup
 */
router.post(
  '/me/whatsapp-connection/complete',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  validateBody(marketingOsCompleteSchema),
  agencyController.completeWhatsAppConnectSession
);

/**
 * GET /api/agencies/me/instagram-connection - Get Instagram connection status
 */
router.get('/me/instagram-connection', authenticate, requirePermission(PERMISSIONS.AGENCY_VIEW), agencyController.getInstagramConnection);

/**
 * POST /api/agencies/me/instagram-connection/connect - Connect Instagram account
 */
router.post(
  '/me/instagram-connection/connect',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.connectInstagram
);

/**
 * DELETE /api/agencies/me/instagram-connection/:accountId - Disconnect Instagram account
 */
router.delete(
  '/me/instagram-connection/:accountId',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.AGENCY_MANAGE),
  agencyController.disconnectInstagram
);

/**
 * PATCH /api/agencies/me - Update agency settings (ADMIN only)
 */
router.patch('/me', authenticate, requireRole('ADMIN'), requirePermission(PERMISSIONS.AGENCY_MANAGE), validateBody(updateAgencySchema), agencyController.updateMe);

/**
 * POST /api/agencies/whatsapp/marketing-os/callback - Provider callback after onboarding
 */
router.post(
  '/whatsapp/marketing-os/callback',
  agencyController.handleMarketingOsCallback
);

/**
 * POST /api/agencies/me/upload-logo
 */
router.post('/me/upload-logo', authenticate, requireRole('ADMIN'), upload.single('image'), agencyController.uploadCompanyLogo);

/**
 * POST /api/agencies/me/upload-asset - generic branding image upload (returns URL only)
 */
router.post('/me/upload-asset', authenticate, requireRole('ADMIN'), upload.single('image'), agencyController.uploadDocumentAsset);

/**
 * POST /api/agencies/me/upload-seal
 */
router.post('/me/upload-seal', authenticate, requireRole('ADMIN'), upload.single('image'), agencyController.uploadCompanySeal);

/**
 * POST /api/agencies/me/upload-signature
 */
router.post('/me/upload-signature', authenticate, requireRole('ADMIN'), upload.single('image'), agencyController.uploadAuthorizedSignature);

module.exports = router;
