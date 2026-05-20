const http = require('http');
const https = require('https');
const path = require('path');
const { Op } = require('sequelize');
const {
  Package,
  Booking,
  Lead,
  Customer,
  Agent,
  Property,
  CampaignRecipient,
  WhatsAppFlow,
} = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));
const serviceRoutingService = require(path.resolve(__dirname, '../../../backend/src/services/serviceRoutingService.ts'));
const { updateSession } = require('../utils/sessionManager');
const templates = require('../utils/messageTemplates');
const {
  sendAgentLeadAssignment,
  sendAgentTalkToAgentIntent,
} = require('../utils/agentNotificationSender');

const STEPS = {
  MENU: 'MENU',
  SERVICE_DETAILS: 'SERVICE_DETAILS',
  CATEGORY_PACKAGES: 'CATEGORY_PACKAGES',
  PROPERTY_LIST: 'PROPERTY_LIST',
  PACKAGE_DETAIL: 'PACKAGE_DETAIL',
  PROPERTY_DETAIL: 'PROPERTY_DETAIL',
  ENQUIRY_NAME: 'ENQUIRY_NAME',
  ENQUIRY_PLACE: 'ENQUIRY_PLACE',
  ENQUIRY_ADDRESS: 'ENQUIRY_ADDRESS',
  ENQUIRY_DATE: 'ENQUIRY_DATE',
  ENQUIRY_TRAVELLERS: 'ENQUIRY_TRAVELLERS',
  ENQUIRY_NOTES: 'ENQUIRY_NOTES',
  COMPLETE: 'COMPLETE',
};

const FLOW_FIRST_SCREEN_ID = process.env.WHATSAPP_TRIP_FLOW_FIRST_SCREEN_ID || 'PACKAGE_SELECTOR';
const FLOW_CTA = process.env.WHATSAPP_TRIP_FLOW_CTA || 'View Packages';
const FLOW_ENQUIRY_ID = normalizeText(process.env.WHATSAPP_TRIP_ENQUIRY_FLOW_ID || '');
const FLOW_ENQUIRY_FIRST_SCREEN_ID = process.env.WHATSAPP_TRIP_FLOW_ENQUIRY_FIRST_SCREEN_ID || 'ENQUIRY_FORM';
const FLOW_ENQUIRY_CTA = process.env.WHATSAPP_TRIP_FLOW_ENQUIRY_CTA || 'Share Enquiry';
const PROPERTY_FLOW_FIRST_SCREEN_ID = process.env.WHATSAPP_PROPERTY_FLOW_FIRST_SCREEN_ID || 'PROPERTY_FILTER';
const CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID = process.env.WHATSAPP_CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID || 'CUSTOM_TRIP_FORM';
const FLOW_PLACEHOLDER_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh8cAAAAASUVORK5CYII=';
const FLOW_IMAGE_TRANSFORM = 'w_400,h_300,c_fill,f_jpg,q_auto';
const PACKAGE_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PACKAGE_BROWSE_LIMIT || '20', 10) || 20);
const PROPERTY_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PROPERTY_BROWSE_LIMIT || '20', 10) || 20);
const FALLBACK_LIST_LIMIT = 10;
const imageCache = new Map();
const DEFAULT_WHATSAPP_MENU_LABELS = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Plan a Trip',
  staycations: 'Staycations',
  flight: 'Flight',
  rail: 'Rail',
  domestic: 'Domestic',
  international: 'International',
  customTrip: 'Custom Trip',
};

const CUSTOM_MENU_TYPES = new Set(['PACKAGE_CATEGORY', 'PROPERTY', 'SERVICE', 'CUSTOM_TRIP']);
const FLOW_ACTIONS = new Set([
  'OPEN_PACKAGE_CATEGORY_MENU',
  'OPEN_PROPERTY_FLOW',
  'OPEN_SERVICE_MENU',
  'OPEN_CUSTOM_TRIP_FLOW',
  'SHOW_TOUR_TYPE_LIST',
  'OPEN_PACKAGE_FLOW',
  'CAPTURE_SERVICE_DETAILS',
]);

function normalizeText(value = '') {
  return String(value || '').trim();
}

function getMenuLabels(agency = {}) {
  const overrides = agency.whatsappMenuLabels && typeof agency.whatsappMenuLabels === 'object'
    ? agency.whatsappMenuLabels
    : {};

  return Object.fromEntries(
    Object.entries(DEFAULT_WHATSAPP_MENU_LABELS).map(([key, fallback]) => {
      const label = normalizeText(overrides[key]).slice(0, 20);
      return [key, label || fallback];
    })
  );
}

function normalizeMenuId(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function getCustomMenuItems(agency = {}) {
  const items = Array.isArray(agency.whatsappMenuConfig) ? agency.whatsappMenuConfig : [];
  const seen = new Set();

  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const type = normalizeText(item.type).toUpperCase();
      if (!CUSTOM_MENU_TYPES.has(type)) return null;

      const title = normalizeText(item.title).slice(0, 24);
      if (!title) return null;

      const value = normalizeText(item.value).slice(0, 80);
      const id = normalizeMenuId(item.id || `${type}_${value || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: normalizeText(item.description).slice(0, 72),
        type,
        value,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function findCustomMenuItem(agency, actionId = '', text = '') {
  const items = getCustomMenuItems(agency);
  const normalizedActionId = normalizeText(actionId);
  const normalizedText = lower(text);

  if (normalizedActionId.startsWith('custom_menu:')) {
    const id = normalizeMenuId(normalizedActionId.slice('custom_menu:'.length));
    return items.find((item) => item.id === id) || null;
  }

  return items.find((item) => lower(item.title) === normalizedText || lower(item.value) === normalizedText) || null;
}

function normalizeFlowKey(value = '') {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function getAgencyFlowConfig(agency = {}) {
  return agency.whatsappFlowConfig && typeof agency.whatsappFlowConfig === 'object' && !Array.isArray(agency.whatsappFlowConfig)
    ? agency.whatsappFlowConfig
    : {};
}

function normalizeFlowMenuItems(items = [], limit = 10) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();

  return items
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const action = normalizeFlowKey(item.action);
      if (!FLOW_ACTIONS.has(action)) return null;

      const title = normalizeText(item.title).slice(0, 24);
      if (!title) return null;

      const category = normalizeFlowKey(item.category);
      const tourType = normalizeFlowKey(item.tourType || item.value);
      const id = normalizeMenuId(item.id || `${action}_${category || tourType || title || index}`);
      if (!id || seen.has(id)) return null;
      seen.add(id);

      return {
        id,
        title,
        description: normalizeText(item.description).slice(0, 72),
        action,
        category,
        tourType,
        value: tourType,
      };
    })
    .filter(Boolean)
    .slice(0, limit);
}

function getFlowWelcomeMenu(agency) {
  return normalizeFlowMenuItems(getAgencyFlowConfig(agency).welcomeMenu, 10);
}

function getFlowPackageCategories(agency) {
  return normalizeFlowMenuItems(getAgencyFlowConfig(agency).packageCategories, 3);
}

function getFlowTourTypes(agency) {
  return normalizeFlowMenuItems(getAgencyFlowConfig(agency).tourTypes, 10);
}

function getFlowServiceMenu(agency) {
  return normalizeFlowMenuItems(getAgencyFlowConfig(agency).serviceMenu, 30);
}

function serviceGroupLabel(serviceGroupKey = '') {
  const labels = {
    VISA_TICKETING: 'Visa & Ticketing',
    SERVICES: 'Services',
    VISA_BORDER: 'Visa & Border',
    VISA_SERVICES: 'Please choose:',
    TICKETS_STAY: 'Tickets & Stay',
    FLIGHT_TICKETS: '✈️ Available Services',
    TOURS_CRUISES: 'Tours & Cruises',
    HOLIDAY_TRIPS: 'Holiday Trips',
    TOUR_PACKAGES: '🏝️ Available Tours',
    TRIPS_TRANSPORT: 'Trips & Transport',
  };
  return labels[serviceGroupKey] || 'Services';
}

function findFlowItem(items = [], actionId = '', text = '', prefix = '') {
  const normalizedActionId = normalizeText(actionId);
  const normalizedText = lower(text);

  if (prefix && normalizedActionId.startsWith(prefix)) {
    const id = normalizeMenuId(normalizedActionId.slice(prefix.length));
    return items.find((item) => item.id === id) || null;
  }

  return items.find((item) => lower(item.title) === normalizedText || lower(item.value) === normalizedText) || null;
}

function renderTemplate(template = '', replacements = {}) {
  return normalizeText(template).replace(/\{customerName\}/g, replacements.customerName || '')
    .replace(/\{agencyName\}/g, replacements.agencyName || '');
}

function getWelcomeMessage(customer, agency) {
  const custom = renderTemplate(agency?.welcomeMessage || '', {
    customerName: firstName(customer),
    agencyName: agency?.name || '',
  });

  if (custom) return custom;

  return [
    `Hi ${firstName(customer)} 👋`,
    `Welcome to ${agency.name} ✈️`,
    'Tell us what you want to explore today.',
    '',
    'How can I help you today?',
  ].join('\n');
}

function uniqueIds(...values) {
  const seen = new Set();
  const ids = [];

  const add = (value) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    if (value && typeof value === 'object') {
      add(value.id || value.itemId || value.value || value.packageId || value.propertyId);
      return;
    }
    const id = normalizeText(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  values.forEach(add);
  return ids;
}

function normalizeSelectedItems(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();

  return items
    .map((item) => ({
      itemType: String(item?.itemType || item?.type || '').trim().toUpperCase(),
      itemId: normalizeText(item?.itemId || item?.id || ''),
    }))
    .filter((item) => ['PACKAGE', 'PROPERTY'].includes(item.itemType) && item.itemId)
    .filter((item) => {
      const key = `${item.itemType}:${item.itemId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildSelectedItems(profile = {}, extra = {}, existingItems = []) {
  const items = normalizeSelectedItems(existingItems);
  const push = (itemType, itemId) => {
    const id = normalizeText(itemId);
    if (!id) return;
    items.push({ itemType, itemId: id });
  };

  uniqueIds(profile.selectedPackageIds, profile.selectedPackageId).forEach((id) => push('PACKAGE', id));
  uniqueIds(profile.selectedPropertyIds, profile.selectedPropertyId).forEach((id) => push('PROPERTY', id));
  normalizeSelectedItems(extra.selectedItems).forEach((item) => push(item.itemType, item.itemId));
  push('PACKAGE', extra.packageId);
  push('PROPERTY', extra.propertyId);

  return normalizeSelectedItems(items);
}

function lower(value = '') {
  return normalizeText(value).toLowerCase();
}

function getContext(customer, agency) {
  return { customerId: customer.id, agencyId: agency.id };
}

function routingIntentLabel(intentKey = '') {
  const normalized = serviceRoutingService.normalizeIntentKey(intentKey);
  if (normalized === 'properties') return 'Properties';
  if (normalized === 'staycations') return 'Staycations';
  if (normalized === 'packages') return 'Packages';
  if (normalized === 'visa') return 'Visa Services';
  return normalizeText(intentKey) || 'Service';
}

function serviceLabel(service = '') {
  const normalized = normalizeText(service).toUpperCase();
  if (normalized === 'RAIL') return 'Rail';
  if (normalized === 'TRAIN') return 'Train';
  if (normalized === 'BUS') return 'Bus';
  if (normalized === 'FLIGHT') return 'Flight';
  return categoryLabel(normalized || 'Service');
}

function normalizeServiceValue(value = '') {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'RAIL') return 'RAIL';
  if (normalized === 'TRAIN') return 'TRAIN';
  if (normalized === 'BUS') return 'BUS';
  if (normalized === 'FLIGHT') return 'FLIGHT';
  return normalized.replace(/[^A-Z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'SERVICE';
}

function readinessAnswerLabel(value = '') {
  return normalizeText(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readinessTravellerNumber(value = '') {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized.includes('FAMILY') || normalized.includes('GROUP')) return null;
  const match = normalized.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function normalizeReadinessPayload(response = {}, readinessFormResponse = {}) {
  const travellerCount = normalizeText(
    response.travellerCount
    || response.travelerCount
    || response.travellers
    || response.travelers
    || readinessFormResponse.travellerCount
    || readinessFormResponse.travelerCount
    || readinessFormResponse.travellers
    || readinessFormResponse.travelers
  );
  const bookingReadiness = normalizeText(
    response.bookingReadiness
    || response.booking_readiness
    || readinessFormResponse.bookingReadiness
    || readinessFormResponse.booking_readiness
  );
  const departureAirport = normalizeText(
    response.departureAirport
    || response.departure_airport
    || readinessFormResponse.departureAirport
    || readinessFormResponse.departure_airport
  );

  return {
    travellerCount,
    bookingReadiness,
    departureAirport,
    hasReadinessFields: !!(travellerCount || bookingReadiness || departureAirport),
  };
}

function resolvePropertyRoutingIntent(agency, text = '') {
  const normalizedText = serviceRoutingService.normalizeIntentKey(text);
  if (normalizedText === 'properties' || normalizedText === 'staycations') return normalizedText;
  const labels = getMenuLabels(agency);
  return serviceRoutingService.normalizeIntentKey(labels.staycations || 'staycations');
}

function encodeFlowTokenPart(value = '') {
  return encodeURIComponent(normalizeText(value));
}

function normalizePropertyFilter(value = '') {
  return normalizeText(value).toLowerCase();
}

function propertyMatchesFilter(property, filters = {}) {
  const typeFilter = normalizePropertyFilter(filters.propertyType || filters.type);
  const locationFilter = normalizePropertyFilter(filters.propertyLocation || filters.location);

  const typeMatches = !typeFilter
    || typeFilter === 'all'
    || normalizePropertyFilter(property?.propertyType) === typeFilter;
  const locationMatches = !locationFilter
    || locationFilter === 'all'
    || normalizePropertyFilter(property?.location) === locationFilter;

  return typeMatches && locationMatches;
}

function logFlowEvent(event, customer, agency, payload = {}) {
  console.log(`[TravelFlow] ${event}`, {
    customerId: customer?.id || null,
    customerPhone: customer?.phone || null,
    agencyId: agency?.id || null,
    ...payload,
  });
}

function escapeMarkdown(text = '') {
  return String(text || '').replace(/\*/g, '＊').trim();
}

function packageDescriptionText(text = '') {
  return escapeMarkdown(text);
}

function phoneDigits(phone = '') {
  return String(phone || '').replace(/\D/g, '');
}

function buildWhatsAppChatLink(phone = '', message = '') {
  const digits = phoneDigits(phone);
  if (!digits) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

function buildSpecialistPrefill({ customer, pkg, campaignName, lead }) {
  return [
    `Hi, I am ${customer?.name || 'interested customer'}.`,
    pkg?.name ? `I want to check availability for ${pkg.name}.` : 'I want to check availability.',
  ].filter(Boolean).join('\n');
}

function formatCurrency(amountPaise) {
  const amount = Number(amountPaise || 0) / 100;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function parseBudgetPaise(value = '') {
  const cleaned = String(value || '').replace(/[₹,\s]|rs\.?/gi, '').trim();
  const amount = parseInt(cleaned, 10);
  if (Number.isNaN(amount) || amount <= 0) return null;
  return amount * 100;
}

function normalizeCategory(value = '') {
  const normalized = lower(value);
  if (normalized === 'domestic') return 'DOMESTIC';
  if (normalized === 'international') return 'INTERNATIONAL';
  const custom = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return custom || null;
}

function categoryLabel(value = '') {
  const normalized = normalizeCategory(value);
  if (normalized === 'INTERNATIONAL') return 'International';
  if (normalized === 'DOMESTIC') return 'Domestic';
  return normalizeText(value || normalized)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Packages';
}

function inferPackageCategory(pkg) {
  const explicit = normalizeCategory(pkg?.category);
  if (explicit) return explicit;

  const searchable = [
    pkg?.name,
    pkg?.summary,
    ...(Array.isArray(pkg?.destinations) ? pkg.destinations : []),
    ...(Array.isArray(pkg?.inclusions) ? pkg.inclusions : []),
  ].join(' ').toLowerCase();

  const domesticKeywords = [
    'india', 'goa', 'kerala', 'munnar', 'alleppey', 'kochi', 'cochin', 'kovalam',
    'himachal', 'manali', 'shimla', 'kashmir', 'srinagar', 'gulmarg', 'pahalgam',
    'jaipur', 'udaipur', 'leh', 'ladakh', 'andaman', 'lakshadweep', 'delhi', 'mumbai',
  ];

  return domesticKeywords.some((keyword) => searchable.includes(keyword))
    ? 'DOMESTIC'
    : 'INTERNATIONAL';
}

function packageMatchesCategory(pkg, category) {
  const normalized = normalizeCategory(category);
  if (!normalized) return true;
  return inferPackageCategory(pkg) === normalized;
}

function packageMatchesTourType(pkg, tourType) {
  const normalized = normalizeFlowKey(tourType);
  if (!normalized) return true;
  return normalizeFlowKey(pkg?.tourType) === normalized;
}

function getProfile(session) {
  const enquiry = session.collectedData?.enquiryDraft || {};

  return {
    packageCategory: session.collectedData?.packageCategory || null,
    packageTourType: session.collectedData?.packageTourType || null,
    packageResults: Array.isArray(session.collectedData?.packageResults)
      ? session.collectedData.packageResults
      : [],
    propertyResults: Array.isArray(session.collectedData?.propertyResults)
      ? session.collectedData.propertyResults
      : [],
    propertyFilter: session.collectedData?.propertyFilter || {},
    selectedPackageId: session.collectedData?.selectedPackageId || null,
    selectedPropertyId: session.collectedData?.selectedPropertyId || null,
    selectedPackageIds: uniqueIds(session.collectedData?.selectedPackageIds, session.collectedData?.selectedPackageId),
    selectedPropertyIds: uniqueIds(session.collectedData?.selectedPropertyIds, session.collectedData?.selectedPropertyId),
    campaignId: session.collectedData?.campaignId || null,
    campaignName: session.collectedData?.campaignName || null,
    activeLeadId: session.collectedData?.activeLeadId || null,
    enquiryDraft: {
      name: enquiry.name || '',
      place: enquiry.place || '',
      address: enquiry.address || '',
      travelDate: enquiry.travelDate || '',
      travellers: enquiry.travellers || null,
      budgetPerPerson: enquiry.budgetPerPerson || null,
      notes: enquiry.notes || '',
    },
  };
}

async function transitionTo(session, nextStep, collectedData = {}) {
  await updateSession(session, {
    currentStep: nextStep,
    failedAttempts: 0,
    collectedData,
  });
}

async function incrementFailedAttempt(session) {
  await updateSession(session, {
    failedAttempts: (session.failedAttempts || 0) + 1,
  });
}

async function sendInvalidChoice(session, customer, agency, fallback = null) {
  await incrementFailedAttempt(session);
  await whatsappService.sendTextMessage(
    customer.phone,
    'Please use one of the options shown in WhatsApp so I can continue smoothly.',
    getContext(customer, agency)
  );

  if (fallback) {
    return fallback();
  }

  return renderCurrentStep(session, customer, agency, { resendOnly: true });
}

async function reopenPackageContext(session, customer, agency, profile = getProfile(session)) {
  if (profile.campaignId) {
    const { showCampaignPackages } = require('./campaignActionHandler');
    return showCampaignPackages(session, profile.campaignId, customer, agency);
  }

  return openPackageFlow(session, customer, agency, profile.packageCategory || 'DOMESTIC', profile.packageTourType || null);
}

async function reopenPropertyContext(session, customer, agency) {
  const profile = getProfile(session);
  return openPropertyFlow(session, customer, agency, profile.propertyFilter?.routingIntentKey || undefined, profile.propertyFilter || {});
}

function firstName(customer) {
  const name = normalizeText(customer?.name);
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

function buildHighlights(pkg) {
  const highlights = Array.isArray(pkg?.inclusions) && pkg.inclusions.length
    ? pkg.inclusions.slice(0, 4)
    : Array.isArray(pkg?.itinerary) && pkg.itinerary.length
      ? pkg.itinerary.slice(0, 4).map((day) => day.title || day.description).filter(Boolean)
      : Array.isArray(pkg?.destinations) && pkg.destinations.length
        ? pkg.destinations.slice(0, 4)
        : ['Hotel stay', 'Sightseeing', 'Curated support'];

  return highlights.map((item) => `• ${escapeMarkdown(item)}`).join('\n');
}

function buildShortDescription(pkg) {
  const summary = packageDescriptionText(pkg?.summary || '');
  if (summary) return summary.slice(0, 180);

  if (Array.isArray(pkg?.inclusions) && pkg.inclusions.length) {
    return packageDescriptionText(pkg.inclusions.slice(0, 3).join(', ')).slice(0, 180);
  }

  return 'Curated holiday package with handpicked stays and experiences.';
}

function buildPackageCaption(pkg) {
  return [
    `🌴 ${escapeMarkdown(pkg.name)}`,
    '',
    `💰 ${formatCurrency(pkg.basePrice)}`,
    `📅 ${escapeMarkdown(pkg.duration || 'Custom itinerary')}`,
    '',
    buildShortDescription(pkg),
    '',
    '✨ Highlights:',
    buildHighlights(pkg),
  ].join('\n');
}

function normalizePackageList(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== 'object') return packageDescriptionText(item || '');
      return packageDescriptionText(item.title || item.name || item.description || item.text || '');
    })
    .filter(Boolean);
}

function buildPackageSection(title, items = []) {
  const values = normalizePackageList(items);
  if (!values.length) return null;
  return [title, ...values.map((item) => `• ${item}`)].join('\n');
}

function buildItinerarySection(itinerary = []) {
  if (!Array.isArray(itinerary) || !itinerary.length) return null;

  const days = itinerary
    .map((day, index) => {
      if (!day || typeof day !== 'object') return `Day ${index + 1}: ${escapeMarkdown(day || '')}`;
      const label = day.day ? `Day ${day.day}` : `Day ${index + 1}`;
      const title = escapeMarkdown(day.title || '');
      const description = packageDescriptionText(day.description || '');
      const activities = normalizePackageList(day.activities);
      return [
        `${label}${title ? `: ${title}` : ''}`,
        description,
        activities.length ? activities.map((item) => `  • ${item}`).join('\n') : '',
      ].filter(Boolean).join('\n');
    })
    .filter(Boolean);

  if (!days.length) return null;
  return ['Itinerary:', ...days].join('\n');
}

function buildFullPackageCaption(pkg) {
  const destinations = normalizePackageList(pkg?.destinations);
  const summary = packageDescriptionText(pkg?.summary || '');
  const sections = [
    destinations.length ? `Destination: ${destinations.join(', ')}` : null,
    summary ? `Description:\n${summary}` : null,
    buildItinerarySection(pkg?.itinerary),
    buildPackageSection('Inclusions:', pkg?.inclusions),
    buildPackageSection('Exclusions:', pkg?.exclusions),
  ].filter(Boolean);

  return [
    `${escapeMarkdown(pkg.name)}`,
    '',
    `Price: ${formatCurrency(pkg.basePrice)}`,
    pkg.duration ? `Duration: ${escapeMarkdown(pkg.duration)}` : null,
    '',
    ...sections,
  ].filter((line) => line !== null && line !== undefined && line !== '').join('\n');
}

function buildPackageActionsFallbackText(pkg, agency) {
  const lines = [
    'Choose what you want to do next:',
    '1. Enquiry',
    `2. Call Now (${agency.phone || agency.whatsappNumber})`,
  ];

  if (pkg?.brochureUrl) {
    lines.push('3. Download Itinerary');
    lines.push('4. Back to Packages');
  } else {
    lines.push('3. Back to Packages');
  }

  lines.push('');
  lines.push('Reply with the number of your choice.');
  return lines.join('\n');
}

function buildPackageListSections(category, packages) {
  return [
    {
      title: 'Options',
      rows: packages.map(({ pkg }) => ({
        id: `pkg_pick:${pkg.id}`,
        title: escapeMarkdown(pkg.name).slice(0, 24) || 'Travel Package',
        description: `${formatCurrency(pkg.basePrice)} • ${escapeMarkdown(pkg.duration || 'Custom itinerary')}`.slice(0, 72),
      })),
    },
    {
      title: 'Navigation',
      rows: [
        { id: 'global_go_back', title: 'Go Back', description: 'Return to previous step' },
        { id: 'global_main_menu', title: 'Main Menu', description: 'Start over anytime' },
      ],
    },
  ];
}

function safePdfName(pkg) {
  const base = normalizeText(pkg?.brochureFileName)
    || `${normalizeText(pkg?.name || 'package').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.pdf`;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function getAgencyTripFlowId(agency) {
  return normalizeText(agency?.whatsappTripFlowId)
    || normalizeText(process.env.WHATSAPP_TRIP_FLOW_ID);
}

async function getPublishedFlowByType(agencyId, flowType) {
  if (!agencyId || !flowType) return null;
  const flows = await WhatsAppFlow.findAll({
    where: {
      agencyId,
      flowType,
      status: 'PUBLISHED',
      metaFlowId: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });

  return flows.find((flow) => Array.isArray(flow.jsonDefinition?.screens) && flow.jsonDefinition.screens.length > 0)
    || flows[0]
    || null;
}

async function getPackageFlowConfig(agency) {
  const packageFlow = await getPublishedFlowByType(agency.id, 'PACKAGE');
  const legacyFlowId = getAgencyTripFlowId(agency);
  if (!packageFlow?.metaFlowId && !legacyFlowId) return null;

  return {
    flowId: packageFlow?.metaFlowId || legacyFlowId,
    firstScreenId: packageFlow?.firstScreenId || FLOW_FIRST_SCREEN_ID,
  };
}

async function getPropertyFlowConfig(agency) {
  const propertyFlow = await getPublishedFlowByType(agency.id, 'PROPERTY');
  if (!propertyFlow?.metaFlowId) return null;

  return {
    flowId: propertyFlow.metaFlowId,
    firstScreenId: propertyFlow.firstScreenId || PROPERTY_FLOW_FIRST_SCREEN_ID,
  };
}

async function getCustomTripFlowConfig(agency) {
  const customTripFlow = await getPublishedFlowByType(agency.id, 'CUSTOM_TRIP');
  if (!customTripFlow?.metaFlowId) return null;

  return {
    flowId: customTripFlow.metaFlowId,
    firstScreenId: customTripFlow.firstScreenId || CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
  };
}

async function getEnquiryFlowConfig(agency) {
  const customTripFlow = await getPublishedFlowByType(agency.id, 'CUSTOM_TRIP');
  const legacyFlowId = FLOW_ENQUIRY_ID || getAgencyTripFlowId(agency);
  if (!customTripFlow?.metaFlowId && !legacyFlowId) return null;

  return {
    flowId: legacyFlowId || customTripFlow?.metaFlowId,
    firstScreenId: customTripFlow?.firstScreenId || FLOW_ENQUIRY_FIRST_SCREEN_ID,
  };
}

async function isMetaTripFlowConfigured(agency) {
  return Boolean(await getPackageFlowConfig(agency));
}

function toAbsoluteFlowImageUrl(imageUrl = '') {
  const url = normalizeText(imageUrl);
  if (!url) return '';

  if (url.startsWith('data:image/')) return url;

  if (url.startsWith('/uploads/')) {
    const baseUrl = normalizeText(process.env.BASE_URL);
    if (!baseUrl) return '';
    return `${baseUrl.replace(/\/$/, '')}${url}`;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const cloudName = normalizeText(process.env.CLOUDINARY_CLOUD_NAME);
  if (cloudName) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/${url.replace(/^\/+/, '')}`;
  }

  return '';
}

function addCloudinaryTransform(url) {
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }

  // Always inject our transform so Flow card images stay lightweight and compatible.
  return url.replace('/image/upload/', `/image/upload/${FLOW_IMAGE_TRANSFORM}/`);
}

function normalizeFlowImageUrl(imageUrl = '') {
  const url = toAbsoluteFlowImageUrl(imageUrl);
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  return addCloudinaryTransform(url);
}

function fetchBuffer(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const client = parsed.protocol === 'http:' ? http : https;
    const req = client.get(parsed, (res) => {
      if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (redirects <= 0 || !res.headers.location) {
          reject(new Error('Too many redirects while fetching flow image'));
          return;
        }
        const nextUrl = new URL(res.headers.location, parsed).toString();
        fetchBuffer(nextUrl, redirects - 1).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Image request failed with status ${res.statusCode}`));
        return;
      }

      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          req.destroy(new Error('Image too large for WhatsApp Flow payload'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
  });
}

async function getFlowBase64Image(imageUrl) {
  const normalized = normalizeFlowImageUrl(imageUrl);
  if (!normalized) return FLOW_PLACEHOLDER_IMAGE;

  if (imageCache.has(normalized)) {
    return imageCache.get(normalized);
  }

  if (normalized.startsWith('data:image/')) {
    const [, payload = ''] = normalized.split(',', 2);
    const inlinePayload = payload || FLOW_PLACEHOLDER_IMAGE;
    imageCache.set(normalized, inlinePayload);
    return inlinePayload;
  }

  try {
    const buffer = await fetchBuffer(normalized);
    const encoded = buffer.length ? buffer.toString('base64') : FLOW_PLACEHOLDER_IMAGE;
    imageCache.set(normalized, encoded);
    return encoded;
  } catch (err) {
    console.warn('[TravelFlow] Could not embed package image in flow:', err.message);
    imageCache.set(normalized, FLOW_PLACEHOLDER_IMAGE);
    return FLOW_PLACEHOLDER_IMAGE;
  }
}

async function findPackagesForCategory(agencyId, category, limit = PACKAGE_BROWSE_LIMIT, tourType = null) {
  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });

  const filtered = packages.filter((pkg) => packageMatchesCategory(pkg, category) && packageMatchesTourType(pkg, tourType));
  if (filtered.length === 0) return [];

  const withCounts = await Promise.all(filtered.map(async (pkg) => ({
    pkg,
    bookingCount: await Booking.count({
      where: {
        agencyId,
        packageId: pkg.id,
        status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
      },
    }),
  })));

  return withCounts
    .sort((a, b) => {
      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
      return new Date(b.pkg.createdAt) - new Date(a.pkg.createdAt);
    })
    .slice(0, limit);
}

async function findActiveProperties(agencyId, limit = PROPERTY_BROWSE_LIMIT, filters = {}) {
  const properties = await Property.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
  });

  return properties
    .filter((property) => propertyMatchesFilter(property, filters))
    .slice(0, limit);
}

async function getPackageCategoryCounts(agencyId) {
  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    attributes: ['category', 'name', 'summary', 'destinations', 'inclusions'],
  });

  return packages.reduce((counts, pkg) => {
    const category = inferPackageCategory(pkg);
    if (category === 'INTERNATIONAL') counts.international += 1;
    else counts.domestic += 1;
    return counts;
  }, { domestic: 0, international: 0 });
}

async function getDynamicTourTypesForCategory(agencyId, category, limit = 10) {
  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    attributes: ['category', 'name', 'summary', 'destinations', 'inclusions', 'tourType'],
    order: [['createdAt', 'DESC']],
  });

  const grouped = new Map();
  for (const pkg of packages) {
    if (!packageMatchesCategory(pkg, category)) continue;
    const tourType = normalizeFlowKey(pkg.tourType);
    if (!tourType) continue;

    const existing = grouped.get(tourType) || {
      id: `dynamic_${normalizeMenuId(tourType)}`,
      title: categoryLabel(tourType).slice(0, 24),
      description: '',
      action: 'OPEN_PACKAGE_FLOW',
      tourType,
      value: tourType,
      count: 0,
    };
    existing.count += 1;
    existing.description = `${existing.count} package${existing.count === 1 ? '' : 's'} available`;
    grouped.set(tourType, existing);
  }

  return Array.from(grouped.values()).slice(0, limit);
}

async function buildFlowPackageOptions(packages) {
  return Promise.all(packages.map(async ({ pkg }) => ({
    id: pkg.id,
    title: escapeMarkdown(pkg.name).slice(0, 30) || 'Travel Package',
    description: `${formatCurrency(pkg.basePrice)} • ${escapeMarkdown(pkg.duration || 'Custom itinerary')}\n${buildShortDescription(pkg)}`.slice(0, 300),
    metadata: escapeMarkdown(categoryLabel(inferPackageCategory(pkg))).slice(0, 20),
    image: await getFlowBase64Image(pkg.imageUrl),
  })));
}

async function buildFlowPropertyOptions(properties) {
  return Promise.all(properties.map(async (property) => ({
    id: property.id,
    title: escapeMarkdown(property.name).slice(0, 30) || 'Property',
    description: `${property.pricePerNight ? `${formatCurrency(property.pricePerNight)}/night` : 'Price on request'} â€¢ ${escapeMarkdown(property.location || 'Selected destination')}\n${escapeMarkdown(property.description || `${property.propertyType || 'Property'} stay with curated support`).slice(0, 180)}`.slice(0, 300),
    metadata: escapeMarkdown([property.propertyType || 'Property', property.location || ''].filter(Boolean).join(' - ')).slice(0, 20),
    image: await getFlowBase64Image(property.imageUrl),
  })));
}

function buildFlowPropertyLocationOptions(properties) {
  const seen = new Set();
  const locations = [];

  for (const property of properties || []) {
    const location = escapeMarkdown(property?.location || '').trim();
    if (!location) continue;

    const key = location.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    locations.push({
      id: location,
      title: location.slice(0, 30),
    });
  }

  return [
    { id: 'ALL', title: 'All locations' },
    ...locations,
  ];
}

function buildFlowPropertyTypeOptions(properties) {
  const seen = new Set();
  const propertyTypes = [];

  for (const property of properties || []) {
    const propertyType = escapeMarkdown(property?.propertyType || '').trim();
    if (!propertyType) continue;

    const key = propertyType.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    propertyTypes.push({
      id: propertyType,
      title: propertyType.slice(0, 30),
    });
  }

  return [
    { id: 'ALL', title: 'All stay types' },
    ...propertyTypes,
  ];
}

function buildFilteredPropertyTypeOptions(properties, filters = {}) {
  const propertyType = normalizeText(filters.propertyType || filters.type);
  if (!propertyType) return buildFlowPropertyTypeOptions(properties);
  return [{ id: propertyType, title: propertyType.slice(0, 30) }];
}

async function findActiveLead(session, customer, agency) {
  const profile = getProfile(session);

  if (profile.activeLeadId) {
    const existing = await Lead.findOne({
      where: { id: profile.activeLeadId, agencyId: agency.id },
    });
    if (existing) return existing;
  }

  const latest = await Lead.findOne({
    where: {
      customerId: customer.id,
      agencyId: agency.id,
      status: { [Op.in]: ['JUST_CONTACTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
    },
    order: [['createdAt', 'DESC']],
  });

  if (latest) {
    await updateSession(session, {
      collectedData: { activeLeadId: latest.id },
    });
  }

  return latest;
}

async function ensureLead(session, customer, agency, extra = {}) {
  let lead = await findActiveLead(session, customer, agency);
  const profile = getProfile(session);
  const routingIntentKey = serviceRoutingService.normalizeIntentKey(extra.routingIntentKey || '');
  const selectedItems = buildSelectedItems(profile, extra, lead?.selectedItems);
  const firstSelectedPackageId = selectedItems.find((item) => item.itemType === 'PACKAGE')?.itemId || null;
  const firstSelectedPropertyId = selectedItems.find((item) => item.itemType === 'PROPERTY')?.itemId || null;
  const primaryPackageId = extra.packageId || profile.selectedPackageId || firstSelectedPackageId || null;
  const primaryPropertyId = extra.propertyId || profile.selectedPropertyId || firstSelectedPropertyId || null;
  const pkg = primaryPackageId
    ? await Package.findOne({ where: { id: primaryPackageId, agencyId: agency.id } })
    : null;
  const property = primaryPropertyId
    ? await Property.findOne({ where: { id: primaryPropertyId, agencyId: agency.id } })
    : null;
  const validPackageId = pkg?.id || null;
  const validPropertyId = property?.id || null;
  const validSelectedItems = selectedItems.filter((item) => {
    if (item.itemType === 'PACKAGE') return item.itemId !== primaryPackageId || !!validPackageId;
    if (item.itemType === 'PROPERTY') return item.itemId !== primaryPropertyId || !!validPropertyId;
    return true;
  });

  const notes = [
    extra.notes || null,
    extra.note || null,
  ].filter(Boolean).join(' | ');
  const customerName = normalizeText(customer?.name || profile.enquiryDraft.name || '');
  const baseCustomTripDetails = customerName ? { name: customerName } : {};

  if (!lead) {
    lead = await leadService.createLead({
      customerId: customer.id,
      packageId: validPackageId,
      propertyId: validPropertyId,
      selectedItems: validSelectedItems,
      itemType: extra.itemType || (validPropertyId ? 'PROPERTY' : validPackageId ? 'PACKAGE' : null),
      campaignId: extra.campaignId || profile.campaignId || null,
      campaignName: extra.campaignName || null,
      campaignAction: extra.campaignAction || null,
      destination: extra.destination || pkg?.destinations?.[0] || null,
      travelDates: extra.travelDates || null,
      travellers: extra.travellers || null,
      budgetPerPerson: extra.budgetPerPerson || null,
      interest: extra.interest || null,
      customTripDetails: {
        ...baseCustomTripDetails,
        ...(extra.customTripDetails || {}),
        ...(routingIntentKey ? {
          routingIntentKey,
          routingIntentLabel: routingIntentLabel(routingIntentKey),
        } : {}),
      },
      status: extra.status || 'NEW',
      notes: notes || 'Lead created from WhatsApp sales funnel',
    }, agency.id);
  } else {
    const nextStatus = extra.preserveExistingStatus
      ? lead.status || 'NEW'
      : (extra.status || lead.status || 'NEW');

    const updates = {
      packageId: validPackageId || lead.packageId || null,
      propertyId: validPropertyId || lead.propertyId || null,
      selectedItems: validSelectedItems,
      itemType: extra.itemType || lead.itemType || (validPropertyId ? 'PROPERTY' : validPackageId ? 'PACKAGE' : null),
      campaignId: extra.campaignId || profile.campaignId || lead.campaignId || null,
      campaignName: extra.campaignName || lead.campaignName || null,
      campaignAction: extra.campaignAction || lead.campaignAction || null,
      destination: extra.destination || lead.destination || pkg?.destinations?.[0] || null,
      travelDates: extra.travelDates || lead.travelDates || null,
      travellers: extra.travellers || lead.travellers || null,
      budgetPerPerson: extra.budgetPerPerson || lead.budgetPerPerson || null,
      interest: extra.interest || lead.interest || null,
      customTripDetails: (extra.customTripDetails || routingIntentKey)
        ? {
          ...(lead.customTripDetails || {}),
          ...baseCustomTripDetails,
          ...extra.customTripDetails,
          ...(routingIntentKey ? {
            routingIntentKey,
            routingIntentLabel: routingIntentLabel(routingIntentKey),
          } : {}),
        }
        : (lead.customTripDetails || {}),
      status: nextStatus,
      notes: [lead.notes, notes].filter(Boolean).join(' | '),
    };
    lead = await leadService.updateLead(lead.id, agency.id, updates);
  }

  if (routingIntentKey) {
    const assignment = await serviceRoutingService.assignLeadToIntentAgent(lead, agency.id, routingIntentKey);
    lead = assignment.lead || lead;
    if (assignment.changed) {
      await notifyAgentOfServiceIntentSelection(assignment.agent, lead, customer, agency, routingIntentKey).catch((err) => {
        console.warn('[TravelFlow] Could not notify routed service agent:', err.message);
      });
    }
  }

  await updateSession(session, {
    collectedData: { activeLeadId: lead.id },
  });

  return lead;
}

async function notifyAgentOfServiceIntentSelection(agent, lead, customer, agency, intentKey) {
  if (!agent?.phone || !lead?.id) return;

  const label = routingIntentLabel(intentKey);
  const notification = [
    `New ${label} lead`,
    '',
    `Customer: ${customer?.name || 'Unknown'}`,
    `Phone: ${customer?.phone || 'Unknown'}`,
    `Lead ID: ${lead.id}`,
    '',
    'The lead has been auto-assigned to you.',
  ].join('\n');

  await whatsappService.sendSystemNotificationWhatsApp(
    agent.phone,
    notification,
    { customerId: customer.id, agencyId: agency.id }
  );

  logFlowEvent('service_intent_agent_notified', customer, agency, {
    leadId: lead.id,
    agentId: agent.id,
    intentKey: serviceRoutingService.normalizeIntentKey(intentKey),
  });
}

function buildProfileSummary(profile) {
  const parts = [];
  if (profile.packageCategory) parts.push(`Category: ${categoryLabel(profile.packageCategory)}`);
  if (profile.selectedPackageId) parts.push('Package selected');
  if (profile.enquiryDraft.place) parts.push(`Place: ${profile.enquiryDraft.place}`);
  if (profile.enquiryDraft.travelDate) parts.push(`Date: ${profile.enquiryDraft.travelDate}`);
  if (profile.enquiryDraft.travellers) parts.push(`Travellers: ${profile.enquiryDraft.travellers}`);
  return parts.join(', ');
}

function buildCustomTripDetails(enquiry = {}, profile = {}) {
  const budgetText = enquiry.budgetPerPerson
    ? `₹${Math.round(Number(enquiry.budgetPerPerson) / 100).toLocaleString('en-IN')}`
    : '';
  const details = {
    name: enquiry.name || '',
    destination: enquiry.place || '',
    travelDate: enquiry.travelDate || '',
    travellers: enquiry.travellers || null,
    travellersText: enquiry.travellers ? String(enquiry.travellers) : '',
    budgetPerPerson: enquiry.budgetPerPerson || null,
    budgetText,
    notes: enquiry.notes || '',
    campaignName: profile.campaignName || '',
    source: profile.campaignId ? 'whatsapp_campaign_custom_trip_flow' : 'whatsapp_custom_trip_flow',
    submittedAt: new Date().toISOString(),
  };

  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

async function createFreshGreetingLead(session, customer) {
  await updateSession(session, {
    isHandedOff: false,
    handedOffAt: null,
    handedOffToId: null,
    currentStep: STEPS.MENU,
    failedAttempts: 0,
    collectedData: {
      menuContext: null,
      planTripOptions: [],
      serviceCategory: null,
      selectedService: null,
      packageCategory: null,
      packageResults: [],
      propertyResults: [],
      selectedPackageId: null,
      selectedPropertyId: null,
      selectedPackageIds: [],
      selectedPropertyIds: [],
      enquiryDraft: {},
    },
  });

  if (customer?.name) {
    await updateSession(session, {
      collectedData: {
        enquiryDraft: { name: customer.name },
      },
    });
  }
}

async function showMainMenu(session, customer, agency) {
  const flowWelcomeMenu = getFlowWelcomeMenu(agency);
  const customMenuItems = getCustomMenuItems(agency);
  const welcomeOptions = flowWelcomeMenu.length
    ? flowWelcomeMenu.map((item) => `flow_welcome:${item.id}`)
    : customMenuItems.length
      ? customMenuItems.map((item) => `custom_menu:${item.id}`)
      : [];

  await transitionTo(session, STEPS.MENU, {
    menuContext: 'WELCOME',
    menuOptions: welcomeOptions,
    packageCategory: null,
    packageTourType: null,
    packageResults: [],
    propertyResults: [],
    selectedPackageId: null,
    selectedPropertyId: null,
    selectedPackageIds: [],
    selectedPropertyIds: [],
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  if (flowWelcomeMenu.length) {
    const buttons = flowWelcomeMenu.slice(0, 3).map((item) => ({
      id: `flow_welcome:${item.id}`,
      title: item.title,
    }));

    if (flowWelcomeMenu.length <= 3) {
      return whatsappService.sendButtonsMessage(
        customer.phone,
        getWelcomeMessage(customer, agency),
        buttons,
        getContext(customer, agency),
        {
          footerText: 'Reply Hi anytime to restart.',
        }
      );
    }

    return whatsappService.sendListMessage(
      customer.phone,
      getWelcomeMessage(customer, agency),
      'Choose Option',
      [
        {
          title: 'Menu',
          rows: flowWelcomeMenu.map((item) => ({
            id: `flow_welcome:${item.id}`,
            title: item.title,
            description: item.description || item.action.replace(/_/g, ' ').toLowerCase(),
          })),
        },
      ],
      getContext(customer, agency),
      {
        footerText: 'Reply Hi anytime to restart.',
      }
    );
  }

  if (customMenuItems.length) {
    return whatsappService.sendListMessage(
      customer.phone,
      getWelcomeMessage(customer, agency),
      'Choose Option',
      [
        {
          title: 'Services',
          rows: customMenuItems.map((item) => ({
            id: `custom_menu:${item.id}`,
            title: item.title,
            description: item.description || serviceLabel(item.value || item.type),
          })),
        },
      ],
      getContext(customer, agency),
      {
        footerText: 'Reply Hi anytime to restart.',
      }
    );
  }

  const labels = getMenuLabels(agency);
  const buttons = [
    { id: 'menu_visa_ticketing', title: labels.visaTicketing },
    { id: 'menu_packages', title: labels.planTrip },
    { id: 'menu_properties', title: labels.staycations },
  ];

  return whatsappService.sendButtonsMessage(
    customer.phone,
    getWelcomeMessage(customer, agency),
    buttons,
    getContext(customer, agency),
    {
      footerText: 'Reply Hi anytime to restart.',
    }
  );
}

async function showVisaTicketingMenu(session, customer, agency) {
  const labels = getMenuLabels(agency);

  await ensureLead(session, customer, agency, {
    routingIntentKey: 'visa',
    interest: 'VISA_TICKETING',
    status: 'NEW',
    campaignAction: 'VISA_TICKETING_MENU',
    customTripDetails: {
      serviceCategory: 'VISA_TICKETING',
    },
    notes: 'Visa services selected from WhatsApp welcome menu',
  });

  await transitionTo(session, STEPS.MENU, {
    menuContext: 'VISA_TICKETING',
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  return whatsappService.sendButtonsMessage(
    customer.phone,
    'Choose the ticketing service you need.',
    [
      { id: 'visa_ticket_flight', title: labels.flight },
      { id: 'visa_ticket_rail', title: labels.rail },
    ],
    getContext(customer, agency),
    {
      headerText: labels.visaTicketing,
      footerText: 'Reply Hi anytime to restart.',
    }
  );
}

async function handleVisaTicketingSelection(session, customer, agency, service) {
  const selectedService = service === 'RAIL' ? 'RAIL' : 'FLIGHT';
  const selectedServiceLabel = serviceLabel(selectedService);

  const lead = await ensureLead(session, customer, agency, {
    interest: `${selectedService}_TICKETING`,
    status: 'ENQUIRY',
    campaignAction: 'VISA_TICKETING',
    customTripDetails: {
      service: selectedService,
      serviceCategory: 'VISA_TICKETING',
    },
    notes: `${selectedServiceLabel} ticketing requested from WhatsApp welcome menu`,
  });

  await updateSession(session, {
    currentStep: STEPS.SERVICE_DETAILS,
    failedAttempts: 0,
    collectedData: {
      activeLeadId: lead.id,
      serviceCategory: 'VISA_TICKETING',
      selectedService,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks. Please share your ${selectedServiceLabel.toLowerCase()} route, date, passenger count, and any visa/ticketing details. Our team will follow up shortly.`,
    getContext(customer, agency)
  );
}

async function handleCustomServiceSelection(session, customer, agency, item) {
  const selectedService = normalizeServiceValue(item.value || item.title);
  const selectedServiceLabel = serviceLabel(item.title || selectedService);
  const routingIntentKey = normalizeText(item.value || item.title).toLowerCase().replace(/[^a-z0-9]+/g, '_');

  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey,
    interest: `${selectedService}_BOOKING`,
    status: 'ENQUIRY',
    campaignAction: 'CUSTOM_SERVICE_MENU',
    customTripDetails: {
      service: selectedService,
      serviceLabel: selectedServiceLabel,
      serviceCategory: 'CUSTOM_SERVICE',
    },
    notes: `${selectedServiceLabel} requested from custom WhatsApp welcome menu`,
  });

  await updateSession(session, {
    currentStep: STEPS.SERVICE_DETAILS,
    failedAttempts: 0,
    collectedData: {
      activeLeadId: lead.id,
      serviceCategory: 'CUSTOM_SERVICE',
      selectedService,
      selectedServiceLabel,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks. Please share your ${selectedServiceLabel.toLowerCase()} route, date, passenger count, and any special requirements. Our team will follow up shortly.`,
    getContext(customer, agency)
  );
}

async function saveServiceDetails(session, incoming, customer, agency) {
  const details = normalizeText(incoming?.text);
  const selectedService = normalizeServiceValue(session.collectedData?.selectedService || 'FLIGHT');
  const selectedServiceLabel = normalizeText(session.collectedData?.selectedServiceLabel) || serviceLabel(selectedService);
  const serviceCategory = normalizeText(session.collectedData?.serviceCategory || 'VISA_TICKETING') || 'VISA_TICKETING';

  if (details.length < 3) {
    return whatsappService.sendTextMessage(
      customer.phone,
      `Please share your ${selectedServiceLabel.toLowerCase()} route, date, and passenger count.`,
      getContext(customer, agency)
    );
  }

  await ensureLead(session, customer, agency, {
    interest: serviceCategory === 'CUSTOM_SERVICE' ? `${selectedService}_BOOKING` : `${selectedService}_TICKETING`,
    status: 'ENQUIRY',
    campaignAction: serviceCategory === 'CUSTOM_SERVICE' ? 'CUSTOM_SERVICE_DETAILS' : 'VISA_TICKETING',
    customTripDetails: {
      service: selectedService,
      serviceLabel: selectedServiceLabel,
      serviceCategory,
      serviceDetails: details,
    },
    notes: `${selectedServiceLabel} details: ${details}`,
  });

  await transitionTo(session, STEPS.COMPLETE, {
    serviceCategory,
    selectedService,
    selectedServiceLabel,
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    'Thanks. Our team has your details and will contact you shortly.',
    getContext(customer, agency)
  );
}

async function showPackageCategoryMenu(session, customer, agency) {
  const configuredCategories = getFlowPackageCategories(agency);
  const counts = await getPackageCategoryCounts(agency.id);
  const hasDomestic = counts.domestic > 0;
  const hasInternational = counts.international > 0;
  const labels = getMenuLabels(agency);

  await ensureLead(session, customer, agency, {
    routingIntentKey: 'packages',
    interest: 'PACKAGES',
    status: 'NEW',
    campaignAction: 'PACKAGES_MENU',
    notes: 'Packages selected from WhatsApp welcome menu',
  });

  const buttons = configuredCategories.length
    ? configuredCategories.map((item) => ({
      id: `flow_package_category:${item.id}`,
      title: item.title,
    }))
    : [
      ...(hasInternational ? [{ id: 'menu_international', title: labels.international }] : []),
      ...(hasDomestic ? [{ id: 'menu_domestic', title: labels.domestic }] : []),
      { id: 'menu_custom_trip', title: labels.customTrip },
    ];

  await transitionTo(session, STEPS.MENU, {
    menuContext: 'PLAN_TRIP',
    planTripOptions: buttons.map((button) => button.id),
    packageCategory: null,
    packageTourType: null,
    packageResults: [],
    propertyResults: [],
    selectedPackageId: null,
    selectedPropertyId: null,
    selectedPackageIds: [],
    selectedPropertyIds: [],
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  return whatsappService.sendButtonsMessage(
    customer.phone,
    'Choose the trip option you want to explore.',
    buttons,
    getContext(customer, agency),
    {
      headerText: labels.planTrip,
      footerText: 'Reply Hi anytime to restart.',
    }
  );
}

async function showTourTypeMenu(session, customer, agency, category) {
  const normalizedCategory = normalizeCategory(category);
  const dynamicTourTypes = await getDynamicTourTypesForCategory(agency.id, normalizedCategory);
  const tourTypes = dynamicTourTypes;

  if (!tourTypes.length) {
    return openPackageFlow(session, customer, agency, normalizedCategory);
  }

  if (tourTypes.length === 1) {
    return openPackageFlow(session, customer, agency, normalizedCategory, tourTypes[0].tourType || tourTypes[0].value);
  }

  await transitionTo(session, STEPS.MENU, {
    menuContext: 'TOUR_TYPE',
    tourTypeOptions: tourTypes.map((item) => `flow_tour_type:${item.id}`),
    tourTypeItems: tourTypes,
    packageCategory: normalizedCategory,
    packageTourType: null,
    packageResults: [],
    selectedPackageId: null,
    selectedPackageIds: [],
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  if (tourTypes.length <= 3) {
    return whatsappService.sendButtonsMessage(
      customer.phone,
      `Choose the ${categoryLabel(normalizedCategory).toLowerCase()} tour type you want.`,
      tourTypes.map((item) => ({
        id: `flow_tour_type:${item.id}`,
        title: item.title,
      })),
      getContext(customer, agency),
      {
        headerText: `${categoryLabel(normalizedCategory)} Packages`,
        footerText: 'Reply Hi anytime to restart.',
      }
    );
  }

  return whatsappService.sendListMessage(
    customer.phone,
    `Choose the ${categoryLabel(normalizedCategory).toLowerCase()} tour type you want.`,
    'Tour Type',
    [
      {
        title: categoryLabel(normalizedCategory),
        rows: tourTypes.map((item) => ({
          id: `flow_tour_type:${item.id}`,
          title: item.title,
          description: item.description || 'Show matching packages',
        })),
      },
    ],
    getContext(customer, agency),
    {
      headerText: `${categoryLabel(normalizedCategory)} Packages`,
      footerText: 'Reply Hi anytime to restart.',
    }
  );
}

async function showPackageListFallback(session, customer, agency, category, packages) {
  await whatsappService.sendTextMessage(
    customer.phone,
    `Browse our best ${categoryLabel(category)} packages 👇`,
    getContext(customer, agency)
  );

  await whatsappService.sendListMessage(
    customer.phone,
    'Tap a package below to view details.',
    'Select Package',
    buildPackageListSections(category, packages.slice(0, FALLBACK_LIST_LIMIT)),
    getContext(customer, agency),
    {
      headerText: `${categoryLabel(category)} Packages`,
      footerText: 'Tap a package to continue.',
    }
  );
}

async function showPropertyListFallback(session, customer, agency, properties) {
  await whatsappService.sendTextMessage(
    customer.phone,
    'Browse our available properties below.',
    getContext(customer, agency)
  );

  await whatsappService.sendListMessage(
    customer.phone,
    'Tap a property below to view details.',
    'Select Property',
    buildPropertyListSections(properties),
    getContext(customer, agency),
    {
      headerText: 'Properties',
      footerText: 'Tap a property to continue.',
    }
  );
}

async function openPackageFlow(session, customer, agency, category, tourType = null) {
  const normalizedCategory = normalizeCategory(category);
  const normalizedTourType = normalizeFlowKey(tourType);
  const packages = await findPackagesForCategory(agency.id, normalizedCategory, PACKAGE_BROWSE_LIMIT, normalizedTourType);
  const tourTypeLabel = normalizedTourType ? categoryLabel(normalizedTourType) : '';

  await ensureLead(session, customer, agency, {
    interest: normalizedTourType || normalizedCategory,
    customTripDetails: {
      packageCategory: normalizedCategory,
      packageTourType: normalizedTourType,
    },
    notes: `Category selected: ${categoryLabel(normalizedCategory)}${tourTypeLabel ? ` / ${tourTypeLabel}` : ''}`,
  });

  await transitionTo(session, STEPS.CATEGORY_PACKAGES, {
    packageCategory: normalizedCategory,
    packageTourType: normalizedTourType,
    packageResults: packages.map(({ pkg }) => pkg.id),
    selectedPackageId: null,
    selectedPackageIds: [],
  });

  if (packages.length === 0) {
    await whatsappService.sendTextMessage(
      customer.phone,
      `We do not have active ${[tourTypeLabel, categoryLabel(normalizedCategory).toLowerCase()].filter(Boolean).join(' ')} packages right now. Our expert can still curate options for you.`,
      getContext(customer, agency)
    );
    return;
  }

  const packageFlowConfig = await getPackageFlowConfig(agency);
  if (!packageFlowConfig?.flowId) {
    console.error('[TravelFlow] package_flow_missing', { agencyId: agency.id, agencyName: agency.name });
    return showPackageListFallback(session, customer, agency, normalizedCategory, packages);
  }

  const packageOptions = await buildFlowPackageOptions(packages);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    `Browse our best ${[tourTypeLabel, categoryLabel(normalizedCategory)].filter(Boolean).join(' ')} packages 👇`,
    {
      flowId: packageFlowConfig.flowId,
      firstScreenId: packageFlowConfig.firstScreenId || FLOW_FIRST_SCREEN_ID,
      flowCta: FLOW_CTA,
      flowToken: `pkg|${agency.id}|${normalizedCategory || 'DOMESTIC'}|${customer.id}|${Date.now()}|${encodeFlowTokenPart(normalizedTourType)}`,
      data: {
        category_label: [tourTypeLabel, categoryLabel(normalizedCategory)].filter(Boolean).join(' '),
        package_options: packageOptions,
      },
    },
    getContext(customer, agency),
    {
      headerText: `${[tourTypeLabel, categoryLabel(normalizedCategory)].filter(Boolean).join(' ')} Packages`,
      footerText: 'Reply LIST if the flow does not open.',
    }
  );

  if (flowResponse?.status === 'FAILED') {
    console.error('[TravelFlow] package_flow_send_failed', {
      agencyId: agency.id,
      flowId: packageFlowConfig.flowId,
      firstScreenId: packageFlowConfig.firstScreenId || FLOW_FIRST_SCREEN_ID,
    });
    return flowResponse;
  }

  return flowResponse;
}

async function openPropertyFlow(session, customer, agency, routingIntentKey = 'staycations', filters = {}) {
  const propertyType = normalizeText(filters.propertyType || filters.type || '');
  const propertyLocation = normalizeText(filters.propertyLocation || filters.location || '');
  const propertyFilter = {
    routingIntentKey,
    ...(propertyType ? { propertyType } : {}),
    ...(propertyLocation ? { propertyLocation } : {}),
  };
  const properties = await findActiveProperties(agency.id, PROPERTY_BROWSE_LIMIT, propertyFilter);
  const propertyLabel = propertyType || 'properties';

  await ensureLead(session, customer, agency, {
    routingIntentKey,
    interest: 'PROPERTY',
    itemType: 'PROPERTY',
    customTripDetails: {
      staycationInterest: 'VIEWED',
      staycationViewedAt: new Date().toISOString(),
      propertyType,
      propertyLocation,
    },
    notes: propertyType ? `${propertyType} properties viewed from WhatsApp menu` : 'Properties viewed from WhatsApp menu',
  });

  await transitionTo(session, STEPS.PROPERTY_LIST, {
    propertyFilter,
    propertyResults: properties.map((property) => property.id),
    selectedPropertyId: null,
    selectedPropertyIds: [],
    selectedPackageId: null,
    selectedPackageIds: [],
  });

  if (properties.length === 0) {
    return whatsappService.sendTextMessage(
      customer.phone,
      `We do not have active ${propertyLabel.toLowerCase()} listed right now. Our expert can still help you with stays.`,
      getContext(customer, agency)
    );
  }

  const propertyFlowConfig = await getPropertyFlowConfig(agency);
  if (!propertyFlowConfig?.flowId) {
    console.error('[TravelFlow] property_flow_missing', { agencyId: agency.id, agencyName: agency.name });
    return showPropertyListFallback(session, customer, agency, properties);
  }

  const propertyOptions = await buildFlowPropertyOptions(properties);
  const propertyLocationOptions = buildFlowPropertyLocationOptions(properties);
  const propertyTypeOptions = buildFilteredPropertyTypeOptions(properties, propertyFilter);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    propertyType ? `Choose your ${propertyType.toLowerCase()} location and travel details.` : 'Choose your stay location and travel details.',
    {
      flowId: propertyFlowConfig.flowId,
      firstScreenId: propertyFlowConfig.firstScreenId || PROPERTY_FLOW_FIRST_SCREEN_ID,
      flowCta: 'View Properties',
      flowToken: `prop|${agency.id}|${customer.id}|${Date.now()}|${encodeFlowTokenPart(propertyType)}`,
      data: {
        property_locations: propertyLocationOptions,
        property_types: propertyTypeOptions,
        property_options: propertyOptions,
      },
    },
    getContext(customer, agency),
    {
      headerText: propertyType ? `${propertyType} Properties` : 'Properties',
      footerText: 'Reply LIST if the flow does not open.',
    }
  );

  if (flowResponse?.status === 'FAILED') {
    console.error('[TravelFlow] property_flow_send_failed', {
      agencyId: agency.id,
      flowId: propertyFlowConfig.flowId,
      firstScreenId: propertyFlowConfig.firstScreenId || PROPERTY_FLOW_FIRST_SCREEN_ID,
    });
  }

  return flowResponse;
}

async function openCustomTripFlow(session, customer, agency) {
  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey: 'packages',
    itemType: 'CUSTOM_TRIP',
    interest: 'CUSTOM_TRIP',
    status: 'ENQUIRY',
    notes: 'Custom trip requested from WhatsApp menu',
  });

  const customTripFlow = await getCustomTripFlowConfig(agency);
  if (customTripFlow?.flowId) {
    await updateSession(session, {
      currentStep: STEPS.COMPLETE,
      collectedData: {
        activeLeadId: lead.id,
        enquiryDraft: customer.name ? { name: customer.name } : {},
      },
    });

    const flowResponse = await whatsappService.sendFlowMessage(
      customer.phone,
      'Share your custom trip preferences below.',
      {
        flowId: customTripFlow.flowId,
        firstScreenId: customTripFlow.firstScreenId || CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
        flowCta: 'Plan Trip',
        flowToken: `custom|${agency.id}|${customer.id}|${Date.now()}`,
        data: {
          customer_name: String(customer.name || '').trim(),
        },
      },
      getContext(customer, agency),
      {
        headerText: 'Plan Custom Trip',
        footerText: 'Submit your trip preferences in the flow.',
      }
    );

    if (flowResponse?.status !== 'FAILED') {
      return flowResponse;
    }
  }

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    'Your custom trip request is created. Our travel expert will contact you shortly.',
    getContext(customer, agency)
  );
}

async function sendPackageActions(customer, agency, pkg) {
  const context = getContext(customer, agency);
  const rows = [
    { id: 'action_enquire', title: 'Enquiry', description: 'Share your trip details in flow' },
    { id: 'action_call_now', title: 'Call Now', description: `Call ${agency.phone}`.slice(0, 72) },
  ];

  if (pkg.brochureUrl) {
    rows.push({ id: 'action_download_itinerary', title: 'Download Itinerary', description: 'Get the PDF brochure' });
  }

  rows.push({ id: 'action_back_packages', title: 'Back to Packages', description: 'Browse more options' });

  if (pkg.brochureUrl) {
    await whatsappService.sendTextMessage(
      customer.phone,
      buildPackageActionsFallbackText(pkg, agency),
      context
    );

    return whatsappService.sendListMessage(
      customer.phone,
      'Choose what you want to do next.',
      'Choose Action',
      [{ title: 'Package Actions', rows }],
      context,
      {
        footerText: 'Select PDF from this menu.',
      }
    );
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    buildPackageActionsFallbackText(pkg, agency),
    [
      { id: 'action_enquire', title: 'Enquiry' },
      { id: 'action_call_now', title: 'Call Now' },
      { id: 'action_back_packages', title: 'Back to Packages' },
    ],
    context
  );
}

async function showPackageDetail(session, customer, agency, packageId) {
  const profile = getProfile(session);
  const normalizedPackageId = normalizeText(packageId);
  const offeredPackageIds = Array.isArray(profile.packageResults)
    ? profile.packageResults.map((id) => normalizeText(id)).filter(Boolean)
    : [];
  const isKnownPackage = offeredPackageIds.length === 0 || offeredPackageIds.includes(normalizedPackageId);

  if (!normalizedPackageId || !isKnownPackage) {
    logFlowEvent('package_detail_invalid_selection', customer, agency, {
      step: session?.currentStep || null,
      selectedPackageId: normalizedPackageId || null,
      offeredPackageIds,
    });
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  const pkg = await Package.findOne({
    where: { id: normalizedPackageId, agencyId: agency.id, isActive: true },
  });

  if (!pkg) {
    logFlowEvent('package_detail_not_found', customer, agency, {
      step: session?.currentStep || null,
      selectedPackageId: normalizedPackageId,
      offeredPackageIds,
    });
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, getProfile(session).packageCategory));
  }

  logFlowEvent('package_detail_opened', customer, agency, {
    step: session?.currentStep || null,
    packageId: pkg.id,
    packageName: pkg.name,
    packageCategory: profile.packageCategory || null,
  });

  await ensureLead(session, customer, agency, {
    packageId: pkg.id,
    destination: pkg?.destinations?.[0] || null,
    notes: `Package selected: ${pkg.name}`,
  });

  await transitionTo(session, STEPS.PACKAGE_DETAIL, {
    selectedPackageId: pkg.id,
    selectedPackageIds: uniqueIds(profile.selectedPackageIds, pkg.id),
    selectedPackageName: pkg.name,
  });

  const detailMessage = buildFullPackageCaption(pkg);
  const buttons = [
    { id: 'action_enquire', title: 'Enquiry' },
    { id: 'action_call_now', title: 'Call Now' },
  ];
  const options = {
    footerText: pkg.brochureUrl ? 'Reply PDF or BACK.' : 'Reply BACK.',
  };
  const context = getContext(customer, agency);

  if (pkg.imageUrl) {
    const interactiveMedia = await whatsappService.sendMediaButtonsMessage(
      customer.phone,
      detailMessage,
      pkg.imageUrl,
      buttons,
      context,
      options
    );

    if (interactiveMedia?.status !== 'FAILED') {
      return interactiveMedia;
    }

    const imageMessage = await whatsappService.sendImageMessage(
      customer.phone,
      pkg.imageUrl,
      detailMessage,
      context
    );

    if (imageMessage?.status !== 'FAILED') {
      return whatsappService.sendButtonsMessage(
        customer.phone,
        'Choose what you want to do next.',
        buttons,
        context,
        options
      );
    }
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    detailMessage,
    buttons,
    context,
    options
  );
}

async function showPropertyDetail(session, customer, agency, propertyId) {
  const profile = getProfile(session);
  const normalizedPropertyId = normalizeText(propertyId);
  const offeredPropertyIds = Array.isArray(profile.propertyResults)
    ? profile.propertyResults.map((id) => normalizeText(id)).filter(Boolean)
    : [];
  const isKnownProperty = offeredPropertyIds.length === 0 || offeredPropertyIds.includes(normalizedPropertyId);

  if (!normalizedPropertyId || !isKnownProperty) {
    logFlowEvent('property_detail_invalid_selection', customer, agency, {
      step: session?.currentStep || null,
      selectedPropertyId: normalizedPropertyId || null,
      offeredPropertyIds,
    });
    return sendInvalidChoice(session, customer, agency, () => reopenPropertyContext(session, customer, agency));
  }

  const property = await Property.findOne({
    where: { id: normalizedPropertyId, agencyId: agency.id, isActive: true },
  });

  if (!property) {
    return sendInvalidChoice(session, customer, agency, () => reopenPropertyContext(session, customer, agency));
  }

  await ensureLead(session, customer, agency, {
    propertyId: property.id,
    itemType: 'PROPERTY',
    destination: property.location || null,
    interest: 'PROPERTY',
    notes: `Property selected: ${property.name}`,
  });

  await transitionTo(session, STEPS.PROPERTY_DETAIL, {
    propertyResults: offeredPropertyIds,
    selectedPropertyId: property.id,
    selectedPropertyIds: uniqueIds(profile.selectedPropertyIds, property.id),
  });

  const buttons = [
    { id: 'action_property_enquire', title: 'Enquiry' },
    { id: 'action_property_call_now', title: 'Call Now' },
    { id: 'action_back_properties', title: 'Back' },
  ];
  const detailMessage = buildPropertyCaption(property);
  const context = getContext(customer, agency);

  if (property.imageUrl) {
    const mediaResult = await whatsappService.sendMediaButtonsMessage(
      customer.phone,
      detailMessage,
      property.imageUrl,
      buttons,
      context,
      { footerText: 'Tap Enquiry for this property.' }
    );
    if (mediaResult?.status !== 'FAILED') return mediaResult;
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    detailMessage,
    buttons,
    context,
    { footerText: 'Tap Enquiry for this property.' }
  );
}

async function handleFlowSubmission(session, incoming, customer, agency) {
  const profile = getProfile(session);
  const rawResponse = incoming?.flowResponse || {};
  const response = typeof rawResponse === 'string'
    ? (() => {
        try {
          return JSON.parse(rawResponse);
        } catch {
          return {};
        }
      })()
    : rawResponse;

  const formResponse = response.package_selector_form && typeof response.package_selector_form === 'object'
    ? response.package_selector_form
    : response.packageSelectorForm && typeof response.packageSelectorForm === 'object'
      ? response.packageSelectorForm
      : {};

  const enquiryFormResponse = response.enquiry_form && typeof response.enquiry_form === 'object'
    ? response.enquiry_form
    : response.enquiryForm && typeof response.enquiryForm === 'object'
      ? response.enquiryForm
      : {};

  const propertyFormResponse = response.property_selector_form && typeof response.property_selector_form === 'object'
    ? response.property_selector_form
    : response.propertySelectorForm && typeof response.propertySelectorForm === 'object'
      ? response.propertySelectorForm
      : {};

  const propertyEnquiryFormResponse = response.property_enquiry_form && typeof response.property_enquiry_form === 'object'
    ? response.property_enquiry_form
    : response.propertyEnquiryForm && typeof response.propertyEnquiryForm === 'object'
      ? response.propertyEnquiryForm
      : {};

  const customTripFormResponse = response.custom_trip_form && typeof response.custom_trip_form === 'object'
    ? response.custom_trip_form
    : response.customTripForm && typeof response.customTripForm === 'object'
      ? response.customTripForm
      : {};

  const readinessFormResponse = response.travel_readiness_form && typeof response.travel_readiness_form === 'object'
    ? response.travel_readiness_form
    : response.travelReadinessForm && typeof response.travelReadinessForm === 'object'
      ? response.travelReadinessForm
      : {};
  const readinessPayload = normalizeReadinessPayload(response, readinessFormResponse);

  const packageIds = uniqueIds(
    response.packageIds,
    response.package_ids,
    response.selected_packages,
    response.selectedPackages,
    response.packageId,
    response.package_id,
    response.selected_package,
    response.selectedPackage,
    formResponse.packageIds,
    formResponse.package_ids,
    formResponse.selected_packages,
    formResponse.selectedPackages,
    formResponse.packageId,
    formResponse.package_id,
    formResponse.selected_package,
    formResponse.selectedPackage,
    enquiryFormResponse.packageIds,
    enquiryFormResponse.package_ids,
    enquiryFormResponse.selected_packages,
    enquiryFormResponse.selectedPackages,
    enquiryFormResponse.packageId,
    enquiryFormResponse.package_id,
    enquiryFormResponse.selected_package,
    enquiryFormResponse.selectedPackage
  );

  const propertyIds = uniqueIds(
    response.propertyIds,
    response.property_ids,
    response.selected_properties,
    response.selectedProperties,
    response.propertyId,
    response.property_id,
    response.selected_property,
    response.selectedProperty,
    propertyFormResponse.propertyIds,
    propertyFormResponse.property_ids,
    propertyFormResponse.selected_properties,
    propertyFormResponse.selectedProperties,
    propertyFormResponse.propertyId,
    propertyFormResponse.property_id,
    propertyFormResponse.selected_property,
    propertyFormResponse.selectedProperty,
    propertyEnquiryFormResponse.propertyIds,
    propertyEnquiryFormResponse.property_ids,
    propertyEnquiryFormResponse.selected_properties,
    propertyEnquiryFormResponse.selectedProperties,
    propertyEnquiryFormResponse.propertyId,
    propertyEnquiryFormResponse.property_id,
    propertyEnquiryFormResponse.selected_property,
    propertyEnquiryFormResponse.selectedProperty
  );

  const packageId = packageIds[0] || '';
  const propertyId = propertyIds[0] || '';
  const mergedPackageIds = uniqueIds(profile.selectedPackageIds, packageIds);
  const mergedPropertyIds = uniqueIds(profile.selectedPropertyIds, propertyIds);

  if (propertyId === '__no_results') {
    await whatsappService.sendTextMessage(
      customer.phone,
      'No matching properties were available for those stay filters. Please try another location or date range.',
      getContext(customer, agency)
    );
    return reopenPropertyContext(session, customer, agency);
  }

  const enquiryPayload = {
    name: normalizeText(
      response.name
      || response.fullName
      || response.full_name
      || enquiryFormResponse.name
      || enquiryFormResponse.fullName
      || enquiryFormResponse.full_name
      || propertyEnquiryFormResponse.name
      || propertyEnquiryFormResponse.fullName
      || propertyEnquiryFormResponse.full_name
      || customTripFormResponse.name
      || customTripFormResponse.fullName
      || customTripFormResponse.full_name
    ),
    place: normalizeText(
      response.place
      || response.city
      || response.location
      || response.propertyLocation
      || response.property_location
      || enquiryFormResponse.place
      || enquiryFormResponse.city
      || enquiryFormResponse.location
      || enquiryFormResponse.propertyLocation
      || enquiryFormResponse.property_location
      || response.destination
      || propertyEnquiryFormResponse.place
      || propertyEnquiryFormResponse.city
      || propertyEnquiryFormResponse.location
      || propertyEnquiryFormResponse.propertyLocation
      || propertyEnquiryFormResponse.property_location
      || customTripFormResponse.place
      || customTripFormResponse.city
      || customTripFormResponse.location
      || customTripFormResponse.destination
    ),
    travelDate: normalizeText(
      response.travelDate
      || response.travel_date
      || response.travelMonth
      || response.checkInDate
      || response.check_in_date
      || response.checkOutDate
      || response.check_out_date
      || enquiryFormResponse.travelDate
      || enquiryFormResponse.travel_date
      || enquiryFormResponse.travelMonth
      || enquiryFormResponse.checkInDate
      || enquiryFormResponse.check_in_date
      || enquiryFormResponse.checkOutDate
      || enquiryFormResponse.check_out_date
      || propertyEnquiryFormResponse.travelDate
      || propertyEnquiryFormResponse.travel_date
      || propertyEnquiryFormResponse.travelMonth
      || propertyEnquiryFormResponse.checkInDate
      || propertyEnquiryFormResponse.check_in_date
      || propertyEnquiryFormResponse.checkOutDate
      || propertyEnquiryFormResponse.check_out_date
      || customTripFormResponse.travelDate
      || customTripFormResponse.travel_date
      || customTripFormResponse.travelMonth
    ),
    travellers: normalizeText(
      response.travellers
      || response.travelers
      || response.guests
      || response.guestCount
      || response.guest_count
      || response.travellerCount
      || response.travelerCount
      || enquiryFormResponse.travellers
      || enquiryFormResponse.travelers
      || enquiryFormResponse.guests
      || enquiryFormResponse.guestCount
      || enquiryFormResponse.guest_count
      || enquiryFormResponse.travellerCount
      || enquiryFormResponse.travelerCount
      || propertyEnquiryFormResponse.travellers
      || propertyEnquiryFormResponse.travelers
      || propertyEnquiryFormResponse.guests
      || propertyEnquiryFormResponse.guestCount
      || propertyEnquiryFormResponse.guest_count
      || propertyEnquiryFormResponse.travellerCount
      || propertyEnquiryFormResponse.travelerCount
      || customTripFormResponse.travellers
      || customTripFormResponse.travelers
      || customTripFormResponse.travellerCount
      || customTripFormResponse.travelerCount
    ),
    budgetPerPerson: normalizeText(
      response.budget
      || response.budgetPerPerson
      || response.budget_per_person
      || enquiryFormResponse.budget
      || enquiryFormResponse.budgetPerPerson
      || enquiryFormResponse.budget_per_person
      || propertyEnquiryFormResponse.budget
      || propertyEnquiryFormResponse.budgetPerPerson
      || propertyEnquiryFormResponse.budget_per_person
      || customTripFormResponse.budget
      || customTripFormResponse.budgetPerPerson
      || customTripFormResponse.budget_per_person
    ),
    notes: normalizeText(
      response.notes
      || response.otherDetails
      || response.other_details
      || enquiryFormResponse.notes
      || enquiryFormResponse.otherDetails
      || enquiryFormResponse.other_details
      || propertyEnquiryFormResponse.notes
      || propertyEnquiryFormResponse.otherDetails
      || propertyEnquiryFormResponse.other_details
      || customTripFormResponse.notes
      || customTripFormResponse.otherDetails
      || customTripFormResponse.other_details
    ),
  };

  const checkInDate = normalizeText(
    response.checkInDate
    || response.check_in_date
    || enquiryFormResponse.checkInDate
    || enquiryFormResponse.check_in_date
    || propertyEnquiryFormResponse.checkInDate
    || propertyEnquiryFormResponse.check_in_date
  );
  const checkOutDate = normalizeText(
    response.checkOutDate
    || response.check_out_date
    || enquiryFormResponse.checkOutDate
    || enquiryFormResponse.check_out_date
    || propertyEnquiryFormResponse.checkOutDate
    || propertyEnquiryFormResponse.check_out_date
  );
  if (checkInDate || checkOutDate) {
    enquiryPayload.travelDate = [checkInDate, checkOutDate].filter(Boolean).join(' to ');
  }

  const travellerMatch = enquiryPayload.travellers.match(/\d+/);
  const travellers = travellerMatch ? parseInt(travellerMatch[0], 10) : NaN;
  const budgetPerPerson = parseBudgetPaise(enquiryPayload.budgetPerPerson);
  const hasFlowEnquiryFields = !!(enquiryPayload.name || enquiryPayload.place || enquiryPayload.travelDate || enquiryPayload.travellers || enquiryPayload.notes);

  logFlowEvent('flow_submission_received', customer, agency, {
    step: session?.currentStep || null,
    selectedPackageId: packageId || null,
    selectedPackageIds: mergedPackageIds,
    selectedPropertyId: propertyId || null,
    selectedPropertyIds: mergedPropertyIds,
    flowName: normalizeText(incoming?.flowName || ''),
    hasFlowEnquiryFields,
    hasReadinessFields: readinessPayload.hasReadinessFields,
  });

  if (!packageId && !propertyId && !hasFlowEnquiryFields && !readinessPayload.hasReadinessFields) {
    return sendInvalidChoice(session, customer, agency, () => reopenPackageContext(session, customer, agency, profile));
  }

  if (hasFlowEnquiryFields) {
    if (readinessPayload.hasReadinessFields) {
      const selectedPackageId = packageId || profile.selectedPackageId || mergedPackageIds[0] || null;
      const readinessTravellers = readinessTravellerNumber(readinessPayload.travellerCount);
      const pkg = selectedPackageId
        ? await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id } })
        : null;

      const notes = [
        'Travel readiness questionnaire submitted',
        pkg?.name ? `Package: ${pkg.name}` : null,
        readinessPayload.travellerCount ? `Travellers: ${readinessAnswerLabel(readinessPayload.travellerCount)}` : null,
        readinessPayload.bookingReadiness ? `Readiness: ${readinessAnswerLabel(readinessPayload.bookingReadiness)}` : null,
        readinessPayload.departureAirport ? `Departure airport: ${readinessAnswerLabel(readinessPayload.departureAirport)}` : null,
      ].filter(Boolean).join(' | ');

      await transitionTo(session, STEPS.COMPLETE, {
        selectedPackageId,
        selectedPropertyId: propertyId || profile.selectedPropertyId || null,
        selectedPackageIds: selectedPackageId ? uniqueIds(mergedPackageIds, selectedPackageId) : mergedPackageIds,
        selectedPropertyIds: mergedPropertyIds,
        campaignId: profile.campaignId || null,
        campaignName: profile.campaignName || null,
        enquiryDraft: {
          ...profile.enquiryDraft,
          travellers: readinessPayload.travellerCount,
          notes,
        },
        travelReadiness: {
          travellerCount: readinessPayload.travellerCount,
          bookingReadiness: readinessPayload.bookingReadiness,
          departureAirport: readinessPayload.departureAirport,
          submittedAt: new Date().toISOString(),
        },
      });

      const lead = await ensureLead(session, customer, agency, {
        routingIntentKey: selectedPackageId ? 'packages' : undefined,
        packageId: selectedPackageId,
        itemType: selectedPackageId ? 'PACKAGE' : null,
        campaignId: profile.campaignId || null,
        campaignName: profile.campaignName || null,
        campaignAction: 'CHECK_AVAILABILITY',
        travellers: readinessTravellers,
        status: 'ENQUIRY',
        notes,
        customTripDetails: {
          travelReadiness: {
            travellerCount: readinessPayload.travellerCount,
            bookingReadiness: readinessPayload.bookingReadiness,
            departureAirport: readinessPayload.departureAirport,
          },
        },
      });

      await attachCampaignRecipientFlowResult(profile.campaignId, customer.id, lead, {
        selectedItemType: selectedPackageId ? 'PACKAGE' : undefined,
        selectedItemId: selectedPackageId || undefined,
      });

      await notifyAgentOfNewEnquiry(lead, customer, agency, pkg, {
        name: customer.name || firstName(customer),
        travellers: readinessAnswerLabel(readinessPayload.travellerCount),
        notes,
      }).catch((err) => {
        console.warn('[TravelFlow] Could not notify agent of readiness enquiry:', err.message);
      });

      const assignedAgent = lead?.assignedAgentId
        ? await Agent.findOne({ where: { id: lead.assignedAgentId, agencyId: agency.id } })
        : null;
      const routedPhone = assignedAgent?.phone || agency.phone || agency.whatsappNumber;
      const routedName = assignedAgent?.name || agency.name || 'our travel specialist';
      const packageText = pkg?.name ? ` for ${escapeMarkdown(pkg.name)}` : '';
      const chatLink = buildWhatsAppChatLink(
        routedPhone,
        buildSpecialistPrefill({
          customer,
          pkg,
          campaignName: profile.campaignName || '',
          lead,
        })
      );
      const confirmationMessage = routedPhone
        ? [
          `Thanks ${escapeMarkdown(firstName(customer))}. We received your availability details${packageText}.`,
          `Our travel consultant will review it and contact you shortly.`,
          `For any quick enquiry, you can contact ${escapeMarkdown(routedName)} on WhatsApp/phone: ${routedPhone}`,
        ].filter(Boolean).join('\n\n')
        : `Thanks ${escapeMarkdown(firstName(customer))}. We received your availability details${packageText} and our travel specialist will contact you shortly.`;

      if (routedPhone && chatLink) {
        return whatsappService.sendUrlButtonMessage(
          customer.phone,
          confirmationMessage,
          'Chat on WhatsApp',
          chatLink,
          getContext(customer, agency)
        );
      }

      return whatsappService.sendTextMessage(
        customer.phone,
        confirmationMessage,
        getContext(customer, agency)
      );
    }

    if (propertyId) {
      if (!enquiryPayload.travelDate || enquiryPayload.travelDate.length < 3 || Number.isNaN(travellers) || travellers < 1 || travellers > 50) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please submit valid check-in, checkout, and guest details.',
          getContext(customer, agency)
        );
      }

      await transitionTo(session, STEPS.COMPLETE, {
        selectedPackageId: null,
        selectedPropertyId: propertyId || profile.selectedPropertyId || null,
        selectedPackageIds: mergedPackageIds,
        selectedPropertyIds: mergedPropertyIds,
        campaignId: profile.campaignId || null,
        campaignName: profile.campaignName || null,
        enquiryDraft: {
          ...profile.enquiryDraft,
          name: enquiryPayload.name,
          place: enquiryPayload.place,
          travelDate: enquiryPayload.travelDate,
          checkInDate,
          checkOutDate,
          travellers,
          notes: enquiryPayload.notes,
        },
      });

      return finalizePropertyFlowEnquiry(session, customer, agency, propertyId);
    }

    if (!enquiryPayload.name || enquiryPayload.name.length < 2 || !enquiryPayload.travelDate || enquiryPayload.travelDate.length < 3 || Number.isNaN(travellers) || travellers < 1 || travellers > 50 || !budgetPerPerson) {
      await whatsappService.sendTextMessage(
        customer.phone,
        'Please submit valid enquiry details in the form. Name, travel date, travellers, and budget are required.',
        getContext(customer, agency)
      );
      if (propertyId) {
        const { showCampaignPropertyDetail } = require('./campaignActionHandler');
        if (profile.campaignId) {
          return showCampaignPropertyDetail(session, profile.campaignId, propertyId, customer, agency, 'PROPERTY_SELECTED');
        }
        return reopenPackageContext(session, customer, agency, profile);
      }
      if (!packageId && profile.campaignId) {
        return reopenPackageContext(session, customer, agency, profile);
      }
      return showPackageDetail(session, customer, agency, packageId || profile.selectedPackageId);
    }

    await transitionTo(session, STEPS.COMPLETE, {
      selectedPackageId: packageId || profile.selectedPackageId || null,
      selectedPropertyId: propertyId || profile.selectedPropertyId || null,
      selectedPackageIds: mergedPackageIds,
      selectedPropertyIds: mergedPropertyIds,
      campaignId: profile.campaignId || null,
      campaignName: profile.campaignName || null,
      enquiryDraft: {
        ...profile.enquiryDraft,
        name: enquiryPayload.name,
        place: enquiryPayload.place,
        travelDate: enquiryPayload.travelDate,
        travellers,
        budgetPerPerson,
        notes: enquiryPayload.notes,
      },
    });

    if (!packageId && !propertyId) {
      return finalizeCustomTripFlowEnquiry(session, customer, agency);
    }

    const result = await finalizeEnquiry(session, customer, agency);
    const activeLead = await findActiveLead(session, customer, agency);
    await attachCampaignRecipientFlowResult(profile.campaignId, customer.id, activeLead, {
      selectedItemType: 'PACKAGE',
      selectedItemId: packageId || profile.selectedPackageId || null,
    });
    return result;
  }

  if (propertyId) {
    await updateSession(session, {
      collectedData: {
        selectedPackageIds: mergedPackageIds,
        selectedPropertyIds: mergedPropertyIds,
      },
    });
    const { showCampaignPropertyDetail } = require('./campaignActionHandler');
    if (profile.campaignId) {
      return showCampaignPropertyDetail(session, profile.campaignId, propertyId, customer, agency, 'PROPERTY_SELECTED');
    }
    return showPropertyDetail(session, customer, agency, propertyId);
  }

  await updateSession(session, {
    collectedData: {
      selectedPackageIds: mergedPackageIds,
      selectedPropertyIds: mergedPropertyIds,
    },
  });
  return showPackageDetail(session, customer, agency, packageId);
}

function buildPropertyCaption(property) {
  return [
    `Stay: ${escapeMarkdown(property.name)}`,
    '',
    property.pricePerNight ? `Price: ${formatCurrency(property.pricePerNight)}/night` : 'Price: On request',
    property.location ? `Location: ${escapeMarkdown(property.location)}` : null,
    property.propertyType ? `Type: ${escapeMarkdown(property.propertyType)}` : null,
    '',
    escapeMarkdown(property.description || 'Share your dates and our team will help with availability.'),
  ].filter(Boolean).join('\n');
}

function buildPropertyListSections(properties) {
  return [
    {
      title: 'Properties',
      rows: properties.slice(0, FALLBACK_LIST_LIMIT).map((property) => ({
        id: `property_pick:${property.id}`,
        title: escapeMarkdown(property.name).slice(0, 24) || 'Property',
        description: `${property.pricePerNight ? `${formatCurrency(property.pricePerNight)}/night` : 'Price on request'} - ${escapeMarkdown(property.location || property.propertyType || 'Stay')}`.slice(0, 72),
      })),
    },
    {
      title: 'Navigation',
      rows: [
        { id: 'global_go_back', title: 'Go Back', description: 'Return to previous step' },
        { id: 'global_main_menu', title: 'Main Menu', description: 'Start over anytime' },
      ],
    },
  ];
}

async function openEnquiryFlow(session, customer, agency) {
  const profile = getProfile(session);
  const selectedPackageId = profile.selectedPackageId;

  if (!selectedPackageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  const enquiryFlowConfig = await getEnquiryFlowConfig(agency);
  if (!enquiryFlowConfig?.flowId) {
    console.error('[TravelFlow] enquiry_flow_missing', { agencyId: agency.id, agencyName: agency.name });
    return startEnquiry(session, customer, agency);
  }

  const pkg = await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id, isActive: true } });
  if (!pkg) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',
    packageId: pkg.id,
    destination: pkg?.destinations?.[0] || null,
    notes: `Enquiry started for package: ${pkg.name}`,
  });

  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    `Share your enquiry details for ${escapeMarkdown(pkg.name)} 👇`,
    {
      flowId: enquiryFlowConfig.flowId,
      firstScreenId: enquiryFlowConfig.firstScreenId || FLOW_ENQUIRY_FIRST_SCREEN_ID,
      flowCta: FLOW_ENQUIRY_CTA,
      flowToken: `enq|${agency.id}|${selectedPackageId}|${customer.id}|${Date.now()}`,
      data: {
        package_id: pkg.id,
        package_name: escapeMarkdown(pkg.name),
        package_summary: `${formatCurrency(pkg.basePrice)} • ${escapeMarkdown(pkg.duration || 'Custom itinerary')}`.slice(0, 80),
        customer_name: normalizeText(customer.name || profile.enquiryDraft.name || ''),
        budget_hint: 'Please share your budget per person in ₹',
      },
    },
    getContext(customer, agency),
    {
      headerText: 'Quick Enquiry',
      footerText: 'Fill details in flow and submit.',
    }
  );

  if (flowResponse?.status === 'FAILED') {
    console.error('[TravelFlow] enquiry_flow_send_failed', {
      agencyId: agency.id,
      flowId: enquiryFlowConfig.flowId,
      firstScreenId: enquiryFlowConfig.firstScreenId || FLOW_ENQUIRY_FIRST_SCREEN_ID,
    });
    return flowResponse;
  }

  return flowResponse;
}

async function startEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const selectedPackageId = profile.selectedPackageId;

  if (!selectedPackageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  const pkg = await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id, isActive: true } });

  if (!pkg) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',
    packageId: pkg.id,
    destination: pkg?.destinations?.[0] || null,
    notes: `Enquiry started for package: ${pkg.name}`,
  });

  await transitionTo(session, STEPS.ENQUIRY_NAME, {
    enquiryDraft: {
      ...profile.enquiryDraft,
      name: profile.enquiryDraft.name || customer.name || '',
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    'Great choice. I will take your enquiry in chat.\n\nPlease share your full name.',
    getContext(customer, agency)
  );
}

async function notifyAgentOfNewEnquiry(lead, customer, agency, pkg, enquiry) {
  if (!lead?.assignedAgentId) {
    return; // No agent assigned, skip notification
  }

  const assignedAgent = await Agent.findOne({
    where: { id: lead.assignedAgentId, agencyId: agency.id },
  });

  if (!assignedAgent?.phone) {
    return; // Agent has no phone number
  }

  await sendAgentLeadAssignment(assignedAgent.phone, agency.id, {
    customerName: customer?.name,
    phone: customer?.phone,
    packageName: pkg?.name,
    travelDate: enquiry.travelDate,
    travellers: enquiry.travellers,
    budgetPerPerson: enquiry.budgetPerPerson,
    notes: enquiry.notes,
  }, { customerId: lead.customerId, agencyId: agency.id });

  logFlowEvent('agent_notified_of_enquiry', customer, agency, {
    leadId: lead.id,
    agentId: assignedAgent.id,
    packageName: pkg?.name || null,
  });
}

async function finalizeEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const enquiry = profile.enquiryDraft;
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;

  if (enquiry.name) {
    await Customer.update(
      { name: enquiry.name },
      { where: { id: customer.id } }
    );
  }

  const notes = [
    'Lead captured from WhatsApp package enquiry funnel',
    pkg?.name ? `Package: ${pkg.name}` : null,
    enquiry.travelDate ? `Travel date: ${enquiry.travelDate}` : null,
    enquiry.travellers ? `Travellers: ${enquiry.travellers}` : null,
    enquiry.budgetPerPerson ? `Budget per person: ₹${Math.round(Number(enquiry.budgetPerPerson) / 100).toLocaleString('en-IN')}` : null,
    enquiry.notes ? `Other details: ${enquiry.notes}` : null,
  ].filter(Boolean).join(' | ');

  const lead = await ensureLead(session, customer, agency, {
    packageId: pkg?.id || null,
    destination: pkg?.destinations?.[0] || null,
    travelDates: enquiry.travelDate || null,
    travellers: enquiry.travellers || null,
    budgetPerPerson: enquiry.budgetPerPerson || null,
    status: 'ENQUIRY',
    notes,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
    },
  });

  // Notify the assigned agent about the new enquiry
  await notifyAgentOfNewEnquiry(lead, customer, agency, pkg, enquiry).catch((err) => {
    console.warn('[TravelFlow] Could not notify agent of enquiry:', err.message);
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks ${escapeMarkdown(enquiry.name || firstName(customer))} 🙌\nOur travel expert will contact you shortly.`,
    getContext(customer, agency)
  );
}

async function attachCampaignRecipientFlowResult(campaignId, customerId, lead, details = {}) {
  if (!campaignId || !customerId || !lead?.id) return;

  await CampaignRecipient.update(
    {
      leadId: lead.id,
      flowSubmittedAt: details.flowSubmittedAt || new Date(),
      selectedItemType: details.selectedItemType || undefined,
      selectedItemId: details.selectedItemId || undefined,
    },
    { where: { campaignId, customerId } }
  );
}

async function finalizePropertyFlowEnquiry(session, customer, agency, propertyId) {
  const profile = getProfile(session);
  const enquiry = profile.enquiryDraft;
  const property = propertyId
    ? await Property.findOne({ where: { id: propertyId, agencyId: agency.id, isActive: true } })
    : null;

  if (!property) {
    return sendInvalidChoice(session, customer, agency, () => reopenPackageContext(session, customer, agency, profile));
  }

  if (enquiry.name) {
    await Customer.update(
      { name: enquiry.name },
      { where: { id: customer.id } }
    );
  }

  const notes = [
    'Lead captured from WhatsApp property enquiry flow',
    property.name ? `Property: ${property.name}` : null,
    enquiry.checkInDate ? `Check-in: ${enquiry.checkInDate}` : null,
    enquiry.checkOutDate ? `Checkout: ${enquiry.checkOutDate}` : null,
    !enquiry.checkInDate && enquiry.travelDate ? `Dates: ${enquiry.travelDate}` : null,
    enquiry.travellers ? `Guests: ${enquiry.travellers}` : null,
    enquiry.budgetPerPerson ? `Budget: ₹${Math.round(Number(enquiry.budgetPerPerson) / 100).toLocaleString('en-IN')}` : null,
    enquiry.notes ? `Other details: ${enquiry.notes}` : null,
  ].filter(Boolean).join(' | ');

  const lead = await ensureLead(session, customer, agency, {
    propertyId: property.id,
    itemType: 'PROPERTY',
    campaignId: profile.campaignId || null,
    campaignName: profile.campaignName || null,
    campaignAction: profile.campaignId ? 'PROPERTY_ENQUIRY_FLOW' : null,
    destination: property.location || null,
    travelDates: enquiry.travelDate || null,
    travellers: enquiry.travellers || null,
    budgetPerPerson: enquiry.budgetPerPerson || null,
    interest: 'PROPERTY',
    customTripDetails: {
      propertyName: property.name || '',
      propertyLocation: property.location || enquiry.place || '',
      destination: property.location || enquiry.place || '',
      travelDate: enquiry.travelDate || '',
      checkInDate: enquiry.checkInDate || '',
      checkOutDate: enquiry.checkOutDate || '',
      travellers: enquiry.travellers || null,
      travellersText: enquiry.travellers ? String(enquiry.travellers) : '',
      notes: enquiry.notes || '',
      source: profile.campaignId ? 'whatsapp_campaign_property_flow' : 'whatsapp_property_flow',
      submittedAt: new Date().toISOString(),
      campaignName: profile.campaignName || '',
    },
    status: 'ENQUIRY',
    notes,
  });

  await attachCampaignRecipientFlowResult(profile.campaignId, customer.id, lead, {
    selectedItemType: 'PROPERTY',
    selectedItemId: property.id,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      selectedPropertyId: property.id,
      selectedPropertyIds: uniqueIds(profile.selectedPropertyIds, property.id),
      campaignId: profile.campaignId || null,
      campaignName: profile.campaignName || null,
    },
  });

  const confirmation = [
    `*${escapeMarkdown(property.name)}*`,
    property.propertyType || property.location ? [property.propertyType, property.location].filter(Boolean).join(' - ') : null,
    property.pricePerNight ? `${formatCurrency(property.pricePerNight)}/night` : 'Price on request',
    '',
    escapeMarkdown(property.description || 'Selected property enquiry received.').slice(0, 500),
    '',
    `Check-in: ${escapeMarkdown(enquiry.checkInDate || 'Not shared')}`,
    `Checkout: ${escapeMarkdown(enquiry.checkOutDate || 'Not shared')}`,
    `Guests: ${enquiry.travellers || 'Not shared'}`,
    '',
    'Our team will connect with you as soon as possible.',
  ].filter(Boolean).join('\n');

  const buttons = [
    { id: 'action_call_now', title: 'Contact Now' },
  ];

  if (property.imageUrl) {
    const mediaResult = await whatsappService.sendMediaButtonsMessage(
      customer.phone,
      confirmation,
      property.imageUrl,
      buttons,
      getContext(customer, agency),
      { footerText: 'Tap Contact Now to speak with us.' }
    );
    if (mediaResult?.status !== 'FAILED') return mediaResult;
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    confirmation,
    buttons,
    getContext(customer, agency),
    { footerText: 'Tap Contact Now to speak with us.' }
  );
}

async function finalizeCustomTripFlowEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const enquiry = profile.enquiryDraft;

  if (enquiry.name) {
    await Customer.update(
      { name: enquiry.name },
      { where: { id: customer.id } }
    );
  }

  const notes = [
    'Lead captured from WhatsApp custom trip flow',
    profile.campaignName ? `Campaign: ${profile.campaignName}` : null,
    enquiry.place ? `Destination: ${enquiry.place}` : null,
    enquiry.travelDate ? `Travel date: ${enquiry.travelDate}` : null,
    enquiry.travellers ? `Travellers: ${enquiry.travellers}` : null,
    enquiry.budgetPerPerson ? `Budget per person: ₹${Math.round(Number(enquiry.budgetPerPerson) / 100).toLocaleString('en-IN')}` : null,
    enquiry.notes ? `Other details: ${enquiry.notes}` : null,
  ].filter(Boolean).join(' | ');
  const customTripDetails = buildCustomTripDetails(enquiry, profile);

  const lead = await ensureLead(session, customer, agency, {
    itemType: 'CUSTOM_TRIP',
    campaignId: profile.campaignId || null,
    campaignName: profile.campaignName || null,
    campaignAction: profile.campaignId ? 'CUSTOM_TRIP_FLOW' : null,
    destination: enquiry.place || null,
    travelDates: enquiry.travelDate || null,
    travellers: enquiry.travellers || null,
    budgetPerPerson: enquiry.budgetPerPerson || null,
    interest: 'CUSTOM_TRIP',
    customTripDetails,
    status: 'ENQUIRY',
    notes,
  });

  await attachCampaignRecipientFlowResult(profile.campaignId, customer.id, lead, {
    selectedItemType: 'CUSTOM_TRIP',
    selectedItemId: null,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      campaignId: profile.campaignId || null,
      campaignName: profile.campaignName || null,
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks ${escapeMarkdown(enquiry.name || firstName(customer))} 🙌\nOur travel expert will contact you shortly with your custom trip plan.`,
    getContext(customer, agency)
  );
}

async function startPropertyEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const property = profile.selectedPropertyId
    ? await Property.findOne({ where: { id: profile.selectedPropertyId, agencyId: agency.id, isActive: true } })
    : null;

  if (!property) {
    return sendInvalidChoice(session, customer, agency, () => reopenPropertyContext(session, customer, agency));
  }

  const lead = await ensureLead(session, customer, agency, {
    propertyId: property.id,
    itemType: 'PROPERTY',
    destination: property.location || null,
    interest: 'PROPERTY',
    status: 'ENQUIRY',
    notes: `Property enquiry from WhatsApp menu: ${property.name}`,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      selectedPropertyId: property.id,
      selectedPropertyIds: uniqueIds(profile.selectedPropertyIds, property.id),
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks. Your enquiry for ${escapeMarkdown(property.name)} is created. Our travel expert will contact you shortly. You can reply with stay dates, guests, rooms, or budget to add more details.`,
    getContext(customer, agency)
  );
}

async function handleEnquiryStep(session, incoming, customer, agency) {
  const text = normalizeText(incoming?.text);
  const profile = getProfile(session);
  const enquiry = { ...profile.enquiryDraft };

  switch (session.currentStep) {
    case STEPS.ENQUIRY_NAME: {
      const name = text.replace(/[^\w\s.'-]/g, '').trim();
      if (name.length < 2) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please share a valid full name.',
          getContext(customer, agency)
        );
      }

      enquiry.name = name;
      await transitionTo(session, STEPS.ENQUIRY_PLACE, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'Please share your travel date or month.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_PLACE: {
      if (text.length < 3) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please share your travel date or month.',
          getContext(customer, agency)
        );
      }

      enquiry.travelDate = text;
      await transitionTo(session, STEPS.ENQUIRY_ADDRESS, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'How many people will be travelling?',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_ADDRESS: {
      const match = text.match(/\d+/);
      const travellers = match ? parseInt(match[0], 10) : NaN;
      if (Number.isNaN(travellers) || travellers < 1 || travellers > 50) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please send a valid traveller count between 1 and 50.',
          getContext(customer, agency)
        );
      }

      enquiry.travellers = travellers;
      await transitionTo(session, STEPS.ENQUIRY_DATE, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'What is your budget per person? You can reply in rupees, for example 25000.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_DATE: {
      const budgetPerPerson = parseBudgetPaise(text);
      if (!budgetPerPerson) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please enter a valid budget amount in ₹.',
          getContext(customer, agency)
        );
      }

      enquiry.budgetPerPerson = budgetPerPerson;
      await transitionTo(session, STEPS.COMPLETE, { enquiryDraft: enquiry });
      if (!profile.selectedPackageId && !profile.selectedPropertyId) {
        return finalizeCustomTripFlowEnquiry(session, customer, agency);
      }
      return finalizeEnquiry(session, customer, agency);
    }

    case STEPS.ENQUIRY_TRAVELLERS: {
      const match = text.match(/\d+/);
      const travellers = match ? parseInt(match[0], 10) : NaN;
      if (Number.isNaN(travellers) || travellers < 1 || travellers > 50) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please send a valid traveller count between 1 and 50.',
          getContext(customer, agency)
        );
      }

      enquiry.travellers = travellers;
      await transitionTo(session, STEPS.ENQUIRY_DATE, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'What is your budget per person? You can reply in rupees, for example 25000.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_NOTES: {
      enquiry.notes = ['skip', 'no', 'none', 'na', 'n/a'].includes(lower(text)) ? '' : text;
      await transitionTo(session, STEPS.COMPLETE, { enquiryDraft: enquiry });
      if (!profile.selectedPackageId && !profile.selectedPropertyId) {
        return finalizeCustomTripFlowEnquiry(session, customer, agency);
      }
      return finalizeEnquiry(session, customer, agency);
    }

    default:
      return showMainMenu(session, customer, agency);
  }
}

async function sendCallNow(session, customer, agency) {
  const profile = getProfile(session);
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;
  const property = profile.selectedPropertyId
    ? await Property.findOne({ where: { id: profile.selectedPropertyId, agencyId: agency.id } })
    : null;

  const lead = await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',
    packageId: pkg?.id || null,
    propertyId: property?.id || null,
    itemType: property ? 'PROPERTY' : pkg ? 'PACKAGE' : null,
    destination: property?.location || pkg?.destinations?.[0] || null,
    notes: `Call Now clicked for ${property?.name || pkg?.name || 'selected item'}`,
  });

  await whatsappService.sendTextMessage(
    customer.phone,
    `📞 Call us: ${agency.phone || agency.whatsappNumber}`,
    getContext(customer, agency)
  );

  if (lead?.assignedAgentId) {
    const assignedAgent = await Agent.findOne({
      where: { id: lead.assignedAgentId, agencyId: agency.id },
    });
    if (assignedAgent?.phone) {
      await sendAgentTalkToAgentIntent(assignedAgent.phone, agency.id, {
        customerName: customer.name || firstName(customer),
        phone: customer.phone,
        packageName: property?.name || pkg?.name,
      }, getContext(customer, agency));
    }
  }

  if (pkg) {
    return sendPackageActions(customer, agency, pkg);
  }
}

async function sendItinerary(session, customer, agency) {
  const profile = getProfile(session);
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;

  if (!pkg?.brochureUrl) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'The itinerary PDF is not available for this package yet. Please choose Enquiry and our team will share it with you.',
      getContext(customer, agency)
    );
    return sendPackageActions(customer, agency, pkg || {});
  }

  await whatsappService.sendDocumentMessage(
    customer.phone,
    pkg.brochureUrl,
    safePdfName(pkg),
    `${escapeMarkdown(pkg.name)} itinerary`,
    getContext(customer, agency)
  );

  return sendPackageActions(customer, agency, pkg);
}

async function renderCurrentStep(session, customer, agency) {
  switch (session.currentStep) {
    case 'NEW':
    case STEPS.MENU:
    case STEPS.COMPLETE:
      return showMainMenu(session, customer, agency);
    case STEPS.CATEGORY_PACKAGES:
      return reopenPackageContext(session, customer, agency, getProfile(session));
    case STEPS.PROPERTY_LIST:
      return reopenPropertyContext(session, customer, agency);
    case STEPS.PACKAGE_DETAIL:
      return showPackageDetail(session, customer, agency, getProfile(session).selectedPackageId);
    case STEPS.PROPERTY_DETAIL:
      return showPropertyDetail(session, customer, agency, getProfile(session).selectedPropertyId);
    case STEPS.ENQUIRY_NAME:
      return whatsappService.sendTextMessage(customer.phone, 'Please share your full name.', getContext(customer, agency));
    case STEPS.ENQUIRY_PLACE:
      return whatsappService.sendTextMessage(customer.phone, 'Please share your travel date or month.', getContext(customer, agency));
    case STEPS.ENQUIRY_ADDRESS:
      return whatsappService.sendTextMessage(customer.phone, 'How many people will be travelling?', getContext(customer, agency));
    case STEPS.ENQUIRY_DATE:
      return whatsappService.sendTextMessage(customer.phone, 'What is your budget per person?', getContext(customer, agency));
    case STEPS.ENQUIRY_TRAVELLERS:
      return whatsappService.sendTextMessage(customer.phone, 'How many people will be travelling?', getContext(customer, agency));
    case STEPS.ENQUIRY_NOTES:
      return whatsappService.sendTextMessage(customer.phone, 'Any other details to share? Reply "skip" if none.', getContext(customer, agency));
    case STEPS.SERVICE_DETAILS:
      return whatsappService.sendTextMessage(customer.phone, 'Please share your route, date, and passenger count.', getContext(customer, agency));
    default:
      return showMainMenu(session, customer, agency);
  }
}

function isCategoryAction(actionId, text) {
  return actionId === 'menu_domestic'
    || actionId === 'menu_international'
    || text === 'domestic'
    || text === 'domestic trips'
    || text === 'domestic packages'
    || text === 'international'
    || text === 'international trips'
    || text === 'international packages';
}

function resolveCategory(actionId, text) {
  if (actionId === 'menu_international' || text.includes('international')) return 'INTERNATIONAL';
  return 'DOMESTIC';
}

async function handleCategoryPackageReply(session, customer, agency, text) {
  return sendInvalidChoice(session, customer, agency, () => reopenPackageContext(session, customer, agency, getProfile(session)));
}

async function handleCustomMenuSelection(session, customer, agency, item) {
  if (!item) return showMainMenu(session, customer, agency);

  if (item.type === 'PACKAGE_CATEGORY') {
    return openPackageFlow(session, customer, agency, item.value || item.title);
  }

  if (item.type === 'PROPERTY') {
    const propertyType = normalizeText(item.value || item.title);
    return openPropertyFlow(
      session,
      customer,
      agency,
      propertyType ? serviceRoutingService.normalizeIntentKey(propertyType) : 'properties',
      propertyType ? { propertyType } : {}
    );
  }

  if (item.type === 'SERVICE') {
    return handleCustomServiceSelection(session, customer, agency, item);
  }

  if (item.type === 'CUSTOM_TRIP') {
    return openCustomTripFlow(session, customer, agency);
  }

  return showMainMenu(session, customer, agency);
}

async function showServiceMenu(session, customer, agency, serviceGroup = '') {
  const serviceGroupKey = normalizeFlowKey(serviceGroup);
  const allServices = getFlowServiceMenu(agency);
  const services = serviceGroupKey
    ? allServices.filter((item) => item.category === serviceGroupKey)
    : allServices;
  const headerText = serviceGroupLabel(serviceGroupKey);

  if (!services.length) {
    return whatsappService.sendTextMessage(
      customer.phone,
      'Please share the service you need, route/date if applicable, and passenger count. Our team will follow up shortly.',
      getContext(customer, agency)
    );
  }

  await transitionTo(session, STEPS.MENU, {
    menuContext: 'SERVICE_MENU',
    serviceOptions: services.map((item) => `flow_service:${item.id}`),
    serviceGroup: serviceGroupKey,
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  return whatsappService.sendListMessage(
    customer.phone,
    'Choose the service you need.',
    'Services',
    [
      {
        title: 'Services',
        rows: services.map((item) => ({
          id: `flow_service:${item.id}`,
          title: item.title,
          description: item.description || 'Send enquiry to our team',
        })),
      },
    ],
    getContext(customer, agency),
    {
      headerText,
      footerText: 'Reply Hi anytime to restart.',
    }
  );
}

async function handleFlowActionSelection(session, customer, agency, item) {
  if (!item) return showMainMenu(session, customer, agency);

  if (item.action === 'OPEN_PACKAGE_CATEGORY_MENU') {
    return showPackageCategoryMenu(session, customer, agency);
  }

  if (item.action === 'OPEN_PROPERTY_FLOW') {
    return openPropertyFlow(session, customer, agency, 'properties');
  }

  if (item.action === 'OPEN_SERVICE_MENU') {
    return showServiceMenu(session, customer, agency, item.category || item.value || item.id);
  }

  if (item.action === 'OPEN_CUSTOM_TRIP_FLOW') {
    return openCustomTripFlow(session, customer, agency);
  }

  if (item.action === 'SHOW_TOUR_TYPE_LIST') {
    return showTourTypeMenu(session, customer, agency, item.category || 'DOMESTIC');
  }

  if (item.action === 'OPEN_PACKAGE_FLOW') {
    return openPackageFlow(session, customer, agency, item.category || session.collectedData?.packageCategory || 'DOMESTIC', item.tourType || null);
  }

  if (item.action === 'CAPTURE_SERVICE_DETAILS') {
    return handleCustomServiceSelection(session, customer, agency, {
      title: item.title,
      value: item.tourType || item.value || item.id,
    });
  }

  return showMainMenu(session, customer, agency);
}

async function handlePackageDetailReply(session, customer, agency, actionId, text) {
  const profile = getProfile(session);
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;

  if (actionId === 'action_enquire' || text === 'enquiry' || text === 'enquire now' || text === 'enquire' || text === '1') {
    return openEnquiryFlow(session, customer, agency);
  }

  if (actionId === 'action_call_now' || text === 'call now' || text === '2') {
    return sendCallNow(session, customer, agency);
  }

  if (actionId === 'action_download_itinerary' || text === 'download itinerary' || text === 'pdf' || (pkg?.brochureUrl && text === '3')) {
    return sendItinerary(session, customer, agency);
  }

  if (
    actionId === 'action_back_packages'
    || text === 'back to packages'
    || (!pkg?.brochureUrl && text === '3')
    || (pkg?.brochureUrl && text === '4')
    || text === 'back'
  ) {
    return reopenPackageContext(session, customer, agency, profile);
  }

  return sendInvalidChoice(session, customer, agency, () => showPackageDetail(session, customer, agency, profile.selectedPackageId));
}

async function handleTravelFlow(session, incoming, customer, agency) {
  let actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);
  const profile = getProfile(session);
  const menuContext = normalizeText(session.collectedData?.menuContext || '');

  if (!actionId && ['1', '2', '3'].includes(text)) {
    if (menuContext === 'WELCOME') {
      const options = Array.isArray(session.collectedData?.menuOptions) ? session.collectedData.menuOptions : [];
      actionId = normalizeText(options[parseInt(text, 10) - 1] || '')
        || { 1: 'menu_visa_ticketing', 2: 'menu_packages', 3: 'menu_properties' }[text]
        || '';
    } else if (menuContext === 'VISA_TICKETING') {
      actionId = { 1: 'visa_ticket_flight', 2: 'visa_ticket_rail' }[text] || '';
    } else if (menuContext === 'PLAN_TRIP') {
      const optionIndex = parseInt(text, 10) - 1;
      const options = Array.isArray(session.collectedData?.planTripOptions) ? session.collectedData.planTripOptions : [];
      actionId = normalizeText(options[optionIndex] || '');
    } else if (menuContext === 'SERVICE_MENU') {
      const optionIndex = parseInt(text, 10) - 1;
      const options = Array.isArray(session.collectedData?.serviceOptions) ? session.collectedData.serviceOptions : [];
      actionId = normalizeText(options[optionIndex] || '');
    } else if (menuContext === 'TOUR_TYPE') {
      const optionIndex = parseInt(text, 10) - 1;
      const options = Array.isArray(session.collectedData?.tourTypeOptions) ? session.collectedData.tourTypeOptions : [];
      actionId = normalizeText(options[optionIndex] || '');
    }
  }

  if (!actionId && menuContext === 'WELCOME' && /^\d+$/.test(text)) {
    const optionIndex = parseInt(text, 10) - 1;
    const options = Array.isArray(session.collectedData?.menuOptions) ? session.collectedData.menuOptions : [];
    actionId = normalizeText(options[optionIndex] || '');
  }

  if (actionId === 'global_main_menu') {
    return showMainMenu(session, customer, agency);
  }

  if (actionId === 'global_go_back') {
    return showMainMenu(session, customer, agency);
  }

  if (actionId === 'flow_submission' || incoming?.flowResponse) {
    return handleFlowSubmission(session, incoming, customer, agency);
  }

  if (text === 'menu' || text === 'main menu' || text === 'start over') {
    return showMainMenu(session, customer, agency);
  }

  const customMenuItem = findCustomMenuItem(agency, actionId, text);
  if (customMenuItem) {
    return handleCustomMenuSelection(session, customer, agency, customMenuItem);
  }

  const flowWelcomeItem = findFlowItem(getFlowWelcomeMenu(agency), actionId, text, 'flow_welcome:');
  if (flowWelcomeItem) {
    return handleFlowActionSelection(session, customer, agency, flowWelcomeItem);
  }

  const flowPackageCategoryItem = findFlowItem(getFlowPackageCategories(agency), actionId, text, 'flow_package_category:');
  if (flowPackageCategoryItem) {
    return handleFlowActionSelection(session, customer, agency, flowPackageCategoryItem);
  }

  const activeTourTypeItems = Array.isArray(session.collectedData?.tourTypeItems)
    ? session.collectedData.tourTypeItems
    : getFlowTourTypes(agency);
  const flowTourTypeItem = findFlowItem(activeTourTypeItems, actionId, text, 'flow_tour_type:');
  if (flowTourTypeItem && menuContext === 'TOUR_TYPE') {
    return openPackageFlow(session, customer, agency, profile.packageCategory || 'DOMESTIC', flowTourTypeItem.tourType || flowTourTypeItem.value);
  }

  const flowServiceItem = findFlowItem(getFlowServiceMenu(agency), actionId, text, 'flow_service:');
  if (flowServiceItem) {
    return handleFlowActionSelection(session, customer, agency, flowServiceItem);
  }

  if (actionId === 'menu_visa_ticketing' || text === 'visa & ticketing' || text === 'visa' || text === 'visa services' || text === 'ticketing') {
    return showVisaTicketingMenu(session, customer, agency);
  }

  if (actionId === 'visa_ticket_flight' || text === 'flight' || text === 'flight tickets') {
    return handleVisaTicketingSelection(session, customer, agency, 'FLIGHT');
  }

  if (actionId === 'visa_ticket_rail' || text === 'rail' || text === 'train') {
    return handleVisaTicketingSelection(session, customer, agency, 'RAIL');
  }

  if (actionId === 'menu_packages' || text === 'view packages' || text === 'packages' || text === 'show packages' || text === 'plan a trip' || text === 'tour package' || text === 'tour packages') {
    return showPackageCategoryMenu(session, customer, agency);
  }

  if (actionId === 'menu_custom_trip' || text === 'plan custom trip' || text === 'custom trip' || text === 'plan trip') {
    return openCustomTripFlow(session, customer, agency);
  }

  if (isCategoryAction(actionId, text)) {
    return openPackageFlow(session, customer, agency, resolveCategory(actionId, text));
  }

  if (actionId === 'menu_properties' || text === 'view properties' || text === 'properties' || text === 'show properties' || text === 'staycations') {
    return openPropertyFlow(session, customer, agency, resolvePropertyRoutingIntent(agency, text));
  }

  if (actionId === 'menu_catalog' || text === 'catalog' || text === 'shop') {
    if (agency.whatsappCatalogId) {
      const allPackages = await Package.findAll({ where: { agencyId: agency.id, isActive: true }, limit: 30 });
      return whatsappService.sendCatalogMessage(
        customer.phone,
        'Browse our full packages directly in WhatsApp! Tap below to open our store and check out your cart.',
        agency.whatsappCatalogId,
        allPackages.map(pkg => pkg.id),
        getContext(customer, agency)
      );
    }
  }

  if (session.currentStep === STEPS.SERVICE_DETAILS) {
    return saveServiceDetails(session, incoming, customer, agency);
  }

  if (session.currentStep === STEPS.CATEGORY_PACKAGES && ['list', 'show list', 'package list', 'packages list'].includes(text)) {
    if (profile.campaignId) {
      return reopenPackageContext(session, customer, agency, profile);
    }

    const packages = await findPackagesForCategory(agency.id, profile.packageCategory || 'DOMESTIC', PACKAGE_BROWSE_LIMIT, profile.packageTourType || null);
    return showPackageListFallback(session, customer, agency, profile.packageCategory || 'DOMESTIC', packages);
  }

  if (session.currentStep === STEPS.PROPERTY_LIST && ['list', 'show list', 'property list', 'properties list'].includes(text)) {
    const properties = await findActiveProperties(agency.id, PROPERTY_BROWSE_LIMIT, profile.propertyFilter || {});
    return showPropertyListFallback(session, customer, agency, properties);
  }

  if (actionId === 'action_back_packages' || text === 'back to packages' || text === 'view packages') {
    return reopenPackageContext(session, customer, agency, profile);
  }

  if (actionId === 'pkg_pick:' || actionId.startsWith('pkg_pick:')) {
    const selectedPackageId = normalizeText(actionId.split(':')[1]);
    logFlowEvent('list_package_selected', customer, agency, {
      step: session?.currentStep || null,
      actionId,
      selectedPackageId: selectedPackageId || null,
    });
    return showPackageDetail(session, customer, agency, selectedPackageId);
  }

  if (actionId.startsWith('property_pick:')) {
    const selectedPropertyId = normalizeText(actionId.split(':')[1]);
    logFlowEvent('list_property_selected', customer, agency, {
      step: session?.currentStep || null,
      actionId,
      selectedPropertyId: selectedPropertyId || null,
    });
    return showPropertyDetail(session, customer, agency, selectedPropertyId);
  }

  // Campaign broadcast package selection — reuse the same package detail view
  if (actionId.startsWith('campaign_pkg_pick:')) {
    const selectedPackageId = normalizeText(actionId.split(':')[1]);
    logFlowEvent('campaign_package_selected', customer, agency, {
      step: session?.currentStep || null,
      actionId,
      selectedPackageId: selectedPackageId || null,
    });
    return showPackageDetail(session, customer, agency, selectedPackageId);
  }

  if (session.currentStep === STEPS.CATEGORY_PACKAGES) {
    return handleCategoryPackageReply(session, customer, agency, text);
  }

  if (session.currentStep === STEPS.PROPERTY_LIST) {
    return sendInvalidChoice(session, customer, agency, () => reopenPropertyContext(session, customer, agency));
  }

  if (session.currentStep === STEPS.PACKAGE_DETAIL) {
    return handlePackageDetailReply(session, customer, agency, actionId, text);
  }

  if (session.currentStep === STEPS.PROPERTY_DETAIL) {
    if (actionId === 'action_property_enquire' || text === 'enquiry' || text === 'enquire') {
      return startPropertyEnquiry(session, customer, agency);
    }
    if (actionId === 'action_property_call_now' || text === 'call now') {
      return sendCallNow(session, customer, agency);
    }
    if (actionId === 'action_back_properties' || text === 'back' || text === 'back to properties') {
      return reopenPropertyContext(session, customer, agency);
    }
    return sendInvalidChoice(session, customer, agency, () => showPropertyDetail(session, customer, agency, profile.selectedPropertyId));
  }

  if ([
    STEPS.ENQUIRY_NAME,
    STEPS.ENQUIRY_PLACE,
    STEPS.ENQUIRY_ADDRESS,
    STEPS.ENQUIRY_DATE,
    STEPS.ENQUIRY_TRAVELLERS,
    STEPS.ENQUIRY_NOTES,
  ].includes(session.currentStep)) {
    if (text === 'back') {
      return showPackageDetail(session, customer, agency, profile.selectedPackageId);
    }
    return handleEnquiryStep(session, incoming, customer, agency);
  }

  if (session.currentStep === 'NEW' || session.currentStep === STEPS.MENU || session.currentStep === STEPS.COMPLETE) {
    return showMainMenu(session, customer, agency);
  }

  return sendInvalidChoice(session, customer, agency);
}

module.exports = {
  STEPS,
  handleTravelFlow,
  renderCurrentStep,
  buildProfileSummary,
  ensureLead,
  createFreshGreetingLead,
  getFlowBase64Image,
  buildFlowPackageOptions,
  buildFlowPropertyOptions,
  buildFlowPropertyLocationOptions,
  buildFlowPropertyTypeOptions,
  getAgencyTripFlowId,
  isMetaTripFlowConfigured,
  getPackageFlowConfig,
  getEnquiryFlowConfig,
  PROPERTY_FLOW_FIRST_SCREEN_ID,
  CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
};
