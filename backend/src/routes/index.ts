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
const adsRoutes = require('./ads');
const propertyRoutes = require('./properties');
const cruiseRoutes = require('./cruises');
const visaRoutes = require('./visas');
const instagramRoutes = require('./instagram');
const serviceRoutingRoutes = require('./serviceRouting');
const platformRoutes = require('./platform');
const brandingRoutes = require('./branding');
const publicRoutes = require('./public');
const publicApiRoutes = require('./publicApi');
const apiKeyRoutes = require('./apiKeys');
const callRoutes = require('./calls');
const accountsRoutes = require('./accounts');
const vendorsRoutes = require('./vendors');
const vendorTypeRoutes = require('./vendorTypes');
const hrmRoutes = require('./hrm');

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
  app.use('/api/auth', authRoutes);
  app.use('/api/agencies', agencyRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/crm', crmRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/ads', adsRoutes.default || adsRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/cruises', cruiseRoutes);
  app.use('/api/visas', visaRoutes);
  app.use('/api/instagram', instagramRoutes);
  app.use('/api/service-routing', serviceRoutingRoutes);
  app.use('/api/platform', platformRoutes);
  app.use('/api/branding', brandingRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/vendors', vendorsRoutes);
  app.use('/api/vendor-types', vendorTypeRoutes);
  app.use('/api/hrm', hrmRoutes);
  app.use('/public', publicRoutes);
  app.use('/api/public/v1', publicApiRoutes);
  app.use('/api/api-keys', apiKeyRoutes);

  // Marketing routes
  app.use('/api/templates', templateRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/drips', dripRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/itineraries', itineraryRoutes);
  app.use('/api/flows', flowRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/invoice-templates', require('./invoiceTemplates'));
}

module.exports = {
  registerApiRoutes,
};
