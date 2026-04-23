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
const whatsappRoutes = require('./whatsapp');
const adsRoutes = require('./ads');
const propertyRoutes = require('./properties');
const instagramRoutes = require('./instagram');

// Marketing routes
const templateRoutes = require('./templates');
const campaignRoutes = require('./campaigns');
const dripRoutes = require('./drips');
const referralRoutes = require('./referrals');
const reviewRoutes = require('./reviews');
const itineraryRoutes = require('./itineraries');

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
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/ads', adsRoutes.default || adsRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/instagram', instagramRoutes);

  // Marketing routes
  app.use('/api/templates', templateRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/drips', dripRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/itineraries', itineraryRoutes);
}

module.exports = {
  registerApiRoutes,
};
