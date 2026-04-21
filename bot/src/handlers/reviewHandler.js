// FILE: /bot/src/handlers/reviewHandler.js
// DEPS: none (uses shared models)

const path = require('path');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');

async function sendReviewRatingPrompt(customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const body = `Please rate your ${customer.destination || 'trip'} experience.`;

  return whatsappService.sendListMessage(
    customer.phone,
    body,
    'Rate Trip',
    [
      {
        title: 'Your rating',
        rows: [
          { id: 'review_rating_5', title: '5 Stars', description: 'Amazing experience' },
          { id: 'review_rating_4', title: '4 Stars', description: 'Good experience' },
          { id: 'review_rating_3', title: '3 Stars', description: 'Average experience' },
          { id: 'review_rating_2', title: '2 Stars', description: 'Could be better' },
          { id: 'review_rating_1', title: '1 Star', description: 'Poor experience' },
        ],
      },
    ],
    ctx,
    {
      headerText: 'Share Your Review',
      footerText: 'You can also type a number from 1 to 5.',
    }
  );
}

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

  // Try to extract star rating if in REVIEW step
  if (session.currentStep === 'REVIEW') {
    const ratingMatch = text.match(/[1-5]/);

    if (ratingMatch) {
      const rating = parseInt(ratingMatch[0], 10);
      
      const reviewService = require(path.resolve(__dirname, '../../../backend/src/services/reviewService.ts'));
      await reviewService.saveReview({
        agencyId: agency.id,
        customerId: customer.id,
        rating
      }).catch(console.error);

      if (rating >= 4) {
        const response = `Thank you for the amazing ${rating}-star rating! ⭐ We're thrilled you had a wonderful trip! 🎉\n\nCould you write a short 1-2 sentence review for us?`;
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        await updateSession(session, { currentStep: 'REVIEW_TESTIMONIAL', collectedData: { rating } });
        return;
      } else {
        const response = `Thank you for your ${rating}-star feedback. We appreciate your honesty.\n\nCould you let us know what we could improve?`;
        await whatsappService.sendTextMessage(customer.phone, response, ctx);
        await updateSession(session, { currentStep: 'REVIEW_TESTIMONIAL', collectedData: { rating } });
        return;
      }
    }
  }

  // If in TESTIMONIAL step
  if (session.currentStep === 'REVIEW_TESTIMONIAL') {
    if (text.length > 2) {
      const reviewService = require(path.resolve(__dirname, '../../../backend/src/services/reviewService.ts'));
      await reviewService.saveReview({
        agencyId: agency.id,
        customerId: customer.id,
        rating: session.collectedData.rating,
        testimonial: text
      }).catch(console.error);

      let response = 'Thank you for sharing your experience! 🙏 Your feedback helps us serve you better.\n\nWould you like to plan another trip? Just say hi! 👋';
      
      // If rating was 4 or 5, ask for Google review
      if (session.collectedData.rating >= 4) {
         if (agency.googleReviewLink) {
             response = `Thank you for the amazing feedback! 🙏\n\nWould you mind sharing it on Google? It helps other travelers discover us!\n👉 ${agency.googleReviewLink}\n\nWould you like to plan another trip? Just say hi!`;
         } else {
             response = `Thank you for the amazing feedback! 🙏\n\nWe really appreciate your support. Would you like to plan another trip? Just say hi!`;
         }
      }
      
      await whatsappService.sendTextMessage(customer.phone, response, ctx);
      await updateSession(session, { currentStep: 'COMPLETE' });
      return;
    }
  }

  // Didn't understand
  const response = 'Please rate your experience from 1 to 5 ⭐ or share your thoughts about the trip.';
  await whatsappService.sendTextMessage(customer.phone, response, ctx);
  await sendReviewRatingPrompt(customer, agency).catch(console.error);
}

module.exports = { handleReview, sendReviewRatingPrompt };
