// FILE: /bot/src/handlers/paymentHandler.js
// DEPS: none (uses shared models)

const path = require('path');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));

/**
 * Handles payment-related messages from customers.
 * @param {object} session - BotSession instance
 * @param {string} messageText - Customer's message
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 */
async function handlePaymentMessage(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const upper = messageText.toUpperCase().trim();

  // Customer asks to renew expired payment link
  if (upper === 'RENEW' || upper === 'NEW LINK' || upper === 'PAY') {
    const response = 'I\'ll get our team to send you a fresh payment link right away! 💳';
    await whatsappService.sendTextMessage(customer.phone, response, ctx);

    // Notify agent to re-send payment
    // This would be handled through the dashboard
    return;
  }

  // Customer asks about payment status
  if (upper.includes('PAYMENT') || upper.includes('PAID') || upper.includes('STATUS')) {
    const response = 'Let me check your payment status. Our team will update you shortly! 🔍';
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    return;
  }

  // General payment question — forward to agent
  const response = 'I\'ve noted your message regarding payment. Our team will assist you shortly! 💬';
  await whatsappService.sendTextMessage(customer.phone, response, ctx);
}

module.exports = { handlePaymentMessage };
