const authRoutes = require('./auth');
const agencyRoutes = require('./agencies');
const agentRoutes = require('./agents');
const leadRoutes = require('./leads');
const bookingRoutes = require('./bookings');
const packageRoutes = require('./packages');
const paymentRoutes = require('./payments');
const messageRoutes = require('./messages');
const analyticsRoutes = require('./analytics');

function registerApiRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/agencies', agencyRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/packages', packageRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/analytics', analyticsRoutes);
}

module.exports = {
  registerApiRoutes,
};