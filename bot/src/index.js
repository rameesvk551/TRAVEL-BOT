// FILE: /bot/src/index.js
// DEPS: express, dotenv
// ENV: BOT_PORT, WEBHOOK_VERIFY_TOKEN

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const { handleVerification, handleIncoming } = require('./webhook');

const app = express();
const PORT = process.env.BOT_PORT || 3001;

// Store raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'travelbot-webhook', timestamp: new Date().toISOString() });
});

// WhatsApp webhook endpoints
app.get('/webhook', handleVerification);
app.post('/webhook', handleIncoming);

// Marketing OS webhook endpoints (same handlers)
app.get('/api/v1/whatsapp/webhook', handleVerification);
app.post('/api/v1/whatsapp/webhook', handleIncoming);

// Start server
app.listen(PORT, () => {
  console.log(`🤖 TravelBot Webhook running on port ${PORT}`);
  console.log(`   Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
});
