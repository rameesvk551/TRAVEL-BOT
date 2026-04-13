const http = require('http');
const https = require('https');
const path = require('path');
const { Op } = require('sequelize');
const {
  Package,
  Booking,
  Lead,
  Customer,
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
const FLOW_PLACEHOLDER_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh8cAAAAASUVORK5CYII=';
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

function escapeMarkdown(text = '') {
  return String(text || '').replace(/\*/g, '').trim();
}

function formatCurrency(amountPaise) {
  const amount = Number(amountPaise || 0) / 100;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
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

function isMetaTripFlowConfigured() {
  return !!process.env.WHATSAPP_TRIP_FLOW_ID;
}

function normalizeFlowImageUrl(imageUrl = '') {
  const url = normalizeText(imageUrl);
  if (!url) return '';

  const isCloudinarySvg = url.includes('res.cloudinary.com')
    && url.includes('/image/upload/')
    && /\.svg(?:\?|$)/i.test(url);

  if (!isCloudinarySvg) return url;

  return url
    .replace('/image/upload/', '/image/upload/f_png/')
    .replace(/\.svg(\?|$)/i, '.png$1');
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

      const contentType = String(res.headers['content-type'] || '').toLowerCase();
      if (contentType.includes('svg')) {
        res.resume();
        reject(new Error('SVG images are not supported in WhatsApp Flow package cards'));
        return;
      }

      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 900 * 1024) {
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
      status: { [Op.in]: ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING'] },
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
      status: extra.status || 'NEW',
      notes: notes || 'Lead created from WhatsApp sales funnel',
    }, agency.id);
  } else {
    const updates = {
      packageId: extra.packageId || pkg?.id || lead.packageId || null,
      destination: extra.destination || lead.destination || pkg?.destinations?.[0] || null,
      travelDates: extra.travelDates || lead.travelDates || null,
      travellers: extra.travellers || lead.travellers || null,
      budgetPerPerson: extra.budgetPerPerson || lead.budgetPerPerson || null,
      status: extra.status || lead.status || 'NEW',
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

  return whatsappService.sendButtonsMessage(
    customer.phone,
    greeting,
    [
      { id: 'menu_domestic', title: 'Domestic' },
      { id: 'menu_international', title: 'International' },
    ],
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

  if (!isMetaTripFlowConfigured()) {
    return showPackageListFallback(session, customer, agency, normalizedCategory, packages);
  }

  const packageOptions = await buildFlowPackageOptions(packages);
  return whatsappService.sendFlowMessage(
    customer.phone,
    `Browse our best ${categoryLabel(normalizedCategory)} packages 👇`,
    {
      flowId: process.env.WHATSAPP_TRIP_FLOW_ID,
      firstScreenId: FLOW_FIRST_SCREEN_ID,
      flowCta: FLOW_CTA,
      flowToken: `pkg-${customer.id}-${Date.now()}`,
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
}

async function sendPackageActions(customer, agency, pkg) {
  const context = getContext(customer, agency);
  const rows = [
    { id: 'action_enquire', title: 'Enquiry', description: 'Share your trip details in chat' },
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
  const pkg = await Package.findOne({
    where: { id: packageId, agencyId: agency.id, isActive: true },
  });

  if (!pkg) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, getProfile(session).packageCategory));
  }

  await transitionTo(session, STEPS.PACKAGE_DETAIL, {
    selectedPackageId: pkg.id,
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
  const response = incoming?.flowResponse || {};
  const packageId = normalizeText(
    response.packageId
    || response.package_id
    || response.selected_package
    || response.selectedPackage
  );

  if (!packageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, getProfile(session).packageCategory));
  }

  return showPackageDetail(session, customer, agency, packageId);
}

async function startEnquiry(session, customer, agency) {
  const profile = getProfile(session);
  const selectedPackageId = profile.selectedPackageId;

  if (!selectedPackageId) {
    return sendInvalidChoice(session, customer, agency, () => openPackageFlow(session, customer, agency, profile.packageCategory));
  }

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
    enquiry.place ? `Place: ${enquiry.place}` : null,
    enquiry.address ? `Address: ${enquiry.address}` : null,
    enquiry.notes ? `Other details: ${enquiry.notes}` : null,
  ].filter(Boolean).join(' | ');

  const lead = await ensureLead(session, customer, agency, {
    packageId: pkg?.id || null,
    destination: enquiry.place || pkg?.destinations?.[0] || null,
    travelDates: enquiry.travelDate || null,
    travellers: enquiry.travellers || null,
    status: 'NEW',
    notes,
  });

  await updateSession(session, {
    currentStep: STEPS.COMPLETE,
    collectedData: {
      activeLeadId: lead.id,
    },
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
        'Please share your city or place.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_PLACE: {
      if (text.length < 2) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please share your city or place so our expert can plan from the right departure point.',
          getContext(customer, agency)
        );
      }

      enquiry.place = text;
      await transitionTo(session, STEPS.ENQUIRY_ADDRESS, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'Please share your address.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_ADDRESS: {
      if (text.length < 5) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please share a complete address.',
          getContext(customer, agency)
        );
      }

      enquiry.address = text;
      await transitionTo(session, STEPS.ENQUIRY_DATE, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'When are you planning to travel? Please share the date or travel month.',
        getContext(customer, agency)
      );
    }

    case STEPS.ENQUIRY_DATE: {
      if (text.length < 3) {
        return whatsappService.sendTextMessage(
          customer.phone,
          'Please share an expected travel date or month.',
          getContext(customer, agency)
        );
      }

      enquiry.travelDate = text;
      await transitionTo(session, STEPS.ENQUIRY_TRAVELLERS, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'How many people will be travelling?',
        getContext(customer, agency)
      );
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
      await transitionTo(session, STEPS.ENQUIRY_NOTES, { enquiryDraft: enquiry });
      return whatsappService.sendTextMessage(
        customer.phone,
        'Any other details to share, like honeymoon, family trip, hotel preference, or special request?\n\nReply "skip" if none.',
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

  await whatsappService.sendTextMessage(
    customer.phone,
    `📞 Call us: ${agency.phone || agency.whatsappNumber}`,
    getContext(customer, agency)
  );

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
      return whatsappService.sendTextMessage(customer.phone, 'Please share your city or place.', getContext(customer, agency));
    case STEPS.ENQUIRY_ADDRESS:
      return whatsappService.sendTextMessage(customer.phone, 'Please share your address.', getContext(customer, agency));
    case STEPS.ENQUIRY_DATE:
      return whatsappService.sendTextMessage(customer.phone, 'When are you planning to travel?', getContext(customer, agency));
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
    return startEnquiry(session, customer, agency);
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

  if (session.currentStep === STEPS.CATEGORY_PACKAGES && ['list', 'show list', 'package list', 'packages list'].includes(text)) {
    const packages = await findPackagesForCategory(agency.id, profile.packageCategory || 'DOMESTIC', 5);
    return showPackageListFallback(session, customer, agency, profile.packageCategory || 'DOMESTIC', packages);
  }

  if (actionId === 'action_back_packages' || text === 'back to packages' || text === 'view packages') {
    return openPackageFlow(session, customer, agency, profile.packageCategory || 'DOMESTIC');
  }

  if (actionId === 'pkg_pick:' || actionId.startsWith('pkg_pick:')) {
    return showPackageDetail(session, customer, agency, actionId.split(':')[1]);
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
