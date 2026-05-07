// FILE: /bot/src/handlers/reviewHandler.js
// DEPS: none (uses shared models)

const path = require('path');
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { WhatsAppFlow } = require(path.resolve(__dirname, '../../../backend/src/models'));
const { updateSession } = require('../utils/sessionManager');

const REVIEW_COLLECTION_FLOW_FIRST_SCREEN_ID = 'RECOMMEND';
const REVIEW_RATING_OPTIONS = {
  '0_EXCELLENT': 5,
  '1_GOOD': 4,
  '2_AVERAGE': 3,
  '3_POOR': 2,
  '4_VERY_POOR': 1,
};

function parseFlowResponse(rawResponse = {}) {
  if (typeof rawResponse === 'string') {
    try {
      return JSON.parse(rawResponse || '{}');
    } catch {
      return {};
    }
  }

  return rawResponse && typeof rawResponse === 'object' ? rawResponse : {};
}

function normalizeRating(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (REVIEW_RATING_OPTIONS[normalized]) return REVIEW_RATING_OPTIONS[normalized];

  const fraction = normalized.match(/([1-5])\s*\/\s*5/);
  if (fraction) return parseInt(fraction[1], 10);

  const rating = parseInt(normalized.match(/[1-5]/)?.[0] || '', 10);
  return Number.isFinite(rating) ? rating : null;
}

function normalizeRecommendation(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('yes')) return 'Yes';
  if (normalized.includes('no')) return 'No';
  return String(value || '').trim();
}

function averageRatings(values = []) {
  const ratings = values.map(normalizeRating).filter((rating) => Number.isFinite(rating));
  if (!ratings.length) return null;
  return Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
}

function compactText(parts = []) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n');
}

function parseReviewCollectionResponse(response = {}, reviewForm = {}) {
  const purchaseRating = normalizeRating(
    response.screen_1_Purchase_0 || response.Purchase_experience || reviewForm.Purchase_experience
  );
  const deliveryRating = normalizeRating(
    response.screen_1_Delivery_and_1 || response.Delivery_and_setup || reviewForm.Delivery_and_setup
  );
  const customerServiceRating = normalizeRating(
    response.screen_1_Customer_2 || response.Customer_service || reviewForm.Customer_service
  );

  const rating = normalizeRating(response.rating || response.reviewRating || reviewForm.rating || reviewForm.reviewRating)
    || averageRatings([purchaseRating, deliveryRating, customerServiceRating]);
  const recommendation = normalizeRecommendation(
    response.screen_0_Choose_0 || response.Choose_one || reviewForm.Choose_one
  );
  const comment = response.screen_0_Leave_a_1
    || response.Leave_a_comment
    || response.testimonial
    || response.review
    || response.comments
    || response.improvement
    || reviewForm.Leave_a_comment
    || reviewForm.testimonial
    || reviewForm.review
    || reviewForm.comments
    || reviewForm.improvement
    || '';

  const detailLines = [
    purchaseRating ? `Booking experience: ${purchaseRating}/5` : '',
    deliveryRating ? `Trip arrangements: ${deliveryRating}/5` : '',
    customerServiceRating ? `Travel support: ${customerServiceRating}/5` : '',
  ];

  return {
    rating,
    testimonial: compactText([
      comment,
      recommendation ? `Would recommend: ${recommendation}` : '',
      ...detailLines,
    ]),
  };
}

async function getReviewFlowConfig(agency) {
  if (!agency?.id) return null;

  const flow = await WhatsAppFlow.findOne({
    where: {
      agencyId: agency.id,
      flowType: 'REVIEW',
      status: 'PUBLISHED',
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!flow?.metaFlowId) return null;

  return {
    flowId: flow.metaFlowId,
    firstScreenId: flow.firstScreenId || REVIEW_COLLECTION_FLOW_FIRST_SCREEN_ID,
  };
}

async function saveReviewAndThankCustomer(session, customer, agency, rating, testimonial) {
  const reviewService = require(path.resolve(__dirname, '../../../backend/src/services/reviewService.ts'));
  await reviewService.saveReview({
    agencyId: agency.id,
    customerId: customer.id,
    bookingId: session.collectedData?.reviewBookingId || null,
    rating,
    testimonial: String(testimonial || '').trim() || undefined,
    destination: customer.destination || undefined,
  }).catch(console.error);

  let response = 'Thank you for sharing your experience! Your feedback helps us serve you better.\n\nWould you like to plan another trip? Just say hi!';

  if (rating >= 4) {
    response = agency.googleReviewLink
      ? `Thank you for the amazing feedback!\n\nWould you mind sharing it on Google? It helps other travelers discover us!\n${agency.googleReviewLink}\n\nWould you like to plan another trip? Just say hi!`
      : 'Thank you for the amazing feedback!\n\nWe really appreciate your support. Would you like to plan another trip? Just say hi!';
  }

  await whatsappService.sendTextMessage(customer.phone, response, { customerId: customer.id, agencyId: agency.id });
  await updateSession(session, { currentStep: 'COMPLETE' });
}

async function sendReviewRatingPrompt(customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const body = `Please rate your ${customer.destination || 'trip'} experience.`;
  const reviewFlowConfig = await getReviewFlowConfig(agency);

  if (reviewFlowConfig?.flowId) {
    const flowResponse = await whatsappService.sendFlowMessage(
      customer.phone,
      body,
      {
        flowId: reviewFlowConfig.flowId,
        firstScreenId: reviewFlowConfig.firstScreenId,
        flowCta: 'Write Review',
        flowToken: `review|${agency.id}|${customer.id}|${Date.now()}`,
        data: {},
      },
      ctx,
      {
        headerText: 'Share Your Review',
        footerText: 'If the form does not open, reply with a number from 1 to 5.',
      }
    );

    if (flowResponse?.status !== 'FAILED') {
      return flowResponse;
    }
  }

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

async function handleReview(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const incoming = typeof messageText === 'object' && messageText ? messageText : { text: messageText };
  const text = String(incoming.text || '').trim();

  if (incoming.type === 'FLOW_REPLY' || incoming.flowResponse) {
    const response = parseFlowResponse(incoming.flowResponse);
    const reviewForm = response.review_form && typeof response.review_form === 'object'
      ? response.review_form
      : response.reviewForm && typeof response.reviewForm === 'object'
        ? response.reviewForm
        : {};
    const { rating, testimonial } = parseReviewCollectionResponse(response, reviewForm);

    if (rating) {
      await saveReviewAndThankCustomer(session, customer, agency, rating, testimonial);
      return;
    }
  }

  if (session.currentStep === 'REVIEW') {
    const rating = normalizeRating(text);

    if (rating) {
      if (rating >= 4) {
        await whatsappService.sendTextMessage(
          customer.phone,
          `Thank you for the amazing ${rating}-star rating! Could you write a short 1-2 sentence review for us?`,
          ctx
        );
      } else {
        await whatsappService.sendTextMessage(
          customer.phone,
          `Thank you for your ${rating}-star feedback. Could you let us know what we could improve?`,
          ctx
        );
      }

      await updateSession(session, { currentStep: 'REVIEW_TESTIMONIAL', collectedData: { rating } });
      return;
    }
  }

  if (session.currentStep === 'REVIEW_TESTIMONIAL') {
    if (text.length > 2) {
      await saveReviewAndThankCustomer(session, customer, agency, session.collectedData.rating, text);
      return;
    }
  }

  await whatsappService.sendTextMessage(
    customer.phone,
    'Please rate your experience from 1 to 5 or share your thoughts about the trip.',
    ctx
  );
  await sendReviewRatingPrompt(customer, agency).catch(console.error);
}

module.exports = { handleReview, sendReviewRatingPrompt };
