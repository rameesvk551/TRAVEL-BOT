// FILE: /backend/src/services/templateService.ts

const { Op } = require('sequelize');
const { MessageTemplate } = require('../models');

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

/**
 * Ensures prebuilt templates exist in the database.
 */
async function seedPrebuiltTemplates() {
  for (const tpl of PREBUILT_TEMPLATES) {
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
    }
  }
  console.log(`[TemplateService] Seeded ${PREBUILT_TEMPLATES.length} prebuilt templates.`);
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

function normalizeButtons(buttons) {
  if (!Array.isArray(buttons)) return [];
  return buttons
    .map((button) => ({
      type: String(button.type || 'QUICK_REPLY').toUpperCase(),
      text: String(button.text || button.title || '').trim(),
      url: button.url || null,
      phoneNumber: button.phoneNumber || button.phone_number || null,
    }))
    .filter((button) => button.text);
}

function extractBodyFromComponents(components = []) {
  if (!Array.isArray(components)) return '';
  return components.find((component) => String(component.type || '').toUpperCase() === 'BODY')?.text || '';
}

function normalizeProviderTemplate(mt) {
  const name = mt.name || mt.templateName || mt.template_name;
  const body = mt.body
    || mt.bodyContent
    || mt.body_content
    || extractBodyFromComponents(mt.components)
    || '';
  const status = normalizeStatus(mt.status);

  return {
    id: mt.id || mt.metaTemplateId || mt.meta_template_id || name,
    name,
    displayName: mt.displayName || mt.display_name || String(name || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    category: normalizeCategory(mt.category),
    language: mt.language || mt.languageCode || mt.language_code || 'en',
    headerType: normalizeHeaderType(mt.headerType || mt.header_type),
    headerContent: mt.headerContent || mt.header_content || null,
    body,
    footer: mt.footer || mt.footerContent || mt.footer_content || null,
    buttons: normalizeButtons(mt.buttons),
    status,
    rejectionReason: status === 'REJECTED' ? (mt.rejectionReason || mt.rejection_reason || mt.rejected_reason || null) : null,
    variableCount: mt.variableCount || mt.variable_count || countBodyVariables(body),
    sampleVariables: Array.isArray(mt.variables) ? mt.variables : [],
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
  const body = data.body ?? existing?.body ?? '';
  const variableCount = countBodyVariables(body);

  return {
    displayName: String(data.displayName ?? existing?.displayName ?? '').trim(),
    name: data.name || existing?.name,
    category: normalizeCategory(data.category ?? existing?.category),
    language: data.language || existing?.language || 'en',
    headerType: normalizeHeaderType(data.headerType ?? existing?.headerType),
    headerContent: data.headerContent ?? existing?.headerContent ?? null,
    body,
    footer: data.footer ?? existing?.footer ?? null,
    buttons: normalizeButtons(data.buttons ?? existing?.buttons),
    variableCount,
    sampleVariables: Array.isArray(data.sampleVariables)
      ? data.sampleVariables
      : (existing?.sampleVariables || Array.from({ length: variableCount }, (_, index) => `Sample ${index + 1}`)),
    tags: Array.isArray(data.tags) ? data.tags : (existing?.tags || []),
    icon: data.icon ?? existing?.icon ?? '💬',
  };
}

async function syncTemplateToMarketingOs(agencyId, template, options = {}) {
  const whatsappService = require('./whatsappService');
  return whatsappService.upsertTemplateWithMeta(agencyId, template, options);
}

function extractProviderTemplateId(result) {
  return result?.data?.id || result?.data?.data?.id || result?.id || result?.template?.id || null;
}

/**
 * List prebuilt template library.
 */
async function listPrebuiltTemplates({ category, tag, search } = {}) {
  const where = { isPrebuilt: true, agencyId: null };
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
async function listAgencyTemplates(agencyId, { status, category, search } = {}) {
  const where = { agencyId };
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
  const payload = buildTemplateData(data);
  if (!payload.displayName) throw new Error('Template display name is required');
  if (!payload.body) throw new Error('Template body is required');
  payload.name = await makeUniqueTemplateName(agencyId, payload.name || payload.displayName);

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
  const whatsappService = require('./whatsappService');
  const metaResult = await whatsappService.syncTemplatesWithMeta(agencyId);

  const rawTemplates = extractProviderTemplates(metaResult);
  const syncedIds = [];

  for (const rawTemplate of rawTemplates) {
    const mt = normalizeProviderTemplate(rawTemplate);
    if (!mt.name) continue;

    const [template, created] = await MessageTemplate.findOrCreate({
      where: { name: mt.name, agencyId },
      defaults: {
        displayName: mt.displayName,
        category: mt.category,
        language: mt.language,
        headerType: mt.headerType,
        headerContent: mt.headerContent,
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
      await template.update({
        displayName: mt.displayName || template.displayName,
        category: mt.category,
        language: mt.language,
        headerType: mt.headerType,
        headerContent: mt.headerContent,
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
  if (template.status === 'PENDING') return template;
  if (!template.body || !template.name) throw new Error('Template is incomplete');
  
  const whatsappService = require('./whatsappService');
  
  try {
    const result = await syncTemplateToMarketingOs(agencyId, template);
    const providerTemplateId = extractProviderTemplateId(result);
    if (providerTemplateId) {
      template.metaTemplateId = providerTemplateId;
    }
    await whatsappService.submitTemplateToMeta(agencyId, template);
    return template.update({ status: 'PENDING', rejectionReason: null });
  } catch (err) {
    console.error('[TemplateService] Meta submission failed:', err.message);
    throw err;
  }
}

module.exports = {
  seedPrebuiltTemplates,
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
};
