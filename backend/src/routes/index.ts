const authRoutes = require('./auth');
const agencyRoutes = require('./agencies');
const agentRoutes = require('./agents');
const leadRoutes = require('./leads');
const customerRoutes = require('./customers');
const bookingRoutes = require('./bookings');
const packageRoutes = require('./packages');
const paymentRoutes = require('./payments');
const messageRoutes = require('./messages');
const analyticsRoutes = require('./analytics');
const crmRoutes = require('./crm');
const whatsappRoutes = require('./whatsapp');
const whatsappFlowController = require('../controllers/whatsappFlowController');
const adsRoutes = require('./ads');
const propertyRoutes = require('./properties');
const cruiseRoutes = require('./cruises');
const visaRoutes = require('./visas');
const instagramRoutes = require('./instagram');
const catalogMediaLinkRoutes = require('./catalogMediaLinks');
const serviceRoutingRoutes = require('./serviceRouting');
const platformRoutes = require('./platform');
const brandingRoutes = require('./branding');
const publicRoutes = require('./public');
const publicApiRoutes = require('./publicApi');
const publicAssetRoutes = require('./publicAssets');
const apiKeyRoutes = require('./apiKeys');
const callRoutes = require('./calls');
const accountsRoutes = require('./accounts');
const vendorsRoutes = require('./vendors');
const vendorTypeRoutes = require('./vendorTypes');
const leadSourceRoutes = require('./leadSources');
const hrmRoutes = require('./hrm');
const itemFinanceRoutes = require('./itemFinance');
const requireModule = require('../middleware/requireModule');
const requireFeature = require('../middleware/requireFeature');

// Marketing routes
const templateRoutes = require('./templates');
const campaignRoutes = require('./campaigns');
const dripRoutes = require('./drips');
const referralRoutes = require('./referrals');
const reviewRoutes = require('./reviews');
const itineraryRoutes = require('./itineraries');
const flowRoutes = require('./flows');
const serviceRoutes = require('./services');

function registerApiRoutes(app) {
  // Core / session / settings routes — never module-gated.
  app.use('/api/auth', authRoutes);
  app.use('/api/me', require('./me'));
  app.use('/api/agencies', agencyRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/service-routing', serviceRoutingRoutes);
  app.use('/api/platform', platformRoutes);
  app.use('/api/branding', brandingRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/missed-calls', requireModule('/api/missed-calls'), require('./missedCalls'));
  app.use('/api/activity', require('./activity'));
  app.use('/api/uploads', require('./uploads'));
  app.use('/api/vendor-types', vendorTypeRoutes);
  app.use('/api/lead-sources', leadSourceRoutes);
  app.use('/public', publicRoutes);
  app.use('/api/public/v1', publicApiRoutes);
  app.use('/api/public-assets', publicAssetRoutes);
  app.use('/api/api-keys', apiKeyRoutes);
  app.use('/api/invoice-templates', require('./invoiceTemplates'));
  app.use('/api/quotation-templates', require('./quotationTemplates'));
  app.use('/api/receipt-templates', require('./receiptTemplates'));
  app.use('/api/itinerary-templates', require('./itineraryTemplates'));
  app.post('/api/whatsapp/flow', whatsappFlowController.handleFlowRequest);

  // Paid add-on. Gated by agency.features, NOT sidebarPreferences — an empty
  // sidebarPreferences list means "unrestricted" (constants/modules.ts), so a
  // module-gated add-on would be free for every agency without an explicit list.
  // requireFeature denies by default instead. See middleware/requireFeature.ts.
  app.use('/api/brochures', requireFeature('brochureBuilder'), require('./brochures'));

  // Module-gated routes — blocked when the agency has an explicit
  // sidebarPreferences list that omits the granting module (see modules.ts).
  app.use('/api/leads', requireModule('/api/leads'), leadRoutes);
  // Named public lead forms (settings surface for lead capture — authenticated,
  // not module-gated so it stays reachable wherever lead capture is used).
  app.use('/api/lead-forms', require('./leadForms'));
  app.use('/api/customers', requireModule('/api/customers'), customerRoutes);
  app.use('/api/crm', requireModule('/api/crm'), crmRoutes);
  app.use('/api/bookings', requireModule('/api/bookings'), bookingRoutes);
  app.use('/api/packages', requireModule('/api/packages'), packageRoutes);
  app.use('/api/payments', requireModule('/api/payments'), paymentRoutes);
  app.use('/api/messages', requireModule('/api/messages'), messageRoutes);
  app.use('/api/analytics', requireModule('/api/analytics'), analyticsRoutes);
  app.use('/api/whatsapp', requireModule('/api/whatsapp'), whatsappRoutes);
  app.use('/api/ads', requireModule('/api/ads'), adsRoutes.default || adsRoutes);
  app.use('/api/properties', requireModule('/api/properties'), propertyRoutes);
  app.use('/api/cruises', requireModule('/api/cruises'), cruiseRoutes);
  app.use('/api/visas', requireModule('/api/visas'), visaRoutes);
  app.use('/api/instagram', requireModule('/api/instagram'), instagramRoutes);
  // Not module-gated: reel links are managed from the property/package forms (which carry their
  // own permission guards), so gating them separately would need a redundant module entry.
  app.use('/api/catalog-media-links', catalogMediaLinkRoutes);
  app.use('/api/accounts', requireModule('/api/accounts'), accountsRoutes);
  app.use('/api/vendors', requireModule('/api/vendors'), vendorsRoutes);
  app.use('/api/hrm', requireModule('/api/hrm'), hrmRoutes);
  app.use('/api/item-finance', requireModule('/api/item-finance'), itemFinanceRoutes);
  app.use('/api/quotations', requireModule('/api/quotations'), require('./quotations'));

  // Marketing routes — also module-gated.
  app.use('/api/templates', requireModule('/api/templates'), templateRoutes);
  app.use('/api/campaigns', requireModule('/api/campaigns'), campaignRoutes);
  app.use('/api/drips', requireModule('/api/drips'), dripRoutes);
  app.use('/api/referrals', requireModule('/api/referrals'), referralRoutes);
  app.use('/api/reviews', requireModule('/api/reviews'), reviewRoutes);
  app.use('/api/itineraries', requireModule('/api/itineraries'), itineraryRoutes);
  app.use('/api/flows', requireModule('/api/flows'), flowRoutes);
  app.use('/api/services', requireModule('/api/services'), serviceRoutes);
}

module.exports = {
  registerApiRoutes,
};
