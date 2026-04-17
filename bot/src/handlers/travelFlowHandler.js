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
} = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));
const { updateSession } = require('../utils/sessionManager');

const STEPS = {
  MENU: 'MENU',
  CATEGORY_PACKAGES: 'CATEGORY_PACKAGES',
  PACKAGE_DETAIL: 'PACKAGE_DETAIL',
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
const FLOW_PLACEHOLDER_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh8cAAAAASUVORK5CYII=';
const FLOW_IMAGE_TRANSFORM = 'w_400,h_300,c_fill,f_jpg,q_auto';
const imageCache = new Map();

function normalizeText(value = '') {
  return String(value || '').trim();
}

function lower(value = '') {
  return normalizeText(value).toLowerCase();
}

function getContext(customer, agency) {
  return { customerId: customer.id, agencyId: agency.id };
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
  return String(text || '').replace(/\*/g, '').trim();
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
  return null;
}

function categoryLabel(value = '') {
  return normalizeCategory(value) === 'INTERNATIONAL' ? 'International' : 'Domestic';
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

function getProfile(session) {
  const enquiry = session.collectedData?.enquiryDraft || {};

  return {
    packageCategory: session.collectedData?.packageCategory || null,
    packageResults: Array.isArray(session.collectedData?.packageResults)
      ? session.collectedData.packageResults
      : [],
    selectedPackageId: session.collectedData?.selectedPackageId || null,
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
  const summary = escapeMarkdown(pkg?.summary || '');
  if (summary) return summary.slice(0, 180);

  if (Array.isArray(pkg?.inclusions) && pkg.inclusions.length) {
    return escapeMarkdown(pkg.inclusions.slice(0, 3).join(', ')).slice(0, 180);
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

function isMetaTripFlowConfigured(agency) {
  return !!getAgencyTripFlowId(agency);
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

async function findPackagesForCategory(agencyId, category, limit = 5) {
  const packages = await Package.findAll({
    where: {
      agencyId,
      isActive: true,
    },
    order: [['createdAt', 'DESC']],
    limit: 20,
  });

  const filtered = packages.filter((pkg) => packageMatchesCategory(pkg, category));
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

async function buildFlowPackageOptions(packages) {
  return Promise.all(packages.map(async ({ pkg }) => ({
    id: pkg.id,
    title: escapeMarkdown(pkg.name).slice(0, 30) || 'Travel Package',
    description: `${formatCurrency(pkg.basePrice)} • ${escapeMarkdown(pkg.duration || 'Custom itinerary')}\n${buildShortDescription(pkg)}`.slice(0, 300),
    metadata: escapeMarkdown(categoryLabel(inferPackageCategory(pkg))).slice(0, 20),
    image: await getFlowBase64Image(pkg.imageUrl),
  })));
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
  const pkg = profile.selectedPackageId
    ? await Package.findOne({ where: { id: profile.selectedPackageId, agencyId: agency.id } })
    : null;

  const notes = [
    extra.notes || null,
    extra.note || null,
  ].filter(Boolean).join(' | ');

  if (!lead) {
    lead = await leadService.createLead({
      customerId: customer.id,
      packageId: extra.packageId || pkg?.id || null,
      destination: extra.destination || pkg?.destinations?.[0] || null,
      travelDates: extra.travelDates || null,
      travellers: extra.travellers || null,
      budgetPerPerson: extra.budgetPerPerson || null,
      interest: extra.interest || null,
      status: extra.status || 'NEW',
      notes: notes || 'Lead created from WhatsApp sales funnel',
    }, agency.id);
  } else {
    const nextStatus = extra.preserveExistingStatus
      ? lead.status || 'NEW'
      : (extra.status || lead.status || 'NEW');

    const updates = {
      packageId: extra.packageId || pkg?.id || lead.packageId || null,
      destination: extra.destination || lead.destination || pkg?.destinations?.[0] || null,
      travelDates: extra.travelDates || lead.travelDates || null,
      travellers: extra.travellers || lead.travellers || null,
      budgetPerPerson: extra.budgetPerPerson || lead.budgetPerPerson || null,
      interest: extra.interest || lead.interest || null,
      status: nextStatus,
      notes: [lead.notes, notes].filter(Boolean).join(' | '),
    };
    lead = await leadService.updateLead(lead.id, agency.id, updates);
  }

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

function buildProfileSummary(profile) {
  const parts = [];
  if (profile.packageCategory) parts.push(`Category: ${categoryLabel(profile.packageCategory)}`);
  if (profile.selectedPackageId) parts.push('Package selected');
  if (profile.enquiryDraft.place) parts.push(`Place: ${profile.enquiryDraft.place}`);
  if (profile.enquiryDraft.travelDate) parts.push(`Date: ${profile.enquiryDraft.travelDate}`);
  if (profile.enquiryDraft.travellers) parts.push(`Travellers: ${profile.enquiryDraft.travellers}`);
  return parts.join(', ');
}

async function createFreshGreetingLead(session, customer) {
  await updateSession(session, {
    isHandedOff: false,
    handedOffAt: null,
    handedOffToId: null,
    currentStep: STEPS.MENU,
    failedAttempts: 0,
    collectedData: {
      packageCategory: null,
      packageResults: [],
      selectedPackageId: null,
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
  await transitionTo(session, STEPS.MENU, {
    packageCategory: null,
    packageResults: [],
    selectedPackageId: null,
    enquiryDraft: customer.name ? { name: customer.name } : {},
  });

  const greeting = [
    `Hi ${firstName(customer)} 👋`,
    `Welcome to ${agency.name} ✈️`,
    'We offer Honeymoon 💕 & Family Tour Packages.',
    '',
    'How can I help you today?',
  ].join('\n');

  const buttons = [
    { id: 'menu_domestic', title: 'Domestic' },
    { id: 'menu_international', title: 'International' },
  ];

  if (agency.whatsappCatalogId) {
    buttons.push({ id: 'menu_catalog', title: '🛒 Shop Catalog' });
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    greeting,
    buttons,
    getContext(customer, agency),
    {
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
    buildPackageListSections(category, packages),
    getContext(customer, agency),
    {
      headerText: `${categoryLabel(category)} Packages`,
      footerText: 'Tap a package to continue.',
    }
  );
}

async function openPackageFlow(session, customer, agency, category) {
  const normalizedCategory = normalizeCategory(category);
  const packages = await findPackagesForCategory(agency.id, normalizedCategory, 5);

  await ensureLead(session, customer, agency, {
    interest: normalizedCategory,
    notes: `Category selected: ${categoryLabel(normalizedCategory)}`,
  });

  await transitionTo(session, STEPS.CATEGORY_PACKAGES, {
    packageCategory: normalizedCategory,
    packageResults: packages.map(({ pkg }) => pkg.id),
    selectedPackageId: null,
  });

  if (packages.length === 0) {
    await whatsappService.sendTextMessage(
      customer.phone,
      `We do not have active ${categoryLabel(normalizedCategory).toLowerCase()} packages right now. Our expert can still curate options for you.`,
      getContext(customer, agency)
    );
    return;
  }

  if (!isMetaTripFlowConfigured(agency)) {
    return showPackageListFallback(session, customer, agency, normalizedCategory, packages);
  }

  const packageOptions = await buildFlowPackageOptions(packages);
  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    `Browse our best ${categoryLabel(normalizedCategory)} packages 👇`,
    {
      flowId: getAgencyTripFlowId(agency),
      firstScreenId: FLOW_FIRST_SCREEN_ID,
      flowCta: FLOW_CTA,
      flowToken: `pkg|${agency.id}|${normalizedCategory || 'DOMESTIC'}|${customer.id}|${Date.now()}`,
      data: {
        category_label: categoryLabel(normalizedCategory),
        package_options: packageOptions,
      },
    },
    getContext(customer, agency),
    {
      headerText: `${categoryLabel(normalizedCategory)} Packages`,
      footerText: 'Reply LIST if the flow does not open.',
    }
  );

  if (flowResponse?.status === 'FAILED') {
    return showPackageListFallback(session, customer, agency, normalizedCategory, packages);
  }

  return flowResponse;
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
    selectedPackageName: pkg.name,
  });

  const detailMessage = buildPackageCaption(pkg);
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

async function handleFlowSubmission(session, incoming, customer, agency) {
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

  const packageId = normalizeText(
    response.packageId
    || response.package_id
    || response.selected_package
    || response.selectedPackage
    || formResponse.packageId
    || formResponse.package_id
    || formResponse.selected_package
    || formResponse.selectedPackage
    || enquiryFormResponse.packageId
    || enquiryFormResponse.package_id
    || enquiryFormResponse.selected_package
    || enquiryFormResponse.selectedPackage
  );

  const enquiryPayload = {
    name: normalizeText(
      response.name
      || response.fullName
      || response.full_name
      || enquiryFormResponse.name
      || enquiryFormResponse.fullName
      || enquiryFormResponse.full_name
    ),
    place: normalizeText(
      response.place
      || response.city
      || response.location
      || enquiryFormResponse.place
      || enquiryFormResponse.city
      || enquiryFormResponse.location
    ),
    travelDate: normalizeText(
      response.travelDate
      || response.travel_date
      || response.travelMonth
      || enquiryFormResponse.travelDate
      || enquiryFormResponse.travel_date
      || enquiryFormResponse.travelMonth
    ),
    travellers: normalizeText(
      response.travellers
      || response.travelers
      || response.travellerCount
      || response.travelerCount
      || enquiryFormResponse.travellers
      || enquiryFormResponse.travelers
      || enquiryFormResponse.travellerCount
      || enquiryFormResponse.travelerCount
    ),
    budgetPerPerson: normalizeText(
      response.budget
      || response.budgetPerPerson
      || response.budget_per_person
      || enquiryFormResponse.budget
      || enquiryFormResponse.budgetPerPerson
      || enquiryFormResponse.budget_per_person
    ),
    notes: normalizeText(
      response.notes
      || response.otherDetails
      || response.other_details
      || enquiryFormResponse.notes
      || enquiryFormResponse.otherDetails
      || enquiryFormResponse.other_details
    ),
  };

  const travellerMatch = enquiryPayload.travellers.match(/\d+/);
  const travellers = travellerMatch ? parseInt(travellerMatch[0], 10) : NaN;
  const budgetPerPerson = parseBudgetPaise(enquiryPayload.budgetPerPerson);
  const hasFlowEnquiryFields = !!(enquiryPayload.name || enquiryPayload.place || enquiryPayload.travelDate || enquiryPayload.travellers || enquiryPayload.notes);

  logFlowEvent('flow_submission_received', customer, agency, {
    step: session?.currentStep || null,
    selectedPackageId: packageId || null,
    flowName: normalizeText(incoming?.flowName || ''),
    hasFlowEnquiryFields,
  });

  if (!packageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, getProfile(session).packageCategory));
  }

  if (hasFlowEnquiryFields) {
    if (!enquiryPayload.name || enquiryPayload.name.length < 2 || !enquiryPayload.travelDate || enquiryPayload.travelDate.length < 3 || Number.isNaN(travellers) || travellers < 1 || travellers > 50 || !budgetPerPerson) {
      await whatsappService.sendTextMessage(
        customer.phone,
        'Please submit valid enquiry details in the form. Name, travel date, travellers, and budget are required.',
        getContext(customer, agency)
      );
      return showPackageDetail(session, customer, agency, packageId);
    }

    await transitionTo(session, STEPS.COMPLETE, {
      selectedPackageId: packageId,
      enquiryDraft: {
        ...getProfile(session).enquiryDraft,
        name: enquiryPayload.name,
        travelDate: enquiryPayload.travelDate,
        travellers,
        budgetPerPerson,
        notes: enquiryPayload.notes,
      },
    });

    return finalizeEnquiry(session, customer, agency);
  }

  return showPackageDetail(session, customer, agency, packageId);
}

async function openEnquiryFlow(session, customer, agency) {
  const profile = getProfile(session);
  const selectedPackageId = profile.selectedPackageId;

  if (!selectedPackageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

  if (!isMetaTripFlowConfigured(agency)) {
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
      flowId: FLOW_ENQUIRY_ID || getAgencyTripFlowId(agency),
      firstScreenId: FLOW_ENQUIRY_FIRST_SCREEN_ID,
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
    return startEnquiry(session, customer, agency);
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

  const budgetText = enquiry.budgetPerPerson
    ? `₹${Math.round(Number(enquiry.budgetPerPerson) / 100).toLocaleString('en-IN')}`
    : 'Not shared yet';

  const agentNotification = [
    '🔥 New Enquiry',
    '',
    `Name: ${customer?.name || 'Unknown'}`,
    `Phone: ${customer?.phone || 'Unknown'}`,
    `Package: ${pkg?.name || 'Not selected'}`,
    `📍 ${enquiry.travelDate ? `Date: ${enquiry.travelDate}` : 'Date: Not shared yet'}`,
    `👥 People: ${enquiry.travellers || 'Not shared yet'}`,
    `💰 Budget: ${budgetText}`,
    enquiry.notes ? `📝 Notes: ${enquiry.notes}` : '',
    '',
    'Take action:',
  ].filter(Boolean).join('\n');

  await whatsappService.sendButtonsMessage(
    assignedAgent.phone,
    agentNotification,
    [
      { id: `lead_call:${lead.id}`, title: '📞 Call Now' },
      { id: `lead_contacted:${lead.id}`, title: '✅ Mark as Contacted' },
      { id: `lead_booked:${lead.id}`, title: '🎉 Mark as Booked' },
    ],
    { customerId: lead.customerId, agencyId: agency.id },
    { footerText: 'Reply NOTE: <text> to add a note.' }
  );

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

  const lead = await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',
    packageId: pkg?.id || null,
    destination: pkg?.destinations?.[0] || null,
    notes: `Call Now clicked for ${pkg?.name || 'selected package'}`,
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
      const budgetText = profile.enquiryDraft.budgetPerPerson
        ? `₹${Math.round(Number(profile.enquiryDraft.budgetPerPerson) / 100).toLocaleString('en-IN')}`
        : 'Not shared yet';
      const agentMsg = [
        '🔥 Call Now Intent',
        '',
        `Name: ${customer.name || firstName(customer)}`,
        `Phone: ${customer.phone}`,
        `Package: ${pkg?.name || 'Not selected'}`,
        `Date: ${profile.enquiryDraft.travelDate || 'Not shared yet'}`,
        `People: ${profile.enquiryDraft.travellers || 'Not shared yet'}`,
        `Budget: ${budgetText}`,
        '',
        'Reply NOTE: <text> to add a note.',
      ].join('\n');

      await whatsappService.sendButtonsMessage(
        assignedAgent.phone,
        agentMsg,
        [
          { id: `lead_call:${lead.id}`, title: 'Call Now' },
          { id: `lead_contacted:${lead.id}`, title: 'Mark as Contacted' },
          { id: `lead_booked:${lead.id}`, title: 'Mark as Booked' },
        ],
        getContext(customer, agency),
        { footerText: 'Reply NOTE: ... to add a note.' }
      );
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
      return openPackageFlow(session, customer, agency, getProfile(session).packageCategory || 'DOMESTIC');
    case STEPS.PACKAGE_DETAIL:
      return showPackageDetail(session, customer, agency, getProfile(session).selectedPackageId);
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
    default:
      return showMainMenu(session, customer, agency);
  }
}

function isCategoryAction(actionId, text) {
  return actionId === 'menu_domestic'
    || actionId === 'menu_international'
    || text === 'domestic'
    || text === 'domestic packages'
    || text === 'international'
    || text === 'international packages';
}

function resolveCategory(actionId, text) {
  if (actionId === 'menu_international' || text.includes('international')) return 'INTERNATIONAL';
  return 'DOMESTIC';
}

async function handleCategoryPackageReply(session, customer, agency, text) {
  return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, getProfile(session).packageCategory || 'DOMESTIC'));
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
    return openPackageFlow(session, customer, agency, profile.packageCategory || 'DOMESTIC');
  }

  return sendInvalidChoice(session, customer, agency, () => showPackageDetail(session, customer, agency, profile.selectedPackageId));
}

async function handleTravelFlow(session, incoming, customer, agency) {
  const actionId = normalizeText(incoming?.actionId || '');
  const text = lower(incoming?.text);
  const profile = getProfile(session);

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

  if (isCategoryAction(actionId, text)) {
    return openPackageFlow(session, customer, agency, resolveCategory(actionId, text));
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

  if (session.currentStep === STEPS.CATEGORY_PACKAGES && ['list', 'show list', 'package list', 'packages list'].includes(text)) {
    const packages = await findPackagesForCategory(agency.id, profile.packageCategory || 'DOMESTIC', 5);
    return showPackageListFallback(session, customer, agency, profile.packageCategory || 'DOMESTIC', packages);
  }

  if (actionId === 'action_back_packages' || text === 'back to packages' || text === 'view packages') {
    return openPackageFlow(session, customer, agency, profile.packageCategory || 'DOMESTIC');
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

  if (session.currentStep === STEPS.CATEGORY_PACKAGES) {
    return handleCategoryPackageReply(session, customer, agency, text);
  }

  if (session.currentStep === STEPS.PACKAGE_DETAIL) {
    return handlePackageDetailReply(session, customer, agency, actionId, text);
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
};
