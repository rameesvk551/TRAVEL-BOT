const path = require('path');
const { Op } = require('sequelize');
const { Package, Booking, Lead } = require(path.resolve(__dirname, '../../../backend/src/models'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService'));
const schedulerService = require(path.resolve(__dirname, '../../../backend/src/services/schedulerService'));
const { updateSession } = require('../utils/sessionManager');

const STEPS = {
  MENU: 'MENU',
  PLAN_DESTINATION: 'PLAN_DESTINATION',
  PLAN_DESTINATION_MORE: 'PLAN_DESTINATION_MORE',
  PLAN_BUDGET: 'PLAN_BUDGET',
  PLAN_DATES: 'PLAN_DATES',
  PLAN_TRAVEL_TYPE: 'PLAN_TRAVEL_TYPE',
  SHOWING_PACKAGES: 'SHOWING_PACKAGES',
  PACKAGE_DETAIL: 'PACKAGE_DETAIL',
  MY_BOOKINGS: 'MY_BOOKINGS',
};

const MENU_ROWS = [
  { id: 'menu_plan_trip', title: 'Plan a Trip', description: 'Build a trip in 4 taps' },
  { id: 'menu_view_deals', title: 'View Top Deals', description: 'See curated packages' },
  { id: 'menu_my_bookings', title: 'My Bookings', description: 'Check booking status' },
  { id: 'menu_talk_agent', title: 'Talk to Agent', description: 'Connect to a specialist' },
];

const DESTINATION_ROWS = [
  { id: 'dest_goa', title: 'Goa', description: 'Beach stays & nightlife', value: 'Goa', emoji: '🏖️' },
  { id: 'dest_bali', title: 'Bali', description: 'Island escapes & resorts', value: 'Bali', emoji: '🏝️' },
  { id: 'dest_paris', title: 'Paris', description: 'Romantic city breaks', value: 'Paris', emoji: '🗼' },
  { id: 'dest_more', title: 'Other Destinations', description: 'See more destinations', value: 'MORE' },
];

const EXTRA_DESTINATION_ROWS = [
  { id: 'dest_dubai', title: 'Dubai', description: 'Luxury, shopping, desert', value: 'Dubai', emoji: '🌆' },
  { id: 'dest_himachal', title: 'Himachal', description: 'Mountains & family trips', value: 'Himachal', emoji: '🏔️' },
  { id: 'dest_kashmir', title: 'Kashmir', description: 'Scenic valleys & houseboats', value: 'Kashmir', emoji: '🌄' },
  { id: 'dest_thailand', title: 'Thailand', description: 'Beaches & nightlife', value: 'Thailand', emoji: '🌴' },
];

const BUDGET_ROWS = [
  { id: 'budget_under_50k', title: '<₹50k', description: 'Budget-friendly picks', label: '<₹50k', min: 0, max: 50000 },
  { id: 'budget_50k_1l', title: '₹50k–1L', description: 'Most popular range', label: '₹50k–1L', min: 50000, max: 100000 },
  { id: 'budget_1l_2l', title: '₹1L–2L', description: 'Premium trips', label: '₹1L–2L', min: 100000, max: 200000 },
  { id: 'budget_flexible', title: 'Flexible', description: 'Show best matches', label: 'Flexible', min: null, max: null },
];

const DATE_ROWS = [
  { id: 'date_next_2_months', title: 'In 1-2 Months', description: 'Near-term travel', label: 'In 1-2 Months' },
  { id: 'date_summer_2026', title: 'Summer 2026', description: 'Peak season ideas', label: 'Summer 2026' },
  { id: 'date_flexible', title: 'Flexible', description: 'Open to any dates', label: 'Flexible' },
  { id: 'date_skip', title: 'Skip Dates', description: 'Continue without dates', label: 'Flexible dates' },
];

const TRAVEL_TYPE_ROWS = [
  { id: 'type_solo', title: 'Solo', description: 'Just for me', label: 'Solo', travellers: 1 },
  { id: 'type_couple', title: 'Couple', description: 'Romantic getaways', label: 'Couple', travellers: 2 },
  { id: 'type_family', title: 'Family', description: 'Comfort-first trips', label: 'Family', travellers: 4 },
  { id: 'type_friends', title: 'Friends', description: 'Fun group trips', label: 'Friends', travellers: 4 },
];

function normalizeText(value = '') {
  return String(value || '').trim();
}

function lower(value = '') {
  return normalizeText(value).toLowerCase();
}

function getContext(customer, agency) {
  return { customerId: customer.id, agencyId: agency.id };
}

function getProfile(session) {
  return {
    navigationStack: Array.isArray(session.collectedData?.navigationStack)
      ? session.collectedData.navigationStack
      : [],
    destination: session.collectedData?.destination || null,
    destinationEmoji: session.collectedData?.destinationEmoji || '',
    budgetLabel: session.collectedData?.budgetLabel || null,
    budgetMin: session.collectedData?.budgetMin ?? null,
    budgetMax: session.collectedData?.budgetMax ?? null,
    datesLabel: session.collectedData?.datesLabel || null,
    travelType: session.collectedData?.travelType || null,
    travellers: session.collectedData?.travellers || null,
    packageResults: Array.isArray(session.collectedData?.packageResults)
      ? session.collectedData.packageResults
      : [],
    selectedPackageId: session.collectedData?.selectedPackageId || null,
    followUpOptOut: !!session.collectedData?.followUpOptOut,
    activeLeadId: session.collectedData?.activeLeadId || null,
  };
}

function buildNavRows(includeBack = true) {
  const rows = [{ id: 'global_main_menu', title: 'Main Menu', description: 'Start over anytime' }];
  if (includeBack) {
    rows.unshift({ id: 'global_go_back', title: 'Go Back', description: 'Return to previous step' });
  }
  return rows;
}

function listSections(rows, includeBack = true) {
  return [
    { title: 'Options', rows },
    { title: 'Navigation', rows: buildNavRows(includeBack) },
  ];
}

function escapeMarkdown(text = '') {
  return String(text).replace(/\*/g, '');
}

function formatCurrency(amountPaise) {
  return `₹${Math.round(amountPaise / 100).toLocaleString('en-IN')}`;
}

function matchesAnyKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function getTravelKeywords(travelType) {
  const maps = {
    Solo: ['solo', 'adventure', 'backpack', 'explore'],
    Couple: ['couple', 'honeymoon', 'romantic', 'escape'],
    Family: ['family', 'kids', 'child', 'parents', 'comfort'],
    Friends: ['friends', 'group', 'party', 'adventure'],
  };
  return maps[travelType] || [];
}

function scorePackage(pkg, profile, bookingCount) {
  let score = 0;
  const destinations = (pkg.destinations || []).map((item) => lower(item));
  const name = lower(pkg.name);
  const duration = lower(pkg.duration);
  const itinerary = JSON.stringify(pkg.itinerary || []).toLowerCase();
  const inclusions = JSON.stringify(pkg.inclusions || []).toLowerCase();
  const searchable = [name, duration, itinerary, inclusions, ...destinations].join(' ');

  if (profile.destination) {
    const destination = lower(profile.destination);
    if (destinations.includes(destination)) score += 60;
    else if (searchable.includes(destination)) score += 40;
  } else {
    score += 20;
  }

  if (profile.budgetMin !== null || profile.budgetMax !== null) {
    if ((profile.budgetMin === null || pkg.basePrice / 100 >= profile.budgetMin)
      && (profile.budgetMax === null || pkg.basePrice / 100 <= profile.budgetMax)) {
      score += 30;
    } else if (profile.budgetMax && pkg.basePrice / 100 <= profile.budgetMax * 1.2) {
      score += 10;
    }
  } else {
    score += 10;
  }

  if (profile.travelType) {
    const keywords = getTravelKeywords(profile.travelType);
    if (matchesAnyKeyword(searchable, keywords)) {
      score += 18;
    }
  }

  if (pkg.imageUrl) score += 4;
  score += Math.min(bookingCount * 2, 20);
  return score;
}

function getPackageBadge(pkg, profile, bookingCount) {
  if (bookingCount >= 5) return '🔥 Popular';
  if (profile.travelType === 'Family') return '⭐ Family Favorite';
  if (profile.travelType === 'Couple') return '💞 Couple Pick';
  if (profile.travelType === 'Solo') return '🧭 Explorer Pick';
  if (profile.budgetMax && pkg.basePrice / 100 <= profile.budgetMax * 0.7) return '💸 Best Value';
  return '🌟 Staff Pick';
}

function summarizePackage(pkg, profile, bookingCount) {
  const highlights = [];
  const inclusions = Array.isArray(pkg.inclusions) ? pkg.inclusions.slice(0, 2) : [];
  if (inclusions.length) highlights.push(...inclusions.map((item) => escapeMarkdown(item)));
  else if (pkg.destinations?.length) highlights.push(...pkg.destinations.slice(0, 2));

  const badge = getPackageBadge(pkg, profile, bookingCount);
  const proof = bookingCount > 0 ? ` · ★ ${bookingCount} booked` : '';

  return {
    heading: `*${escapeMarkdown(pkg.name)}* - ${formatCurrency(pkg.basePrice)} (${pkg.duration || 'Custom'})`,
    detail: `${highlights.join(', ') || 'Curated travel package'}. ${badge}${proof}`,
  };
}

async function findPackagesForProfile(agencyId, profile, limit = 3) {
  const packages = await Package.findAll({
    where: { agencyId, isActive: true },
    order: [['createdAt', 'DESC']],
    limit: 30,
  });

  if (packages.length === 0) {
    return [];
  }

  const withCounts = await Promise.all(packages.map(async (pkg) => {
    const bookingCount = await Booking.count({
      where: { agencyId, packageId: pkg.id, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
    });

    return {
      pkg,
      bookingCount,
      score: scorePackage(pkg, profile, bookingCount),
    };
  }));

  return withCounts
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
      return new Date(b.pkg.createdAt) - new Date(a.pkg.createdAt);
    })
    .slice(0, limit);
}

async function sendList(customer, agency, payload) {
  const ctx = getContext(customer, agency);
  return whatsappService.sendListMessage(
    customer.phone,
    payload.body,
    payload.buttonText || 'Choose',
    payload.sections,
    ctx,
    { headerText: payload.headerText, footerText: payload.footerText }
  );
}

async function transitionTo(session, nextStep, updates = {}, options = {}) {
  const profile = getProfile(session);
  const currentStep = session.currentStep || STEPS.MENU;
  const nextStack = Array.isArray(options.stack)
    ? options.stack
    : [...profile.navigationStack];

  if (options.clearStack) {
    nextStack.length = 0;
  } else if (options.rememberCurrent !== false && currentStep && currentStep !== nextStep) {
    nextStack.push(currentStep);
  }

  await updateSession(session, {
    currentStep: nextStep,
    failedAttempts: options.resetFailedAttempts === false ? session.failedAttempts : 0,
    collectedData: {
      ...updates,
      navigationStack: nextStack,
    },
  });
}

async function incrementFailedAttempt(session) {
  await updateSession(session, {
    failedAttempts: (session.failedAttempts || 0) + 1,
  });
}

async function sendInvalidChoice(session, customer, agency) {
  await incrementFailedAttempt(session);
  const message = 'Sorry, I did not get that. Please pick one of the options below or tap Main Menu to start over.';
  await whatsappService.sendTextMessage(customer.phone, message, getContext(customer, agency));
  return renderCurrentStep(session, customer, agency, { resendOnly: true });
}

function parseByRows(text, rows) {
  const normalized = lower(text);
  if (!normalized) return null;

  const byNumber = rows.find((row, index) => normalized === String(index + 1));
  if (byNumber) return byNumber.id;

  const byTitle = rows.find((row) => {
    const title = lower(row.title);
    return normalized === title || normalized.includes(title);
  });

  return byTitle?.id || null;
}

function resolveAction(incoming, rows = []) {
  const actionId = normalizeText(incoming?.actionId || '');
  if (actionId) return actionId;
  return parseByRows(incoming?.text, rows);
}

function buildProfileSummary(profile) {
  const parts = [];
  if (profile.destination) parts.push(`Destination: ${profile.destination}`);
  if (profile.budgetLabel) parts.push(`Budget: ${profile.budgetLabel}`);
  if (profile.travelType) parts.push(`Travel Type: ${profile.travelType}`);
  if (profile.datesLabel) parts.push(`Dates: ${profile.datesLabel}`);
  return parts.join(', ');
}

function isMetaTripFlowConfigured() {
  return !!process.env.WHATSAPP_TRIP_FLOW_ID;
}

function pickFirstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function normalizeBudgetSelection(rawBudget) {
  const value = String(rawBudget || '').trim();
  if (!value) return null;

  const lookup = BUDGET_ROWS.find((row) => {
    const normalizedTitle = lower(row.title);
    const normalizedLabel = lower(row.label);
    const normalizedValue = lower(value);
    return normalizedValue === normalizedTitle || normalizedValue === normalizedLabel;
  });

  if (lookup) {
    return {
      budgetLabel: lookup.label,
      budgetMin: lookup.min,
      budgetMax: lookup.max,
    };
  }

  return {
    budgetLabel: value,
    budgetMin: null,
    budgetMax: null,
  };
}

async function ensureLead(session, customer, agency, extra = {}) {
  const profile = getProfile(session);
  let lead = null;

  if (profile.activeLeadId) {
    lead = await Lead.findOne({ where: { id: profile.activeLeadId, agencyId: agency.id } });
  }

  if (!lead) {
    lead = await Lead.findOne({
      where: {
        customerId: customer.id,
        agencyId: agency.id,
        status: { [Op.in]: ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
      },
      order: [['createdAt', 'DESC']],
    });
  }

  const leadPayload = {
    destination: profile.destination,
    travelDates: profile.datesLabel === 'Flexible dates' ? null : profile.datesLabel,
    travellers: profile.travellers || null,
    budgetPerPerson: profile.budgetMax ? profile.budgetMax * 100 : null,
    packageId: extra.packageId || profile.selectedPackageId || null,
    status: extra.status || 'NEW',
    notes: [
      'Collected via guided WhatsApp flow',
      profile.travelType ? `Travel Type: ${profile.travelType}` : null,
      profile.datesLabel ? `Dates: ${profile.datesLabel}` : null,
      extra.note || null,
    ].filter(Boolean).join(' | '),
  };

  if (!lead) {
    lead = await leadService.createLead({
      customerId: customer.id,
      destination: leadPayload.destination,
      travelDates: leadPayload.travelDates,
      travellers: leadPayload.travellers,
      budgetPerPerson: leadPayload.budgetPerPerson,
      notes: leadPayload.notes,
    }, agency.id);
  }

  const updates = { ...leadPayload };
  if (!updates.destination) delete updates.destination;
  if (!updates.travelDates) delete updates.travelDates;
  if (!updates.travellers) delete updates.travellers;
  if (!updates.budgetPerPerson) delete updates.budgetPerPerson;
  if (!updates.packageId) delete updates.packageId;

  lead = await leadService.updateLead(lead.id, agency.id, updates);

  if (!lead.assignedAgentId) {
    const agent = await leadService.findLeastBusyAgent(agency.id);
    if (agent) {
      lead = await leadService.updateLead(lead.id, agency.id, { assignedAgentId: agent.id });
    }
  }

  await updateSession(session, {
    collectedData: { activeLeadId: lead.id },
  });

  return lead;
}

async function scheduleFollowUps(session, customer, agency, overrides = {}) {
  const profile = getProfile(session);
  if (profile.followUpOptOut) return;

  try {
    await schedulerService.scheduleChatFollowUps({
      customerId: customer.id,
      agencyId: agency.id,
      phone: customer.phone,
      customerName: customer.name || '',
      destination: overrides.destination || profile.destination,
      budgetLabel: profile.budgetLabel,
      travelType: profile.travelType,
      datesLabel: profile.datesLabel,
      packageName: overrides.packageName || null,
      packageId: overrides.packageId || profile.selectedPackageId || null,
    });
  } catch (err) {
    console.warn('[TravelFlow] Could not schedule follow-ups:', err.message);
  }
}

async function handleFlowSubmission(session, incoming, customer, agency, deps) {
  const response = incoming?.flowResponse || {};
  const destination = pickFirstValue(response, ['destination', 'destination_name', 'trip_destination']);
  const datesLabel = pickFirstValue(response, ['dates', 'travel_dates', 'date_window']) || 'Flexible dates';
  const travelType = pickFirstValue(response, ['travel_type', 'travelType', 'traveler_type', 'who_travels']);
  const budgetRaw = pickFirstValue(response, ['budget', 'budget_range', 'budget_label']);
  const selectedPackage = pickFirstValue(response, ['selected_package', 'package_name']);
  const intent = lower(pickFirstValue(response, ['intent', 'next_action', 'next_step', 'request_type']) || 'show_packages');
  const budget = normalizeBudgetSelection(budgetRaw);
  const travelTypeMeta = TRAVEL_TYPE_ROWS.find((row) => lower(row.label) === lower(travelType));

  await transitionTo(session, STEPS.SHOWING_PACKAGES, {
    destination: destination || getProfile(session).destination,
    datesLabel,
    travelType: travelTypeMeta?.label || travelType || getProfile(session).travelType,
    travellers: travelTypeMeta?.travellers || getProfile(session).travellers || null,
    budgetLabel: budget?.budgetLabel || getProfile(session).budgetLabel,
    budgetMin: budget ? budget.budgetMin : getProfile(session).budgetMin,
    budgetMax: budget ? budget.budgetMax : getProfile(session).budgetMax,
    selectedPackageName: selectedPackage || null,
  }, { rememberCurrent: true });

  if (intent.includes('agent')) {
    await ensureLead(session, customer, agency, { note: 'Customer completed trip flow and requested an agent' });
    return deps.handoffToAgent(session, customer, agency, 'Customer completed WhatsApp Flow and requested an agent');
  }

  if (intent.includes('booking')) {
    return showMyBookings(session, customer, agency, { rememberCurrent: false });
  }

  if (intent.includes('book_now') || intent.includes('book now')) {
    await ensureLead(session, customer, agency, {
      status: 'QUOTED',
      note: selectedPackage
        ? `Customer completed WhatsApp Flow and requested booking for ${selectedPackage}`
        : 'Customer completed WhatsApp Flow and requested booking',
    });
    return deps.handoffToAgent(
      session,
      customer,
      agency,
      selectedPackage
        ? `Customer completed WhatsApp Flow and wants to book ${selectedPackage}`
        : 'Customer completed WhatsApp Flow and wants to book'
    );
  }

  return showTripSummaryAndPackages(session, customer, agency);
}

async function showMainMenu(session, customer, agency, options = {}) {
  const firstName = customer.name ? customer.name.split(' ')[0] : 'there';
  const profile = getProfile(session);

  await transitionTo(session, STEPS.MENU, {}, {
    clearStack: true,
    rememberCurrent: false,
  });

  await updateSession(session, {
    collectedData: {
      destination: null,
      destinationEmoji: '',
      budgetLabel: null,
      budgetMin: null,
      budgetMax: null,
      datesLabel: null,
      travelType: null,
      travellers: null,
      packageResults: [],
      selectedPackageId: null,
      activeLeadId: profile.activeLeadId,
      followUpOptOut: profile.followUpOptOut,
      navigationStack: [],
    },
  });

  return sendList(customer, agency, {
    headerText: 'TripBot',
    body: options.body || `👋 Hi ${firstName}! I'm TripBot for ${agency.name}. How can I help you today?`,
    buttonText: 'Open Menu',
    sections: [{ title: 'Main Menu', rows: MENU_ROWS }],
    footerText: 'Choose one option to continue.',
  });
}

async function showDestinationStep(session, customer, agency, options = {}) {
  if (!options.resendOnly) {
    await transitionTo(session, STEPS.PLAN_DESTINATION, {
      destination: null,
      destinationEmoji: '',
      budgetLabel: null,
      budgetMin: null,
      budgetMax: null,
      datesLabel: null,
      travelType: null,
      travellers: null,
      packageResults: [],
      selectedPackageId: null,
    }, { rememberCurrent: options.rememberCurrent });
  }

  if (isMetaTripFlowConfigured()) {
    return whatsappService.sendFlowMessage(
      customer.phone,
      'Open the guided trip planner to choose destination, budget, dates, and travel type in one interactive flow.',
      {
        flowId: process.env.WHATSAPP_TRIP_FLOW_ID,
        firstScreenId: process.env.WHATSAPP_TRIP_FLOW_FIRST_SCREEN_ID || 'TRIP_PLANNER',
        flowCta: process.env.WHATSAPP_TRIP_FLOW_CTA || 'Plan Trip',
        flowToken: `trip-${customer.id}-${Date.now()}`,
        data: {
          customer_name: customer.name || '',
          agency_name: agency.name || '',
        },
      },
      getContext(customer, agency),
      {
        headerText: 'Trip Planner',
        footerText: 'If the flow does not open, I will continue here in chat.',
      }
    );
  }

  return sendList(customer, agency, {
    headerText: 'Plan a Trip',
    body: 'Great! Which destination are you interested in?',
    buttonText: 'Destinations',
    sections: listSections(DESTINATION_ROWS.map(({ id, title, description }) => ({ id, title, description })), true),
    footerText: 'Tap a destination below.',
  });
}

async function showMoreDestinationsStep(session, customer, agency, options = {}) {
  if (!options.resendOnly) {
    await transitionTo(session, STEPS.PLAN_DESTINATION_MORE, {}, { rememberCurrent: options.rememberCurrent });
  }

  return sendList(customer, agency, {
    headerText: 'More Destinations',
    body: 'Here are a few more destinations you can explore.',
    buttonText: 'More Options',
    sections: listSections(EXTRA_DESTINATION_ROWS.map(({ id, title, description }) => ({ id, title, description })), true),
    footerText: 'Pick one to continue.',
  });
}

async function showBudgetStep(session, customer, agency, options = {}) {
  if (!options.resendOnly) {
    await transitionTo(session, STEPS.PLAN_BUDGET, {}, { rememberCurrent: options.rememberCurrent });
  }

  return sendList(customer, agency, {
    headerText: 'Budget',
    body: 'What is your budget per person?',
    buttonText: 'Budget Range',
    sections: listSections(BUDGET_ROWS.map(({ id, title, description }) => ({ id, title, description })), true),
    footerText: 'Choose the closest range.',
  });
}

async function showDatesStep(session, customer, agency, options = {}) {
  if (!options.resendOnly) {
    await transitionTo(session, STEPS.PLAN_DATES, {}, { rememberCurrent: options.rememberCurrent });
  }

  return sendList(customer, agency, {
    headerText: 'Travel Dates',
    body: 'Any travel dates in mind?',
    buttonText: 'Dates',
    sections: listSections(DATE_ROWS.map(({ id, title, description }) => ({ id, title, description })), true),
    footerText: 'Dates are optional.',
  });
}

async function showTravelTypeStep(session, customer, agency, options = {}) {
  if (!options.resendOnly) {
    await transitionTo(session, STEPS.PLAN_TRAVEL_TYPE, {}, { rememberCurrent: options.rememberCurrent });
  }

  return sendList(customer, agency, {
    headerText: 'Travel Type',
    body: "Who's traveling with you?",
    buttonText: 'Travel Type',
    sections: listSections(TRAVEL_TYPE_ROWS.map(({ id, title, description }) => ({ id, title, description })), true),
    footerText: 'Pick the best fit.',
  });
}

async function showPackageList(session, customer, agency, options = {}) {
  const profile = getProfile(session);
  const packages = options.packages || await findPackagesForProfile(agency.id, profile, 3);

  await transitionTo(session, STEPS.SHOWING_PACKAGES, {
    packageResults: packages.map((entry) => entry.pkg.id),
  }, {
    rememberCurrent: options.rememberCurrent,
  });

  if (packages.length === 0) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'I could not find a close match right now. Tap Talk to Agent and we will curate options for you.',
      getContext(customer, agency)
    );

    return sendList(customer, agency, {
      headerText: 'No Exact Match',
      body: 'Would you like more help with this trip?',
      buttonText: 'Choose',
      sections: listSections([
        { id: 'menu_plan_trip', title: 'Try Again', description: 'Restart trip planning' },
        { id: 'menu_talk_agent', title: 'Talk to Agent', description: 'Get custom recommendations' },
      ], true),
      footerText: 'We can suggest more options.',
    });
  }

  const introLine = profile.destination
    ? `👍 Great! Here are top ${profile.travelType || ''} packages for ${profile.destination}${profile.budgetLabel ? ` under ${profile.budgetLabel}` : ''}.`
      .replace(/\s+/g, ' ')
      .trim()
    : '🔥 Here are the top deals our travelers are checking out right now.';

  const lines = packages.map((entry, index) => {
    const summary = summarizePackage(entry.pkg, profile, entry.bookingCount);
    return `${index + 1}. ${summary.heading}\n${summary.detail}`;
  }).join('\n\n');

  await whatsappService.sendTextMessage(
    customer.phone,
    `${introLine}\n\n${lines}\n\nPrices can change with availability, so the best time to ask for details is now.`,
    getContext(customer, agency)
  );

  await scheduleFollowUps(session, customer, agency, {
    packageName: packages[0]?.pkg?.name || null,
    packageId: packages[0]?.pkg?.id || null,
  });

  return sendList(customer, agency, {
    headerText: 'Top Packages',
    body: 'Tap a package below to view full details.',
    buttonText: 'View Details',
    sections: listSections(packages.map((entry, index) => ({
      id: `pkg_view:${entry.pkg.id}`,
      title: `View Details #${index + 1}`,
      description: `${formatCurrency(entry.pkg.basePrice)} · ${entry.pkg.duration || 'Custom'}`,
    })), true),
    footerText: 'You can also go back or return to the main menu.',
  });
}

async function showPackageDetail(session, customer, agency, packageId, options = {}) {
  const pkg = await Package.findOne({ where: { id: packageId, agencyId: agency.id } });
  if (!pkg) {
    return sendInvalidChoice(session, customer, agency);
  }

  const bookingCount = await Booking.count({
    where: { agencyId: agency.id, packageId: pkg.id, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
  });

  await transitionTo(session, STEPS.PACKAGE_DETAIL, {
    selectedPackageId: pkg.id,
  }, {
    rememberCurrent: options.rememberCurrent,
  });

  await whatsappService.sendTextMessage(
    customer.phone,
    `Great choice! Here are the details for *${escapeMarkdown(pkg.name)}* (${formatCurrency(pkg.basePrice)}).`,
    getContext(customer, agency)
  );

  if (pkg.imageUrl) {
    await whatsappService.sendImageMessage(
      customer.phone,
      pkg.imageUrl,
      `${escapeMarkdown(pkg.name)} · ${pkg.duration || 'Curated itinerary'}`,
      getContext(customer, agency)
    );
  }

  const itinerary = Array.isArray(pkg.itinerary) && pkg.itinerary.length > 0
    ? pkg.itinerary.slice(0, 4).map((day) => `• Day ${day.day}: ${escapeMarkdown(day.title || day.description || 'Planned activities')}`).join('\n')
    : '• Day 1: Arrival and check-in\n• Day 2: Signature sightseeing\n• Day 3: Free time or add-ons\n• Final Day: Checkout';

  const inclusions = Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0
    ? pkg.inclusions.slice(0, 4).map((item) => `✓ ${escapeMarkdown(item)}`).join('\n')
    : '✓ Hotel stay\n✓ Daily breakfast\n✓ Local transfers';

  const proofLine = bookingCount > 0
    ? `⭐ ${bookingCount} travelers have booked this package already.`
    : '🌟 This is one of our most-clicked curated trips right now.';

  const urgencyLine = '🏷️ Prices can move with availability, so an agent can help lock the latest rate today.';

  await whatsappService.sendTextMessage(
    customer.phone,
    `*${escapeMarkdown(pkg.name)}* - ${formatCurrency(pkg.basePrice)} (${pkg.duration || 'Custom'})\n\n*Itinerary*\n${itinerary}\n\n*Includes*\n${inclusions}\n\n${proofLine}\n${urgencyLine}`,
    getContext(customer, agency)
  );

  await scheduleFollowUps(session, customer, agency, {
    packageName: pkg.name,
    packageId: pkg.id,
  });

  return sendList(customer, agency, {
    headerText: 'Next Step',
    body: 'What would you like to do next?',
    buttonText: 'Choose',
    sections: listSections([
      { id: 'detail_book_now', title: 'Book Now', description: 'Get this trip reserved' },
      { id: 'menu_talk_agent', title: 'Talk to Agent', description: 'Ask questions or customize' },
      { id: 'detail_more_packages', title: 'More Packages', description: 'See more options' },
    ], true),
    footerText: 'Pick the next action.',
  });
}

async function showMyBookings(session, customer, agency, options = {}) {
  const bookings = await Booking.findAll({
    where: { customerId: customer.id, agencyId: agency.id },
    include: [{ model: Package, as: 'package', attributes: ['name'] }],
    order: [['createdAt', 'DESC']],
    limit: 3,
  });

  await transitionTo(session, STEPS.MY_BOOKINGS, {}, {
    rememberCurrent: options.rememberCurrent,
  });

  if (bookings.length === 0) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'I could not find a booking on this WhatsApp number yet. I can help you plan a trip or connect you with an agent.',
      getContext(customer, agency)
    );

    return sendList(customer, agency, {
      headerText: 'No Bookings Found',
      body: 'What would you like to do next?',
      buttonText: 'Choose',
      sections: listSections([
        { id: 'menu_plan_trip', title: 'Plan a Trip', description: 'Start a new enquiry' },
        { id: 'menu_talk_agent', title: 'Talk to Agent', description: 'Get personal help' },
      ], true),
      footerText: 'You can always return to the main menu.',
    });
  }

  const summary = bookings.map((booking, index) => {
    const travelDate = booking.travelDate
      ? new Date(booking.travelDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Date TBD';
    return `${index + 1}. *${escapeMarkdown(booking.package?.name || booking.bookingRef)}*\nRef ${booking.bookingRef} · ${booking.status} · ${travelDate}`;
  }).join('\n\n');

  await whatsappService.sendTextMessage(
    customer.phone,
    `Here are your latest bookings:\n\n${summary}`,
    getContext(customer, agency)
  );

  return sendList(customer, agency, {
    headerText: 'Need Help?',
    body: 'Need help with a booking?',
    buttonText: 'Choose',
    sections: listSections([
      { id: 'menu_talk_agent', title: 'Talk to Agent', description: 'Get booking help now' },
    ], true),
    footerText: 'We can help with changes, payments, or updates.',
  });
}

async function showTripSummaryAndPackages(session, customer, agency) {
  const profile = getProfile(session);
  const summary = `${profile.travelType || 'Custom'} trip to ${profile.destination || 'your destination'}${profile.budgetLabel ? ` under ${profile.budgetLabel}` : ''}`;
  await whatsappService.sendTextMessage(
    customer.phone,
    `👍 Perfect, ${summary}. Finding the best matches now...`,
    getContext(customer, agency)
  );
  return showPackageList(session, customer, agency, { rememberCurrent: true });
}

async function handleBookNow(session, customer, agency, handoffToAgent) {
  const profile = getProfile(session);
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;

  await ensureLead(session, customer, agency, {
    packageId: pkg?.id || null,
    status: 'QUOTED',
    note: pkg ? `Customer tapped Book Now for ${pkg.name}` : 'Customer tapped Book Now',
  });

  return handoffToAgent(
    session,
    customer,
    agency,
    pkg ? `Book Now requested for ${pkg.name}` : 'Book Now requested'
  );
}

async function goBack(session, customer, agency) {
  const profile = getProfile(session);
  const stack = [...profile.navigationStack];
  const previousStep = stack.pop();

  if (!previousStep) {
    return showMainMenu(session, customer, agency);
  }

  await updateSession(session, {
    currentStep: previousStep,
    failedAttempts: 0,
    collectedData: { navigationStack: stack },
  });

  return renderCurrentStep(session, customer, agency, { resendOnly: true });
}

async function renderCurrentStep(session, customer, agency, options = {}) {
  switch (session.currentStep) {
    case STEPS.MENU:
    case 'NEW':
    case 'COMPLETE':
      return showMainMenu(session, customer, agency, options);
    case STEPS.PLAN_DESTINATION:
      return showDestinationStep(session, customer, agency, { resendOnly: true });
    case STEPS.PLAN_DESTINATION_MORE:
      return showMoreDestinationsStep(session, customer, agency, { resendOnly: true });
    case STEPS.PLAN_BUDGET:
      return showBudgetStep(session, customer, agency, { resendOnly: true });
    case STEPS.PLAN_DATES:
      return showDatesStep(session, customer, agency, { resendOnly: true });
    case STEPS.PLAN_TRAVEL_TYPE:
      return showTravelTypeStep(session, customer, agency, { resendOnly: true });
    case STEPS.SHOWING_PACKAGES:
      return showPackageList(session, customer, agency, { rememberCurrent: false });
    case STEPS.PACKAGE_DETAIL:
      return showPackageDetail(session, customer, agency, getProfile(session).selectedPackageId, { rememberCurrent: false });
    case STEPS.MY_BOOKINGS:
      return showMyBookings(session, customer, agency, { rememberCurrent: false });
    default:
      return showMainMenu(session, customer, agency);
  }
}

async function handleMenuSelection(session, incoming, customer, agency, deps) {
  const action = resolveAction(incoming, MENU_ROWS);

  if (!action && session.currentStep === 'NEW') {
    return showMainMenu(session, customer, agency);
  }

  switch (action) {
    case 'menu_plan_trip':
      await whatsappService.sendTextMessage(customer.phone, 'Let’s build your trip in a few quick taps.', getContext(customer, agency));
      return showDestinationStep(session, customer, agency, { rememberCurrent: false });
    case 'menu_view_deals':
    case 'followup_view_packages':
      await whatsappService.sendTextMessage(customer.phone, 'Here are the top deals travelers are viewing right now.', getContext(customer, agency));
      return showPackageList(session, customer, agency, { rememberCurrent: false });
    case 'menu_my_bookings':
      return showMyBookings(session, customer, agency, { rememberCurrent: false });
    case 'menu_talk_agent':
      await ensureLead(session, customer, agency, { note: 'User requested agent from main menu' });
      return deps.handoffToAgent(session, customer, agency, 'Customer requested agent from main menu');
    default:
      return sendInvalidChoice(session, customer, agency);
  }
}

async function handleDestinationSelection(session, incoming, customer, agency) {
  const rows = session.currentStep === STEPS.PLAN_DESTINATION_MORE ? EXTRA_DESTINATION_ROWS : DESTINATION_ROWS;
  const action = resolveAction(incoming, rows);
  const picked = rows.find((row) => row.id === action);

  if (!picked) {
    return sendInvalidChoice(session, customer, agency);
  }

  if (picked.id === 'dest_more') {
    return showMoreDestinationsStep(session, customer, agency, { rememberCurrent: true });
  }

  await transitionTo(session, STEPS.PLAN_BUDGET, {
    destination: picked.value,
    destinationEmoji: picked.emoji,
  }, { rememberCurrent: true });

  await whatsappService.sendTextMessage(
    customer.phone,
    `${picked.emoji || '👍'} ${picked.value} it is!`,
    getContext(customer, agency)
  );

  return showBudgetStep(session, customer, agency, { resendOnly: true });
}

async function handleBudgetSelection(session, incoming, customer, agency) {
  const action = resolveAction(incoming, BUDGET_ROWS);
  const picked = BUDGET_ROWS.find((row) => row.id === action);

  if (!picked) {
    return sendInvalidChoice(session, customer, agency);
  }

  await transitionTo(session, STEPS.PLAN_DATES, {
    budgetLabel: picked.label,
    budgetMin: picked.min,
    budgetMax: picked.max,
  }, { rememberCurrent: true });

  await whatsappService.sendTextMessage(customer.phone, `👍 ${picked.label} noted.`, getContext(customer, agency));
  return showDatesStep(session, customer, agency, { resendOnly: true });
}

async function handleDatesSelection(session, incoming, customer, agency) {
  const action = resolveAction(incoming, DATE_ROWS);
  const picked = DATE_ROWS.find((row) => row.id === action);

  if (!picked) {
    return sendInvalidChoice(session, customer, agency);
  }

  await transitionTo(session, STEPS.PLAN_TRAVEL_TYPE, {
    datesLabel: picked.label,
  }, { rememberCurrent: true });

  await whatsappService.sendTextMessage(customer.phone, `👍 ${picked.label} works.`, getContext(customer, agency));
  return showTravelTypeStep(session, customer, agency, { resendOnly: true });
}

async function handleTravelTypeSelection(session, incoming, customer, agency) {
  const action = resolveAction(incoming, TRAVEL_TYPE_ROWS);
  const picked = TRAVEL_TYPE_ROWS.find((row) => row.id === action);

  if (!picked) {
    return sendInvalidChoice(session, customer, agency);
  }

  await transitionTo(session, STEPS.SHOWING_PACKAGES, {
    travelType: picked.label,
    travellers: picked.travellers,
  }, { rememberCurrent: true });

  return showTripSummaryAndPackages(session, customer, agency);
}

async function handlePackageListSelection(session, incoming, customer, agency) {
  const profile = getProfile(session);
  const actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);

  if (actionId.startsWith('pkg_view:')) {
    return showPackageDetail(session, customer, agency, actionId.split(':')[1], { rememberCurrent: true });
  }

  if (/^\d+$/.test(text)) {
    const index = parseInt(text, 10) - 1;
    const packageId = profile.packageResults[index];
    if (packageId) {
      return showPackageDetail(session, customer, agency, packageId, { rememberCurrent: true });
    }
  }

  const detailNumberMatch = text.match(/(\d+)/);
  if (detailNumberMatch) {
    const index = parseInt(detailNumberMatch[1], 10) - 1;
    const packageId = profile.packageResults[index];
    if (packageId) {
      return showPackageDetail(session, customer, agency, packageId, { rememberCurrent: true });
    }
  }

  return sendInvalidChoice(session, customer, agency);
}

async function handlePackageDetailSelection(session, incoming, customer, agency, deps) {
  const actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);

  if (actionId === 'detail_book_now' || text === 'book now' || text === 'book') {
    return handleBookNow(session, customer, agency, deps.handoffToAgent);
  }

  if (actionId === 'detail_more_packages' || text.includes('more package')) {
    return showPackageList(session, customer, agency, { rememberCurrent: false });
  }

  if (actionId === 'menu_talk_agent' || text.includes('agent')) {
    await ensureLead(session, customer, agency, { note: 'User requested agent from package detail' });
    return deps.handoffToAgent(session, customer, agency, 'Customer requested agent from package detail');
  }

  return sendInvalidChoice(session, customer, agency);
}

async function handleBookingsSelection(session, incoming, customer, agency, deps) {
  const actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);

  if (actionId === 'menu_talk_agent' || text.includes('agent')) {
    return deps.handoffToAgent(session, customer, agency, 'Customer requested help with booking');
  }

  if (actionId === 'menu_plan_trip' || text.includes('plan')) {
    return showDestinationStep(session, customer, agency, { rememberCurrent: false });
  }

  return sendInvalidChoice(session, customer, agency);
}

async function handleTravelFlow(session, incoming, customer, agency, deps) {
  const actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);

  if (actionId === 'flow_submission' || incoming?.flowResponse) {
    return handleFlowSubmission(session, incoming, customer, agency, deps);
  }

  if (actionId === 'global_stop' || ['stop', 'unsubscribe'].includes(text)) {
    await schedulerService.cancelChatFollowUps(customer.id, agency.id).catch(() => {});
    await updateSession(session, {
      collectedData: { followUpOptOut: true },
    });
    return whatsappService.sendTextMessage(
      customer.phone,
      'You will not receive follow-up nudges from me anymore. Reply MENU anytime if you want to continue.',
      getContext(customer, agency)
    );
  }

  if (actionId === 'global_main_menu' || ['main menu', 'menu', 'start over'].includes(text)) {
    return showMainMenu(session, customer, agency);
  }

  if (actionId === 'global_go_back' || text === 'back' || text === 'go back') {
    return goBack(session, customer, agency);
  }

  if (actionId === 'followup_view_packages' || text === 'view packages') {
    return showPackageList(session, customer, agency, { rememberCurrent: false });
  }

  if (actionId === 'menu_talk_agent' || text === 'talk to agent') {
    await ensureLead(session, customer, agency, { note: 'User requested an agent' });
    return deps.handoffToAgent(session, customer, agency, 'Customer requested agent');
  }

  switch (session.currentStep) {
    case 'NEW':
    case 'COMPLETE':
    case STEPS.MENU:
      return handleMenuSelection(session, incoming, customer, agency, deps);
    case STEPS.PLAN_DESTINATION:
    case STEPS.PLAN_DESTINATION_MORE:
      return handleDestinationSelection(session, incoming, customer, agency);
    case STEPS.PLAN_BUDGET:
      return handleBudgetSelection(session, incoming, customer, agency);
    case STEPS.PLAN_DATES:
      return handleDatesSelection(session, incoming, customer, agency);
    case STEPS.PLAN_TRAVEL_TYPE:
      return handleTravelTypeSelection(session, incoming, customer, agency);
    case STEPS.SHOWING_PACKAGES:
      return handlePackageListSelection(session, incoming, customer, agency);
    case STEPS.PACKAGE_DETAIL:
      return handlePackageDetailSelection(session, incoming, customer, agency, deps);
    case STEPS.MY_BOOKINGS:
      return handleBookingsSelection(session, incoming, customer, agency, deps);
    default:
      return showMainMenu(session, customer, agency);
  }
}

module.exports = {
  STEPS,
  handleTravelFlow,
  renderCurrentStep,
  buildProfileSummary,
  ensureLead,
};
