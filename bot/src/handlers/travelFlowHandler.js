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
  Service,
  Visa,
  Cruise,
  CampaignRecipient,
  WhatsAppFlow,
  Itinerary,
} = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));
const serviceRoutingService = require(path.resolve(__dirname, '../../../backend/src/services/serviceRoutingService.ts'));
const { updateSession } = require('../utils/sessionManager');
const {
  invalidReplyContext,
  shouldSuppressInvalidReply,
} = require('../utils/automationCooldowns');
const templates = require('../utils/messageTemplates');
const { bestMatch, similarity } = require('../utils/fuzzyMatch');
const { toWaMeNumber } = require('../utils/phoneFormat');
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
// Max base64 length for a single Flow card image (~18KB). Bigger images blow past
// WhatsApp's flow data-payload limit and get rejected with (#131009), so we downscale
// what we can (CDN URL params) and fall back to a placeholder for anything still too big.
const FLOW_IMAGE_MAX_BASE64 = 24000;
const FLOW_DOCUMENT_NEXT_NODE_DELAY_MS = Math.max(0, parseInt(process.env.FLOW_DOCUMENT_NEXT_NODE_DELAY_MS || '7000', 10) || 0);
const PACKAGE_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PACKAGE_BROWSE_LIMIT || '20', 10) || 20);
const PROPERTY_BROWSE_LIMIT = Math.max(1, parseInt(process.env.WHATSAPP_PROPERTY_BROWSE_LIMIT || '20', 10) || 20);
const FALLBACK_LIST_LIMIT = 10;
const imageCache = new Map();
const DEFAULT_WHATSAPP_MENU_LABELS = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Plan a Trip',
  staycations: 'Staycations',
  visaServices: 'Visa Services',
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
  'OPEN_TRAVEL_READINESS_FLOW',
  'SHOW_TOUR_TYPE_LIST',
  'OPEN_PACKAGE_FLOW',
  'CAPTURE_SERVICE_DETAILS',
]);

function normalizeText(value = '') {
  return String(value || '').trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return normalizeText(template)
    .replace(/\{customerName\}/gi, replacements.customerName || '')
    .replace(/\{agencyName\}/gi, replacements.agencyName || '');
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

function parseStayrouteTravellerCount(text = '') {
  const normalized = lower(text);
  if (/\b(solo|single|alone|one)\b/.test(normalized)) return 1;
  const match = normalized.match(/\d+/);
  if (match) return parseInt(match[0], 10);
  if (/\bcouple\b/.test(normalized)) return 2;
  return null;
}

function parseStayrouteTripType(text = '') {
  const normalized = lower(text);
  if (/\b(couple|husband|wife)\b/.test(normalized)) return 'Couple';
  if (/\b(family|families|parents|kids|children)\b/.test(normalized)) return 'Family';
  if (/\b(bachelor|friends|boys|girls|solo|single|alone)\b/.test(normalized)) return 'Not eligible';
  return null;
}

function parseStayrouteAirport(text = '') {
  const normalized = lower(text);
  if (normalized === '1' || normalized.includes('kochi') || normalized.includes('cochin') || normalized.includes('cok')) return 'Kochi (COK)';
  if (normalized === '2' || normalized.includes('thiruvananthapuram') || normalized.includes('trivandrum') || normalized.includes('trv')) return 'Thiruvananthapuram (TRV)';
  if (normalized === '3' || normalized.includes('kozhikode') || normalized.includes('calicut') || normalized.includes('ccj')) return 'Kozhikode (CCJ)';
  if (normalized === '4' || normalized.includes('kannur') || normalized.includes('cnn')) return 'Kannur (CNN)';
  return null;
}

function parseStayrouteRoomType(text = '') {
  const normalized = lower(text);
  if (normalized === '1' || normalized.includes('couple')) return 'Couple room';
  if (normalized === '2' || normalized.includes('family')) return 'Family room';
  return null;
}

async function startStayrouteOnamTextFlow(session, customer, agency) {
  await transitionTo(session, STEPS.MENU, {
    menuContext: 'STAYROUTE_ONAM_TRAVELLERS',
    stayrouteOnam: {},
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    [
      'Hi 👋',
      '',
      'Thank you for your interest in our Onam trip (27th-31st August).',
      '',
      'May I know how many travellers are planning to join the trip?',
    ].join('\n'),
    getContext(customer, agency)
  );
}

async function politelyCloseStayrouteIneligible(session, customer, agency) {
  await transitionTo(session, STEPS.COMPLETE, {
    menuContext: null,
    stayrouteOnam: {},
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    [
      'Thank you for checking with us.',
      '',
      'This trip is arranged for couples and families, so it may not be suitable for a solo traveller or bachelor group.',
      '',
      'Our travel consultant can still help you with another suitable option.',
    ].join('\n'),
    getContext(customer, agency)
  );
}

async function askStayrouteTripType(session, customer, agency, travellerCount) {
  await transitionTo(session, STEPS.MENU, {
    menuContext: 'STAYROUTE_ONAM_TRIP_TYPE',
    stayrouteOnam: {
      ...(session.collectedData?.stayrouteOnam || {}),
      travellerCount,
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    'Thank you. Could you please tell us if this trip is for a couple or family?',
    getContext(customer, agency)
  );
}

async function askStayrouteAirport(session, customer, agency, updates = {}) {
  await transitionTo(session, STEPS.MENU, {
    menuContext: 'STAYROUTE_ONAM_AIRPORT',
    stayrouteOnam: {
      ...(session.collectedData?.stayrouteOnam || {}),
      ...updates,
    },
  });

  return whatsappService.sendListMessage(
    customer.phone,
    'Please choose your preferred departure airport.',
    'Select Airport',
    [
      {
        title: 'Kerala Airports',
        rows: [
          { id: 'stayroute_airport_cok', title: 'Kochi (COK)', description: 'Cochin International Airport' },
          { id: 'stayroute_airport_trv', title: 'Trivandrum (TRV)', description: 'Thiruvananthapuram Airport' },
          { id: 'stayroute_airport_ccj', title: 'Kozhikode (CCJ)', description: 'Calicut International Airport' },
          { id: 'stayroute_airport_cnn', title: 'Kannur (CNN)', description: 'Kannur International Airport' },
        ],
      },
    ],
    getContext(customer, agency),
    {
      footerText: 'Choose one airport to continue.',
    }
  );
}

async function askStayrouteRoomType(session, customer, agency, departureAirport) {
  await transitionTo(session, STEPS.MENU, {
    menuContext: 'STAYROUTE_ONAM_ROOM',
    stayrouteOnam: {
      ...(session.collectedData?.stayrouteOnam || {}),
      departureAirport,
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    [
      'Preferred room type?',
      '',
      '1. Couple room',
      '2. Family room',
    ].join('\n'),
    getContext(customer, agency)
  );
}

async function completeStayrouteOnamTextFlow(session, customer, agency, roomType) {
  const details = {
    ...(session.collectedData?.stayrouteOnam || {}),
    roomType,
  };
  const bismina = await findStayrouteBisminaAgent(agency).catch(() => null);
  const notes = [
    'Onam trip enquiry submitted from WhatsApp welcome chat',
    details.travellerCount ? `Travellers: ${details.travellerCount}` : null,
    details.departureAirport ? `Departure airport: ${details.departureAirport}` : null,
    details.roomType ? `Preferred room type: ${details.roomType}` : null,
  ].filter(Boolean).join(' | ');

  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey: 'packages',
    source: 'whatsapp_organic',
    campaignName: 'Onam trip',
    campaignAction: 'WELCOME_CHAT_ENQUIRY',
    status: 'ENQUIRY',
    travellers: details.travellerCount || null,
    notes,
    customTripDetails: {
      stayrouteOnam: details,
    },
  });

  if (bismina?.id && lead?.id && lead.assignedAgentId !== bismina.id) {
    await leadService.updateLead(lead.id, agency.id, { assignedAgentId: bismina.id }).catch((err) => {
      console.warn('[TravelFlow] Could not auto-assign StayRoute welcome enquiry to Bismina:', err.message);
    });
    lead.assignedAgentId = bismina.id;
  }

  if (bismina?.phone) {
    await whatsappService.sendTextMessage(
      bismina.phone,
      [
        'New Onam trip enquiry',
        '',
        `Customer: ${customer?.name || 'Not shared'}`,
        `Phone: ${customer?.phone || 'Not shared'}`,
        details.travellerCount ? `Travellers: ${details.travellerCount}` : null,
        details.departureAirport ? `Departure airport: ${details.departureAirport}` : null,
        details.roomType ? `Room type: ${details.roomType}` : null,
      ].filter(Boolean).join('\n'),
      getContext(customer, agency)
    ).catch((err) => {
      console.warn('[TravelFlow] Could not notify Bismina of StayRoute welcome enquiry:', err.message);
    });
  }

  await transitionTo(session, STEPS.COMPLETE, {
    activeLeadId: lead?.id || null,
    menuContext: null,
    stayrouteOnam: details,
  });

  const routedPhone = bismina?.phone || agency.phone || agency.whatsappNumber;
  const chatLink = buildWhatsAppChatLink(routedPhone, buildSpecialistPrefill({ customer, lead }));
  const message = 'Thank you. Our travel consultant will contact you shortly.';

  if (routedPhone && chatLink) {
    return whatsappService.sendUrlButtonMessage(
      customer.phone,
      message,
      'Chat WhatsApp',
      chatLink,
      getContext(customer, agency)
    );
  }

  return whatsappService.sendTextMessage(customer.phone, message, getContext(customer, agency));
}

async function handleStayrouteOnamTextFlow(session, customer, agency, text) {
  const menuContext = normalizeText(session.collectedData?.menuContext || '');

  if (menuContext === 'STAYROUTE_ONAM_TRAVELLERS') {
    const travellerCount = parseStayrouteTravellerCount(text);
    if (!travellerCount) {
      return whatsappService.sendTextMessage(
        customer.phone,
        'Please share the number of travellers, for example 2 or 4.',
        getContext(customer, agency)
      );
    }
    if (travellerCount <= 1) return politelyCloseStayrouteIneligible(session, customer, agency);
    return askStayrouteAirport(session, customer, agency, { travellerCount });
  }

  if (menuContext === 'STAYROUTE_ONAM_AIRPORT') {
    const departureAirport = parseStayrouteAirport(text);
    if (!departureAirport) {
      return whatsappService.sendTextMessage(
        customer.phone,
        'Please choose 1, 2, 3, or 4, or type the airport name.',
        getContext(customer, agency)
      );
    }
    return askStayrouteRoomType(session, customer, agency, departureAirport);
  }

  if (menuContext === 'STAYROUTE_ONAM_ROOM') {
    const roomType = parseStayrouteRoomType(text);
    if (!roomType) {
      return whatsappService.sendTextMessage(
        customer.phone,
        'Please choose 1 for Couple room or 2 for Family room.',
        getContext(customer, agency)
      );
    }
    return completeStayrouteOnamTextFlow(session, customer, agency, roomType);
  }

  return startStayrouteOnamTextFlow(session, customer, agency);
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
    .filter((item) => ['PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE'].includes(item.itemType) && item.itemId)
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
  uniqueIds(profile.selectedServiceIds, profile.selectedServiceId).forEach((id) => push('SERVICE', id));
  uniqueIds(profile.selectedVisaIds, profile.selectedVisaId).forEach((id) => push('VISA', id));
  uniqueIds(profile.selectedCruiseIds, profile.selectedCruiseId).forEach((id) => push('CRUISE', id));
  normalizeSelectedItems(extra.selectedItems).forEach((item) => push(item.itemType, item.itemId));
  push('PACKAGE', extra.packageId);
  push('PROPERTY', extra.propertyId);
  push('SERVICE', extra.serviceId);
  push('VISA', extra.visaId);
  push('CRUISE', extra.cruiseId);

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
  if (normalized === 'VISA') return 'Visa Services';
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

function routingKey(prefix, value = '') {
  const suffix = normalizeText(value)
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 56);
  return suffix ? `${prefix}_${suffix}`.slice(0, 80) : prefix;
}

function catalogRoutingIntent(itemType, item = {}) {
  const type = normalizeFlowCatalogType(itemType);
  if (type === 'SERVICE' && item?.id) return `service_${item.id}`;
  if (type === 'PACKAGE') return routingKey('packages', inferPackageCategory(item) || item.category || 'packages');
  if (type === 'PROPERTY') return routingKey('properties', item.propertyType || item.type || '');
  if (type === 'VISA') return routingKey('visa', item.country || item.visaType || '');
  if (type === 'CRUISE') return routingKey('cruises', item.cruiseLine || '');
  return type.toLowerCase();
}

const READINESS_LABELS = {
  ONE_PERSON: '1 traveller',
  TWO_PEOPLE: '2 travellers',
  THREE_TO_FIVE: '3-5 travellers',
  SIX_OR_MORE: '6 or more travellers',
  FAMILY_OR_GROUP: 'Family / Group',
  SOLO: 'Solo traveller',
  BACHELOR_GROUP: 'Bachelor group',
  COUPLE: 'Couple',
  FAMILY: 'Family',
  READY_TO_BOOK: 'Yes, ready to book',
  NEED_MORE_DETAILS: 'Need more details',
  JUST_EXPLORING: 'Just exploring',
  COK: 'Kochi (COK)',
  TRV: 'Thiruvananthapuram (TRV)',
  CCJ: 'Kozhikode (CCJ)',
  CNN: 'Kannur (CNN)',
  FLEXIBLE: 'Flexible / Any Kerala airport',
  COUPLE_ROOM: 'Couple room',
  FAMILY_ROOM: 'Family room',
};

function readinessAnswerLabel(value = '') {
  const normalized = normalizeText(value).toUpperCase();
  if (READINESS_LABELS[normalized]) return READINESS_LABELS[normalized];
  return normalizeText(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readinessTravellerNumber(value = '') {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized.includes('FAMILY') || normalized.includes('GROUP')) return null;
  if (normalized === 'ONE_PERSON') return 1;
  if (normalized === 'TWO_PEOPLE') return 2;
  if (normalized === 'THREE_TO_FIVE') return 3;
  if (normalized === 'SIX_OR_MORE') return 6;
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
  const tripType = normalizeText(
    response.tripType
    || response.trip_type
    || response.travelType
    || response.travel_type
    || readinessFormResponse.tripType
    || readinessFormResponse.trip_type
    || readinessFormResponse.travelType
    || readinessFormResponse.travel_type
  );
  const departureAirport = normalizeText(
    response.departureAirport
    || response.departure_airport
    || readinessFormResponse.departureAirport
    || readinessFormResponse.departure_airport
  );
  const roomType = normalizeText(
    response.roomType
    || response.room_type
    || readinessFormResponse.roomType
    || readinessFormResponse.room_type
  );

  return {
    travellerCount,
    bookingReadiness,
    tripType,
    departureAirport,
    roomType,
    hasReadinessFields: !!(travellerCount || bookingReadiness || tripType || departureAirport || roomType),
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

function getPropertyLocationFieldKey(data = {}) {
  return normalizeText(data.propertyLocationField || data.locationFieldKey || 'propertyLocation') || 'propertyLocation';
}

function selectedPropertyLocationForCatalog(data = {}, fields = {}) {
  return normalizeText(data.propertyLocation || fields[getPropertyLocationFieldKey(data)] || '');
}

function buildPropertyLocationRows(properties = []) {
  const grouped = new Map();

  for (const property of properties) {
    const location = normalizeText(property?.location);
    if (!location) continue;
    const key = location.toLowerCase();
    const existing = grouped.get(key) || { id: location, title: location.slice(0, 24), count: 0 };
    existing.count += 1;
    grouped.set(key, existing);
  }

  return [
    { id: 'ALL', title: 'All locations', description: 'Show every property' },
    ...Array.from(grouped.values()).map((row) => ({
      id: row.id,
      title: row.title,
      description: `${row.count} propert${row.count === 1 ? 'y' : 'ies'}`.slice(0, 72),
    })).slice(0, FALLBACK_LIST_LIMIT - 1),
  ];
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
  const packageName = publicPackageName(pkg);
  return [
    `Hi, I am ${customer?.name || 'interested customer'}.`,
    packageName ? `I want to check availability for ${packageName}.` : `I want to discuss my ${campaignName || 'custom trip enquiry'}.`,
  ].filter(Boolean).join('\n');
}

function isStayrouteOnamContext(profile = {}) {
  return String(profile.menuContext || '').startsWith('STAYROUTE_ONAM_')
    || /kashmir\s+onam|onam\s+trip/i.test(String(profile.campaignName || ''));
}

function isCustomTripReadinessContext(profile = {}) {
  return String(profile.campaignName || '').trim().toLowerCase() === 'custom trip'
    && !profile.selectedPackageId
    && !uniqueIds(profile.selectedPackageIds).length;
}

function publicPackageName(pkg) {
  const name = String(pkg?.name || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  const copyCount = (name.match(/\(copy\)/gi) || []).length;
  const withoutCopySuffixes = name.replace(/\s*\(copy\)/gi, '').trim();
  if (copyCount > 0 && withoutCopySuffixes.length < 3) return '';
  if (copyCount > 1) return '';
  return name;
}

function readinessEnquiryLabel({ pkg, profile = {} } = {}) {
  const packageName = publicPackageName(pkg);
  if (packageName && !isCustomTripReadinessContext(profile)) return packageName;
  if (isStayrouteOnamContext(profile)) return profile.campaignName || 'Kashmir Onam Special';
  if (profile.campaignName && !/kashmir\s+onam|onam\s+trip/i.test(String(profile.campaignName))) return profile.campaignName;
  return 'custom trip';
}

function formatCurrency(amountPaise) {
  const amount = Number(amountPaise || 0) / 100;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function packagePriceLabel(amountPaise) {
  const amount = Number(amountPaise || 0);
  return Number.isFinite(amount) && amount > 0 ? formatCurrency(amount) : '';
}

function visaListLabel(visa = {}) {
  return [visa.country, visa.visaType].filter(Boolean).join(' · ') || 'Visa Service';
}

function bulletList(items = []) {
  return items
    .map((item) => (typeof item === 'string' ? item : (item?.name || item?.title || '')))
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join('\n');
}

// ---- WhatsApp Flow config lookups (published image-selector flows per domain) ----
async function getVisaFlowConfig(agency) {
  const flow = await getPublishedFlowByType(agency.id, 'VISA');
  if (!flow?.metaFlowId) return null;
  return { flowId: flow.metaFlowId, firstScreenId: flow.firstScreenId || 'VISA_SELECTOR' };
}

async function getCruiseFlowConfig(agency) {
  const flow = await getPublishedFlowByType(agency.id, 'CRUISE');
  if (!flow?.metaFlowId) return null;
  return { flowId: flow.metaFlowId, firstScreenId: flow.firstScreenId || 'CRUISE_SELECTOR' };
}

async function getServiceFlowConfig(agency) {
  const flow = await getPublishedFlowByType(agency.id, 'SERVICE');
  if (!flow?.metaFlowId) return null;
  return { flowId: flow.metaFlowId, firstScreenId: flow.firstScreenId || 'SERVICE_SELECTOR' };
}

// ---- Flow option builders (id/title/description/metadata + base64 image), like packages ----
async function buildFlowVisaOptions(visas) {
  return Promise.all(visas.map(async (visa) => ({
    id: visa.id,
    title: escapeMarkdown(visaListLabel(visa)).slice(0, 30),
    description: `${[packagePriceLabel(visa.price), visa.processingTime].filter(Boolean).join(' - ')}\n${escapeMarkdown(visa.description || `${visa.visaType || 'Visa'} for ${visa.country || 'your destination'}`).slice(0, 200)}`.trim().slice(0, 300),
    metadata: escapeMarkdown(visa.visaType || 'Visa').slice(0, 20),
    image: await getFlowBase64Image(visa.imageUrl),
  })));
}

async function buildFlowCruiseOptions(cruises) {
  return Promise.all(cruises.map(async (cruise) => ({
    id: cruise.id,
    title: escapeMarkdown(cruise.name || 'Cruise').slice(0, 30),
    description: `${[packagePriceLabel(cruise.basePrice), cruise.duration].filter(Boolean).join(' - ')}\n${escapeMarkdown(cruise.summary || (Array.isArray(cruise.destinations) ? cruise.destinations.join(', ') : '') || 'Curated cruise holiday').slice(0, 200)}`.trim().slice(0, 300),
    metadata: escapeMarkdown(cruise.cruiseLine || 'Cruise').slice(0, 20),
    image: await getFlowBase64Image(cruise.imageUrl),
  })));
}

async function buildFlowServiceOptions(services) {
  return Promise.all(services.map(async (service) => ({
    id: service.id,
    title: escapeMarkdown(service.name || 'Service').slice(0, 30),
    description: escapeMarkdown(service.description || service.category || 'Tap to view details and enquire.').slice(0, 300),
    metadata: escapeMarkdown(service.category || 'Service').slice(0, 20),
    image: await getFlowBase64Image(service.imageUrl),
  })));
}

// Shared detail card: image + caption + Enquiry / Call Now buttons (mirrors showPackageDetail).
async function sendItemDetailCard(customer, agency, caption, imageUrl, detailOptions = {}) {
  if (detailOptions.showActions === false) {
    return whatsappService.sendTextMessage(customer.phone, caption, getContext(customer, agency));
  }

  const context = getContext(customer, agency);
  const buttons = [
    { id: 'action_item_enquire', title: 'Enquiry' },
    { id: 'action_call_now', title: 'Call Now' },
  ];
  const options = { footerText: 'Tap Enquiry to connect with our team.' };
  if (imageUrl) {
    const media = await whatsappService.sendMediaButtonsMessage(customer.phone, caption, imageUrl, buttons, context, options);
    if (media?.status !== 'FAILED') return media;
  }
  return whatsappService.sendButtonsMessage(customer.phone, caption, buttons, context, options);
}

// ---- VISA ----
// OPEN_VISA_FLOW node: send the image-selector Meta flow when published, else a text list.
async function openVisaFlow(session, customer, agency, filters = {}) {
  const where = { agencyId: agency.id, isActive: true };
  if (filters.country) where.country = { [Op.iLike]: `%${filters.country}%` };
  if (filters.visaType) where.visaType = { [Op.iLike]: filters.visaType };
  const visas = await Visa.findAll({ where, order: [['country', 'ASC']], limit: PACKAGE_BROWSE_LIMIT });

  await ensureLead(session, customer, agency, {
    interest: 'VISA',
    notes: `Visa list opened${filters.country ? ` for ${filters.country}` : ''}`,
  });

  if (!visas.length) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'We do not have active visa services listed right now. Share the country you need a visa for and our team will assist you.',
      getContext(customer, agency)
    );
    return;
  }

  const flowConfig = await getVisaFlowConfig(agency);
  if (!flowConfig?.flowId) return showVisaListFallback(customer, agency, visas);

  const visaOptions = await buildFlowVisaOptions(visas);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    'Browse our visa services 👇',
    {
      flowId: flowConfig.flowId,
      firstScreenId: flowConfig.firstScreenId || 'VISA_SELECTOR',
      flowCta: 'View Visas',
      flowToken: `visa|${agency.id}|${customer.id}|${Date.now()}`,
      data: { category_label: 'Visa Services', visa_options: visaOptions },
    },
    getContext(customer, agency),
    { headerText: 'Visa Services', footerText: 'Reply LIST if the flow does not open.' }
  );
  if (flowResponse?.status === 'FAILED') return showVisaListFallback(customer, agency, visas);
  return flowResponse;
}

async function showVisaListFallback(customer, agency, visas) {
  return whatsappService.sendListMessage(
    customer.phone,
    'Here are our visa services. Select one to view details. 🛂',
    'View Visas',
    [
      {
        title: 'Visa Services',
        rows: visas.slice(0, FALLBACK_LIST_LIMIT).map((visa) => ({
          id: `visa_pick:${visa.id}`,
          title: normalizeText(visaListLabel(visa)).slice(0, 24),
          description: [visa.processingTime, packagePriceLabel(visa.price)].filter(Boolean).join(' · ').slice(0, 72),
        })),
      },
    ],
    getContext(customer, agency),
    { footerText: 'Reply Hi anytime to restart.' }
  );
}

async function showVisaDetail(session, customer, agency, visaId) {
  const visa = await Visa.findOne({ where: { id: normalizeText(visaId), agencyId: agency.id } });
  if (!visa) {
    return whatsappService.sendTextMessage(customer.phone, 'That visa option is no longer available.', getContext(customer, agency));
  }
  const docs = Array.isArray(visa.requiredDocuments) ? visa.requiredDocuments : [];
  const caption = [
    `🛂 *${visaListLabel(visa)}*`,
    packagePriceLabel(visa.price) ? `Fee: ${packagePriceLabel(visa.price)}` : null,
    visa.processingTime ? `Processing: ${visa.processingTime}` : null,
    visa.validityPeriod ? `Validity: ${visa.validityPeriod}` : null,
    visa.description ? `\n${visa.description}` : null,
    docs.length ? `\n*Documents required:*\n${bulletList(docs)}` : null,
  ].filter(Boolean).join('\n').slice(0, 1024);
  await ensureLead(session, customer, agency, {
    routingIntentKey: catalogRoutingIntent('VISA', visa),
    visaId: visa.id,
    itemType: 'VISA',
    interest: 'VISA',
    customTripDetails: {
      visaEnquiry: {
        visaId: visa.id,
        country: visa.country || '',
        visaType: visa.visaType || '',
        selectedAt: new Date().toISOString(),
      },
    },
    notes: `Viewed visa: ${visaListLabel(visa)}`,
  });
  return sendItemDetailCard(customer, agency, caption, visa.imageUrl);
}

// ---- CRUISE ----
async function openCruiseFlow(session, customer, agency, filters = {}) {
  const all = await Cruise.findAll({ where: { agencyId: agency.id, isActive: true }, order: [['name', 'ASC']], limit: 50 });
  const dest = String(filters.destination || '').toLowerCase();
  const line = String(filters.cruiseLine || '').toLowerCase();
  const cruises = all.filter((cruise) =>
    (!dest || (Array.isArray(cruise.destinations) ? cruise.destinations.join(' ') : '').toLowerCase().includes(dest))
    && (!line || String(cruise.cruiseLine || '').toLowerCase().includes(line))
  ).slice(0, PACKAGE_BROWSE_LIMIT);

  await ensureLead(session, customer, agency, { interest: 'CRUISE', notes: 'Cruise list opened' });

  if (!cruises.length) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'We do not have active cruises listed right now. Share your preferred destination and our team will help you plan.',
      getContext(customer, agency)
    );
    return;
  }

  const flowConfig = await getCruiseFlowConfig(agency);
  if (!flowConfig?.flowId) return showCruiseListFallback(customer, agency, cruises);

  const cruiseOptions = await buildFlowCruiseOptions(cruises);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    'Browse our cruise holidays 👇',
    {
      flowId: flowConfig.flowId,
      firstScreenId: flowConfig.firstScreenId || 'CRUISE_SELECTOR',
      flowCta: 'View Cruises',
      flowToken: `cruise|${agency.id}|${customer.id}|${Date.now()}`,
      data: { category_label: 'Cruise Holidays', cruise_options: cruiseOptions },
    },
    getContext(customer, agency),
    { headerText: 'Cruise Holidays', footerText: 'Reply LIST if the flow does not open.' }
  );
  if (flowResponse?.status === 'FAILED') return showCruiseListFallback(customer, agency, cruises);
  return flowResponse;
}

async function showCruiseListFallback(customer, agency, cruises) {
  return whatsappService.sendListMessage(
    customer.phone,
    'Here are our cruise holidays. Select one to view details. 🚢',
    'View Cruises',
    [
      {
        title: 'Cruises',
        rows: cruises.slice(0, FALLBACK_LIST_LIMIT).map((cruise) => ({
          id: `cruise_pick:${cruise.id}`,
          title: normalizeText(cruise.name || 'Cruise').slice(0, 24),
          description: [cruise.duration, packagePriceLabel(cruise.basePrice)].filter(Boolean).join(' · ').slice(0, 72),
        })),
      },
    ],
    getContext(customer, agency),
    { footerText: 'Reply Hi anytime to restart.' }
  );
}

async function showCruiseDetail(session, customer, agency, cruiseId) {
  const cruise = await Cruise.findOne({ where: { id: normalizeText(cruiseId), agencyId: agency.id } });
  if (!cruise) {
    return whatsappService.sendTextMessage(customer.phone, 'That cruise is no longer available.', getContext(customer, agency));
  }
  const dests = Array.isArray(cruise.destinations) ? cruise.destinations : [];
  const inclusions = Array.isArray(cruise.inclusions) ? cruise.inclusions : [];
  const caption = [
    `🚢 *${cruise.name}*`,
    cruise.cruiseLine ? `Cruise line: ${cruise.cruiseLine}` : null,
    cruise.departurePort ? `Departs from: ${cruise.departurePort}` : null,
    dests.length ? `Destinations: ${dests.join(', ')}` : null,
    cruise.duration ? `Duration: ${cruise.duration}` : null,
    packagePriceLabel(cruise.basePrice) ? `From ${packagePriceLabel(cruise.basePrice)}` : null,
    cruise.summary ? `\n${cruise.summary}` : null,
    inclusions.length ? `\n*Inclusions:*\n${bulletList(inclusions)}` : null,
  ].filter(Boolean).join('\n').slice(0, 1024);
  await ensureLead(session, customer, agency, {
    routingIntentKey: catalogRoutingIntent('CRUISE', cruise),
    cruiseId: cruise.id,
    itemType: 'CRUISE',
    destination: dests[0] || null,
    interest: 'CRUISE',
    customTripDetails: {
      cruiseEnquiry: {
        cruiseId: cruise.id,
        cruiseName: cruise.name || '',
        cruiseLine: cruise.cruiseLine || '',
        destinations: dests,
        selectedAt: new Date().toISOString(),
      },
    },
    notes: `Viewed cruise: ${cruise.name}`,
  });
  return sendItemDetailCard(customer, agency, caption, cruise.imageUrl);
}

// ---- SERVICE ----
async function openServiceFlow(session, customer, agency, filters = {}) {
  const where = { agencyId: agency.id, isActive: true };
  if (filters.category) where.category = { [Op.iLike]: filters.category };
  const services = await Service.findAll({ where, order: [['name', 'ASC']], limit: PACKAGE_BROWSE_LIMIT });

  await ensureLead(session, customer, agency, { interest: 'SERVICE', notes: 'Service list opened' });

  if (!services.length) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'Please share what service you need and our team will assist you shortly.',
      getContext(customer, agency)
    );
    return;
  }

  const flowConfig = await getServiceFlowConfig(agency);
  if (!flowConfig?.flowId) return showServiceListFallback(customer, agency, services);

  const serviceOptions = await buildFlowServiceOptions(services);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    'Browse our services 👇',
    {
      flowId: flowConfig.flowId,
      firstScreenId: flowConfig.firstScreenId || 'SERVICE_SELECTOR',
      flowCta: 'View Services',
      flowToken: `service|${agency.id}|${customer.id}|${Date.now()}`,
      data: { category_label: 'Our Services', service_options: serviceOptions },
    },
    getContext(customer, agency),
    { headerText: 'Our Services', footerText: 'Reply LIST if the flow does not open.' }
  );
  if (flowResponse?.status === 'FAILED') return showServiceListFallback(customer, agency, services);
  return flowResponse;
}

async function showServiceListFallback(customer, agency, services) {
  return whatsappService.sendListMessage(
    customer.phone,
    'Here are our services. Select one to view details. ✨',
    'View Services',
    [
      {
        title: 'Services',
        rows: services.slice(0, FALLBACK_LIST_LIMIT).map((service) => ({
          id: `service_pick:${service.id}`,
          title: normalizeText(service.name || 'Service').slice(0, 24),
          description: normalizeText(service.category || service.description || '').slice(0, 72),
        })),
      },
    ],
    getContext(customer, agency),
    { footerText: 'Reply Hi anytime to restart.' }
  );
}

async function showServiceDetail(session, customer, agency, serviceId) {
  const service = await Service.findOne({ where: { id: normalizeText(serviceId), agencyId: agency.id } });
  if (!service) {
    return whatsappService.sendTextMessage(customer.phone, 'That service is no longer available.', getContext(customer, agency));
  }
  const caption = [
    `✨ *${service.name}*`,
    service.category ? `Category: ${service.category}` : null,
    service.description ? `\n${service.description}` : null,
  ].filter(Boolean).join('\n').slice(0, 1024);
  await ensureLead(session, customer, agency, {
    routingIntentKey: catalogRoutingIntent('SERVICE', service),
    serviceId: service.id,
    itemType: 'SERVICE',
    interest: 'SERVICE',
    customTripDetails: {
      serviceEnquiry: {
        serviceId: service.id,
        serviceName: service.name || '',
        serviceCategory: service.category || '',
        selectedAt: new Date().toISOString(),
      },
      service: normalizeServiceValue(service.name || service.category || 'SERVICE'),
      serviceLabel: service.name || '',
      serviceCategory: service.category || '',
    },
    notes: `Viewed service: ${service.name}`,
  });
  await updateSession(session, {
    currentStep: STEPS.MENU,
    collectedData: {
      selectedServiceId: service.id,
      selectedService: normalizeServiceValue(service.name || service.category || 'SERVICE'),
      selectedServiceLabel: service.name || 'Service',
      serviceCategory: service.category || 'SERVICE',
    },
  });
  return sendItemDetailCard(customer, agency, caption, service.imageUrl);
}

function packageSummaryLine(pkg, separator = ' - ') {
  return [
    packagePriceLabel(pkg?.basePrice),
    escapeMarkdown(pkg?.duration || 'Custom itinerary'),
  ].filter(Boolean).join(separator);
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
      checkInDate: enquiry.checkInDate || '',
      checkOutDate: enquiry.checkOutDate || '',
      travellers: enquiry.travellers || null,
      budgetPerPerson: enquiry.budgetPerPerson || null,
      stayType: enquiry.stayType || '',
      propertyType: enquiry.propertyType || '',
      getOutHouseDetails: enquiry.getOutHouseDetails && typeof enquiry.getOutHouseDetails === 'object'
        ? enquiry.getOutHouseDetails
        : {},
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

async function recordMenuSent(session) {
  await updateSession(session, {
    collectedData: {
      lastMenuSentAt: new Date().toISOString(),
      lastInvalidAutoReplyAt: null,
      lastInvalidAutoReplyContext: null,
    },
  });
}

async function sendInvalidChoice(session, customer, agency) {
  const context = invalidReplyContext(session);
  const suppressReply = shouldSuppressInvalidReply(session, context);
  const collectedData = suppressReply
    ? {}
    : {
      lastInvalidAutoReplyAt: new Date().toISOString(),
      lastInvalidAutoReplyContext: context,
    };

  await updateSession(session, {
    failedAttempts: (session.failedAttempts || 0) + 1,
    collectedData,
  });

  if (suppressReply) {
    return null;
  }

  await whatsappService.sendTextMessage(
    customer.phone,
    'Please use one of the options shown in WhatsApp so I can continue smoothly.',
    getContext(customer, agency)
  );
  return null;
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
    packagePriceLabel(pkg.basePrice) ? `💰 ${packagePriceLabel(pkg.basePrice)}` : 'Price on request',
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
    packagePriceLabel(pkg.basePrice) ? `Price: ${packagePriceLabel(pkg.basePrice)}` : 'Price: On request',
    pkg.duration ? `Duration: ${escapeMarkdown(pkg.duration)}` : null,
    '',
    ...sections,
  ].filter((line) => line !== null && line !== undefined && line !== '').join('\n');
}

function buildPackageDetailCardCaption(pkg) {
  const destinations = normalizePackageList(pkg?.destinations);
  const highlights = normalizePackageList(pkg?.inclusions).slice(0, 4);
  const summary = packageDescriptionText(pkg?.summary || buildShortDescription(pkg)).slice(0, 120);

  return [
    `*${escapeMarkdown(pkg.name)}*`,
    packagePriceLabel(pkg.basePrice) ? `Price: ${packagePriceLabel(pkg.basePrice)}` : 'Price: On request',
    pkg.duration ? `Duration: ${escapeMarkdown(pkg.duration)}` : null,
    destinations.length ? `Route: ${destinations.slice(0, 3).join(', ')}` : null,
    summary ? `\n${summary}` : null,
    highlights.length ? `\nHighlights:\n${highlights.map((item) => `- ${item}`).join('\n')}` : null,
    pkg.brochureUrl ? '\nReply PDF for full itinerary.' : null,
    '\nSelect an option below.',
  ].filter(Boolean).join('\n').slice(0, 900);
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
        description: packageSummaryLine(pkg).slice(0, 72),
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

async function getTravelReadinessFlowConfig(agency) {
  if (!agency?.id) return null;

  const readinessFlow = await WhatsAppFlow.findOne({
    where: {
      agencyId: agency.id,
      status: { [Op.in]: ['PUBLISHED', 'DRAFT'] },
      metaFlowId: { [Op.ne]: null },
      name: { [Op.iLike]: '%Travel Readiness Questionnaire%' },
    },
    order: [
      ['status', 'DESC'],
      ['updatedAt', 'DESC'],
    ],
  });

  if (!readinessFlow?.metaFlowId) return null;
  return {
    flowId: readinessFlow.metaFlowId,
    firstScreenId: readinessFlow.firstScreenId || 'TRAVELLER_COUNT',
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
  // Cloudinary: inject a server-side resize transform.
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/${FLOW_IMAGE_TRANSFORM}/`);
  }

  // Unsplash / imgix and other CDNs that resize via query params (?w=&q=).
  // Without this, full-size images (hundreds of KB each) overflow the Flow data payload.
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const hasResizeParams = parsed.searchParams.has('w')
      || parsed.searchParams.has('width')
      || parsed.searchParams.has('q');
    if (host.includes('images.unsplash.com') || host.includes('imgix') || hasResizeParams) {
      parsed.searchParams.set('w', '160');
      parsed.searchParams.set('q', '40');
      parsed.searchParams.delete('width');
      parsed.searchParams.delete('h');
      if (!parsed.searchParams.get('fit')) parsed.searchParams.set('fit', 'crop');
      if (!parsed.searchParams.get('auto')) parsed.searchParams.set('auto', 'format');
      return parsed.toString();
    }
  } catch (_err) {
    // Not a parseable URL — leave it untouched; the size guard will protect the payload.
  }

  return url;
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
    let encoded = buffer.length ? buffer.toString('base64') : FLOW_PLACEHOLDER_IMAGE;
    if (encoded.length > FLOW_IMAGE_MAX_BASE64) {
      console.warn(`[TravelFlow] Flow image too large after resize (${encoded.length}b); using placeholder`);
      encoded = FLOW_PLACEHOLDER_IMAGE;
    }
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
    description: `${packageSummaryLine(pkg)}\n${buildShortDescription(pkg)}`.trim().slice(0, 300),
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

  const fallbackTypes = [
    { id: 'Villa', title: 'Villa' },
    { id: 'Resort', title: 'Resort' },
    { id: 'Hotel', title: 'Hotel' },
    { id: 'Apartment', title: 'Apartment' },
    { id: 'Homestay', title: 'Homestay' },
  ];

  return [
    { id: 'ALL', title: 'All stay types' },
    ...(propertyTypes.length ? propertyTypes : fallbackTypes),
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
      // Entry-stage leads carry a null status; match those too so we reuse the
      // existing lead instead of creating a duplicate on every message.
      [Op.or]: [
        { status: null },
        { status: { [Op.in]: ['JUST_CONTACTED', 'NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] } },
      ],
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
  const firstSelectedServiceId = selectedItems.find((item) => item.itemType === 'SERVICE')?.itemId || null;
  const firstSelectedVisaId = selectedItems.find((item) => item.itemType === 'VISA')?.itemId || null;
  const firstSelectedCruiseId = selectedItems.find((item) => item.itemType === 'CRUISE')?.itemId || null;
  const primaryPackageId = extra.packageId || profile.selectedPackageId || firstSelectedPackageId || null;
  const primaryPropertyId = extra.propertyId || profile.selectedPropertyId || firstSelectedPropertyId || null;
  const primaryServiceId = extra.serviceId || profile.selectedServiceId || firstSelectedServiceId || null;
  const primaryVisaId = extra.visaId || profile.selectedVisaId || firstSelectedVisaId || null;
  const primaryCruiseId = extra.cruiseId || profile.selectedCruiseId || firstSelectedCruiseId || null;
  const pkg = primaryPackageId
    ? await Package.findOne({ where: { id: primaryPackageId, agencyId: agency.id } })
    : null;
  const property = primaryPropertyId
    ? await Property.findOne({ where: { id: primaryPropertyId, agencyId: agency.id } })
    : null;
  const service = primaryServiceId
    ? await Service.findOne({ where: { id: primaryServiceId, agencyId: agency.id } })
    : null;
  const visa = primaryVisaId
    ? await Visa.findOne({ where: { id: primaryVisaId, agencyId: agency.id } })
    : null;
  const cruise = primaryCruiseId
    ? await Cruise.findOne({ where: { id: primaryCruiseId, agencyId: agency.id } })
    : null;
  const validPackageId = pkg?.id || null;
  const validPropertyId = property?.id || null;
  const validServiceId = service?.id || null;
  const validVisaId = visa?.id || null;
  const validCruiseId = cruise?.id || null;
  const validSelectedItems = selectedItems.filter((item) => {
    if (item.itemType === 'PACKAGE') return item.itemId !== primaryPackageId || !!validPackageId;
    if (item.itemType === 'PROPERTY') return item.itemId !== primaryPropertyId || !!validPropertyId;
    if (item.itemType === 'SERVICE') return item.itemId !== primaryServiceId || !!validServiceId;
    if (item.itemType === 'VISA') return item.itemId !== primaryVisaId || !!validVisaId;
    if (item.itemType === 'CRUISE') return item.itemId !== primaryCruiseId || !!validCruiseId;
    return true;
  });
  const inferredItemType = extra.itemType
    || (validServiceId ? 'SERVICE' : validVisaId ? 'VISA' : validCruiseId ? 'CRUISE' : validPropertyId ? 'PROPERTY' : validPackageId ? 'PACKAGE' : null);

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
      serviceId: validServiceId,
      visaId: validVisaId,
      cruiseId: validCruiseId,
      selectedItems: validSelectedItems,
      itemType: inferredItemType,
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
    const previousFlowSubmissions = Array.isArray(lead.customTripDetails?.flowSubmissions)
      ? lead.customTripDetails.flowSubmissions
      : [];
    const incomingFlowSubmissions = Array.isArray(extra.customTripDetails?.flowSubmissions)
      ? extra.customTripDetails.flowSubmissions
      : [];

    const updates = {
      packageId: validPackageId || lead.packageId || null,
      propertyId: validPropertyId || lead.propertyId || null,
      serviceId: validServiceId || lead.serviceId || null,
      visaId: validVisaId || lead.visaId || null,
      cruiseId: validCruiseId || lead.cruiseId || null,
      selectedItems: validSelectedItems,
      itemType: inferredItemType || lead.itemType || null,
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
          ...(incomingFlowSubmissions.length ? {
            flowSubmissions: [...previousFlowSubmissions, ...incomingFlowSubmissions].slice(-30),
          } : {}),
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
    if (assignment.agent && (assignment.changed || extra.notifyRoutedAgent)) {
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

function formatStayDateForCustomer(value = '') {
  const raw = normalizeText(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}-${match[2]}-${match[1]}`;
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
      activeFlow: null,
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
      pendingMetaFlow: null,
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

// A flow graph is "usable" when it is an object carrying at least a v2 graph.
function hasUsableFlowConfig(config) {
  return Boolean(config)
    && typeof config === 'object'
    && !Array.isArray(config)
    && Number(config.schemaVersion) >= 2;
}

// Determine which channel a conversation is happening on. Instagram customers are
// identified by the `ig_` identifier prefix (or an explicit instagram source). When a
// flow is already running, the channel stored on the active flow state is authoritative.
function resolveFlowChannel(customer = {}, session = null) {
  const identifier = String((customer && customer.phone) || '');
  if (identifier.startsWith('ig_')) return 'INSTAGRAM';
  if (lower((customer && customer.source) || '') === 'instagram') return 'INSTAGRAM';
  const stored = normalizeText((getActiveFlowGraphState(session) || {}).channel || '');
  if (stored === 'INSTAGRAM') return 'INSTAGRAM';
  return 'WHATSAPP';
}

function getFlowGraphConfig(agency = {}, targetFlowId = null, channel = 'WHATSAPP') {
  let config = channel === 'INSTAGRAM' ? agency.instagramFlowConfig : agency.whatsappFlowConfig;
  // Instagram falls back to the WhatsApp flow graph until the agency builds a dedicated
  // Instagram flow, so connecting Instagram does not silently disable existing automation.
  if (channel === 'INSTAGRAM' && !hasUsableFlowConfig(config)) {
    config = agency.whatsappFlowConfig;
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  if (Number(config.schemaVersion) < 2) return null;
  if (Number(config.schemaVersion) >= 4 && Array.isArray(config.flows)) {
    const entryFlowId = normalizeText(targetFlowId || config.entryFlowId || '');
    const flow = config.flows.find((item) => normalizeText(item.id) === entryFlowId)
      || config.flows[0]
      || null;
    if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) return null;
    const startNodeId = normalizeText(flow.startNodeId);
    if (!startNodeId) return null;
    return {
      schemaVersion: Number(config.schemaVersion),
      flowId: flow.id,
      flowName: flow.name,
      startNodeId,
      nodes: flow.nodes,
      edges: flow.edges,
    };
  }
  if (!Array.isArray(config.nodes) || !Array.isArray(config.edges)) return null;
  const startNodeId = normalizeText(config.startNodeId);
  if (!startNodeId) return null;
  return config;
}

// True only when the agency has built a DEDICATED Instagram flow graph (not the WhatsApp
// fallback). The webhook uses this to decide whether to drive Instagram DMs through the
// unified flow engine versus the legacy Instagram package/welcome path.
function hasInstagramFlowGraph(agency = {}) {
  return hasUsableFlowConfig(agency.instagramFlowConfig)
    && Boolean(getFlowGraphConfig(agency, null, 'INSTAGRAM'));
}

function getFlowGraphNode(graph, nodeId) {
  const normalizedId = normalizeText(nodeId);
  return (graph?.nodes || []).find((node) => normalizeText(node.id) === normalizedId) || null;
}

function getFlowGraphEdgeTarget(graph, sourceId, sourceHandle = 'default') {
  const normalizedSource = normalizeText(sourceId);
  const normalizedHandle = lower(sourceHandle || 'default');
  const edge = (graph?.edges || []).find((item) =>
    normalizeText(item.source) === normalizedSource
    && lower(item.sourceHandle || 'default') === normalizedHandle
  ) || (normalizedHandle !== 'default'
    ? (graph?.edges || []).find((item) =>
      normalizeText(item.source) === normalizedSource
      && lower(item.sourceHandle || 'default') === 'default'
    )
    : null);
  return normalizeText(edge?.target || '');
}

function findFlowBuilderMetaNode(graph, pendingMetaFlow = {}) {
  const flowDbId = normalizeText(pendingMetaFlow.flowDbId || '');
  const metaFlowId = normalizeText(pendingMetaFlow.flowId || '');
  const flowType = normalizeText(pendingMetaFlow.flowType || '').toUpperCase();
  return (graph?.nodes || []).find((node) => {
    if (node?.type !== 'OPEN_META_FLOW') return false;
    const data = node.data || {};
    return (flowDbId && normalizeText(data.flowId) === flowDbId)
      || (metaFlowId && normalizeText(data.metaFlowId) === metaFlowId)
      || (flowType && normalizeText(data.flowType).toUpperCase() === flowType);
  }) || null;
}

// Maps flow-graph "open module" node types to the sidebar module path that gates them.
// Anything not listed here (generic nodes) is always available.
const FLOW_NODE_MODULE = {
  OPEN_SERVICE: '/services',
  OPEN_SERVICE_FLOW: '/services',
  OPEN_PACKAGE_FLOW: '/packages',
  OPEN_CUSTOM_TRIP_FLOW: '/packages',
  OPEN_PROPERTY_FLOW: '/properties',
  OPEN_VISA_FLOW: '/visas',
  OPEN_CRUISE_FLOW: '/cruises',
};

// Empty/missing prefs = legacy full access; otherwise only listed modules are enabled.
function isModuleEnabledForAgency(agency, modulePath) {
  if (!modulePath) return true;
  const prefs = agency && agency.sidebarPreferences;
  if (!Array.isArray(prefs) || prefs.length === 0) return true;
  return prefs.includes(modulePath);
}

// True when a menu option (button/list row) leads to a node for a module this agency has disabled.
function flowGraphOptionModuleDisabled(graph, agency, sourceNodeId, optionHandle) {
  const targetId = getFlowGraphEdgeTarget(graph, sourceNodeId, optionHandle);
  if (!targetId) return false;
  const targetNode = getFlowGraphNode(graph, targetId);
  const modulePath = targetNode && FLOW_NODE_MODULE[targetNode.type];
  if (!modulePath) return false;
  return !isModuleEnabledForAgency(agency, modulePath);
}

function renderFlowGraphText(template = '', customer, agency, fields = {}, itemContext = null) {
  let result = normalizeText(template)
    .replace(/\{customerName\}/g, customer?.name || firstName(customer) || '')
    .replace(/\{customerPhone\}/g, customer?.phone || '')
    .replace(/\{agencyName\}/g, agency?.name || '')
    .replace(/\{packageName\}/g, fields.packageName || fields.package || fields.enquiryPackage || 'Not selected');
  // Item-level variables for SEND_ITEM_DETAIL templates
  if (itemContext) {
    result = result
      .replace(/\{itemName\}/g, itemContext.name || '')
      .replace(/\{itemCategory\}/g, itemContext.category || '')
      .replace(/\{itemPrice\}/g, packagePriceLabel(itemContext.basePrice || itemContext.price) || '')
      .replace(/\{itemDescription\}/g, itemContext.description || itemContext.summary || '')
      .replace(/\{itemDuration\}/g, itemContext.duration || '');
  }
  return result.replace(/\{([^}]+)\}/g, (match, key) => {
    const normalizedKey = normalizeText(key);
    if (Object.prototype.hasOwnProperty.call(fields, normalizedKey)) {
      return normalizeText(fields[normalizedKey]);
    }
    return match;
  });
}

function getActiveFlowGraphState(session = {}) {
  const activeFlow = session.collectedData?.activeFlow;
  return activeFlow && typeof activeFlow === 'object' && !Array.isArray(activeFlow)
    ? activeFlow
    : null;
}

async function updateFlowGraphState(session, updates = {}) {
  const current = getActiveFlowGraphState(session) || {};
  await updateSession(session, {
    currentStep: STEPS.MENU,
    failedAttempts: 0,
    collectedData: {
      ...(session.collectedData || {}),
      menuContext: 'FLOW_GRAPH',
      activeFlow: {
        ...current,
        ...updates,
        fields: {
          ...(current.fields || {}),
          ...(updates.fields || {}),
        },
      },
    },
  });
}

async function resetFlowGraphProgress(session, nodeId = null) {
  const current = getActiveFlowGraphState(session) || {};
  await updateSession(session, {
    currentStep: STEPS.MENU,
    failedAttempts: 0,
    collectedData: {
      ...(session.collectedData || {}),
      menuContext: 'FLOW_GRAPH',
      activeFlow: {
        ...current,
        nodeId: nodeId || current.nodeId || null,
        awaitingNodeId: null,
        awaitingType: null,
        fields: {},
        selectedItem: null,
        catalogOptions: [],
      },
    },
  });
}

async function clearFlowGraphState(session, nextStep = STEPS.COMPLETE, extraCollectedData = {}) {
  const clearsHumanHandoff = nextStep === STEPS.COMPLETE;
  await updateSession(session, {
    currentStep: nextStep,
    ...(clearsHumanHandoff ? {
      isHandedOff: false,
      handedOffAt: null,
      handedOffToId: null,
    } : {}),
    failedAttempts: 0,
    collectedData: {
      ...(session.collectedData || {}),
      ...extraCollectedData,
      menuContext: null,
      activeFlow: null,
      ...(clearsHumanHandoff ? { manualHandoff: null } : {}),
    },
  });
}

function getPendingMetaFlow(session = {}) {
  const pending = session.collectedData?.pendingMetaFlow;
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return null;
  if (pending.status !== 'awaiting_submission' || !normalizeText(pending.flowId)) return null;
  return pending;
}

async function markPendingMetaFlow(session, pendingMetaFlow = {}) {
  if (!pendingMetaFlow.flowId) return;
  await updateSession(session, {
    collectedData: {
      pendingMetaFlow: {
        status: 'awaiting_submission',
        openedAt: new Date().toISOString(),
        reminderCount: 0,
        ...pendingMetaFlow,
      },
    },
  });
}

async function clearPendingMetaFlow(session) {
  if (!session.collectedData?.pendingMetaFlow) return;
  await updateSession(session, {
    collectedData: { pendingMetaFlow: null },
  });
}

async function remindPendingMetaFlow(session, customer, agency) {
  const pending = getPendingMetaFlow(session);
  if (!pending) return false;

  const reminderText = normalizeText(pending.reminderText)
    || 'Please fill this form so we can check the best available options, pricing, dates, guest count, and location for you.';
  const flowCta = normalizeText(pending.flowCta || 'Open Form').slice(0, 20) || 'Open Form';
  const flowData = pending.data && typeof pending.data === 'object' && !Array.isArray(pending.data)
    ? pending.data
    : null;

  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    reminderText,
    {
      flowId: normalizeText(pending.flowId),
      firstScreenId: normalizeText(pending.firstScreenId || '') || null,
      flowCta,
      flowToken: `pending|${agency.id}|${customer.id}|${Date.now()}|${encodeFlowTokenPart(pending.flowType || 'meta')}`,
      ...(flowData ? { data: flowData } : {}),
    },
    getContext(customer, agency),
    {
      headerText: normalizeText(pending.headerText || 'Complete enquiry form'),
      footerText: normalizeText(pending.footerText || 'This helps us check availability and pricing accurately.'),
    }
  );

  if (flowResponse?.status !== 'FAILED') {
    await updateSession(session, {
      collectedData: {
        pendingMetaFlow: {
          ...pending,
          lastRemindedAt: new Date().toISOString(),
          reminderCount: Number(pending.reminderCount || 0) + 1,
        },
      },
    });
  }

  return true;
}

function buttonOptionsForNode(node = {}) {
  return Array.isArray(node.data?.buttons) ? node.data.buttons.slice(0, 3) : [];
}

function listRowsForNode(node = {}) {
  return Array.isArray(node.data?.rows) ? node.data.rows.slice(0, 10) : [];
}

function evaluateFlowCondition(node = {}, fields = {}) {
  const fieldKey = normalizeText(node.data?.fieldKey || '');
  const actual = normalizeText(fields[fieldKey] || '');
  const expected = normalizeText(node.data?.value || '');
  const operator = normalizeText(node.data?.operator || 'EXISTS').toUpperCase();
  if (operator === 'EQUALS') return lower(actual) === lower(expected);
  if (operator === 'NOT_EQUALS') return lower(actual) !== lower(expected);
  if (operator === 'CONTAINS') return lower(actual).includes(lower(expected));
  return Boolean(actual);
}

const FLOW_CATALOG_TYPES = new Set(['SERVICE', 'PACKAGE', 'PROPERTY', 'VISA', 'CRUISE']);

function normalizeFlowCatalogType(value = '') {
  const type = normalizeText(value).toUpperCase();
  return FLOW_CATALOG_TYPES.has(type) ? type : 'SERVICE';
}

function flowCatalogHandle(type, itemId) {
  return `item:${normalizeFlowCatalogType(type)}:${normalizeText(itemId)}`;
}

function flowCatalogTitle(item, type) {
  const catalogType = normalizeFlowCatalogType(type);
  if (catalogType === 'VISA') return [item?.country, item?.visaType].filter(Boolean).join(' - ') || 'Visa';
  return normalizeText(item?.name || item?.title || item?.country || 'Option');
}

function flowCatalogDescription(item, type) {
  const catalogType = normalizeFlowCatalogType(type);
  if (catalogType === 'SERVICE') return normalizeText(item?.category || item?.description || '').slice(0, 72);
  if (catalogType === 'PACKAGE') return [item?.duration, packagePriceLabel(item?.basePrice)].filter(Boolean).join(' - ').slice(0, 72);
  if (catalogType === 'PROPERTY') return [item?.location, item?.propertyType].filter(Boolean).join(' - ').slice(0, 72);
  if (catalogType === 'VISA') return [item?.processingTime, packagePriceLabel(item?.price)].filter(Boolean).join(' - ').slice(0, 72);
  if (catalogType === 'CRUISE') return [item?.cruiseLine, item?.duration].filter(Boolean).join(' - ').slice(0, 72);
  return '';
}

// Build a wa.me click-to-chat link that bridges an Instagram catalog card to the agency's
// WhatsApp. Packages use the VIEW_PACKAGE:<id> deep link the WhatsApp bot already understands;
// other types prefill a human-readable enquiry naming the item.
function buildWhatsappCardLink(agency, item, catalogType) {
  const digits = String(agency.whatsappNumber || agency.phone || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const name = flowCatalogTitle(item, catalogType);
  const prefill = normalizeFlowCatalogType(catalogType) === 'PACKAGE'
    ? `VIEW_PACKAGE:${item.id}`
    : `Hi! I'd like more details about ${name}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`;
}

// Turn catalog/search items into Instagram generic-template cards (image + title + subtitle +
// a customizable "get details on WhatsApp" button). Titles are numbered so a numeric reply
// still selects the item inside the Instagram flow.
function buildFlowCatalogCards(agency, items, catalogType, buttonLabel) {
  const label = normalizeText(buttonLabel || 'Get details on WhatsApp').slice(0, 20) || 'Get details on WhatsApp';
  return items.slice(0, 10).map((item, index) => {
    const url = buildWhatsappCardLink(agency, item, catalogType);
    return {
      title: `${index + 1}. ${flowCatalogTitle(item, catalogType)}`.slice(0, 80),
      subtitle: (flowCatalogDescription(item, catalogType) || '').slice(0, 80),
      imageUrl: item.imageUrl || item.image_url || null,
      ...(url ? { buttons: [{ title: label, url }] } : {}),
    };
  });
}

// Send catalog cards on Instagram either as one swipeable carousel or one stacked card per item.
async function sendFlowCatalogCards(session, customer, agency, cards, mode) {
  if (mode === 'CAROUSEL') {
    return whatsappService.sendInstagramCards(customer.phone, cards, getContext(customer, agency));
  }
  for (const card of cards) {
    await whatsappService.sendInstagramCards(customer.phone, [card], getContext(customer, agency));
  }
  return null;
}

async function findFlowCatalogItems(agency, node = {}, fields = {}) {
  const data = node.data || {};
  const catalogType = normalizeFlowCatalogType(data.catalogType);
  const limit = Math.min(PACKAGE_BROWSE_LIMIT, FALLBACK_LIST_LIMIT);

  if (catalogType === 'SERVICE') {
    const where = { agencyId: agency.id, isActive: true };
    if (data.category) where.category = { [Op.iLike]: data.category };
    return { catalogType, items: await Service.findAll({ where, order: [['displayOrder', 'ASC'], ['name', 'ASC']], limit }) };
  }

  if (catalogType === 'PACKAGE') {
    const packages = await findPackagesForCategory(agency.id, data.category || null, limit, data.tourType || null);
    return { catalogType, items: packages.map((item) => item.pkg || item).filter(Boolean) };
  }

  if (catalogType === 'PROPERTY') {
    const properties = await findActiveProperties(agency.id, limit, {
      propertyType: data.propertyType || '',
      propertyLocation: selectedPropertyLocationForCatalog(data, fields),
    });
    return { catalogType, items: properties };
  }

  if (catalogType === 'VISA') {
    const where = { agencyId: agency.id, isActive: true };
    if (data.country) where.country = { [Op.iLike]: `%${data.country}%` };
    if (data.visaType) where.visaType = { [Op.iLike]: data.visaType };
    return { catalogType, items: await Visa.findAll({ where, order: [['country', 'ASC']], limit }) };
  }

  const all = await Cruise.findAll({ where: { agencyId: agency.id, isActive: true }, order: [['name', 'ASC']], limit: 50 });
  const destination = lower(data.destination || '');
  const cruiseLine = lower(data.cruiseLine || '');
  return {
    catalogType,
    items: all.filter((cruise) =>
      (!destination || (Array.isArray(cruise.destinations) ? cruise.destinations.join(' ') : '').toLowerCase().includes(destination))
      && (!cruiseLine || lower(cruise.cruiseLine || '').includes(cruiseLine))
    ).slice(0, limit),
  };
}

async function findFlowCatalogItem(agency, catalogType, itemId) {
  const type = normalizeFlowCatalogType(catalogType);
  const id = normalizeText(itemId);
  if (!id) return null;
  const where = { id, agencyId: agency.id };
  if (type === 'SERVICE') return Service.findOne({ where: { ...where, isActive: true } });
  if (type === 'PACKAGE') return Package.findOne({ where: { ...where, isActive: true } });
  if (type === 'PROPERTY') return Property.findOne({ where: { ...where, isActive: true } });
  if (type === 'VISA') return Visa.findOne({ where: { ...where, isActive: true } });
  if (type === 'CRUISE') return Cruise.findOne({ where: { ...where, isActive: true } });
  return null;
}

// ---- SEARCH node (typo-tolerant inventory search driven by collected answers) ----
const SEARCH_RESULT_LIMIT = 6;
const SEARCH_RESULT_HARD_CAP = 10;
const SEARCH_FIELD_ALIASES = { destination: 'destinations' };

async function loadActiveCatalogItems(agency, catalogType, scanLimit = 500) {
  const where = { agencyId: agency.id, isActive: true };
  if (catalogType === 'SERVICE') return Service.findAll({ where, limit: scanLimit });
  if (catalogType === 'PACKAGE') return Package.findAll({ where, limit: scanLimit });
  if (catalogType === 'PROPERTY') return Property.findAll({ where, limit: scanLimit });
  if (catalogType === 'VISA') return Visa.findAll({ where, limit: scanLimit });
  if (catalogType === 'CRUISE') return Cruise.findAll({ where, limit: scanLimit });
  return [];
}

// All the string values a catalog item exposes for a given search field (arrays flattened).
function getItemFieldValues(item, matchField) {
  const field = SEARCH_FIELD_ALIASES[matchField] || matchField;
  const value = item ? item[field] : null;
  if (Array.isArray(value)) return value.map((v) => normalizeText(v)).filter(Boolean);
  if (value === null || value === undefined) return [];
  return [normalizeText(value)].filter(Boolean);
}

// Distinct real values that exist in inventory for a field — the candidate set we snap typos to.
function distinctValuesForField(items, matchField) {
  const seen = new Map();
  for (const item of items) {
    for (const value of getItemFieldValues(item, matchField)) {
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
  }
  return Array.from(seen.values());
}

function searchMappingsForNode(node = {}) {
  const raw = Array.isArray(node.data?.searchMappings) ? node.data.searchMappings : [];
  return raw
    .map((m) => ({ fieldKey: normalizeText(m && m.fieldKey), matchField: normalizeText(m && m.matchField) }))
    .filter((m) => m.fieldKey && m.matchField);
}

// Turn the customer's typed answer into a lowercase substring term to filter on.
// Priority: a direct substring hit (so "coorg" matches every "X, Coorg" location, not just one),
// otherwise typo-correct against the distinct WORD TOKENS of the field (so "munar" -> "munnar").
function resolveSearchTerm(input, items, matchField) {
  const norm = String(input || '').trim().toLowerCase();
  if (!norm) return { term: null, corrected: null, confidence: 'none' };

  const values = [];
  for (const item of items) {
    for (const value of getItemFieldValues(item, matchField)) values.push(value);
  }

  // Direct substring hit (needs >=3 chars to avoid noise) — use the typed word as-is.
  if (norm.length >= 3 && values.some((v) => v.toLowerCase().includes(norm))) {
    return { term: norm, corrected: null, confidence: 'exact' };
  }

  // Otherwise fuzzy-correct against the distinct field VALUES, then keep the closest word from
  // the matched value as the filter term — so "munar" -> value "Chithirapuram, Munnar" -> term
  // "munnar" (matches every Munnar stay), and "home stay" -> "Homestay" reads cleanly.
  const distinct = [];
  const seenValues = new Set();
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seenValues.has(key)) { seenValues.add(key); distinct.push(value); }
  }
  const match = bestMatch(norm, distinct);
  if (match.value && match.confidence !== 'none') {
    const tokens = String(match.value).split(/[^A-Za-z0-9]+/).filter(Boolean);
    let bestToken = match.value;
    let bestScore = -1;
    for (const token of tokens) {
      const score = similarity(norm, token.toLowerCase());
      if (score > bestScore) { bestScore = score; bestToken = token; }
    }
    return { term: bestToken.toLowerCase(), corrected: bestToken, confidence: match.confidence };
  }
  return { term: null, corrected: null, confidence: 'none' };
}

// Apply each mapping: read the customer's answer, snap it to the closest real value, filter inventory.
async function findFlowSearchItems(agency, node, fields = {}) {
  const data = node.data || {};
  const catalogType = normalizeFlowCatalogType(data.catalogType);
  const mappings = searchMappingsForNode(node);
  const allItems = await loadActiveCatalogItems(agency, catalogType);
  const corrections = [];
  const criteria = [];

  for (const mapping of mappings) {
    const input = normalizeText(fields[mapping.fieldKey]);
    if (!input) continue; // question unanswered -> don't filter on it
    const resolved = resolveSearchTerm(input, allItems, mapping.matchField);
    corrections.push({ ...mapping, input, corrected: resolved.corrected, confidence: resolved.confidence });
    criteria.push({ matchField: mapping.matchField, term: resolved.term });
  }

  // A criterion matches when ANY of the item's values for that field contains the term —
  // so "coorg" returns every Coorg stay regardless of the rest of the location string.
  const matchesCriterion = (item, criterion) => {
    if (!criterion.term) return false;
    return getItemFieldValues(item, criterion.matchField).some((v) => v.toLowerCase().includes(criterion.term));
  };

  // Match on all answered criteria (AND). If nothing matches, relax by dropping the
  // earliest (least important) criterion and retrying — so e.g. "villa in Coorg" still
  // surfaces Coorg stays when there is no villa specifically in Coorg. Location-type
  // answers come last in the flow, so they survive relaxation longest.
  let used = criteria.slice();
  let items = [];
  if (!used.length) {
    items = allItems;
  } else {
    while (used.length) {
      items = allItems.filter((item) => used.every((criterion) => matchesCriterion(item, criterion)));
      if (items.length) break;
      used = used.slice(1);
    }
  }
  const relaxed = used.length < criteria.length;

  const maxResults = Math.min(
    Math.max(parseInt(data.maxResults, 10) || SEARCH_RESULT_LIMIT, 1),
    SEARCH_RESULT_HARD_CAP
  );
  return { catalogType, items: items.slice(0, maxResults), corrections, relaxed };
}

// Transparency line shown when we auto-corrected a typo, e.g. "Showing results for *Villa* · *Munnar*."
function buildSearchCorrectionHint(corrections = []) {
  const corrected = corrections.filter((c) => c.corrected && c.confidence !== 'exact');
  if (!corrected.length) return '';
  return `Showing results for ${corrected.map((c) => `*${c.corrected}*`).join(' · ')}.`;
}

function buildSearchCardCaption(item, catalogType, index) {
  const title = flowCatalogTitle(item, catalogType);
  const meta = flowCatalogDescription(item, catalogType);
  const summary = normalizeText(item && (item.summary || item.description)).slice(0, 140);
  return [`*${index}. ${title}*`, meta || null, summary || null]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1024);
}

function getSelectedFlowCatalogItem(session = {}) {
  const selected = getActiveFlowGraphState(session)?.selectedItem;
  if (!selected || typeof selected !== 'object' || Array.isArray(selected)) return null;
  const itemType = normalizeFlowCatalogType(selected.itemType || selected.catalogType);
  const itemId = normalizeText(selected.itemId || selected.id);
  if (!itemId) return null;
  return {
    itemType,
    itemId,
    itemName: normalizeText(selected.itemName || ''),
  };
}

// Resolve the PDF a SEND_ITEM_DOCUMENT node should send, honoring its configured
// documentSource. Returns { url, fileName, caption } or null when unavailable.
//   AUTO         -> selected item's natural doc (package brochure / property doc)
//   BROCHURE     -> selected package's brochureUrl
//   ITINERARY    -> uploaded itinerary PDF for the selected package (Itinerary.pdfUrl),
//                   falling back to the package brochure
//   PROPERTY_DOC -> selected property's brochureUrl
//   UPLOAD       -> a static PDF uploaded onto the node (data.uploadedPdfUrl)
async function resolveFlowGraphDocument(agency, selected, data = {}) {
  const source = String(data.documentSource || 'AUTO').toUpperCase();
  const captionOverride = normalizeText(data.documentCaption) || null;

  if (source === 'UPLOAD') {
    const url = normalizeText(data.uploadedPdfUrl);
    if (!url) return null;
    const fileName = normalizeText(data.uploadedPdfName) || 'document.pdf';
    return { url, fileName: fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`, caption: captionOverride };
  }

  const itemType = normalizeFlowCatalogType(selected?.itemType);

  if (source === 'PROPERTY_DOC' || (source === 'AUTO' && itemType === 'PROPERTY')) {
    if (!selected?.itemId) return null;
    const property = await Property.findOne({ where: { id: selected.itemId, agencyId: agency.id } });
    if (!property?.brochureUrl) return null;
    return { url: property.brochureUrl, fileName: safePdfName({ name: property.name, brochureFileName: property.brochureFileName }), caption: captionOverride || `${escapeMarkdown(property.name || 'Property')} details` };
  }

  // Package-based sources (BROCHURE / ITINERARY / AUTO-package)
  if (!selected?.itemId) return null;
  const pkg = await Package.findOne({ where: { id: selected.itemId, agencyId: agency.id, isActive: true } });
  if (!pkg) return null;

  if (source === 'ITINERARY') {
    const itinerary = await Itinerary.findOne({
      where: { packageId: pkg.id, agencyId: agency.id, pdfUrl: { [Op.ne]: null } },
      order: [['updatedAt', 'DESC']],
    });
    if (itinerary?.pdfUrl) {
      return { url: itinerary.pdfUrl, fileName: safePdfName(pkg), caption: captionOverride || `${escapeMarkdown(pkg.name)} itinerary` };
    }
  }

  if (pkg.brochureUrl) {
    return { url: pkg.brochureUrl, fileName: safePdfName(pkg), caption: captionOverride || `${escapeMarkdown(pkg.name)} itinerary` };
  }
  return null;
}

async function saveSelectedFlowCatalogItem(session, itemType, item) {
  await updateFlowGraphState(session, {
    selectedItem: {
      itemType: normalizeFlowCatalogType(itemType),
      itemId: item.id,
      itemName: flowCatalogTitle(item, itemType),
    },
    fields: {
      selectedItemType: normalizeFlowCatalogType(itemType),
      selectedItemId: item.id,
      selectedItemName: flowCatalogTitle(item, itemType),
    },
  });
}

function buildGraphItemCaption(item, itemType) {
  const type = normalizeFlowCatalogType(itemType);
  if (type === 'PACKAGE') return buildPackageDetailCardCaption(item);
  if (type === 'PROPERTY') return buildPropertyCaption(item);
  if (type === 'VISA') {
    const docs = Array.isArray(item.requiredDocuments) ? item.requiredDocuments : [];
    return [
      `*${visaListLabel(item)}*`,
      packagePriceLabel(item.price) ? `Fee: ${packagePriceLabel(item.price)}` : null,
      item.processingTime ? `Processing: ${item.processingTime}` : null,
      item.description ? `\n${item.description}` : null,
      docs.length ? `\n*Documents required:*\n${bulletList(docs)}` : null,
    ].filter(Boolean).join('\n').slice(0, 1024);
  }
  if (type === 'CRUISE') {
    const destinations = Array.isArray(item.destinations) ? item.destinations : [];
    return [
      `*${item.name}*`,
      item.cruiseLine ? `Cruise line: ${item.cruiseLine}` : null,
      destinations.length ? `Destinations: ${destinations.join(', ')}` : null,
      item.duration ? `Duration: ${item.duration}` : null,
      packagePriceLabel(item.basePrice) ? `From ${packagePriceLabel(item.basePrice)}` : null,
      item.summary ? `\n${item.summary}` : null,
    ].filter(Boolean).join('\n').slice(0, 1024);
  }
  return [
    `*${item.name || 'Service'}*`,
    item.category ? `Category: ${item.category}` : null,
    packagePriceLabel(item.basePrice) ? `From ${packagePriceLabel(item.basePrice)}` : null,
    item.description ? `\n${item.description}` : null,
  ].filter(Boolean).join('\n').slice(0, 1024);
}

function cleanGraphAnswers(fields = {}) {
  const hiddenKeys = new Set(['customerName', 'agencyName', 'selectedItemType', 'selectedItemId', 'selectedItemName', 'token', 'flow_token', 'flowToken']);
  return Object.fromEntries(
    Object.entries(fields || {})
      .filter(([key, value]) => !hiddenKeys.has(key) && value !== undefined && value !== null && String(value).trim())
      .map(([key, value]) => [key, String(value).trim()])
  );
}

function graphEnquiryKey(itemType, interest = '') {
  const rawType = normalizeText(itemType || '').toUpperCase();
  const rawInterest = normalizeText(interest || '').toUpperCase();
  if (rawInterest === 'CUSTOM_TRIP') return 'customTripEnquiry';
  const type = normalizeFlowCatalogType(rawType || rawInterest);
  if (type === 'PACKAGE') return 'packageEnquiry';
  if (type === 'PROPERTY') return 'propertyEnquiry';
  if (type === 'SERVICE') return 'serviceEnquiry';
  if (type === 'VISA') return 'visaEnquiry';
  if (type === 'CRUISE') return 'cruiseEnquiry';
  return 'flowEnquiry';
}

function graphEnquiryDetails(fields = {}, selected = null, item = null, interest = '') {
  const answers = cleanGraphAnswers(fields);
  const rawInterest = normalizeText(interest || '').toUpperCase();
  const itemType = rawInterest === 'CUSTOM_TRIP'
    ? 'CUSTOM_TRIP'
    : normalizeFlowCatalogType(selected?.itemType || selected?.catalogType || interest || '');
  return {
    ...(selected?.itemId ? { itemId: selected.itemId } : {}),
    ...(selected?.itemName ? { itemName: selected.itemName } : {}),
    ...(selected?.itemType ? { itemType: selected.itemType } : {}),
    ...(item?.name ? { name: item.name } : {}),
    ...(item?.category ? { category: item.category } : {}),
    ...(item?.propertyType ? { propertyType: item.propertyType } : {}),
    ...(item?.location ? { location: item.location } : {}),
    ...(item?.country ? { country: item.country } : {}),
    ...(item?.visaType ? { visaType: item.visaType } : {}),
    ...(item?.cruiseLine ? { cruiseLine: item.cruiseLine } : {}),
    ...(Object.keys(answers).length ? { answers } : {}),
    ...(itemType ? { itemType } : {}),
    submittedAt: new Date().toISOString(),
  };
}

function graphSubmissionTitle(enquiryKey = '', selected = null, interest = '') {
  const itemName = normalizeText(selected?.itemName || '');
  if (enquiryKey === 'serviceEnquiry') return itemName ? `Service Answers - ${itemName}` : 'Service Answers';
  if (enquiryKey === 'packageEnquiry') return itemName ? `Package Answers - ${itemName}` : 'Package Answers';
  if (enquiryKey === 'propertyEnquiry') return itemName ? `Property Answers - ${itemName}` : 'Property Answers';
  if (enquiryKey === 'visaEnquiry') return itemName ? `Visa Answers - ${itemName}` : 'Visa Answers';
  if (enquiryKey === 'cruiseEnquiry') return itemName ? `Cruise Answers - ${itemName}` : 'Cruise Answers';
  if (normalizeText(interest).toUpperCase() === 'CUSTOM_TRIP') return 'Custom Trip Answers';
  return 'Flow Answers';
}

function graphLeadPayloadFromFields(fields = {}, selected = null) {
  const answers = cleanGraphAnswers(fields);
  const travellersText = fields.travellers || fields.people || fields.passengers || fields.guests || '';
  const travellers = parseInt(travellersText, 10);
  const travelDates = fields.travelDate || fields.date || fields.when || fields.checkInDate || '';
  const destination = fields.destination || fields.to || fields.where || fields.city || '';
  const notes = Object.entries(answers)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  return {
    destination: normalizeText(destination) || null,
    travelDates: normalizeText(travelDates) || null,
    travellers: Number.isFinite(travellers) && travellers > 0 ? travellers : null,
      notes,
      customTripDetails: {
        flowAnswers: answers,
        ...(selected ? {
          selectedItemType: selected.itemType,
          selectedItemId: selected.itemId,
        selectedItemName: selected.itemName,
      } : {}),
    },
  };
}

function selectedItemLeadFields(selected = null, item = null) {
  const itemType = normalizeFlowCatalogType(selected?.itemType || selected?.catalogType || item?.itemType);
  const itemId = normalizeText(selected?.itemId || selected?.id || item?.id || '');
  if (!itemId) return {};
  const fallbackRoutingIntent = {
    PACKAGE: 'packages',
    PROPERTY: 'properties',
    SERVICE: `service_${itemId}`,
    VISA: 'visas',
    CRUISE: 'cruises',
  }[itemType] || '';
  return {
    itemType,
    packageId: itemType === 'PACKAGE' ? itemId : null,
    propertyId: itemType === 'PROPERTY' ? itemId : null,
    serviceId: itemType === 'SERVICE' ? itemId : null,
    visaId: itemType === 'VISA' ? itemId : null,
    cruiseId: itemType === 'CRUISE' ? itemId : null,
    routingIntentKey: item ? catalogRoutingIntent(itemType, item) : fallbackRoutingIntent,
    interest: itemType,
    selectedItems: [{ itemType, itemId }],
  };
}

async function openGraphMetaFlow(session, customer, agency, node) {
  const flowId = normalizeText(node.data?.flowId || '');
  const flowType = normalizeText(node.data?.flowType || '').toUpperCase();
  const activeState = getActiveFlowGraphState(session) || {};
  const channel = resolveFlowChannel(customer, session);
  const fields = activeState.fields || {};
  const where = {
    agencyId: agency.id,
    status: 'PUBLISHED',
    metaFlowId: { [Op.ne]: null },
  };
  if (flowId) where.id = flowId;
  else if (flowType) where.flowType = flowType;

  const flow = await WhatsAppFlow.findOne({ where, order: [['updatedAt', 'DESC']] });
  if (!flow?.metaFlowId) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'This WhatsApp form is not published yet. Our team will contact you shortly.',
      getContext(customer, agency)
    );
    return clearFlowGraphState(session, STEPS.COMPLETE);
  }

  await clearFlowGraphState(session, STEPS.COMPLETE, {
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  const flowCta = normalizeText(node.data?.cta || 'Open Form').slice(0, 20);
  const flowData = {
    customer_name: normalizeText(customer.name || ''),
  };
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    renderFlowGraphText(node.data?.body || 'Please complete the form below.', customer, agency, fields),
    {
      flowId: flow.metaFlowId,
      firstScreenId: flow.firstScreenId || null,
      flowCta,
      flowToken: `graph|${agency.id}|${customer.id}|${Date.now()}|${flow.id}`,
      data: flowData,
    },
    getContext(customer, agency),
    {}
  );

  if (flowResponse?.status !== 'FAILED') {
    await markPendingMetaFlow(session, {
      source: 'FLOW_BUILDER_META_FLOW',
      flowType: flow.flowType || flowType || 'GENERIC',
      flowId: flow.metaFlowId,
      flowDbId: flow.id,
      graphFlowId: activeState.flowId || null,
      graphNodeId: node.id,
      channel,
      firstScreenId: flow.firstScreenId || null,
      flowCta,
      data: flowData,
      reminderText: 'Please fill this form so we can check the best available options, pricing, dates, guest count, and location for you.',
    });
  }

  return flowResponse;
}

async function executeFlowGraphNode(session, customer, agency, nodeId, hopCount = 0) {
  const activeState = getActiveFlowGraphState(session) || {};
  const channel = resolveFlowChannel(customer, session);
  const graph = getFlowGraphConfig(agency, activeState.flowId, channel);
  if (!graph) return showMainMenu(session, customer, agency);
  if (hopCount > 20) {
    console.error('[TravelFlow] flow_graph_loop_guard', { agencyId: agency.id, nodeId });
    return clearFlowGraphState(session, STEPS.COMPLETE);
  }

  const node = getFlowGraphNode(graph, nodeId);
  if (!node) return clearFlowGraphState(session, STEPS.COMPLETE);

  // If this node opens a module the agency has disabled, don't run it — return to the menu.
  if (FLOW_NODE_MODULE[node.type] && !isModuleEnabledForAgency(agency, FLOW_NODE_MODULE[node.type])) {
    return showMainMenu(session, customer, agency);
  }

  const fields = activeState.fields || {};
  const data = node.data || {};
  await updateFlowGraphState(session, {
    nodeId: node.id,
    awaitingNodeId: null,
    awaitingType: null,
  });

  if (node.type === 'START') {
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'MESSAGE') {
    const body = renderFlowGraphText(data.body || data.message, customer, agency, fields);
    if (body) {
      await whatsappService.sendTextMessage(customer.phone, body, getContext(customer, agency));
    }
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'BUTTONS') {
    const buttons = buttonOptionsForNode(node)
      .filter((option) => !flowGraphOptionModuleDisabled(graph, agency, node.id, option.id));
    await updateFlowGraphState(session, {
      nodeId: node.id,
      awaitingNodeId: node.id,
      awaitingType: 'BUTTONS',
    });
    await recordMenuSent(session);
    return whatsappService.sendButtonsMessage(
      customer.phone,
      renderFlowGraphText(data.body || 'Please choose an option.', customer, agency, fields),
      buttons.map((option) => ({
        id: `flow_graph:${node.id}:${option.id}`,
        title: option.label || option.title,
      })),
      getContext(customer, agency),
      {
        footerText: data.footerText || 'Reply Hi anytime to restart.',
      }
    );
  }

  if (node.type === 'LIST') {
    const rows = listRowsForNode(node)
      .filter((row) => !flowGraphOptionModuleDisabled(graph, agency, node.id, row.id));
    await updateFlowGraphState(session, {
      nodeId: node.id,
      awaitingNodeId: node.id,
      awaitingType: 'LIST',
    });
    await recordMenuSent(session);
    return whatsappService.sendListMessage(
      customer.phone,
      renderFlowGraphText(data.body || 'Please choose an option.', customer, agency, fields),
      normalizeText(data.buttonLabel || 'Choose Option').slice(0, 20),
      [
        {
          title: normalizeText(data.title || 'Options').slice(0, 24),
          rows: rows.map((row) => ({
            id: `flow_graph:${node.id}:${row.id}`,
            title: row.title || row.label,
            description: row.description || '',
          })),
        },
      ],
      getContext(customer, agency),
      {
        footerText: data.footerText || 'Reply Hi anytime to restart.',
      }
    );
  }

  if (node.type === 'CATALOG_LIST') {
    const catalogType = normalizeFlowCatalogType(data.catalogType);
    const shouldAskPropertyLocation = catalogType === 'PROPERTY'
      && data.askLocationFirst === true
      && !normalizeText(data.propertyLocation)
      && !normalizeText(fields[getPropertyLocationFieldKey(data)]);

    if (shouldAskPropertyLocation) {
      const propertiesForLocations = await findActiveProperties(agency.id, 500, {
        propertyType: data.propertyType || '',
      });
      const locationRows = buildPropertyLocationRows(propertiesForLocations);

      if (locationRows.length > 1) {
        await updateFlowGraphState(session, {
          nodeId: node.id,
          awaitingNodeId: node.id,
          awaitingType: 'PROPERTY_LOCATION_LIST',
          propertyLocationOptions: locationRows.map((row) => ({
            location: row.id,
            title: row.title,
          })),
        });
        await recordMenuSent(session);
        return whatsappService.sendListMessage(
          customer.phone,
          renderFlowGraphText(data.locationPrompt || 'Which location are you interested in?', customer, agency, fields),
          normalizeText(data.locationButtonLabel || 'Choose Location').slice(0, 20),
          [
            {
              title: normalizeText(data.locationListTitle || 'Locations').slice(0, 24),
              rows: locationRows.map((row) => ({
                id: `flow_property_location:${node.id}:${encodeURIComponent(row.id)}`,
                title: row.title,
                description: row.description || '',
              })),
            },
          ],
          getContext(customer, agency),
          {
            footerText: data.footerText || 'Reply Hi anytime to restart.',
          }
        );
      }
    }

    const { items } = await findFlowCatalogItems(agency, node, fields);
      if (!items.length) {
        const emptyMessage = renderFlowGraphText(data.emptyMessage || 'No active options are available right now.', customer, agency, fields);
        if (emptyMessage) {
          await whatsappService.sendTextMessage(customer.phone, emptyMessage, getContext(customer, agency));
        }
        await updateFlowGraphState(session, { selectedItem: null, catalogOptions: [] });
        const emptyTarget = getFlowGraphEdgeTarget(graph, node.id, 'empty');
        return emptyTarget ? executeFlowGraphNode(session, customer, agency, emptyTarget, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
      }

    await updateFlowGraphState(session, {
      nodeId: node.id,
      awaitingNodeId: node.id,
      awaitingType: 'CATALOG_LIST',
      catalogOptions: items.map((item) => ({
        itemType: catalogType,
        itemId: item.id,
        itemName: flowCatalogTitle(item, catalogType),
      })),
    });
    await recordMenuSent(session);

    // Instagram card / carousel mode: show each item as an image+title+subtitle card with a
    // customizable "get details on WhatsApp" button. Numeric replies still select inside IG.
    const catalogCardMode = normalizeText(data.igCardMode || 'LIST').toUpperCase();
    if (channel === 'INSTAGRAM' && (catalogCardMode === 'CARDS' || catalogCardMode === 'CAROUSEL')) {
      const intro = renderFlowGraphText(data.body || 'Please choose an option.', customer, agency, fields);
      if (intro) {
        await whatsappService.sendTextMessage(customer.phone, intro, getContext(customer, agency));
      }
      const cards = buildFlowCatalogCards(agency, items.slice(0, FALLBACK_LIST_LIMIT), catalogType, data.igCardButtonLabel);
      await sendFlowCatalogCards(session, customer, agency, cards, catalogCardMode);
      return whatsappService.sendTextMessage(
        customer.phone,
        normalizeText(data.pickPrompt || 'Reply with the number of your choice.'),
        getContext(customer, agency)
      );
    }

    return whatsappService.sendListMessage(
      customer.phone,
      renderFlowGraphText(data.body || 'Please choose an option.', customer, agency, fields),
      normalizeText(data.buttonLabel || 'View Options').slice(0, 20),
      [
        {
          title: normalizeText(data.title || `${catalogType.charAt(0)}${catalogType.slice(1).toLowerCase()}`).slice(0, 24),
          rows: items.slice(0, FALLBACK_LIST_LIMIT).map((item) => ({
            id: `flow_catalog:${node.id}:${catalogType}:${item.id}`,
            title: flowCatalogTitle(item, catalogType).slice(0, 24),
            description: flowCatalogDescription(item, catalogType),
          })),
        },
      ],
      getContext(customer, agency),
      {
        footerText: data.footerText || 'Reply Hi anytime to restart.',
      }
    );
  }

  if (node.type === 'SEARCH') {
    const { catalogType, items, corrections, relaxed } = await findFlowSearchItems(agency, node, fields);
    if (!items.length) {
      const emptyMessage = renderFlowGraphText(
        data.emptyMessage || 'Sorry, I could not find a match for that. Our team will help you shortly.',
        customer, agency, fields
      );
      if (emptyMessage) {
        await whatsappService.sendTextMessage(customer.phone, emptyMessage, getContext(customer, agency));
      }
      await updateFlowGraphState(session, { selectedItem: null, catalogOptions: [] });
      const emptyTarget = getFlowGraphEdgeTarget(graph, node.id, 'empty');
      return emptyTarget ? executeFlowGraphNode(session, customer, agency, emptyTarget, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
    }

    // Arm the existing CATALOG_LIST numbered-reply resolver + the node's `selected` edge.
    await updateFlowGraphState(session, {
      nodeId: node.id,
      awaitingNodeId: node.id,
      awaitingType: 'CATALOG_LIST',
      catalogOptions: items.map((item) => ({
        itemType: catalogType,
        itemId: item.id,
        itemName: flowCatalogTitle(item, catalogType),
      })),
    });

    // Intro/heading + a transparency hint when a typo was auto-corrected.
    // When the search had to relax (no exact match), say so and skip the corrected-terms
    // hint (some of those terms were dropped to find these closest options).
    const intro = [
      relaxed
        ? 'I could not find an exact match, so here are the closest options:'
        : renderFlowGraphText(data.body || 'Here are the closest matches:', customer, agency, fields),
      relaxed ? '' : buildSearchCorrectionHint(corrections),
    ].filter(Boolean).join('\n\n');
    if (intro) {
      await whatsappService.sendTextMessage(customer.phone, intro, getContext(customer, agency));
    }

    const searchCardMode = normalizeText(data.igCardMode || 'LIST').toUpperCase();
    if (channel === 'INSTAGRAM' && (searchCardMode === 'CARDS' || searchCardMode === 'CAROUSEL')) {
      // Instagram: image + title + subtitle + "get details on WhatsApp" combined in one card.
      const cards = buildFlowCatalogCards(agency, items, catalogType, data.igCardButtonLabel);
      await sendFlowCatalogCards(session, customer, agency, cards, searchCardMode);
    } else {
      // One numbered card per result. Only send it AS an image when the image lives on the
      // reliable Cloudinary CDN — WhatsApp's fetcher intermittently fails on external image
      // URLs (e.g. Unsplash) and silently drops the whole card (caption included). For those,
      // send a text card so every matching result always reaches the customer.
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const caption = buildSearchCardCaption(item, catalogType, i + 1);
        const reliableImage = item.imageUrl
          && /res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(String(item.imageUrl));
        if (reliableImage) {
          await whatsappService.sendImageMessage(customer.phone, item.imageUrl, caption, getContext(customer, agency));
        } else {
          await whatsappService.sendTextMessage(customer.phone, caption, getContext(customer, agency));
        }
      }
    }

    return whatsappService.sendTextMessage(
      customer.phone,
      renderFlowGraphText(data.pickPrompt || 'Reply with the number of your choice.', customer, agency, fields),
      getContext(customer, agency)
    );
  }

  if (node.type === 'QUESTION') {
    await updateFlowGraphState(session, {
      nodeId: node.id,
      awaitingNodeId: node.id,
      awaitingType: 'QUESTION',
    });
    return whatsappService.sendTextMessage(
      customer.phone,
      renderFlowGraphText(data.prompt || 'Please share the details.', customer, agency, fields),
      getContext(customer, agency)
    );
  }

  if (node.type === 'CONDITION') {
    const matched = evaluateFlowCondition(node, fields);
    const target = getFlowGraphEdgeTarget(graph, node.id, matched ? 'true' : 'false')
      || getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'SEND_ITEM_DETAIL') {
    const selected = getSelectedFlowCatalogItem(session);
    const itemType = normalizeFlowCatalogType(data.catalogType === 'AUTO' ? selected?.itemType : data.catalogType || selected?.itemType);
    const item = selected ? await findFlowCatalogItem(agency, itemType, selected.itemId) : null;
    if (data.message) {
      await whatsappService.sendTextMessage(
        customer.phone,
        renderFlowGraphText(data.message, customer, agency, fields),
        getContext(customer, agency)
      );
    }
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    const targetNode = target ? getFlowGraphNode(graph, target) : null;
    const nextNodeSendsDocument = targetNode?.type === 'SEND_ITEM_DOCUMENT';
    if (item) {
      // Use custom message template from node data, or fall back to auto-generated caption.
      // Packages get a richer follow-up text so the customer sees full trip details instead
      // of only the compact flow card summary.
      const caption = data.message
        ? renderFlowGraphText(data.message, customer, agency, fields, item)
        : buildGraphItemCaption(item, itemType);
      if (itemType === 'PACKAGE') {
        const fullCaption = buildFullPackageCaption(item);
        if (item.imageUrl) {
          await whatsappService.sendImageMessage(customer.phone, item.imageUrl, caption, getContext(customer, agency));
        } else {
          await whatsappService.sendTextMessage(customer.phone, caption, getContext(customer, agency));
        }
        if (item.brochureUrl && !nextNodeSendsDocument) {
          await whatsappService.sendDocumentMessage(
            customer.phone,
            item.brochureUrl,
            safePdfName(item),
            `${escapeMarkdown(item.name)} itinerary`,
            getContext(customer, agency)
          );
        }
        if (fullCaption && fullCaption !== caption) {
          await whatsappService.sendTextMessage(customer.phone, fullCaption, getContext(customer, agency));
        }
      } else if (item.imageUrl) {
        await whatsappService.sendImageMessage(customer.phone, item.imageUrl, caption, getContext(customer, agency));
      } else {
        await whatsappService.sendTextMessage(customer.phone, caption, getContext(customer, agency));
      }
    } else {
      const notAvailableMsg = data.emptyMessage || 'The selected item is no longer available.';
      await whatsappService.sendTextMessage(customer.phone, notAvailableMsg, getContext(customer, agency));
    }
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'WHATSAPP_BUTTON') {
    let phone = '';
    let staffName = '';
    if (data.target === 'CUSTOM') {
      phone = String(data.phone || '');
    } else {
      // Default: deep-link to the staff member assigned to this customer's lead.
      const lead = await findActiveLead(session, customer, agency);
      const agentId = lead?.assignedAgentId || session.handedOffToId;
      if (agentId) {
        const agent = await Agent.findByPk(agentId, { attributes: ['name', 'phone'] });
        phone = agent?.phone || '';
        staffName = normalizeText(agent?.name || '');
      }
    }
    const digits = toWaMeNumber(phone);
    const firstName = staffName ? staffName.split(/\s+/)[0] : '';
    // Expose {staffName} to the message body, and label the button with the staff's name.
    const renderFields = { ...fields, staffName: staffName || 'our consultant' };
    const body = renderFlowGraphText(data.body || 'Tap below to chat with us on WhatsApp.', customer, agency, renderFields);
    const label = (firstName ? `Chat with ${firstName}` : normalizeText(data.buttonLabel || 'Chat on WhatsApp')).slice(0, 20) || 'Chat on WhatsApp';
    const isStaffChatNode = normalizeText(node.id).toLowerCase().includes('staff')
      || normalizeText(data.buttonLabel).toLowerCase().includes('staff');
    if (isStaffChatNode) {
      const lead = await ensureLead(session, customer, agency, {
        itemType: 'PROPERTY',
        interest: 'PROPERTY',
        status: 'ENQUIRY',
        campaignAction: 'CHAT_TO_STAFF',
        notes: 'Customer selected Chat to Staff from WhatsApp welcome flow',
        customTripDetails: {
          source: 'whatsapp_welcome_chat_to_staff',
          requestedStaffChatAt: new Date().toISOString(),
        },
      });
      await notifyAgentOfNewEnquiry(lead, customer, agency, null, {
        travelDate: 'Not shared yet',
        travellers: 'Not shared yet',
        budgetPerPerson: null,
        notes: 'Customer clicked Chat to Staff before submitting the stay form.',
      }).catch((err) => {
        console.warn('[TravelFlow] Could not notify staff of chat-to-staff lead:', err.message);
      });
    }
    if (digits) {
      await whatsappService.sendUrlButtonMessage(customer.phone, body, label, `https://wa.me/${digits}`, getContext(customer, agency));
    } else {
      await whatsappService.sendTextMessage(customer.phone, body, getContext(customer, agency));
    }
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'SEND_ITEM_DOCUMENT') {
    const selected = getSelectedFlowCatalogItem(session);
    const document = await resolveFlowGraphDocument(agency, selected, data);
    if (document?.url) {
      await whatsappService.sendDocumentMessage(
        customer.phone,
        document.url,
        document.fileName,
        document.caption || undefined,
        getContext(customer, agency)
      );
    } else {
      await whatsappService.sendTextMessage(
        customer.phone,
        renderFlowGraphText(data.fallbackMessage || 'The PDF is not available yet. Our team will share it shortly.', customer, agency, fields),
        getContext(customer, agency)
      );
    }
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    if (target && document?.url && FLOW_DOCUMENT_NEXT_NODE_DELAY_MS > 0) {
      await wait(FLOW_DOCUMENT_NEXT_NODE_DELAY_MS);
    }
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'NOTIFY_STAFF') {
    const selected = getSelectedFlowCatalogItem(session);
    const selectedItem = selected ? await findFlowCatalogItem(agency, selected.itemType, selected.itemId) : null;
    const payload = graphLeadPayloadFromFields(fields, selected);
    const lead = await ensureLead(session, customer, agency, {
      ...payload,
      ...selectedItemLeadFields(selected, selectedItem),
      routingIntentKey: data.routingIntentKey || payload.routingIntentKey,
      interest: selected?.itemType || data.interest || payload.customTripDetails?.flowAnswers?.interest || null,
      status: data.status || 'ENQUIRY',
      notes: [data.notePrefix || 'Flow enquiry', payload.notes].filter(Boolean).join(': '),
    });
    const assignedAgent = await resolveEnquiryNotificationAgent(lead, agency);
    const recipientPhone = assignedAgent?.phone || agency?.phone || agency?.whatsappNumber || '';
    const staffMessage = renderFlowGraphText(data.staffMessage || '', customer, agency, fields, selectedItem);

    if (recipientPhone && staffMessage) {
      await whatsappService.sendTextMessage(
        recipientPhone,
        staffMessage,
        { customerId: lead.customerId, agencyId: agency.id }
      );
      logFlowEvent('flow_graph_staff_notified', customer, agency, {
        leadId: lead.id,
        agentId: assignedAgent?.id || null,
        nodeId: node.id,
      });
    }

    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

    if (node.type === 'SAVE_ENQUIRY') {
      const selected = getSelectedFlowCatalogItem(session);
      const selectedItem = selected ? await findFlowCatalogItem(agency, selected.itemType, selected.itemId) : null;
      const payload = graphLeadPayloadFromFields(fields, selected);
      const enquiryKey = graphEnquiryKey(selected?.itemType, data.interest);
      const enquiryDetails = graphEnquiryDetails(fields, selected, selectedItem, data.interest);
      const flowSubmission = {
        key: enquiryKey,
        title: graphSubmissionTitle(enquiryKey, selected, data.interest),
        ...enquiryDetails,
        routingIntentKey: data.routingIntentKey || payload.routingIntentKey || '',
      };
      await ensureLead(session, customer, agency, {
        ...payload,
        ...selectedItemLeadFields(selected, selectedItem),
        routingIntentKey: data.routingIntentKey || payload.routingIntentKey,
        interest: selected?.itemType || data.interest || payload.customTripDetails?.flowAnswers?.interest || null,
        customTripDetails: {
          ...payload.customTripDetails,
          [enquiryKey]: enquiryDetails,
          flowSubmissions: [flowSubmission],
          ...(enquiryDetails.answers?.destination ? { destination: enquiryDetails.answers.destination } : {}),
          ...(enquiryDetails.answers?.travelDate ? { travelDate: enquiryDetails.answers.travelDate } : {}),
          ...(enquiryDetails.answers?.checkInDate ? { checkInDate: enquiryDetails.answers.checkInDate } : {}),
          ...(enquiryDetails.answers?.checkOutDate ? { checkOutDate: enquiryDetails.answers.checkOutDate } : {}),
          ...(enquiryDetails.answers?.people ? { travellersText: enquiryDetails.answers.people } : {}),
          ...(enquiryDetails.answers?.notes ? { notes: enquiryDetails.answers.notes } : {}),
          submittedAt: enquiryDetails.submittedAt,
        },
        notifyRoutedAgent: true,
        status: data.status || 'ENQUIRY',
        notes: [data.notePrefix || 'Flow enquiry', payload.notes].filter(Boolean).join(': '),
      });
    const finalMessage = renderFlowGraphText(data.finalMessage || '', customer, agency, fields);
    if (finalMessage) {
      await whatsappService.sendTextMessage(customer.phone, finalMessage, getContext(customer, agency));
    }
    const target = getFlowGraphEdgeTarget(graph, node.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target, hopCount + 1) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (node.type === 'OPEN_SERVICE') {
    let title = data.serviceKey || data.serviceCategory || data.title || 'Service';
    let value = data.serviceKey || data.serviceCategory || data.value || title;
    if (data.serviceId) {
      const service = await Service.findOne({ where: { id: data.serviceId, agencyId: agency.id } });
      if (service) {
        title = service.name;
        value = service.category || service.name;
      }
    }
    await clearFlowGraphState(session, STEPS.MENU);
    return handleCustomServiceSelection(session, customer, agency, { title, value });
  }

  if (node.type === 'OPEN_PACKAGE_FLOW') {
    const subGraph = getFlowGraphConfig(agency, 'packages', channel);
    if (subGraph) return startFlowGraph(session, customer, agency, 'packages');
    await clearFlowGraphState(session, STEPS.MENU);
    return openPackageFlow(session, customer, agency, data.category || 'DOMESTIC', data.tourType || null);
  }

  if (node.type === 'OPEN_PROPERTY_FLOW') {
    const subGraph = getFlowGraphConfig(agency, 'properties', channel);
    if (subGraph) return startFlowGraph(session, customer, agency, 'properties');
    await clearFlowGraphState(session, STEPS.MENU);
    return openPropertyFlow(
      session,
      customer,
      agency,
      data.routingIntentKey || 'staycations',
      {
        propertyType: data.propertyType || '',
        propertyLocation: data.propertyLocation || '',
      }
    );
  }

  if (node.type === 'OPEN_VISA_FLOW') {
    const subGraph = getFlowGraphConfig(agency, 'visas', channel);
    if (subGraph) return startFlowGraph(session, customer, agency, 'visas');
    await clearFlowGraphState(session, STEPS.MENU);
    return openVisaFlow(session, customer, agency, {
      country: data.country || '',
      visaType: data.visaType || '',
    });
  }

  if (node.type === 'OPEN_CRUISE_FLOW') {
    const subGraph = getFlowGraphConfig(agency, 'cruises', channel);
    if (subGraph) return startFlowGraph(session, customer, agency, 'cruises');
    await clearFlowGraphState(session, STEPS.MENU);
    return openCruiseFlow(session, customer, agency, {
      destination: data.destination || '',
      cruiseLine: data.cruiseLine || '',
    });
  }

  if (node.type === 'OPEN_SERVICE_FLOW') {
    const subGraph = getFlowGraphConfig(agency, 'services', channel);
    if (subGraph) return startFlowGraph(session, customer, agency, 'services');
    await clearFlowGraphState(session, STEPS.MENU);
    return openServiceFlow(session, customer, agency, {
      category: data.category || '',
    });
  }

  if (node.type === 'OPEN_CUSTOM_TRIP_FLOW') {
    await clearFlowGraphState(session, STEPS.MENU);
    return openCustomTripFlow(session, customer, agency);
  }

  if (node.type === 'OPEN_META_FLOW') {
    return openGraphMetaFlow(session, customer, agency, node);
  }

  if (node.type === 'HANDOFF') {
    await clearFlowGraphState(session, STEPS.MENU);
    const { handoffToAgent } = require('./handoffHandler');
    return handoffToAgent(session, customer, agency, data.reason || 'Requested from WhatsApp flow builder');
  }

  if (node.type === 'END') {
    const message = renderFlowGraphText(data.message || data.body, customer, agency, fields);
    if (message) {
      await whatsappService.sendTextMessage(customer.phone, message, getContext(customer, agency));
    }
    return clearFlowGraphState(session, STEPS.COMPLETE);
  }

  return clearFlowGraphState(session, STEPS.COMPLETE);
}

async function startFlowGraph(session, customer, agency, targetFlowId = null, options = {}) {
  const channel = resolveFlowChannel(customer, session);
  const graph = getFlowGraphConfig(agency, targetFlowId, channel);
  if (!graph) return showMainMenu(session, customer, agency);
  // Seed fields let a caller (e.g. a campaign card tap) inject variables such as
  // {campaign_keyword} that MESSAGE/CONDITION nodes can render and branch on.
  const seedFields = options && typeof options.seedFields === 'object' && options.seedFields
    ? options.seedFields
    : {};
  // Seed selected item lets a caller pre-select the catalog item (the tapped
  // carousel package/property) so SEND_ITEM_DOCUMENT / SEND_ITEM_DETAIL know which
  // record's PDF/details to send without an in-flow picker.
  const seedSelected = options && typeof options.seedSelectedItem === 'object' && options.seedSelectedItem?.itemId
    ? {
        itemType: normalizeFlowCatalogType(options.seedSelectedItem.itemType),
        itemId: String(options.seedSelectedItem.itemId),
        itemName: normalizeText(options.seedSelectedItem.itemName || ''),
      }
    : null;
  const seededPackageId = seedSelected?.itemType === 'PACKAGE' ? seedSelected.itemId : null;
  const seededPropertyId = seedSelected?.itemType === 'PROPERTY' ? seedSelected.itemId : null;
  // A caller may start the graph at a specific node (multi-entry campaign flow:
  // each template button enters the shared flow at its own starter node).
  const requestedStartNodeId = options?.startNodeId
    && Array.isArray(graph.nodes) && graph.nodes.some((node) => node.id === options.startNodeId)
    ? options.startNodeId
    : graph.startNodeId;
  await updateSession(session, {
    currentStep: STEPS.MENU,
    failedAttempts: 0,
    collectedData: {
      menuContext: 'FLOW_GRAPH',
      activeFlow: {
        flowId: graph.flowId,
        nodeId: requestedStartNodeId,
        awaitingNodeId: null,
        awaitingType: null,
        channel,
        fields: {
          ...seedFields,
          ...(seedSelected ? {
            selectedItemType: seedSelected.itemType,
            selectedItemId: seedSelected.itemId,
            selectedItemName: seedSelected.itemName,
          } : {}),
        },
        ...(seedSelected ? { selectedItem: seedSelected } : {}),
        startedAt: new Date().toISOString(),
      },
      packageCategory: null,
      packageTourType: null,
      packageResults: [],
      propertyResults: [],
      selectedPackageId: seededPackageId,
      selectedPropertyId: seededPropertyId,
      selectedPackageIds: seededPackageId ? [seededPackageId] : [],
      selectedPropertyIds: seededPropertyId ? [seededPropertyId] : [],
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });
  return executeFlowGraphNode(session, customer, agency, requestedStartNodeId);
}

async function handleFlowGraphReply(session, incoming, customer, agency) {
  const activeState = getActiveFlowGraphState(session);
  const channel = resolveFlowChannel(customer, session);
  const graph = getFlowGraphConfig(agency, activeState?.flowId, channel);
  if (!graph) return null;

  const actionId = normalizeText(incoming?.actionId || '');
  const text = normalizeText(incoming?.text || '');

  // A flow_graph button reply is self-describing (it encodes source node + handle), so it
  // can be routed straight from the graph even when the active session state was cleared
  // by a previous terminal node (e.g. an opened Meta flow / property / package flow).
  // This keeps the menu buttons live so the customer can pick another option afterwards.
    if (actionId.startsWith('flow_graph:')) {
      const [, sourceNodeId, sourceHandle] = actionId.split(':');
      let target = getFlowGraphEdgeTarget(graph, sourceNodeId, sourceHandle);
      // If not found in active sub-flow, try the entry flow (e.g. main_menu buttons)
      if (!target && activeState?.flowId) {
        const entryGraph = getFlowGraphConfig(agency, null, channel);
        if (entryGraph) {
          target = getFlowGraphEdgeTarget(entryGraph, sourceNodeId, sourceHandle);
          if (target) {
            // Jump back to entry flow context before executing
            return startFlowGraph(session, customer, agency, null).then(() =>
              executeFlowGraphNode(session, customer, agency, target)
            );
          }
        }
      }
      if (target) {
        if (['main_menu', 'packages_menu'].includes(normalizeText(sourceNodeId))) {
          await resetFlowGraphProgress(session, sourceNodeId);
        }
        return executeFlowGraphNode(session, customer, agency, target);
      }
      const active = getActiveFlowGraphState(session);
      const awaitingId = normalizeText(active?.awaitingNodeId || active?.nodeId || '');
      return sendInvalidChoice(session, customer, agency, () => (
      awaitingId
        ? executeFlowGraphNode(session, customer, agency, awaitingId)
        : startFlowGraph(session, customer, agency)
    ));
  }

  if (actionId.startsWith('flow_catalog:')) {
    const parts = actionId.split(':');
    const sourceNodeId = normalizeText(parts[1]);
    const itemType = normalizeFlowCatalogType(parts[2]);
    const itemId = normalizeText(parts.slice(3).join(':'));
    const sourceNode = getFlowGraphNode(graph, sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'CATALOG_LIST') {
      return sendInvalidChoice(session, customer, agency, () => startFlowGraph(session, customer, agency));
    }
    const item = await findFlowCatalogItem(agency, itemType, itemId);
    if (!item) {
      return sendInvalidChoice(session, customer, agency, () => executeFlowGraphNode(session, customer, agency, sourceNodeId));
    }
    await saveSelectedFlowCatalogItem(session, itemType, item);
    await ensureLead(session, customer, agency, {
      ...selectedItemLeadFields({ itemType, itemId }, item),
      status: 'NEW',
      customTripDetails: {
        [`${itemType.toLowerCase()}Enquiry`]: {
          itemId,
          itemName: flowCatalogTitle(item, itemType),
          selectedAt: new Date().toISOString(),
        },
      },
      notes: `${itemType} selected from flow builder: ${flowCatalogTitle(item, itemType)}`,
    });
    await updateFlowGraphState(session, {
      fields: {
        selectedItemCategory: normalizeText(item.category || itemType),
        selectedItemName: flowCatalogTitle(item, itemType),
        selectedItemId: item.id,
        selectedItemType: itemType,
      },
    });
    const overrideTarget = getFlowGraphEdgeTarget(graph, sourceNodeId, flowCatalogHandle(itemType, item.id));
    const defaultTarget = getFlowGraphEdgeTarget(graph, sourceNodeId, 'selected');
    const target = overrideTarget || defaultTarget;
    return target ? executeFlowGraphNode(session, customer, agency, target) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (!activeState) return null;

  const awaitingNodeId = normalizeText(activeState.awaitingNodeId || activeState.nodeId || '');
  const awaitingNode = getFlowGraphNode(graph, awaitingNodeId);
  if (!awaitingNode) return startFlowGraph(session, customer, agency);

  if (activeState.awaitingType === 'QUESTION') {
    if (!text || text.length < 1) {
      return whatsappService.sendTextMessage(customer.phone, 'Please share a response to continue.', getContext(customer, agency));
    }
    const fieldKey = normalizeText(awaitingNode.data?.fieldKey || awaitingNode.id);
    await updateFlowGraphState(session, {
      nodeId: awaitingNode.id,
      awaitingNodeId: null,
      awaitingType: null,
      fields: {
        [fieldKey]: text,
      },
    });
    const target = getFlowGraphEdgeTarget(graph, awaitingNode.id, 'default');
    return target ? executeFlowGraphNode(session, customer, agency, target) : clearFlowGraphState(session, STEPS.COMPLETE);
  }

  if (!actionId && /^\d+$/.test(text) && ['BUTTONS', 'LIST'].includes(activeState.awaitingType)) {
    const options = activeState.awaitingType === 'BUTTONS'
      ? buttonOptionsForNode(awaitingNode)
      : listRowsForNode(awaitingNode);
    const selected = options[parseInt(text, 10) - 1];
    if (selected) {
      const target = getFlowGraphEdgeTarget(graph, awaitingNode.id, selected.id);
      if (target) return executeFlowGraphNode(session, customer, agency, target);
    }
  }

  if (actionId.startsWith('flow_property_location:') || (!actionId && /^\d+$/.test(text) && activeState.awaitingType === 'PROPERTY_LOCATION_LIST')) {
    let sourceNodeId = awaitingNodeId;
    let selectedLocation = '';

    if (actionId.startsWith('flow_property_location:')) {
      const parts = actionId.split(':');
      sourceNodeId = normalizeText(parts[1]);
      try {
        selectedLocation = decodeURIComponent(parts.slice(2).join(':'));
      } catch {
        selectedLocation = normalizeText(parts.slice(2).join(':'));
      }
    } else {
      const selected = (activeState.propertyLocationOptions || [])[parseInt(text, 10) - 1];
      selectedLocation = normalizeText(selected?.location || '');
    }

    const sourceNode = getFlowGraphNode(graph, sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'CATALOG_LIST') {
      return sendInvalidChoice(session, customer, agency, () => startFlowGraph(session, customer, agency));
    }

    const fieldKey = getPropertyLocationFieldKey(sourceNode.data || {});
    const locationValue = normalizeText(selectedLocation || 'ALL');
    await updateFlowGraphState(session, {
      nodeId: sourceNode.id,
      awaitingNodeId: null,
      awaitingType: null,
      fields: {
        [fieldKey]: locationValue,
        selectedPropertyLocation: locationValue,
      },
      propertyLocationOptions: [],
    });
    return executeFlowGraphNode(session, customer, agency, sourceNode.id);
  }

  if (!actionId && /^\d+$/.test(text) && activeState.awaitingType === 'CATALOG_LIST') {
    const selected = (activeState.catalogOptions || [])[parseInt(text, 10) - 1];
    if (selected) {
      const item = await findFlowCatalogItem(agency, selected.itemType, selected.itemId);
      if (item) {
        await saveSelectedFlowCatalogItem(session, selected.itemType, item);
        await ensureLead(session, customer, agency, {
          ...selectedItemLeadFields(selected, item),
          status: 'NEW',
          customTripDetails: {
            [`${normalizeFlowCatalogType(selected.itemType).toLowerCase()}Enquiry`]: {
              itemId: selected.itemId,
              itemName: flowCatalogTitle(item, selected.itemType),
              selectedAt: new Date().toISOString(),
            },
          },
          notes: `${normalizeFlowCatalogType(selected.itemType)} selected from flow builder: ${flowCatalogTitle(item, selected.itemType)}`,
        });
        await updateFlowGraphState(session, {
          fields: {
            selectedItemCategory: normalizeText(item.category || selected.itemType),
            selectedItemName: flowCatalogTitle(item, selected.itemType),
            selectedItemId: item.id,
            selectedItemType: selected.itemType,
          },
        });
        const overrideTarget = getFlowGraphEdgeTarget(graph, awaitingNode.id, flowCatalogHandle(selected.itemType, selected.itemId));
        const defaultTarget = getFlowGraphEdgeTarget(graph, awaitingNode.id, 'selected');
        const target = overrideTarget || defaultTarget;
        if (target) return executeFlowGraphNode(session, customer, agency, target);
      }
    }
  }

  return sendInvalidChoice(session, customer, agency, () => executeFlowGraphNode(session, customer, agency, awaitingNodeId));
}

async function showMainMenu(session, customer, agency) {
  if (getFlowGraphConfig(agency, null, resolveFlowChannel(customer, session))) {
    return startFlowGraph(session, customer, agency);
  }

  if (isStayrouteAgency(agency)) {
    return startStayrouteOnamTextFlow(session, customer, agency);
  }

  const flowWelcomeMenu = getFlowWelcomeMenu(agency)
    .filter((item) => isModuleEnabledForAgency(agency, FLOW_NODE_MODULE[item.action]));
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

  if (flowWelcomeMenu.length === 1 && flowWelcomeMenu[0].action === 'OPEN_TRAVEL_READINESS_FLOW') {
    return openTravelReadinessFlow(session, customer, agency);
  }

  if (flowWelcomeMenu.length) {
    const buttons = flowWelcomeMenu.slice(0, 3).map((item) => ({
      id: `flow_welcome:${item.id}`,
      title: item.title,
    }));

    if (flowWelcomeMenu.length <= 3) {
      await recordMenuSent(session);
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

    await recordMenuSent(session);
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
    await recordMenuSent(session);
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
    { id: 'menu_visa_ticketing', title: labels.visaTicketing, module: '/visas' },
    { id: 'menu_packages', title: labels.planTrip, module: '/packages' },
    { id: 'menu_properties', title: labels.staycations, module: '/properties' },
  ]
    .filter((button) => isModuleEnabledForAgency(agency, button.module))
    .map(({ module, ...button }) => button);

  await recordMenuSent(session);
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

  await recordMenuSent(session);
  return whatsappService.sendButtonsMessage(
    customer.phone,
    'Choose the service you need.',
    [
      { id: 'visa_ticket_visa', title: labels.visaServices || 'Visa Services' },
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
  const selectedService = service === 'VISA' ? 'VISA' : service === 'RAIL' ? 'RAIL' : 'FLIGHT';
  const selectedServiceLabel = serviceLabel(selectedService);
  const isVisaService = selectedService === 'VISA';

  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey: 'visa',
    interest: isVisaService ? 'VISA_SERVICE' : `${selectedService}_TICKETING`,
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
      selectedServiceLabel,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    isVisaService
      ? 'Thanks. Please share the country, travel date, passenger count, and visa type you need. Our team will follow up shortly.'
      : `Thanks. Please share your ${selectedServiceLabel.toLowerCase()} route, date, passenger count, and any visa/ticketing details. Our team will follow up shortly.`,
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
  const selectedServiceId = normalizeText(session.collectedData?.selectedServiceId || '');

  if (details.length < 3) {
    return whatsappService.sendTextMessage(
      customer.phone,
      `Please share your ${selectedServiceLabel.toLowerCase()} route, date, and passenger count.`,
      getContext(customer, agency)
    );
  }

  await ensureLead(session, customer, agency, {
    ...(selectedServiceId ? {
      routingIntentKey: `service_${selectedServiceId}`,
      serviceId: selectedServiceId,
      itemType: 'SERVICE',
      notifyRoutedAgent: true,
    } : {}),
    interest: serviceCategory === 'CUSTOM_SERVICE' ? `${selectedService}_BOOKING` : `${selectedService}_TICKETING`,
    status: 'ENQUIRY',
    campaignAction: serviceCategory === 'CUSTOM_SERVICE' ? 'CUSTOM_SERVICE_DETAILS' : 'VISA_TICKETING',
    customTripDetails: {
      service: selectedService,
      serviceLabel: selectedServiceLabel,
      serviceCategory,
      serviceDetails: details,
      serviceEnquiry: {
        serviceId: selectedServiceId,
        serviceName: selectedServiceLabel,
        serviceCategory,
        details,
        submittedAt: new Date().toISOString(),
      },
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

  await recordMenuSent(session);
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
    await recordMenuSent(session);
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

  await recordMenuSent(session);
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

  await recordMenuSent(session);
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

  await recordMenuSent(session);
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
    routingIntentKey: routingKey('packages', normalizedCategory),
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

  const propertyFlowConfig = await getPropertyFlowConfig(agency);
  if (!propertyFlowConfig?.flowId) {
    console.error('[TravelFlow] property_flow_missing', { agencyId: agency.id, agencyName: agency.name });
    if (properties.length === 0) {
      return whatsappService.sendTextMessage(
        customer.phone,
        `We do not have active ${propertyLabel.toLowerCase()} listed right now. Please reply with location, stay type, dates, and number of people.`,
        getContext(customer, agency)
      );
    }
    return showPropertyListFallback(session, customer, agency, properties);
  }

  const propertyOptions = await buildFlowPropertyOptions(properties);
  const propertyLocationOptions = buildFlowPropertyLocationOptions(properties);
  const propertyTypeOptions = buildFilteredPropertyTypeOptions(properties, propertyFilter);
  const hasProperties = properties.length > 0;
  // Only the built-in multi-screen property flow starts on PROPERTY_FILTER and consumes the
  // property_locations/types/options data. Custom agency flows (e.g. a single-screen stay
  // enquiry form) declare their own first screen and no such bindings — sending them the
  // PROPERTY_FILTER screen + filter data makes Meta reject the message and the form never opens.
  const resolvedFirstScreenId = propertyFlowConfig.firstScreenId || PROPERTY_FLOW_FIRST_SCREEN_ID;
  const isStandardPropertyFlow = resolvedFirstScreenId === PROPERTY_FLOW_FIRST_SCREEN_ID;
  const firstScreenId = isStandardPropertyFlow
    ? (hasProperties ? PROPERTY_FLOW_FIRST_SCREEN_ID : null)
    : resolvedFirstScreenId;
  const flowData = (isStandardPropertyFlow && hasProperties)
    ? {
      property_locations: propertyLocationOptions,
      property_types: propertyTypeOptions,
      property_options: propertyOptions,
    }
    : null;
  const flowCta = hasProperties ? 'View Properties' : 'Request Stay';
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    hasProperties
      ? (propertyType ? `Choose your ${propertyType.toLowerCase()} location and travel details.` : 'Choose your stay location and travel details.')
      : 'Share your stay request and our team will find matching options.',
    {
      flowId: propertyFlowConfig.flowId,
      firstScreenId,
      flowCta,
      flowToken: `prop|${agency.id}|${customer.id}|${Date.now()}|${encodeFlowTokenPart(propertyType)}`,
      ...(flowData ? { data: flowData } : {}),
    },
    getContext(customer, agency),
    {
      headerText: hasProperties
        ? (propertyType ? `${propertyType} Properties` : 'Properties')
        : 'Stay Request',
      footerText: hasProperties ? 'Reply LIST if the flow does not open.' : 'Submit your stay requirement in the form.',
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
    routingIntentKey: 'packages_custom_trip',
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

async function openTravelReadinessFlow(session, customer, agency) {
  const readinessFlow = await getTravelReadinessFlowConfig(agency);
  if (!readinessFlow?.flowId) {
    console.error('[TravelFlow] travel_readiness_flow_missing', {
      agencyId: agency.id,
      agencyName: agency.name,
    });
    return whatsappService.sendTextMessage(
      customer.phone,
      'Thank you for your interest. Our travel consultant will contact you shortly.',
      getContext(customer, agency)
    );
  }

  await transitionTo(session, STEPS.COMPLETE, {
    selectedPackageId: null,
    selectedPropertyId: null,
    selectedPackageIds: [],
    selectedPropertyIds: [],
    campaignId: null,
    campaignName: 'Custom Trip',
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  return whatsappService.sendFlowMessage(
    customer.phone,
    getWelcomeMessage(customer, agency),
    {
      flowId: readinessFlow.flowId,
      firstScreenId: readinessFlow.firstScreenId || 'TRAVELLER_COUNT',
      flowCta: 'Start Enquiry',
      flowToken: `welcome-readiness|${agency.id}|${customer.id}|${Date.now()}`,
      data: {
        campaign_name: 'Custom Trip',
        customer_name: String(customer.name || '').trim(),
      },
    },
    getContext(customer, agency),
    {
      headerText: 'Plan Custom Trip',
      footerText: 'Submit the form and our consultant will contact you shortly.',
    }
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
    routingIntentKey: catalogRoutingIntent('PACKAGE', pkg),
    packageId: pkg.id,
    itemType: 'PACKAGE',
    destination: pkg?.destinations?.[0] || null,
    interest: inferPackageCategory(pkg) || profile.packageCategory || 'PACKAGE',
    customTripDetails: {
      packageEnquiry: {
        packageId: pkg.id,
        packageName: pkg.name,
        category: inferPackageCategory(pkg) || profile.packageCategory || '',
        selectedAt: new Date().toISOString(),
      },
    },
    notes: `Package selected: ${pkg.name}`,
  });

  await transitionTo(session, STEPS.PACKAGE_DETAIL, {
    selectedPackageId: pkg.id,
    selectedPackageIds: uniqueIds(profile.selectedPackageIds, pkg.id),
    selectedPackageName: pkg.name,
  });

  const detailMessage = buildPackageDetailCardCaption(pkg);
  const buttons = [
    { id: 'action_enquire', title: 'Enquiry' },
    { id: 'action_call_now', title: 'Call Now' },
  ];
  const options = {
    footerText: pkg.brochureUrl ? 'Reply PDF or BACK.' : 'Reply BACK.',
  };
  const context = getContext(customer, agency);
  const actionPrompt = 'Choose what you want to do next.';

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
        actionPrompt,
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
    routingIntentKey: catalogRoutingIntent('PROPERTY', property),
    propertyId: property.id,
    itemType: 'PROPERTY',
    destination: property.location || null,
    interest: 'PROPERTY',
    customTripDetails: {
      propertyEnquiry: {
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.propertyType || '',
        propertyLocation: property.location || '',
        selectedAt: new Date().toISOString(),
      },
    },
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
  const pendingMetaFlow = getPendingMetaFlow(session);
  await clearPendingMetaFlow(session);
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

  if (pendingMetaFlow?.source === 'FLOW_BUILDER_META_FLOW') {
    const formFields = {};
    flattenFlowResponse(response).forEach(({ key, value }) => {
      const normalizedKey = normalizeText(key);
      const normalizedValue = normalizeText(value);
      if (!normalizedKey || !normalizedValue) return;
      formFields[normalizedKey] = normalizedValue;
      const leafKey = normalizedKey.split('_').filter(Boolean).pop();
      if (leafKey && !formFields[leafKey]) {
        formFields[leafKey] = normalizedValue;
      }
      if (/date$/i.test(leafKey || '') || /date$/i.test(normalizedKey)) {
        const formattedDate = formatStayDateForCustomer(normalizedValue);
        if (formattedDate) {
          formFields[`${leafKey || normalizedKey}Formatted`] = formattedDate;
          formFields[`${normalizedKey}Formatted`] = formattedDate;
        }
      }
    });
    const graph = getFlowGraphConfig(agency, pendingMetaFlow.graphFlowId || null, pendingMetaFlow.channel || 'WHATSAPP');
    const graphNodeId = normalizeText(pendingMetaFlow.graphNodeId || '') || normalizeText(findFlowBuilderMetaNode(graph, pendingMetaFlow)?.id || '');
    const target = graph && graphNodeId ? getFlowGraphEdgeTarget(graph, graphNodeId, 'default') : '';
    await updateFlowGraphState(session, {
      flowId: pendingMetaFlow.graphFlowId || graph?.flowId || null,
      channel: pendingMetaFlow.channel || 'WHATSAPP',
      fields: formFields,
    });
    if (target) return executeFlowGraphNode(session, customer, agency, target);
  }

  // Visa / Cruise / Service image-selector flows: route the picked item straight to its detail card.
  const visaSelectorForm = (response.visa_selector_form && typeof response.visa_selector_form === 'object') ? response.visa_selector_form : (response.visaSelectorForm || {});
  const cruiseSelectorForm = (response.cruise_selector_form && typeof response.cruise_selector_form === 'object') ? response.cruise_selector_form : (response.cruiseSelectorForm || {});
  const serviceSelectorForm = (response.service_selector_form && typeof response.service_selector_form === 'object') ? response.service_selector_form : (response.serviceSelectorForm || {});
  const pickedVisaId = normalizeText(visaSelectorForm.visaId || visaSelectorForm.visa_id || response.visaId || '');
  if (pickedVisaId) return showVisaDetail(session, customer, agency, pickedVisaId);
  const pickedCruiseId = normalizeText(cruiseSelectorForm.cruiseId || cruiseSelectorForm.cruise_id || response.cruiseId || '');
  if (pickedCruiseId) return showCruiseDetail(session, customer, agency, pickedCruiseId);
  const pickedServiceId = normalizeText(serviceSelectorForm.serviceId || serviceSelectorForm.service_id || response.serviceId || '');
  if (pickedServiceId) return showServiceDetail(session, customer, agency, pickedServiceId);

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

  const stayRequestFormResponse = response.stay_request_form && typeof response.stay_request_form === 'object'
    ? response.stay_request_form
    : response.stayRequestForm && typeof response.stayRequestForm === 'object'
      ? response.stayRequestForm
      : {};

  const getOutHouseFormResponse = response.getouthouse_stay_enquiry_form && typeof response.getouthouse_stay_enquiry_form === 'object'
    ? response.getouthouse_stay_enquiry_form
    : response.getOutHouseStayEnquiryForm && typeof response.getOutHouseStayEnquiryForm === 'object'
      ? response.getOutHouseStayEnquiryForm
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
  const hasCustomTripFormResponse = Object.keys(customTripFormResponse).length > 0;
  const readinessPayload = normalizeReadinessPayload(response, readinessFormResponse);
  if (
    hasCustomTripFormResponse
    && readinessPayload.hasReadinessFields
    && !readinessPayload.bookingReadiness
    && !readinessPayload.tripType
    && !readinessPayload.departureAirport
    && !readinessPayload.roomType
  ) {
    readinessPayload.hasReadinessFields = false;
  }

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
      || getOutHouseFormResponse.name
      || getOutHouseFormResponse.guestName
      || getOutHouseFormResponse.guest_name
      || response.guestName
      || response.guest_name
      || findFlowResponseValue(response, [/guestname/, /customername/, /^name$/])
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
      || stayRequestFormResponse.place
      || stayRequestFormResponse.city
      || stayRequestFormResponse.location
      || stayRequestFormResponse.propertyLocation
      || stayRequestFormResponse.property_location
      || getOutHouseFormResponse.propertyLocation
      || getOutHouseFormResponse.property_location
      || response.propertyLocation
      || response.property_location
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
      || stayRequestFormResponse.travelDate
      || stayRequestFormResponse.travel_date
      || stayRequestFormResponse.travelMonth
      || stayRequestFormResponse.checkInDate
      || stayRequestFormResponse.check_in_date
      || stayRequestFormResponse.checkOutDate
      || stayRequestFormResponse.check_out_date
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
      || stayRequestFormResponse.travellers
      || stayRequestFormResponse.travelers
      || stayRequestFormResponse.guests
      || stayRequestFormResponse.guestCount
      || stayRequestFormResponse.guest_count
      || stayRequestFormResponse.travellerCount
      || stayRequestFormResponse.travelerCount
      || getOutHouseFormResponse.travellers
      || getOutHouseFormResponse.guests
      || getOutHouseFormResponse.adults
      || response.travellers
      || response.guests
      || response.adults
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
      || stayRequestFormResponse.notes
      || stayRequestFormResponse.otherDetails
      || stayRequestFormResponse.other_details
      || getOutHouseFormResponse.notes
      || getOutHouseFormResponse.otherDetails
      || getOutHouseFormResponse.other_details
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
    || stayRequestFormResponse.checkInDate
    || stayRequestFormResponse.check_in_date
    || getOutHouseFormResponse.checkInDate
    || getOutHouseFormResponse.check_in_date
    || findFlowResponseValue(response, [/checkin/, /checkindate/, /arrivaldate/])
  );
  const checkOutDate = normalizeText(
    response.checkOutDate
    || response.check_out_date
    || enquiryFormResponse.checkOutDate
    || enquiryFormResponse.check_out_date
    || propertyEnquiryFormResponse.checkOutDate
    || propertyEnquiryFormResponse.check_out_date
    || stayRequestFormResponse.checkOutDate
    || stayRequestFormResponse.check_out_date
    || getOutHouseFormResponse.checkOutDate
    || getOutHouseFormResponse.check_out_date
    || findFlowResponseValue(response, [/checkout/, /checkoutdate/, /departuredate/])
  );
  if (checkInDate || checkOutDate) {
    enquiryPayload.travelDate = [checkInDate, checkOutDate].filter(Boolean).join(' to ');
  }

  const stayRequestType = normalizeText(
    response.propertyType
    || response.property_type
    || response.stayType
    || response.stay_type
    || stayRequestFormResponse.propertyType
    || stayRequestFormResponse.property_type
    || stayRequestFormResponse.stayType
    || stayRequestFormResponse.stay_type
    || getOutHouseFormResponse.propertyType
    || getOutHouseFormResponse.property_type
    || getOutHouseFormResponse.groupType
    || getOutHouseFormResponse.group_type
    || response.groupType
    || response.group_type
    || findFlowResponseValue(response, [/grouptype/, /familyorbachelor/])
  );

  const getOutHouseAdults = parseInt(normalizeText(
    getOutHouseFormResponse.adults
    || response.adults
    || findFlowResponseValue(response, [/adults/, /adultcount/])
    || ''
  ), 10);
  const getOutHouseChildren6To12 = parseInt(normalizeText(
    getOutHouseFormResponse.children6To12
    || getOutHouseFormResponse.children_6_to_12
    || response.children6To12
    || response.children_6_to_12
    || findFlowResponseValue(response, [/children6to12/, /children612/, /child6to12/, /child612/])
    || ''
  ), 10);
  const getOutHouseChildrenBelow5 = parseInt(normalizeText(
    getOutHouseFormResponse.childrenBelow5
    || getOutHouseFormResponse.children_below_5
    || response.childrenBelow5
    || response.children_below_5
    || findFlowResponseValue(response, [/childrenbelow5/, /childbelow5/, /below5/])
    || ''
  ), 10);
  const getOutHouseTravellerTotal = [getOutHouseAdults, getOutHouseChildren6To12, getOutHouseChildrenBelow5]
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  if (getOutHouseTravellerTotal > 0) {
    enquiryPayload.travellers = String(getOutHouseTravellerTotal);
  }

  const getOutHouseDetails = {
    groupType: normalizeText(getOutHouseFormResponse.groupType || getOutHouseFormResponse.group_type || response.groupType || response.group_type || ''),
    adults: Number.isFinite(getOutHouseAdults) ? getOutHouseAdults : null,
    children6To12: Number.isFinite(getOutHouseChildren6To12) ? getOutHouseChildren6To12 : null,
    childrenBelow5: Number.isFinite(getOutHouseChildrenBelow5) ? getOutHouseChildrenBelow5 : null,
    rooms: normalizeText(getOutHouseFormResponse.rooms || getOutHouseFormResponse.roomCount || response.rooms || response.roomCount || findFlowResponseValue(response, [/rooms/, /roomcount/]) || ''),
  };
  if (!getOutHouseDetails.groupType) {
    getOutHouseDetails.groupType = normalizeText(findFlowResponseValue(response, [/grouptype/, /familyorbachelor/]));
  }
  const getOutHouseNotes = [
    getOutHouseDetails.groupType ? `Group type: ${getOutHouseDetails.groupType}` : null,
    getOutHouseDetails.adults !== null ? `Adults: ${getOutHouseDetails.adults}` : null,
    getOutHouseDetails.children6To12 !== null ? `Children 6-12: ${getOutHouseDetails.children6To12}` : null,
    getOutHouseDetails.childrenBelow5 !== null ? `Children below 5: ${getOutHouseDetails.childrenBelow5}` : null,
    getOutHouseDetails.rooms ? `Rooms: ${getOutHouseDetails.rooms}` : null,
  ].filter(Boolean).join(' | ');
  if (getOutHouseNotes) {
    enquiryPayload.notes = [enquiryPayload.notes, getOutHouseNotes].filter(Boolean).join(' | ');
  }

  const isStayRequest = String(response.stayRequest || response.stay_request || stayRequestFormResponse.stayRequest || stayRequestFormResponse.stay_request || '').toLowerCase() === 'true'
    || normalizeText(response.enquiryType || response.enquiry_type || getOutHouseFormResponse.enquiryType || getOutHouseFormResponse.enquiry_type).toLowerCase() === 'getouthouse_stay'
    || Object.keys(stayRequestFormResponse).length > 0
    || Object.keys(getOutHouseFormResponse).length > 0
    || Boolean(checkInDate && checkOutDate && (getOutHouseTravellerTotal > 0 || getOutHouseDetails.rooms));
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
    isStayRequest,
    hasReadinessFields: readinessPayload.hasReadinessFields,
  });

  if (isStayRequest) {
    logFlowEvent('stay_request_flow_dates_parsed', customer, agency, {
      responseKeys: flattenFlowResponse(response).map(({ key }) => key).slice(0, 30),
      checkInDate: checkInDate || null,
      checkOutDate: checkOutDate || null,
      travellers: enquiryPayload.travellers || null,
    });
  }

  if (!packageId && !propertyId && !hasFlowEnquiryFields && !readinessPayload.hasReadinessFields) {
    return sendInvalidChoice(session, customer, agency, () => reopenPackageContext(session, customer, agency, profile));
  }

  if (hasFlowEnquiryFields) {
    if (isStayRequest && !propertyId) {
      if (!enquiryPayload.travelDate || enquiryPayload.travelDate.length < 3 || Number.isNaN(travellers) || travellers < 1 || travellers > 50) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please submit valid stay details. Check-in, checkout, and guest count are required.',
          getContext(customer, agency)
        );
      }

      await transitionTo(session, STEPS.COMPLETE, {
        selectedPackageId: null,
        selectedPropertyId: null,
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
          stayType: stayRequestType,
          getOutHouseDetails,
          notes: enquiryPayload.notes,
        },
      });

      return finalizeStayRequestFlowEnquiry(session, customer, agency);
    }

    if (readinessPayload.hasReadinessFields) {
      const isCustomTripReadiness = isCustomTripReadinessContext(profile);
      const selectedPackageId = isCustomTripReadiness
        ? null
        : packageId || profile.selectedPackageId || mergedPackageIds[0] || null;
      const selectedPackageIds = isCustomTripReadiness
        ? []
        : selectedPackageId
          ? uniqueIds(mergedPackageIds, selectedPackageId)
          : mergedPackageIds;
      const readinessTravellers = readinessTravellerNumber(readinessPayload.travellerCount);
      const pkg = selectedPackageId
        ? await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id } })
        : null;
      const packageName = publicPackageName(pkg);

      const notes = [
        'Travel readiness questionnaire submitted',
        packageName ? `Package: ${packageName}` : null,
        readinessPayload.travellerCount ? `Travellers: ${readinessAnswerLabel(readinessPayload.travellerCount)}` : null,
        readinessPayload.tripType ? `Trip type: ${readinessAnswerLabel(readinessPayload.tripType)}` : null,
        readinessPayload.bookingReadiness ? `Readiness: ${readinessAnswerLabel(readinessPayload.bookingReadiness)}` : null,
        readinessPayload.departureAirport ? `Departure airport: ${readinessAnswerLabel(readinessPayload.departureAirport)}` : null,
        readinessPayload.roomType ? `Preferred room type: ${readinessAnswerLabel(readinessPayload.roomType)}` : null,
      ].filter(Boolean).join(' | ');

      await transitionTo(session, STEPS.COMPLETE, {
        selectedPackageId,
        selectedPropertyId: propertyId || profile.selectedPropertyId || null,
        selectedPackageIds,
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
          tripType: readinessPayload.tripType,
          bookingReadiness: readinessPayload.bookingReadiness,
          departureAirport: readinessPayload.departureAirport,
          roomType: readinessPayload.roomType,
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
          ...(isCustomTripReadiness
            ? {
                source: 'whatsapp_custom_trip_flow',
                submittedAt: new Date().toISOString(),
                travellers: readinessTravellers,
                travellersText: readinessPayload.travellerCount
                  ? readinessAnswerLabel(readinessPayload.travellerCount)
                  : '',
              }
            : {}),
          travelReadiness: {
            travellerCount: readinessPayload.travellerCount,
            tripType: readinessPayload.tripType,
            bookingReadiness: readinessPayload.bookingReadiness,
            departureAirport: readinessPayload.departureAirport,
            roomType: readinessPayload.roomType,
          },
        },
      });

      const shouldUseStayrouteOnamRouting = isStayrouteOnamContext(profile);
      const bisminaAgent = shouldUseStayrouteOnamRouting
        ? await findStayrouteBisminaAgent(agency).catch(() => null)
        : null;
      if (bisminaAgent?.id && lead?.id && lead.assignedAgentId !== bisminaAgent.id) {
        await leadService.updateLead(lead.id, agency.id, { assignedAgentId: bisminaAgent.id }).catch((err) => {
          console.warn('[TravelFlow] Could not auto-assign StayRoute enquiry to Bismina:', err.message);
        });
        lead.assignedAgentId = bisminaAgent.id;
      }

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
      const enquiryLabel = readinessEnquiryLabel({ pkg, profile });
      const chatLink = buildWhatsAppChatLink(
        routedPhone,
        buildSpecialistPrefill({
          customer,
          pkg,
          campaignName: enquiryLabel,
          lead,
        })
      );
      const confirmationMessage = routedPhone
        ? [
          `Thank you ${escapeMarkdown(firstName(customer))}. We received your ${escapeMarkdown(enquiryLabel)} enquiry.`,
          'Our travel consultant will contact you shortly.',
          `You can also chat with ${escapeMarkdown(routedName)} on WhatsApp.`,
        ].filter(Boolean).join('\n\n')
        : `Thank you ${escapeMarkdown(firstName(customer))}. We received your ${escapeMarkdown(enquiryLabel)} enquiry. Our travel consultant will contact you shortly.`;

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

function flattenFlowResponse(value, prefix = '', output = []) {
  if (value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenFlowResponse(item, `${prefix}_${index}`, output));
    return output;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenFlowResponse(child, prefix ? `${prefix}_${key}` : key, output);
    }
    return output;
  }
  output.push({ key: prefix, value });
  return output;
}

function findFlowResponseValue(source, patterns = []) {
  const flat = flattenFlowResponse(source);
  const match = flat.find(({ key, value }) => {
    const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    return value !== '' && patterns.some((pattern) => pattern.test(normalizedKey));
  });
  return match ? normalizeText(match.value) : '';
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
        package_summary: packageSummaryLine(pkg).slice(0, 80),
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

  await markPendingMetaFlow(session, {
    source: 'PROPERTY_STAY_FLOW',
    flowType: 'PROPERTY',
    flowId: propertyFlowConfig.flowId,
    firstScreenId,
    flowCta,
    ...(flowData ? { data: flowData } : {}),
    reminderText: 'Please fill the stay request form so we can check the best available options, pricing, dates, guest count, and location for you.',
    headerText: 'Complete stay request',
    footerText: 'These details help us share accurate availability and pricing.',
  });

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

function isStayrouteAgency(agency = {}) {
  return normalizeText(agency.name).toLowerCase().includes('stayroute');
}

async function findStayrouteBisminaAgent(agency) {
  if (!agency?.id || !isStayrouteAgency(agency)) return null;

  return Agent.findOne({
    where: {
      agencyId: agency.id,
      name: { [Op.iLike]: '%bismina%' },
      phone: { [Op.ne]: null },
    },
    order: [['createdAt', 'ASC']],
  });
}

async function notifyAgentOfNewEnquiry(lead, customer, agency, pkg, enquiry) {
  const assignedAgent = await resolveEnquiryNotificationAgent(lead, agency);
  const fallbackPhone = agency?.phone || agency?.whatsappNumber || '';
  const recipientPhone = assignedAgent?.phone || fallbackPhone;

  if (!recipientPhone) return;

  await sendAgentLeadAssignment(recipientPhone, agency.id, {
    customerName: customer?.name,
    phone: customer?.phone,
    packageName: pkg?.name || enquiry.packageName || enquiry.destination,
    travelDate: enquiry.travelDate,
    travellers: enquiry.travellers,
    budgetPerPerson: enquiry.budgetPerPerson,
    notes: enquiry.notes,
  }, { customerId: lead.customerId, agencyId: agency.id });

  logFlowEvent('agent_notified_of_enquiry', customer, agency, {
    leadId: lead.id,
    agentId: assignedAgent?.id || null,
    packageName: pkg?.name || null,
  });
}

async function resolveEnquiryNotificationAgent(lead, agency) {
  if (!agency?.id) return null;

  if (lead?.assignedAgentId) {
    const assignedAgent = await Agent.findOne({
      where: { id: lead.assignedAgentId, agencyId: agency.id },
    });
    if (assignedAgent?.phone) return assignedAgent;
  }

  const leastBusyAgent = await leadService.findLeastBusyAgent(agency.id).catch(() => null);
  if (leastBusyAgent?.phone) {
    if (lead?.id && !lead.assignedAgentId) {
      await leadService.updateLead(lead.id, agency.id, { assignedAgentId: leastBusyAgent.id }).catch(() => null);
      lead.assignedAgentId = leastBusyAgent.id;
    }
    return leastBusyAgent;
  }

  return Agent.findOne({
    where: {
      agencyId: agency.id,
      role: 'ADMIN',
      phone: { [Op.ne]: null },
    },
    order: [['createdAt', 'ASC']],
  });
}

async function sendCustomerQuickContact(customer, agency, pkg, lead, agent) {
  const routedPhone = agent?.phone || agency.phone || agency.whatsappNumber;
  const routedName = agent?.name || agency.name || 'our travel expert';
  const packageText = pkg?.name ? ` for ${escapeMarkdown(pkg.name)}` : '';
  const message = routedPhone
    ? [
      `Thanks ${escapeMarkdown(firstName(customer))}. Your enquiry${packageText} has been sent to ${escapeMarkdown(routedName)}.`,
      `You can also contact us directly on WhatsApp/phone: ${routedPhone}`,
    ].join('\n\n')
    : `Thanks ${escapeMarkdown(firstName(customer))}. Your enquiry${packageText} has been sent. Our team will contact you shortly.`;

  const chatLink = buildWhatsAppChatLink(
    routedPhone,
    buildSpecialistPrefill({
      customer,
      pkg,
      lead,
    })
  );

  if (routedPhone && chatLink) {
    return whatsappService.sendUrlButtonMessage(
      customer.phone,
      message,
      'Chat on WhatsApp',
      chatLink,
      getContext(customer, agency),
      { footerText: 'Our team will also follow up from the dashboard.' }
    );
  }

  return whatsappService.sendTextMessage(customer.phone, message, getContext(customer, agency));
}

async function quickPackageEnquiry(session, customer, agency, packageId = null, details = {}) {
  const profile = getProfile(session);
  const selectedPackageId = normalizeText(packageId || profile.selectedPackageId || '');
  const pkg = selectedPackageId
    ? await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id, isActive: true } })
    : null;

  if (!pkg) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'Please choose the package you want to enquire about, then tap Enquiry again.',
      getContext(customer, agency)
    );
    return reopenPackageContext(session, customer, agency, profile);
  }

  const lead = await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',
    packageId: pkg.id,
    itemType: 'PACKAGE',
    source: details.source || 'whatsapp_package_enquiry',
    campaignId: details.campaignId || profile.campaignId || null,
    campaignName: details.campaignName || profile.campaignName || null,
    campaignAction: details.campaignAction || 'ENQUIRY_CLICKED',
    destination: pkg.destinations?.[0] || null,
    notes: details.notes || `Enquiry clicked for package: ${pkg.name}`,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      selectedPackageId: pkg.id,
      selectedPackageIds: Array.from(new Set([...(profile.selectedPackageIds || []), pkg.id].filter(Boolean))),
      selectedPackageName: pkg.name,
      packageResults: profile.packageResults?.length ? profile.packageResults : [pkg.id],
      campaignId: details.campaignId || profile.campaignId || null,
      campaignName: details.campaignName || profile.campaignName || null,
    },
  });

  const notificationAgent = await resolveEnquiryNotificationAgent(lead, agency);
  await notifyAgentOfNewEnquiry(lead, customer, agency, pkg, {
    travelDate: profile.enquiryDraft.travelDate,
    travellers: profile.enquiryDraft.travellers,
    budgetPerPerson: profile.enquiryDraft.budgetPerPerson,
    notes: details.notes || 'Customer tapped Enquiry button',
  }).catch((err) => {
    console.warn('[TravelFlow] Could not notify agent/admin of quick enquiry:', err.message);
  });

  return sendCustomerQuickContact(customer, agency, pkg, lead, notificationAgent);
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

async function finalizeStayRequestFlowEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const enquiry = profile.enquiryDraft;
  const stayType = normalizeText(enquiry.stayType || enquiry.propertyType || '');
  const getOutHouseDetails = enquiry.getOutHouseDetails && typeof enquiry.getOutHouseDetails === 'object'
    ? enquiry.getOutHouseDetails
    : {};

  if (enquiry.name) {
    await Customer.update(
      { name: enquiry.name },
      { where: { id: customer.id } }
    );
  }

  const notes = [
    'Lead captured from WhatsApp stay request flow',
    profile.campaignName ? `Campaign: ${profile.campaignName}` : null,
    enquiry.place ? `Location: ${enquiry.place}` : null,
    stayType ? `Stay type: ${stayType}` : null,
    enquiry.checkInDate ? `Check-in: ${enquiry.checkInDate}` : null,
    enquiry.checkOutDate ? `Checkout: ${enquiry.checkOutDate}` : null,
    !enquiry.checkInDate && enquiry.travelDate ? `Dates: ${enquiry.travelDate}` : null,
    enquiry.travellers ? `People: ${enquiry.travellers}` : null,
    getOutHouseDetails.groupType ? `Group type: ${getOutHouseDetails.groupType}` : null,
    getOutHouseDetails.adults !== undefined && getOutHouseDetails.adults !== null ? `Adults: ${getOutHouseDetails.adults}` : null,
    getOutHouseDetails.children6To12 !== undefined && getOutHouseDetails.children6To12 !== null ? `Children 6-12: ${getOutHouseDetails.children6To12}` : null,
    getOutHouseDetails.childrenBelow5 !== undefined && getOutHouseDetails.childrenBelow5 !== null ? `Children below 5: ${getOutHouseDetails.childrenBelow5}` : null,
    getOutHouseDetails.rooms ? `Rooms: ${getOutHouseDetails.rooms}` : null,
    enquiry.notes ? `Other details: ${enquiry.notes}` : null,
  ].filter(Boolean).join(' | ');

  const lead = await ensureLead(session, customer, agency, {
    itemType: 'PROPERTY',
    campaignId: profile.campaignId || null,
    campaignName: profile.campaignName || null,
    campaignAction: profile.campaignId ? 'STAY_REQUEST_FLOW' : null,
    destination: enquiry.place || null,
    travelDates: enquiry.travelDate || null,
    travellers: enquiry.travellers || null,
    interest: 'PROPERTY',
    customTripDetails: {
      propertyLocation: enquiry.place || '',
      destination: enquiry.place || '',
      propertyType: stayType || '',
      stayType: stayType || '',
      travelDate: enquiry.travelDate || '',
      checkInDate: enquiry.checkInDate || '',
      checkOutDate: enquiry.checkOutDate || '',
      travellers: enquiry.travellers || null,
      travellersText: enquiry.travellers ? String(enquiry.travellers) : '',
      groupType: getOutHouseDetails.groupType || '',
      adults: getOutHouseDetails.adults || null,
      children6To12: getOutHouseDetails.children6To12 || null,
      childrenBelow5: getOutHouseDetails.childrenBelow5 || null,
      rooms: getOutHouseDetails.rooms || '',
      notes: enquiry.notes || '',
      source: profile.campaignId ? 'whatsapp_campaign_stay_request_flow' : 'whatsapp_stay_request_flow',
      submittedAt: new Date().toISOString(),
      campaignName: profile.campaignName || '',
    },
    status: 'ENQUIRY',
    notes,
  });

  await notifyAgentOfNewEnquiry(lead, customer, agency, null, {
    packageName: 'GetOutHouse stay enquiry',
    destination: enquiry.place || 'Stay request',
    travelDate: enquiry.travelDate || [enquiry.checkInDate, enquiry.checkOutDate].filter(Boolean).join(' to '),
    travellers: enquiry.travellers || null,
    budgetPerPerson: null,
    notes,
  }).catch((err) => {
    console.warn('[TravelFlow] Could not notify staff of stay request enquiry:', err.message);
  });

  await attachCampaignRecipientFlowResult(profile.campaignId, customer.id, lead, {
    selectedItemType: 'PROPERTY',
    selectedItemId: null,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
      selectedPropertyId: null,
      selectedPropertyIds: [],
      campaignId: profile.campaignId || null,
      campaignName: profile.campaignName || null,
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    [
      `Thanks ${escapeMarkdown(firstName(customer))}. We received your stay request.`,
      '',
      enquiry.place ? `Location: ${escapeMarkdown(enquiry.place)}` : null,
      stayType ? `Stay type: ${escapeMarkdown(stayType)}` : null,
      `Check-in: ${escapeMarkdown(formatStayDateForCustomer(enquiry.checkInDate) || 'Not shared')}`,
      `Checkout: ${escapeMarkdown(formatStayDateForCustomer(enquiry.checkOutDate) || 'Not shared')}`,
      getOutHouseDetails.adults !== undefined && getOutHouseDetails.adults !== null
        ? `Adults (12+): ${getOutHouseDetails.adults}`
        : null,
      getOutHouseDetails.children6To12 !== undefined && getOutHouseDetails.children6To12 !== null
        ? `Kids (6-12): ${getOutHouseDetails.children6To12}`
        : null,
      getOutHouseDetails.adults == null && getOutHouseDetails.children6To12 == null
        ? `People: ${enquiry.travellers || 'Not shared'}`
        : null,
      '',
      'Our team will contact you shortly with matching stay options.',
    ].filter(Boolean).join('\n'),
    getContext(customer, agency)
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

  await recordMenuSent(session);
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
    return openPropertyFlow(session, customer, agency, resolvePropertyRoutingIntent(agency, item.title || item.value || item.id));
  }

  if (item.action === 'OPEN_SERVICE_MENU') {
    return showServiceMenu(session, customer, agency, item.category || item.value || item.id);
  }

  if (item.action === 'OPEN_CUSTOM_TRIP_FLOW') {
    return openCustomTripFlow(session, customer, agency);
  }

  if (item.action === 'OPEN_TRAVEL_READINESS_FLOW') {
    return openTravelReadinessFlow(session, customer, agency);
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

  if (actionId === 'action_item_enquire') {
    const { handoffToAgent } = require('./handoffHandler');
    return handoffToAgent(session, customer, agency, 'Enquiry from visa/cruise/service selection');
  }

  if (actionId === 'action_enquire' || text === 'enquiry' || text === 'enquire now' || text === 'enquire' || text === '1') {
    return quickPackageEnquiry(session, customer, agency);
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

  if (isStayrouteAgency(agency) && menuContext.startsWith('STAYROUTE_ONAM_')) {
    return handleStayrouteOnamTextFlow(
      session,
      customer,
      agency,
      [incoming?.actionId, incoming?.text].filter(Boolean).join(' ')
    );
  }

  if (!actionId && ['1', '2', '3'].includes(text)) {
    if (menuContext === 'WELCOME') {
      const options = Array.isArray(session.collectedData?.menuOptions) ? session.collectedData.menuOptions : [];
      actionId = normalizeText(options[parseInt(text, 10) - 1] || '')
        || { 1: 'menu_visa_ticketing', 2: 'menu_packages', 3: 'menu_properties' }[text]
        || '';
    } else if (menuContext === 'VISA_TICKETING') {
      actionId = { 1: 'visa_ticket_visa', 2: 'visa_ticket_flight', 3: 'visa_ticket_rail' }[text] || '';
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
    if (session?.collectedData?.campaignId) {
      return showPackageCategoryMenu(session, customer, agency);
    }
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

  if (
    getFlowGraphConfig(agency, null, resolveFlowChannel(customer, session))
    && (getActiveFlowGraphState(session) || actionId.startsWith('flow_graph:') || menuContext === 'FLOW_GRAPH')
  ) {
    return handleFlowGraphReply(session, incoming, customer, agency);
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

  if (actionId === 'menu_visa_ticketing' || (menuContext !== 'VISA_TICKETING' && (text === 'visa & ticketing' || text === 'visa' || text === 'visa services' || text === 'ticketing'))) {
    return showVisaTicketingMenu(session, customer, agency);
  }

  if (actionId === 'visa_ticket_visa' || text === 'visa service' || text === 'visa services') {
    return handleVisaTicketingSelection(session, customer, agency, 'VISA');
  }

  if (actionId === 'visa_ticket_flight' || text === 'flight' || text === 'flight tickets') {
    return handleVisaTicketingSelection(session, customer, agency, 'FLIGHT');
  }

  if (actionId === 'visa_ticket_rail' || text === 'rail' || text === 'train') {
    return handleVisaTicketingSelection(session, customer, agency, 'RAIL');
  }

  if (actionId === 'menu_packages' || text === 'see other' || text === 'see others' || text === 'view packages' || text === 'packages' || text === 'show packages' || text === 'plan a trip' || text === 'tour package' || text === 'tour packages') {
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

  if (actionId.startsWith('visa_pick:')) {
    return showVisaDetail(session, customer, agency, normalizeText(actionId.split(':')[1]));
  }

  if (actionId.startsWith('cruise_pick:')) {
    return showCruiseDetail(session, customer, agency, normalizeText(actionId.split(':')[1]));
  }

  if (actionId.startsWith('service_pick:')) {
    return showServiceDetail(session, customer, agency, normalizeText(actionId.split(':')[1]));
  }

  if (actionId === 'action_item_enquire' && profile.selectedServiceId) {
    await updateSession(session, {
      currentStep: STEPS.SERVICE_DETAILS,
      failedAttempts: 0,
      collectedData: {
        selectedServiceId: profile.selectedServiceId,
        selectedService: profile.selectedService || 'SERVICE',
        selectedServiceLabel: profile.selectedServiceLabel || 'Service',
        serviceCategory: profile.serviceCategory || 'SERVICE',
      },
    });
    return whatsappService.sendTextMessage(
      customer.phone,
      `Please share the details for ${escapeMarkdown(profile.selectedServiceLabel || 'this service')} - dates, route/location, passenger/applicant count, and any special requirement.`,
      getContext(customer, agency)
    );
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

  if (
    getPendingMetaFlow(session)
    && !actionId
    && text
    && !['menu', 'main menu', 'start', 'restart', 'start over'].includes(text)
  ) {
    return remindPendingMetaFlow(session, customer, agency);
  }

  if (session.currentStep === 'NEW' || session.currentStep === STEPS.MENU || session.currentStep === STEPS.COMPLETE) {
    return showMainMenu(session, customer, agency);
  }

  return sendInvalidChoice(session, customer, agency);
}

module.exports = {
  STEPS,
  handleTravelFlow,
  hasInstagramFlowGraph,
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
  quickPackageEnquiry,
  startFlowGraph,
  PROPERTY_FLOW_FIRST_SCREEN_ID,
  CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
};
