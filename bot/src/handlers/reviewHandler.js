// FILE: /bot/src/handlers/reviewHandler.js
// DEPS: none (uses shared models)

const path = require('path');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');

/**
 * Handles post-trip review collection.
 * @param {object} session - BotSession instance
 * @param {string} messageText - Customer's message
 * @param {object} customer - Customer instance
 * @param {object} agency - Agency instance
 */
async function handleReview(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const text = messageText.trim();

  // Try to extract star rating
  const ratingMatch = text.match(/[1-5]/);

  if (ratingMatch) {
    const rating = parseInt(ratingMatch[0], 10);
    let response;

    if (rating >= 4) {
      response = `Thank you for the amazing ${rating}-star rating! ⭐ We're thrilled you had a wonderful trip! 🎉\n\nWould you like to plan your next adventure with us?`;
    } else if (rating >= 3) {
      response = `Thank you for your ${rating}-star feedback! We appreciate your honesty and will work to make your next trip even better. 💪`;
    } else {
      response = `We're sorry your experience wasn't up to expectations. 😔 Your feedback matters to us. Our team will reach out to you to understand how we can improve.`;
    }

    await whatsappService.sendTextMessage(customer.phone, response, ctx);

    // Reset session to allow new conversations
    await updateSession(session, { currentStep: 'COMPLETE' });
    return;
  }

  // If text response instead of rating
  if (text.length > 5) {
    const response = 'Thank you for sharing your experience! 🙏 Your feedback helps us serve you better.\n\nWould you like to plan another trip? Just say hi! 👋';
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    await updateSession(session, { currentStep: 'COMPLETE' });
    return;
  }

  // Didn't understand
  const response = 'Please rate your experience from 1 to 5 ⭐ or share your thoughts about the trip.';
  await whatsappService.sendTextMessage(customer.phone, response, ctx);
}

module.exports = { handleReview };
