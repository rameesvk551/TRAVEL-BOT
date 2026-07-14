// FILE: /backend/src/services/templateService.ts

const { Op } = require('sequelize');
const { Agency, AgencyChannel, MessageTemplate } = require('../models');

/**
 * Prebuilt travel template library — seeded on first access.
 */
const PREBUILT_TEMPLATES = [
  // ── SEASONAL & PROMOTIONAL ──
  {
    name: 'seasonal_offer',
    displayName: 'Seasonal Offer',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Hi {{1}}! 🌟 Our exclusive {{2}} packages are now live!\n\n✈️ Starting at just ₹{{3}}/person\n📅 Limited slots for {{4}}\n\nBook now and save up to 20%! Reply YES to get the best options.',
    footer: 'Sent via TravelBot',
    variableCount: 4,
    sampleVariables: ['Rahul', 'Maldives', '25,000', 'Dec-Jan'],
    tags: ['seasonal', 'promotional', 'travel'],
    icon: '🏖️',
    buttons: [{ type: 'QUICK_REPLY', text: 'View Packages' }, { type: 'QUICK_REPLY', text: 'Talk to Agent' }],
  },
  {
    name: 'flash_sale',
    displayName: 'Flash Sale',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: '⚡ FLASH SALE — {{1}} hours only!\n\n{{2}} package at ₹{{3}}/person (was ₹{{4}})\n\n🎯 Only {{5}} seats remaining\n📅 Travel dates: {{6}}\n\nGrab this deal before it expires!',
    footer: 'Limited time offer',
    variableCount: 6,
    sampleVariables: ['48', 'Bali Beach Paradise', '18,000', '25,000', '12', 'Jan 15-20'],
    tags: ['flash-sale', 'promotional', 'urgent'],
    icon: '⚡',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }, { type: 'QUICK_REPLY', text: 'More Details' }],
  },
  {
    name: 'festival_greeting',
    displayName: 'Festival Greeting + Offer',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: '🎉 Happy {{1}}, {{2}}!\n\nCelebrate with a dream vacation!\n🌴 {{3}} — starting ₹{{4}}/person\n\n🎁 Use code {{5}} for an extra {{6}}% off\n\nOffer valid till {{7}}. Plan your getaway today!',
    footer: 'Festive special from your travel partner',
    variableCount: 7,
    sampleVariables: ['Diwali', 'Priya', 'Kerala Backwaters', '12,000', 'DIWALI24', '15', 'Nov 5'],
    tags: ['festival', 'seasonal', 'greeting'],
    icon: '🎊',
    buttons: [{ type: 'QUICK_REPLY', text: 'Explore Deals' }],
  },
  {
    name: 'new_destination',
    displayName: 'New Destination Launch',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: '🆕 Just launched: {{1}}!\n\nHi {{2}}, we\'ve added an exciting new destination to our catalog.\n\n📍 {{1}} — {{3}}\n💰 From ₹{{4}}/person\n📅 First departure: {{5}}\n\nBe among the first to book this route!',
    footer: 'New routes added monthly',
    variableCount: 5,
    sampleVariables: ['Vietnam', 'Arjun', '5N/6D Ho Chi Minh to Hanoi', '32,000', 'Feb 10'],
    tags: ['new-launch', 'promotional'],
    icon: '🆕',
    buttons: [{ type: 'QUICK_REPLY', text: 'View Itinerary' }, { type: 'QUICK_REPLY', text: 'Check Dates' }],
  },

  // ── FOLLOW-UP & NURTURING ──
  {
    name: 'lead_followup_day2',
    displayName: 'Lead Follow-up (Day 2)',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Hi {{1}}! 👋\n\nJust checking in about your {{2}} trip inquiry.\n\nDid you know our packages include:\n✅ Airport transfers\n✅ Daily breakfast\n✅ Guided sightseeing\n\nWant me to share the detailed itinerary?',
    variableCount: 2,
    sampleVariables: ['Sneha', 'Goa'],
    tags: ['follow-up', 'nurturing', 'day-2'],
    icon: '💬',
    buttons: [{ type: 'QUICK_REPLY', text: 'Yes, share!' }, { type: 'QUICK_REPLY', text: 'Not interested' }],
  },
  {
    name: 'lead_followup_day5',
    displayName: 'Urgency Follow-up (Day 5)',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Hi {{1}},\n\n⏰ Quick update: Only {{2}} seats left for {{3}} departures!\n\nYour {{4}} trip at ₹{{5}}/person is still available. Should I hold a seat for 24 hours?\n\nReply HOLD to reserve or CALL for a free consultation.',
    variableCount: 5,
    sampleVariables: ['Amit', '3', 'December', 'Manali', '15,000'],
    tags: ['follow-up', 'urgency', 'day-5'],
    icon: '⏰',
    buttons: [{ type: 'QUICK_REPLY', text: 'Hold My Seat' }, { type: 'QUICK_REPLY', text: 'Call Me' }],
  },
  {
    name: 'cold_lead_reengagement',
    displayName: 'Cold Lead Re-engagement',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Hi {{1}}! It\'s been a while 🌟\n\nWe have some amazing new deals you might love:\n\n🏝️ {{2}} — ₹{{3}}/person\n🏔️ {{4}} — ₹{{5}}/person\n\nWould you like to explore these options?',
    variableCount: 5,
    sampleVariables: ['Kavya', 'Bali 5N', '22,000', 'Shimla 3N', '8,000'],
    tags: ['re-engagement', 'cold-lead'],
    icon: '🔄',
    buttons: [{ type: 'QUICK_REPLY', text: 'Show More' }, { type: 'QUICK_REPLY', text: 'Stop Messages' }],
  },
  {
    name: 'abandoned_inquiry',
    displayName: 'Abandoned Inquiry Recovery',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Hi {{1}},\n\nLooks like we didn\'t finish planning your {{2}} trip! 🗺️\n\nNo worries — I\'m here whenever you\'re ready. Your details are saved, so we can pick up right where we left off.\n\nJust reply START to continue.',
    variableCount: 2,
    sampleVariables: ['Deepak', 'Kerala'],
    tags: ['abandoned', 'recovery'],
    icon: '🗺️',
    buttons: [{ type: 'QUICK_REPLY', text: 'Continue' }, { type: 'QUICK_REPLY', text: 'Start Over' }],
  },

  // ── BOOKING & UTILITY ──
  {
    name: 'booking_confirmation',
    displayName: 'Booking Confirmation',
    category: 'UTILITY',
    headerType: 'NONE',
    body: '✅ *Booking Confirmed!*\n\nHi {{1}}, your trip is locked in!\n\n📍 Destination: {{2}}\n📅 Travel: {{3}}\n👥 Travellers: {{4}}\n🎫 Booking Ref: {{5}}\n💰 Total: ₹{{6}}\n\nYour travel expert will share the full itinerary shortly.',
    footer: 'Bon Voyage! ✈️',
    variableCount: 6,
    sampleVariables: ['Ravi', 'Maldives', 'Dec 20 - Dec 25', '2 Adults', 'TB-2026-0042', '1,20,000'],
    tags: ['booking', 'utility', 'confirmation'],
    icon: '✅',
  },
  {
    name: 'payment_reminder',
    displayName: 'Payment Reminder',
    category: 'UTILITY',
    headerType: 'NONE',
    body: 'Hi {{1}},\n\n💳 Friendly reminder: Your balance payment of ₹{{2}} for the {{3}} trip is due by {{4}}.\n\nRef: {{5}}\n\nPay now to secure your booking. Need help? Reply HELP.',
    variableCount: 5,
    sampleVariables: ['Neha', '45,000', 'Bali', 'Dec 10', 'TB-2026-0055'],
    tags: ['payment', 'utility', 'reminder'],
    icon: '💳',
    buttons: [{ type: 'QUICK_REPLY', text: 'Pay Now' }, { type: 'QUICK_REPLY', text: 'Need Help' }],
  },
  {
    name: 'pre_trip_checklist',
    displayName: 'Pre-Trip Checklist',
    category: 'UTILITY',
    headerType: 'NONE',
    body: 'Hi {{1}}! Your {{2}} trip is in {{3}} days! 🎉\n\n📋 *Pre-trip checklist:*\n☐ Valid passport/ID\n☐ Printed tickets & vouchers\n☐ Travel insurance\n☐ Local currency/forex card\n☐ Packing essentials\n\n📞 Emergency: {{4}}\n\nHave a wonderful trip! 🌟',
    variableCount: 4,
    sampleVariables: ['Arun', 'Thailand', '3', '+91 98765 43210'],
    tags: ['pre-trip', 'utility', 'checklist'],
    icon: '📋',
  },
  {
    name: 'trip_tomorrow',
    displayName: 'Trip Tomorrow',
    category: 'UTILITY',
    headerType: 'NONE',
    body: '🌅 *Tomorrow\'s the day, {{1}}!*\n\nYour {{2}} adventure begins tomorrow.\n\n✅ {{3}}\n📍 Pickup: {{4}}\n⏰ Time: {{5}}\n\nWishing you an incredible journey! 🧳✈️',
    variableCount: 5,
    sampleVariables: ['Meera', 'Rajasthan', 'Flight AI-302 confirmed', 'Hotel lobby', '6:00 AM'],
    tags: ['pre-trip', 'utility', 'day-before'],
    icon: '🌅',
  },

  // ── REVIEW & REFERRAL ──
  {
    name: 'review_request',
    displayName: 'Post-Trip Review',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Welcome back, {{1}}! 🏡\n\nHow was your {{2}} trip? We\'d love to hear about it!\n\n⭐ Rate your experience from 1-5\n📝 Share a quick review\n\nYour feedback helps us serve you better!',
    variableCount: 2,
    sampleVariables: ['Vikram', 'Ladakh'],
    tags: ['review', 'post-trip', 'feedback'],
    icon: '⭐',
  },
  {
    name: 'google_review_nudge',
    displayName: 'Google Review Nudge',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Thank you for the amazing feedback, {{1}}! 🙏\n\nWould you mind sharing it on Google? It helps other travelers discover us!\n\n👉 {{2}}\n\nTakes just 30 seconds. Thank you! 🌟',
    variableCount: 2,
    sampleVariables: ['Lakshmi', 'https://g.page/r/your-agency/review'],
    tags: ['review', 'google', 'social-proof'],
    icon: '🌐',
  },
  {
    name: 'referral_invite',
    displayName: 'Referral Invite',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Hi {{1}}! 🎁\n\nLoved your trip? Share the joy!\n\nRefer a friend and you both get ₹{{2}} off your next booking.\n\n🔗 Your referral code: *{{3}}*\n\nJust share this code with friends planning a trip.',
    footer: 'Earn rewards for every referral',
    variableCount: 3,
    sampleVariables: ['Suresh', '2,000', 'SURESH2026'],
    tags: ['referral', 'reward', 'loyalty'],
    icon: '🎁',
    buttons: [{ type: 'QUICK_REPLY', text: 'Share Code' }],
  },
  {
    name: 'loyalty_milestone',
    displayName: 'Loyalty Milestone',
    category: 'MARKETING',
    headerType: 'NONE',
    body: '🏆 Congratulations {{1}}!\n\nYou\'ve completed {{2}} trips with us! As a valued traveler, enjoy:\n\n✨ {{3}}% off your next booking\n🎁 Priority support\n⭐ VIP early access to new packages\n\nThank you for choosing us! 🙏',
    variableCount: 3,
    sampleVariables: ['Anjali', '5', '10'],
    tags: ['loyalty', 'milestone', 'reward'],
    icon: '🏆',
  },

  // ── GROUP & SPECIAL ──
  {
    name: 'group_discount',
    displayName: 'Group Travel Discount',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Hi {{1}}! 👥\n\nPlanning a group trip? The more the merrier!\n\n🎯 {{2}} — Group Special:\n👥 5-9 travelers: {{3}}% off\n👥 10+ travelers: {{4}}% off\n\nOrganize your group and save big! Reply GROUP to get started.',
    variableCount: 4,
    sampleVariables: ['Kiran', 'Thailand 5N/6D', '10', '20'],
    tags: ['group', 'discount', 'promotional'],
    icon: '👥',
    buttons: [{ type: 'QUICK_REPLY', text: 'Plan Group Trip' }],
  },
  {
    name: 'honeymoon_special',
    displayName: 'Honeymoon Special',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: '💕 Congratulations on your wedding, {{1}}!\n\nMake your honeymoon unforgettable with our curated packages:\n\n🌺 {{2}} — {{3}}\n💰 Starting ₹{{4}}/couple\n🎁 Includes: {{5}}\n\nBook within 48 hours for a complimentary spa session!',
    variableCount: 5,
    sampleVariables: ['Anita & Raj', 'Maldives Water Villa', '4N/5D', '85,000', 'Candlelight dinner, Snorkeling, Sunset cruise'],
    tags: ['honeymoon', 'special', 'romantic'],
    icon: '💕',
    buttons: [{ type: 'QUICK_REPLY', text: 'View Details' }, { type: 'QUICK_REPLY', text: 'Customize' }],
  },
  {
    name: 'weekend_getaway',
    displayName: 'Weekend Getaway',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Need a quick escape, {{1}}? 🏃\n\n🗓️ This weekend:\n📍 {{2}} — just {{3}} hours away\n💰 ₹{{4}}/person (all inclusive)\n\n✅ {{5}}\n\nLimited spots — reply BOOK to reserve!',
    variableCount: 5,
    sampleVariables: ['Divya', 'Coorg', '5', '6,500', 'Stay, meals, activities included'],
    tags: ['weekend', 'getaway', 'quick-trip'],
    icon: '🏃',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Weekend' }, { type: 'QUICK_REPLY', text: 'Other Options' }],
  },
  {
    name: 'review_collection_campaign',
    displayName: 'Automated Review Collection',
    category: 'MARKETING',
    headerType: 'NONE',
    body: 'Hi {{1}}, welcome back from {{2}}! 🌟\n\nWe hope you had a fantastic trip. We are constantly looking to improve our services and your feedback means the world to us.\n\nCould you take 2 minutes to share your experience with us? Simply reply with a rating from 1 to 5 (5 being Excellent!)',
    variableCount: 2,
    sampleVariables: ['Rohit', 'Switzerland'],
    tags: ['review', 'collection', 'automated'],
    icon: '📊',
  },
  {
    name: 'early_bird_discount',
    displayName: 'Early Bird Promo',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Early Bird Gets the Worm! 🐦☀️\n\nHi {{1}}, planning your summer holidays yet? Book your {{2}} trip now and enjoy a massive {{3}}% Early Bird Discount!\n\n📅 Valid for travel dates: {{4}}\n\nReply INTERESTED to get the details.',
    footer: 'Plan ahead and save!',
    variableCount: 4,
    sampleVariables: ['Aisha', 'Europe', '15', 'May - July'],
    tags: ['early-bird', 'promotional', 'summer'],
    icon: '🐦',
    buttons: [{ type: 'QUICK_REPLY', text: 'INTERESTED' }, { type: 'QUICK_REPLY', text: 'Talk to Expert' }],
  },
  {
    name: 'visa_on_arrival_promo',
    displayName: 'Visa-Free / VOA Deals',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'No Visa Hassles! ✈️🛂\n\nHey {{1}}, escaping for a vacation is now easier than ever. Explore our top Visa-Free and Visa-on-Arrival destinations:\n\n🌴 {{2}} - from ₹{{3}}\n🏯 {{4}} - from ₹{{5}}\n\nReady to pack your bags? Reply YES for itineraries.',
    footer: 'Travel simplified',
    variableCount: 5,
    sampleVariables: ['Vikash', 'Thailand', '18,500', 'Bali', '22,000'],
    tags: ['visa-free', 'promotional', 'hassle-free'],
    icon: '🛂',
    buttons: [{ type: 'QUICK_REPLY', text: 'YES' }],
  },
  {
    name: 'luxury_escape',
    displayName: 'Luxury Escape',
    category: 'MARKETING',
    headerType: 'IMAGE',
    body: 'Indulge in Luxury 🥂✨\n\nHi {{1}}, treat yourself to the ultimate getaway with our Premium {{2}} Package. \n\n✨ 5-star stays\n🚗 Private transfers\n🍽️ Curated dining experiences\n\nStarts at ₹{{3}}/couple. Shall we send the brochure?',
    variableCount: 3,
    sampleVariables: ['Karan', 'Maldives', '1,50,000'],
    tags: ['luxury', 'promotional', 'premium'],
    icon: '🥂',
    buttons: [{ type: 'QUICK_REPLY', text: 'Send Brochure' }, { type: 'QUICK_REPLY', text: 'Not Now' }],
  },
];

const DEFAULT_TEMPLATE_MEDIA = {
  image1: 'https://res.cloudinary.com/djruimp0d/image/upload/v1777548757/travel-bot/packages/768f7576-35b4-4f83-bcf6-5e51bf3b9c81/vidpcschrp1k6yqolvxn.jpg',
  image2: 'https://res.cloudinary.com/djruimp0d/image/upload/v1777562253/travel-bot/packages/768f7576-35b4-4f83-bcf6-5e51bf3b9c81/uqghxy6kwqvbnmxbn8oo.jpg',
  image3: 'https://res.cloudinary.com/djruimp0d/image/upload/v1777548757/travel-bot/packages/768f7576-35b4-4f83-bcf6-5e51bf3b9c81/vidpcschrp1k6yqolvxn.jpg',
  video1: 'https://scontent.whatsapp.net/v/t61.29466-34/677285023_1551552316309307_1265374083007597790_n.jpg?ccb=1-7&_nc_sid=a80384&_nc_ohc=_4mLCxnmEXcQ7kNvwFDgw13&_nc_oc=AdoVJwFtK3IKimTdFz7al68sZzwn1YAFR6c4iPQ8XN-z69L_RSnDsLC8K3ES_bba6iw&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=Vkdu6l0FXzkO-BvQUyZtSQ&oh=01_Q5Aa4QHO54h9EjcmxlSVMT2jtHH4qBZu3ZseFBOSbXgB2TxS9A&oe=6A1A69D7',
  video2: 'https://scontent.whatsapp.net/v/t61.29466-34/652732328_1620509109208391_6872574975304393197_n.jpg?ccb=1-7&_nc_sid=a80384&_nc_ohc=Qj36WJN_WtYQ7kNvwHmWOZB&_nc_oc=Adq2auO875xs1U6knH_otE9NAAQZ847GsLkvBuFU8zZJFgY-fD_yxeVskYEO5A32LrM&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=Vkdu6l0FXzkO-BvQUyZtSQ&oh=01_Q5Aa4QE_brt5Fjwe1855Nh2qDzt50wTSzELZhjbQeHcrFSLr2A&oe=6A1A6844',
};

const PREBUILT_TEMPLATE_NAMES = [
  'lead_assignment_alert',
  'image_cta_1btn',
  'image_cta_2btn',
  'video_cta_1btn',
  'video_cta_2btn',
  'image_carousel_1btn',
  'image_carousel_2btn',
  'video_carousel_1btn',
  'video_carousel_2btn',
  // Document-attachment templates for the "Send documents to WhatsApp" page.
  'document_quotation',
  'document_invoice',
  'document_receipt',
];

// Generic placeholder values so every field is customer-editable in the editor.
const PLACEHOLDER_URL = 'https://example.com';
const PLACEHOLDER_PHONE = '+10000000000';
// Public sample PDF used only so Meta has a header media sample at approval time.
// Each agency replaces it with its own document when cloning the template.
const PLACEHOLDER_DOC_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

// Mixed-CTA button sets reused across the generic presets.
const CTA_BUTTONS_1 = [
  { type: 'URL', text: 'Visit Website', url: PLACEHOLDER_URL },
];
const CTA_BUTTONS_2 = [
  { type: 'URL', text: 'Visit Website', url: PLACEHOLDER_URL },
  { type: 'PHONE_NUMBER', text: 'Call Us', phoneNumber: PLACEHOLDER_PHONE },
];

/**
 * Builds 10 identical-structure carousel cards (Meta requires every card in a
 * carousel to share the same media type and button layout).
 */
function genericCarouselCards(mediaType, cardButtons) {
  const media = mediaType === 'VIDEO'
    ? [DEFAULT_TEMPLATE_MEDIA.video1, DEFAULT_TEMPLATE_MEDIA.video2]
    : [DEFAULT_TEMPLATE_MEDIA.image1, DEFAULT_TEMPLATE_MEDIA.image2, DEFAULT_TEMPLATE_MEDIA.image3];

  return Array.from({ length: 10 }, (_, i) => ({
    id: `card_${i + 1}`,
    mediaType,
    mediaUrl: media[i % media.length],
    title: '',
    body: `Headline ${i + 1} goes here — edit this text and replace the ${mediaType.toLowerCase()}.`,
    buttons: cardButtons.map((b) => ({ ...b })),
  }));
}

function curatedPrebuiltTemplates() {
  return [
    {
      name: 'lead_assignment_alert',
      displayName: 'Lead Assignment Alert',
      category: 'UTILITY',
      headerType: 'NONE',
      body: '🔔 New lead assigned to you\n\nName: {{1}}\nPhone: {{2}}\nSource: {{3}}\nNotes: {{4}}\n\nPlease follow up promptly.',
      variableCount: 4,
      sampleVariables: ['John Doe', '+1 555 0100', 'Website', 'Requested a callback'],
      tags: ['lead', 'assignment', 'internal', 'notification'],
      icon: '🔔',
      buttons: [],
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'image_cta_1btn',
      displayName: 'Image with CTA (1 Button)',
      category: 'MARKETING',
      headerType: 'IMAGE',
      headerContent: DEFAULT_TEMPLATE_MEDIA.image1,
      body: 'Hi {{1}},\n\n{{2}}\n\nTap below to learn more.',
      footer: 'Your brand here',
      variableCount: 2,
      sampleVariables: ['there', 'Add your message here'],
      tags: ['cta', 'image', 'generic'],
      icon: '🖼️',
      buttons: CTA_BUTTONS_1.map((b) => ({ ...b })),
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'image_cta_2btn',
      displayName: 'Image with CTA (2 Buttons)',
      category: 'MARKETING',
      headerType: 'IMAGE',
      headerContent: DEFAULT_TEMPLATE_MEDIA.image1,
      body: 'Hi {{1}},\n\n{{2}}\n\nTap below to learn more or get in touch.',
      footer: 'Your brand here',
      variableCount: 2,
      sampleVariables: ['there', 'Add your message here'],
      tags: ['cta', 'image', 'generic'],
      icon: '🖼️',
      buttons: CTA_BUTTONS_2.map((b) => ({ ...b })),
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'video_cta_1btn',
      displayName: 'Video with CTA (1 Button)',
      category: 'MARKETING',
      headerType: 'VIDEO',
      headerContent: DEFAULT_TEMPLATE_MEDIA.video1,
      body: 'Hi {{1}},\n\n{{2}}\n\nTap below to learn more.',
      footer: 'Your brand here',
      variableCount: 2,
      sampleVariables: ['there', 'Add your message here'],
      tags: ['cta', 'video', 'generic'],
      icon: '🎬',
      buttons: CTA_BUTTONS_1.map((b) => ({ ...b })),
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'video_cta_2btn',
      displayName: 'Video with CTA (2 Buttons)',
      category: 'MARKETING',
      headerType: 'VIDEO',
      headerContent: DEFAULT_TEMPLATE_MEDIA.video1,
      body: 'Hi {{1}},\n\n{{2}}\n\nTap below to learn more or get in touch.',
      footer: 'Your brand here',
      variableCount: 2,
      sampleVariables: ['there', 'Add your message here'],
      tags: ['cta', 'video', 'generic'],
      icon: '🎬',
      buttons: CTA_BUTTONS_2.map((b) => ({ ...b })),
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'image_carousel_1btn',
      displayName: 'Image Carousel (1 Button)',
      category: 'MARKETING',
      headerType: 'NONE',
      body: 'Hi {{1}}, take a look at these options.',
      variableCount: 1,
      sampleVariables: ['there'],
      tags: ['carousel', 'image', 'generic'],
      icon: '🎞️',
      buttons: [],
      templateType: 'CAROUSEL',
      carouselCards: genericCarouselCards('IMAGE', CTA_BUTTONS_1),
    },
    {
      name: 'image_carousel_2btn',
      displayName: 'Image Carousel (2 Buttons)',
      category: 'MARKETING',
      headerType: 'NONE',
      body: 'Hi {{1}}, take a look at these options.',
      variableCount: 1,
      sampleVariables: ['there'],
      tags: ['carousel', 'image', 'generic'],
      icon: '🎞️',
      buttons: [],
      templateType: 'CAROUSEL',
      carouselCards: genericCarouselCards('IMAGE', CTA_BUTTONS_2),
    },
    {
      name: 'video_carousel_1btn',
      displayName: 'Video Carousel (1 Button)',
      category: 'MARKETING',
      headerType: 'NONE',
      body: 'Hi {{1}}, take a look at these options.',
      variableCount: 1,
      sampleVariables: ['there'],
      tags: ['carousel', 'video', 'generic'],
      icon: '🎞️',
      buttons: [],
      templateType: 'CAROUSEL',
      carouselCards: genericCarouselCards('VIDEO', CTA_BUTTONS_1),
    },
    {
      name: 'video_carousel_2btn',
      displayName: 'Video Carousel (2 Buttons)',
      category: 'MARKETING',
      headerType: 'NONE',
      body: 'Hi {{1}}, take a look at these options.',
      variableCount: 1,
      sampleVariables: ['there'],
      tags: ['carousel', 'video', 'generic'],
      icon: '🎞️',
      buttons: [],
      templateType: 'CAROUSEL',
      carouselCards: genericCarouselCards('VIDEO', CTA_BUTTONS_2),
    },

    // ── DOCUMENT-ATTACHMENT TEMPLATES (Send documents to WhatsApp) ──
    // headerType DOCUMENT → the generated PDF is attached as the header media at
    // send time; the placeholder URL is only a Meta approval sample. One per
    // document type, tagged so the Document Sending page can surface exactly one.
    {
      name: 'document_quotation',
      displayName: 'Quotation Document',
      category: 'UTILITY',
      headerType: 'DOCUMENT',
      headerContent: PLACEHOLDER_DOC_URL,
      body: 'Hi {{1}}, 👋\n\nThank you for your interest! Please find your travel quotation attached.\n\nReview the details and reply here if you have any questions — we are happy to help you plan the perfect trip.',
      footer: 'Your travel team',
      variableCount: 1,
      sampleVariables: ['Rahul'],
      tags: ['document-send', 'quotation'],
      icon: '📄',
      buttons: [],
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'document_invoice',
      displayName: 'Invoice Document',
      category: 'UTILITY',
      headerType: 'DOCUMENT',
      headerContent: PLACEHOLDER_DOC_URL,
      body: 'Hi {{1}},\n\nPlease find your invoice attached for your records. 🧾\n\nIf you have any questions about the charges or need assistance with payment, just reply to this message.',
      footer: 'Your travel team',
      variableCount: 1,
      sampleVariables: ['Rahul'],
      tags: ['document-send', 'invoice'],
      icon: '🧾',
      buttons: [],
      templateType: 'STANDARD',
      carouselCards: [],
    },
    {
      name: 'document_receipt',
      displayName: 'Payment Receipt Document',
      category: 'UTILITY',
      headerType: 'DOCUMENT',
      headerContent: PLACEHOLDER_DOC_URL,
      body: 'Hi {{1}}, ✅\n\nThank you! We have received your payment. Your receipt is attached for your records.\n\nWe look forward to making your trip a memorable one. Reply here anytime you need us.',
      footer: 'Your travel team',
      variableCount: 1,
      sampleVariables: ['Rahul'],
      tags: ['document-send', 'receipt'],
      icon: '🧾',
      buttons: [],
      templateType: 'STANDARD',
      carouselCards: [],
    },
  ];
}

function defaultApprovalTemplatesForAgency(agencyName = 'your travel team') {
  const brand = String(agencyName || 'your travel team').trim();
  const brandSlug = slugifyTemplateName(brand).slice(0, 24) || 'travel';

  return curatedPrebuiltTemplates().map((template) => ({
    ...template,
    name: `${brandSlug}_${template.name}`,
    displayName: `${brand} ${template.displayName}`,
    footer: template.footer === 'Your brand here' ? brand : template.footer,
  }));
}

/**
 * Ensures prebuilt templates exist in the database.
 */
async function seedPrebuiltTemplates() {
  await MessageTemplate.destroy({
    where: {
      isPrebuilt: true,
      agencyId: null,
      name: { [Op.notIn]: PREBUILT_TEMPLATE_NAMES },
    },
  });

  const templates = curatedPrebuiltTemplates();
  for (const tpl of templates) {
    const existing = await MessageTemplate.findOne({
      where: { name: tpl.name, isPrebuilt: true, agencyId: null },
    });

    if (!existing) {
      await MessageTemplate.create({
        ...tpl,
        isPrebuilt: true,
        agencyId: null,
        status: 'APPROVED',
      });
    } else {
      await existing.update({
        ...tpl,
        isPrebuilt: true,
        agencyId: null,
        status: 'APPROVED',
      });
    }
  }
  console.log(`[TemplateService] Seeded ${templates.length} curated prebuilt templates.`);
}

function slugifyTemplateName(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return slug || `template_${Date.now()}`;
}

async function makeUniqueTemplateName(agencyId, baseName, excludeId = null) {
  const base = slugifyTemplateName(baseName);
  let candidate = base;
  let suffix = 1;

  while (true) {
    const where = { agencyId, name: candidate };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await MessageTemplate.findOne({ where, attributes: ['id'] });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
}

function countBodyVariables(body) {
  const matches = String(body || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return matches.reduce((max, token) => {
    const value = parseInt(token.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

function extractBodyVariablePositions(body) {
  const matches = String(body || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return [...new Set(matches
    .map((token) => parseInt(token.replace(/[^\d]/g, ''), 10))
    .filter((value) => Number.isFinite(value) && value > 0))]
    .sort((a, b) => a - b);
}

// Names that resolve from the contact per-recipient (not filled at campaign time).
const RESERVED_CONTACT_VARIABLES = new Set([
  'name', 'firstname', 'first_name', 'fullname', 'full_name',
  'customer', 'customername', 'customer_name',
  'phone', 'mobile', 'number', 'phone_number',
]);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile a body that may contain NAMED tokens ({{description}}, {{destination}})
 * into Meta-safe positional placeholders ({{1}}, {{2}}) and produce an ordered
 * variableMap. Numeric-only bodies are returned unchanged with an empty map
 * (legacy behaviour). Tokens are positioned by order of first appearance.
 */
function compileNamedVariables(rawBody, existingSamples = []) {
  const body = String(rawBody || '');
  const tokenRe = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*|\d+)\s*\}\}/g;
  const order = [];
  let match;
  while ((match = tokenRe.exec(body)) !== null) {
    const key = match[1];
    if (!order.includes(key)) order.push(key);
  }

  const hasNamed = order.some((key) => !/^\d+$/.test(key));
  if (!hasNamed) {
    return { body, variableMap: [] };
  }

  const variableMap = order.map((key, index) => ({
    name: /^\d+$/.test(key) ? `var${index + 1}` : key.toLowerCase(),
    source: RESERVED_CONTACT_VARIABLES.has(key.toLowerCase()) ? 'CONTACT' : 'STATIC',
  }));

  let positionalBody = body;
  order.forEach((key, index) => {
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    positionalBody = positionalBody.replace(re, `{{${index + 1}}}`);
  });

  // Realign provided sample values to the new positions where possible.
  const sampleVariables = order.map((key, index) => {
    const provided = existingSamples[index];
    return String(provided || '').trim() ? provided : '';
  });

  return { body: positionalBody, variableMap, sampleVariables };
}

function normalizeVariableMap(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || '').trim().toLowerCase();
      if (!name) return null;
      const source = String(entry.source || '').toUpperCase() === 'CONTACT'
        || RESERVED_CONTACT_VARIABLES.has(name)
        ? 'CONTACT'
        : 'STATIC';
      return { name, source };
    })
    .filter(Boolean);
}

function defaultSampleVariable(position) {
  const defaults = {
    1: 'Rahul',
    2: 'Kashmir 4N 5D - hotels, transfers, sightseeing, from Rs 39,999/person',
    3: 'Kashmir Family Escape',
    4: 'Wayon Travels',
  };
  return defaults[position] || `Sample ${position}`;
}

function normalizeStatus(status) {
  const normalized = String(status || 'DRAFT').toUpperCase().replace(/\s+/g, '_');
  if (['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DRAFT'].includes(normalized)) return normalized;
  if (['IN_REVIEW', 'SUBMITTED', 'UNDER_REVIEW'].includes(normalized)) return 'PENDING';
  if (['DISABLED', 'DELETED'].includes(normalized)) return 'PAUSED';
  return 'DRAFT';
}

function normalizeCategory(category) {
  const normalized = String(category || 'MARKETING').toUpperCase();
  return ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(normalized) ? normalized : 'MARKETING';
}

function normalizeHeaderType(headerType) {
  const normalized = String(headerType || 'NONE').toUpperCase();
  return ['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'].includes(normalized) ? normalized : 'NONE';
}

function normalizeButtonRoute(route) {
  const normalized = String(route || '').toUpperCase();
  return [
    'VIEW_PACKAGES',
    'VIEW_PROPERTIES',
    'CUSTOM_TRIP',
    'VIEW_DETAILS',
    'SEND_ITINERARY',
    'CHECK_AVAILABILITY',
    'TALK_TO_AGENT',
  ].includes(normalized) ? normalized : null;
}

function normalizeButtons(buttons) {
  if (!Array.isArray(buttons)) return [];
  return buttons
    .map((button) => {
      const type = String(button.type || 'QUICK_REPLY').toUpperCase();
      return {
        type,
        text: String(button.text || button.title || '').trim(),
        url: button.url || null,
        phoneNumber: button.phoneNumber || button.phone_number || null,
        route: type === 'QUICK_REPLY' ? normalizeButtonRoute(button.route || button.action || button.routing) : null,
      };
    })
    .filter((button) => button.text);
}

function isValidHttpUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function normalizeCarouselCards(cards) {
  if (!Array.isArray(cards)) return [];

  return cards
    .slice(0, 10)
    .map((card, index) => ({
      id: card?.id || `card_${index + 1}`,
      mediaType: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(card?.mediaType || card?.headerType || 'IMAGE').toUpperCase())
        ? String(card?.mediaType || card?.headerType || 'IMAGE').toUpperCase()
        : 'IMAGE',
      mediaUrl: String(card?.mediaUrl || '').trim(),
      title: String(card?.title || '').trim(),
      body: String(card?.body || '').trim(),
      buttons: normalizeButtons(
        Array.isArray(card?.buttons) && card.buttons.length
          ? card.buttons
          : [
              { type: 'QUICK_REPLY', text: 'Enquiry' },
              { type: 'QUICK_REPLY', text: 'See Others' },
            ]
      ).slice(0, 2),
    }))
    .filter((card) => card.mediaUrl || card.body || card.title);
}

function validateTemplatePayload(payload) {
  if (!payload.displayName) throw new Error('Template display name is required');
  if (!payload.body) throw new Error('Template body is required');
  if (payload.templateType !== 'CAROUSEL') return;

  if (!Array.isArray(payload.carouselCards) || payload.carouselCards.length < 2 || payload.carouselCards.length > 10) {
    throw new Error('Carousel templates need 2 to 10 cards');
  }

  payload.carouselCards.forEach((card, index) => {
    if (!card.body) {
      throw new Error(`Carousel card ${index + 1} is missing body text`);
    }
    if (!isValidHttpUrl(card.mediaUrl)) {
      throw new Error(`Carousel card ${index + 1} needs a valid public media URL`);
    }
  });
}

function extractHeaderFromComponents(components = []) {
  if (!Array.isArray(components)) return null;
  return components.find((component) => String(component.type || '').toUpperCase() === 'HEADER') || null;
}

function extractBodyFromComponents(components = []) {
  if (!Array.isArray(components)) return '';
  return components.find((component) => String(component.type || '').toUpperCase() === 'BODY')?.text || '';
}

function extractFooterFromComponents(components = []) {
  if (!Array.isArray(components)) return null;
  return components.find((component) => String(component.type || '').toUpperCase() === 'FOOTER')?.text || null;
}

function extractButtonsFromComponents(components = []) {
  if (!Array.isArray(components)) return [];
  const buttonComponent = components.find((component) => String(component.type || '').toUpperCase() === 'BUTTONS');
  return normalizeButtons(buttonComponent?.buttons);
}

function extractCarouselCardsFromComponents(components = []) {
  if (!Array.isArray(components)) return [];
  const carouselComponent = components.find((component) => String(component.type || '').toUpperCase() === 'CAROUSEL');
  if (!carouselComponent || !Array.isArray(carouselComponent.cards)) return [];

  return carouselComponent.cards.map((card, index) => {
    const cardComponents = Array.isArray(card.components) ? card.components : [];
    const cardHeader = extractHeaderFromComponents(cardComponents);
    return {
      id: card.id || `card_${index + 1}`,
      mediaType: String(cardHeader?.format || 'IMAGE').toUpperCase(),
      mediaUrl: cardHeader?.example?.header_handle?.[0] || null,
      title: '',
      body: extractBodyFromComponents(cardComponents) || '',
      buttons: extractButtonsFromComponents(cardComponents),
    };
  }).filter((card) => card.body || card.mediaUrl || (card.buttons && card.buttons.length > 0));
}

function normalizeProviderTemplate(mt) {
  const name = mt.name || mt.templateName || mt.template_name;
  const header = extractHeaderFromComponents(mt.components);
  const carouselCardsFromComponents = extractCarouselCardsFromComponents(mt.components);
  const body = mt.body
    || mt.bodyContent
    || mt.body_content
    || extractBodyFromComponents(mt.components)
    || '';
  const status = normalizeStatus(mt.status);

  return {
    id: mt.id || mt.metaTemplateId || mt.meta_template_id || name,
    name,
    displayName: mt.displayName || mt.display_name || String(name || '')
      .replace(/_corrected$/i, '')
      .replace(/_3btn$/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    category: normalizeCategory(mt.category),
    language: mt.language || mt.languageCode || mt.language_code || 'en',
    headerType: normalizeHeaderType(mt.headerType || mt.header_type || header?.format),
    headerContent: mt.headerContent || mt.header_content || header?.text || null,
    body,
    footer: mt.footer || mt.footerContent || mt.footer_content || extractFooterFromComponents(mt.components),
    buttons: normalizeButtons(mt.buttons).length ? normalizeButtons(mt.buttons) : extractButtonsFromComponents(mt.components),
    status,
    rejectionReason: status === 'REJECTED' ? (mt.rejectionReason || mt.rejection_reason || mt.rejected_reason || null) : null,
    variableCount: mt.variableCount || mt.variable_count || countBodyVariables(body),
    sampleVariables: Array.isArray(mt.variables) ? mt.variables : [],
    templateType: (
      String(mt.templateType || mt.template_type || '').toUpperCase() === 'CAROUSEL'
      || carouselCardsFromComponents.length > 0
      || (Array.isArray(mt.carouselCards || mt.carousel_cards) && (mt.carouselCards || mt.carousel_cards).length > 0)
    ) ? 'CAROUSEL' : 'STANDARD',
    carouselCards: Array.isArray(mt.carouselCards || mt.carousel_cards) && (mt.carouselCards || mt.carousel_cards).length > 0
      ? normalizeCarouselCards(mt.carouselCards || mt.carousel_cards)
      : normalizeCarouselCards(carouselCardsFromComponents),
  };
}

function extractProviderTemplates(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.templates)) return result.templates;
  if (Array.isArray(result?.data?.templates)) return result.data.templates;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  if (Array.isArray(result?.data?.data?.templates)) return result.data.data.templates;
  return [];
}

function buildTemplateData(data, existing = null) {
  const rawBody = data.body ?? existing?.body ?? '';
  const rawSampleVariables = Array.isArray(data.sampleVariables)
    ? data.sampleVariables
    : (existing?.sampleVariables || []);

  // Compile any named tokens ({{description}}) into Meta-safe positional ones.
  const compiled = compileNamedVariables(rawBody, rawSampleVariables);
  const body = compiled.body;
  const variableMap = compiled.variableMap.length
    ? compiled.variableMap
    : normalizeVariableMap(data.variableMap ?? existing?.variableMap);
  const variableCount = countBodyVariables(body);
  const sampleVariables = Array.isArray(compiled.sampleVariables)
    ? [...compiled.sampleVariables]
    : [...rawSampleVariables];
  extractBodyVariablePositions(body).forEach((position) => {
    const index = position - 1;
    if (!String(sampleVariables[index] || '').trim()) {
      sampleVariables[index] = defaultSampleVariable(position);
    }
  });
  const templateType = String(data.templateType ?? data.template_type ?? existing?.templateType ?? 'STANDARD').toUpperCase() === 'CAROUSEL'
    ? 'CAROUSEL'
    : 'STANDARD';
  const normalized = {
    displayName: String(data.displayName ?? existing?.displayName ?? '').trim(),
    name: data.name || existing?.name,
    category: normalizeCategory(data.category ?? existing?.category),
    language: data.language || existing?.language || 'en',
    headerType: normalizeHeaderType(data.headerType ?? existing?.headerType),
    headerContent: data.headerContent ?? existing?.headerContent ?? null,
    body,
    footer: data.footer ?? existing?.footer ?? null,
    buttons: normalizeButtons(data.buttons ?? existing?.buttons),
    templateType,
    carouselCards: Array.isArray(data.carouselCards)
      ? normalizeCarouselCards(data.carouselCards)
      : normalizeCarouselCards(existing?.carouselCards || []),
    variableCount,
    sampleVariables,
    variableMap,
    tags: Array.isArray(data.tags) ? data.tags : (existing?.tags || []),
    icon: data.icon ?? existing?.icon ?? '💬',
  };

  if (templateType === 'CAROUSEL') {
    normalized.headerType = 'NONE';
    normalized.headerContent = null;
    normalized.footer = null;
    normalized.buttons = [];
  }

  validateTemplatePayload(normalized);
  return normalized;
}

async function syncTemplateToMarketingOs(agencyId, template, options = {}) {
  const whatsappService = require('./whatsappService');
  return whatsappService.upsertTemplateWithMeta(agencyId, template, options);
}

async function resolveTemplateChannelScope(agencyId, channelId, { requireStaff = false } = {}) {
  if (!channelId) return null;

  const channel = await AgencyChannel.findOne({
    where: { id: channelId, agencyId, isActive: true },
  });
  if (!channel) {
    throw Object.assign(new Error('WhatsApp channel not found for this agency'), {
      statusCode: 404,
      code: 'WHATSAPP_CHANNEL_NOT_FOUND',
    });
  }

  if (requireStaff && String(channel.usageType || '').toUpperCase() !== 'STAFF') {
    throw Object.assign(new Error('Templates for this flow must belong to a staff WhatsApp number'), {
      statusCode: 400,
      code: 'INVALID_TEMPLATE_CHANNEL_SCOPE',
    });
  }

  if (String(channel.usageType || '').toUpperCase() === 'STAFF') {
    const agency = await Agency.findByPk(agencyId, { attributes: ['id', 'staffWhatsAppEnabled'] });
    if (!agency?.staffWhatsAppEnabled) {
      throw Object.assign(new Error('Staff WhatsApp feature is not enabled for this agency'), {
        statusCode: 403,
        code: 'STAFF_WHATSAPP_DISABLED',
      });
    }
  }

  return channel;
}

function extractProviderTemplateId(result) {
  return result?.data?.id || result?.data?.data?.id || result?.id || result?.template?.id || null;
}

function extractExternalErrorMessage(err) {
  const data = err?.response?.data;
  return data?.error?.error_user_msg
    || data?.error?.message
    || data?.error
    || data?.message
    || err?.message
    || 'Template submission failed';
}

/**
 * List prebuilt template library.
 */
async function listPrebuiltTemplates({ category, tag, search } = {}) {
  const where = { isPrebuilt: true, agencyId: null, name: { [Op.in]: PREBUILT_TEMPLATE_NAMES } };
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [
      { displayName: { [Op.iLike]: `%${search}%` } },
      { body: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const templates = await MessageTemplate.findAll({
    where,
    order: [['usageCount', 'DESC'], ['displayName', 'ASC']],
  });

  if (tag) {
    return templates.filter((t) => (t.tags || []).includes(tag));
  }

  return templates;
}

/**
 * List agency-specific saved templates.
 */
async function listAgencyTemplates(agencyId, { status, category, search, channelId } = {}) {
  const channel = await resolveTemplateChannelScope(agencyId, channelId, { requireStaff: true });
  const where = { agencyId, channelId: channel ? channel.id : null };
  if (status) where.status = status;
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [
      { displayName: { [Op.iLike]: `%${search}%` } },
      { body: { [Op.iLike]: `%${search}%` } },
    ];
  }

  return MessageTemplate.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });
}

/**
 * Get a template by ID.
 */
async function getTemplate(id) {
  return MessageTemplate.findByPk(id);
}

/**
 * Create an agency template (optionally from a prebuilt template).
 */
async function createTemplate(agencyId, data) {
  const channel = await resolveTemplateChannelScope(agencyId, data.channelId, { requireStaff: true });
  const payload = buildTemplateData(data);
  if (!payload.displayName) throw new Error('Template display name is required');
  if (!payload.body) throw new Error('Template body is required');
  payload.name = await makeUniqueTemplateName(agencyId, payload.name || payload.displayName);
  payload.channelId = channel ? channel.id : null;

  const template = await MessageTemplate.create({
    ...payload,
    agencyId,
    isPrebuilt: false,
    status: 'DRAFT',
    metaTemplateId: null,
  });

  try {
    const result = await syncTemplateToMarketingOs(agencyId, template, { mode: 'create' });
    const providerTemplateId = extractProviderTemplateId(result);
    if (providerTemplateId) {
      await template.update({ metaTemplateId: providerTemplateId });
    }
    return template;
  } catch (err) {
    await template.destroy().catch(() => {});
    throw err;
  }
}

/**
 * Fork a prebuilt template into the agency's saved templates.
 */
async function usePrebuiltTemplate(agencyId, prebuiltId, overrides = {}) {
  const prebuilt = await MessageTemplate.findByPk(prebuiltId);
  if (!prebuilt || !prebuilt.isPrebuilt) {
    throw new Error('Prebuilt template not found');
  }

  // Increment usage count on the prebuilt template
  await prebuilt.increment('usageCount');

  const data = prebuilt.toJSON();
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  const payload = buildTemplateData({ ...data, ...overrides });
  payload.name = await makeUniqueTemplateName(agencyId, payload.name || payload.displayName || data.name);
  const channel = await resolveTemplateChannelScope(agencyId, overrides.channelId, { requireStaff: true });
  payload.channelId = channel ? channel.id : null;

  const template = await MessageTemplate.create({
    ...data,
    ...overrides,
    ...payload,
    agencyId,
    isPrebuilt: false,
    status: 'DRAFT',
    metaTemplateId: null,
    usageCount: 0,
  });

  try {
    const result = await syncTemplateToMarketingOs(agencyId, template, { mode: 'create' });
    const providerTemplateId = extractProviderTemplateId(result);
    if (providerTemplateId) {
      await template.update({ metaTemplateId: providerTemplateId });
    }
    return template;
  } catch (err) {
    await template.destroy().catch(() => {});
    throw err;
  }
}

/**
 * Update a template.
 */
async function updateTemplate(id, agencyId, data) {
  const template = await MessageTemplate.findOne({ where: { id, agencyId } });
  if (!template) throw new Error('Template not found');
  if (template.status === 'PENDING') {
    throw new Error('Pending templates cannot be edited until Meta finishes review');
  }

  const nextData = buildTemplateData(data, template);
  const channel = await resolveTemplateChannelScope(agencyId, data.channelId ?? template.channelId, { requireStaff: true });
  nextData.channelId = channel ? channel.id : null;
  if (data.name && data.name !== template.name) {
    nextData.name = await makeUniqueTemplateName(agencyId, data.name, id);
  }

  if (template.status === 'APPROVED') {
    nextData.status = 'DRAFT';
    nextData.metaTemplateId = null;
    nextData.rejectionReason = null;
  } else if (template.status === 'REJECTED') {
    nextData.status = 'DRAFT';
    nextData.rejectionReason = null;
  }

  const result = await syncTemplateToMarketingOs(agencyId, {
    ...template.toJSON(),
    ...nextData,
  });
  const providerTemplateId = extractProviderTemplateId(result);
  if (providerTemplateId) {
    nextData.metaTemplateId = providerTemplateId;
  }

  return template.update(nextData);
}

/**
 * Duplicate a template.
 */
async function duplicateTemplate(id, agencyId) {
  const template = await MessageTemplate.findOne({ where: { id, agencyId } });
  if (!template) throw new Error('Template not found');

  const data = template.toJSON();
  delete data.id;
  delete data.createdAt;
  delete data.updatedAt;

  return MessageTemplate.create({
    ...data,
    name: `${data.name}_copy_${Date.now()}`,
    displayName: `${data.displayName} (Copy)`,
    status: 'DRAFT',
    metaTemplateId: null,
    usageCount: 0,
  });
}

/**
 * Delete a draft template.
 */
async function deleteTemplate(id, agencyId) {
  const template = await MessageTemplate.findOne({ where: { id, agencyId } });
  if (!template) throw new Error('Template not found');
  await resolveTemplateChannelScope(agencyId, template.channelId, { requireStaff: true });
  if (template.status === 'PENDING') {
    throw new Error('Pending templates cannot be deleted until Meta finishes review');
  }

  const whatsappService = require('./whatsappService');
  try {
    await whatsappService.deleteTemplateFromMeta(agencyId, template);
  } catch (err) {
    console.warn('[TemplateService] Marketing OS template deletion failed:', err.message);
  }

  await template.destroy();
  return { success: true };
}

/**
 * Synchronize templates with Meta (via configured provider).
 */
async function syncTemplates(agencyId) {
  return syncTemplatesForScope(agencyId, {});
}

async function syncTemplatesForScope(agencyId, { channelId } = {}) {
  const channel = await resolveTemplateChannelScope(agencyId, channelId, { requireStaff: true });
  const whatsappService = require('./whatsappService');
  const metaResult = await whatsappService.syncTemplatesWithMeta(agencyId, channel ? { channelId: channel.id } : {});

  const rawTemplates = extractProviderTemplates(metaResult);
  const syncedIds = [];

  for (const rawTemplate of rawTemplates) {
    const mt = normalizeProviderTemplate(rawTemplate);
    if (!mt.name) continue;

    const [template, created] = await MessageTemplate.findOrCreate({
      where: { name: mt.name, agencyId },
      defaults: {
        channelId: channel ? channel.id : null,
        displayName: mt.displayName,
        category: mt.category,
        language: mt.language,
        headerType: mt.headerType,
        headerContent: mt.headerContent,
        templateType: mt.templateType,
        carouselCards: mt.carouselCards,
        body: mt.body,
        footer: mt.footer,
        buttons: mt.buttons,
        variableCount: mt.variableCount,
        sampleVariables: mt.sampleVariables,
        status: mt.status,
        metaTemplateId: mt.id,
        rejectionReason: mt.rejectionReason,
        isPrebuilt: false,
      }
    });

    if (!created) {
      if ((template.channelId || null) !== (channel ? channel.id : null)) {
        continue;
      }
      await template.update({
        channelId: channel ? channel.id : null,
        displayName: mt.displayName || template.displayName,
        category: mt.category,
        language: mt.language,
        headerType: mt.headerType,
        headerContent: mt.headerContent,
        templateType: mt.templateType,
        carouselCards: mt.carouselCards,
        status: mt.status,
        metaTemplateId: mt.id,
        rejectionReason: mt.rejectionReason,
        body: mt.body || template.body,
        footer: mt.footer,
        buttons: mt.buttons,
        variableCount: mt.variableCount,
        sampleVariables: mt.sampleVariables.length ? mt.sampleVariables : template.sampleVariables,
      });
    }
    syncedIds.push(template.id);
  }

  return { success: true, count: rawTemplates.length, syncedIds };
}

/**
 * Submit a template for Meta approval.
 */
async function submitForApproval(id, agencyId) {
  const template = await MessageTemplate.findOne({ where: { id, agencyId } });
  if (!template) throw new Error('Template not found');
  await resolveTemplateChannelScope(agencyId, template.channelId, { requireStaff: true });
  if (template.status === 'PENDING') return template;
  if (!template.body || !template.name) throw new Error('Template is incomplete');
  const normalizedTemplate = {
    ...template.toJSON(),
    ...buildTemplateData(template.toJSON(), template),
  };
  
  const whatsappService = require('./whatsappService');
  
  try {
    const result = await syncTemplateToMarketingOs(agencyId, normalizedTemplate);
    const providerTemplateId = extractProviderTemplateId(result);
    if (providerTemplateId) {
      template.metaTemplateId = providerTemplateId;
    }
    await whatsappService.submitTemplateToMeta(agencyId, template);
    return template.update({ status: 'PENDING', rejectionReason: null });
  } catch (err) {
    const message = extractExternalErrorMessage(err);
    console.error('[TemplateService] Meta submission failed:', {
      message,
      status: err?.response?.status || null,
      data: err?.response?.data || null,
    });
    throw Object.assign(new Error(message), {
      statusCode: err?.response?.status || 400,
      code: 'META_TEMPLATE_SUBMISSION_FAILED',
      details: err?.response?.data || null,
    });
  }
}

async function ensureDefaultApprovalTemplatesForAgency(agency) {
  const agencyId = typeof agency === 'string' ? agency : agency?.id;
  const agencyName = typeof agency === 'string' ? 'your travel team' : agency?.name;
  if (!agencyId) throw new Error('Agency ID is required to prepare default templates');

  const results = [];
  const defaults = defaultApprovalTemplatesForAgency(agencyName);

  for (const definition of defaults) {
    const existing = await MessageTemplate.findOne({
      where: { agencyId, name: definition.name },
    });

    if (existing) {
      if (['APPROVED', 'PENDING'].includes(existing.status)) {
        results.push({ name: existing.name, status: existing.status, skipped: true });
        continue;
      }

      try {
        const submitted = await submitForApproval(existing.id, agencyId);
        results.push({ name: submitted.name, status: submitted.status, submitted: true });
      } catch (err) {
        await existing.update({ rejectionReason: err.message }).catch(() => {});
        results.push({ name: existing.name, status: existing.status, error: err.message });
      }
      continue;
    }

    let template = null;
    try {
      const payload = buildTemplateData(definition);
      template = await MessageTemplate.create({
        ...payload,
        name: definition.name,
        agencyId,
        isPrebuilt: false,
        status: 'DRAFT',
        metaTemplateId: null,
        usageCount: 0,
      });

      const submitted = await submitForApproval(template.id, agencyId);
      results.push({ name: submitted.name, status: submitted.status, created: true, submitted: true });
    } catch (err) {
      if (template) {
        await template.update({ status: 'DRAFT', rejectionReason: err.message }).catch(() => {});
        results.push({ name: template.name, status: 'DRAFT', created: true, error: err.message });
      } else {
        results.push({ name: definition.name, error: err.message });
      }
    }
  }

  return {
    success: results.every((result) => !result.error),
    count: results.length,
    submitted: results.filter((result) => result.submitted).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: results.filter((result) => result.error).length,
    results,
  };
}

module.exports = {
  seedPrebuiltTemplates,
  ensureDefaultApprovalTemplatesForAgency,
  listPrebuiltTemplates,
  listAgencyTemplates,
  getTemplate,
  createTemplate,
  usePrebuiltTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
  submitForApproval,
  syncTemplates,
  syncTemplatesForScope,
};
