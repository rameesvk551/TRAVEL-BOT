const path = require('path');
const { Package } = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');

function packagePriceLine(pkg) {
  const amount = Number(pkg?.basePrice || 0);
  return Number.isFinite(amount) && amount > 0
    ? `Price: Rs.${(amount / 100).toLocaleString('en-IN')} / person`
    : 'Price: On request';
}

async function sendQuote(session, customer, agency, packageId) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const lang = customer.language || 'EN';

  const pkg = await Package.findByPk(packageId);
  if (!pkg) {
    console.error('[QuoteHandler] Package not found:', packageId);
    return;
  }

  const destinations = pkg.destinations?.join(', ') || 'Multiple destinations';
  const duration = pkg.duration || 'Custom duration';
  const inclusions = Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0
    ? pkg.inclusions.slice(0, 5).map((item) => `- ${item}`).join('\n')
    : '- Standard inclusions available';
  const exclusions = Array.isArray(pkg.exclusions) && pkg.exclusions.length > 0
    ? pkg.exclusions.slice(0, 3).map((item) => `- ${item}`).join('\n')
    : '';

  let itineraryText = '';
  if (Array.isArray(pkg.itinerary) && pkg.itinerary.length > 0) {
    itineraryText = '\n\nItinerary:\n' + pkg.itinerary
      .slice(0, 5)
      .map((day) => `Day ${day.day}: ${day.title}`)
      .join('\n');
  }

  const message = lang === 'ML'
    ? [
        `*${pkg.name}*`,
        '',
        `Duration: ${duration}`,
        `Destinations: ${destinations}`,
        packagePriceLine(pkg),
        '',
        'Inclusions:',
        inclusions,
        exclusions ? `\nExclusions:\n${exclusions}` : '',
        itineraryText,
        '',
        'Interested? Reply *BOOK* to proceed or *PACKAGES* to see more options.',
      ].join('\n')
    : [
        `*${pkg.name}*`,
        '',
        `Duration: ${duration}`,
        `Destinations: ${destinations}`,
        packagePriceLine(pkg),
        '',
        'Inclusions:',
        inclusions,
        exclusions ? `\nExclusions:\n${exclusions}` : '',
        itineraryText,
        '',
        'Interested? Reply *BOOK* to proceed or *PACKAGES* to see more options.',
      ].join('\n');

  await whatsappService.sendTextMessage(customer.phone, message, ctx);
}

async function handleQuoteResponse(session, messageText, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const upper = messageText.toUpperCase().trim();

  if (upper === 'BOOK' || upper === 'YES' || upper === 'PROCEED') {
    const response = 'Great choice! Our travel expert will finalize the booking details and send you a payment link shortly.';
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    return;
  }

  if (upper === 'PACKAGES' || upper === 'MORE' || upper === 'BACK') {
    await updateSession(session, { currentStep: 'PACKAGE_BROWSING' });
    const response = 'Sure. Send me a destination name or ask for packages again, and I will show matching options.';
    await whatsappService.sendTextMessage(customer.phone, response, ctx);
    return;
  }

  const response = 'Got it. I have shared your message with our travel expert. They will get back to you soon.';
  await whatsappService.sendTextMessage(customer.phone, response, ctx);
}

module.exports = { sendQuote, handleQuoteResponse };
