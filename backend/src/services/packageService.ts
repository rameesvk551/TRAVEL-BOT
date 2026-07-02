// FILE: /backend/src/services/packageService.js

const { Op } = require('sequelize');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const crypto = require('crypto');
const { Package, Itinerary } = require('../models');
const packageRepository = require('../repositories/packageRepository');
const mediaService = require('./mediaService');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'category', 'tourType', 'duration', 'destinations', 'inclusions', 'exclusions',
  'basePrice', 'imageUrl', 'summary', 'brochureUrl', 'brochureFileName', 'itinerary', 'isActive',
];

/**
 * Lists all packages for an agency.
 * @param {string} agencyId - Agency ID
 * @param {boolean} [activeOnly=false] - Only return active packages
 * @returns {Promise<object[]>} List of packages
 */
function parsePositiveInt(value, fallback, max = 200) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function buildOrder(sortBy) {
  if (sortBy === 'price_asc') return [['basePrice', 'ASC'], ['createdAt', 'DESC']];
  if (sortBy === 'price_desc') return [['basePrice', 'DESC'], ['createdAt', 'DESC']];
  if (sortBy === 'name') return [['name', 'ASC']];
  return [['createdAt', 'DESC']];
}

function cleanText(value = '') {
  return String(value || '')
    .replace(/₹/g, 'INR ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function asList(value = []) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
}

function money(amountPaise = 0) {
  return `INR ${Math.round(Number(amountPaise || 0) / 100).toLocaleString('en-IN')}`;
}

function inferDayCount(duration = '') {
  const text = String(duration || '').toLowerCase();
  const dayMatch = text.match(/(\d+)\s*(?:d|day|days)\b/);
  if (dayMatch) return Math.min(Math.max(parseInt(dayMatch[1], 10), 1), 14);

  const nightMatch = text.match(/(\d+)\s*(?:n|night|nights)\b/);
  if (nightMatch) return Math.min(Math.max(parseInt(nightMatch[1], 10) + 1, 1), 14);

  return 3;
}

function toItineraryItem(name) {
  return { id: crypto.randomUUID(), name: cleanText(name) };
}

function normalizePackageItineraryDay(day = {}, index = 0) {
  const title = cleanText(day.title || `Day ${day.day || index + 1}`);
  const description = cleanText(day.description || `Enjoy ${title.toLowerCase()} with planned travel support.`);
  return {
    id: crypto.randomUUID(),
    title,
    description,
    hotels: asList(day.hotels || []).map(toItineraryItem),
    activities: asList(day.activities || []).map(toItineraryItem),
    transports: asList(day.transports || []).map(toItineraryItem),
  };
}

function buildAutoItineraryDays(pkg) {
  const explicitDays = Array.isArray(pkg?.itinerary) ? pkg.itinerary : [];
  if (explicitDays.length) return explicitDays.map(normalizePackageItineraryDay);

  const dayCount = inferDayCount(pkg?.duration);
  const destinations = asList(pkg?.destinations);
  const inclusions = asList(pkg?.inclusions);
  const primaryDestination = destinations[0] || 'the destination';

  return Array.from({ length: dayCount }).map((_, index) => {
    const dayNumber = index + 1;
    const destination = destinations[index] || destinations[Math.min(index, destinations.length - 1)] || primaryDestination;
    const isFirst = index === 0;
    const isLast = index === dayCount - 1;
    const isMiddle = !isFirst && !isLast;
    const inclusionHighlights = inclusions.slice(0, 4);

    let title = `Day ${dayNumber}: ${destination} Experience`;
    let description = `Explore ${destination} with a comfortable, well-paced plan tailored for this package.`;
    let activities = [`Explore ${destination}`, 'Photo stops and local experiences'];
    let transports = ['Private/local transfer as per package'];

    if (isFirst) {
      title = `Day ${dayNumber}: Arrival and Check-in`;
      description = `Arrive for ${cleanText(pkg?.name || 'your trip')}, meet the local support team, transfer to the stay, and settle in for a relaxed start.`;
      activities = ['Arrival assistance', 'Hotel check-in', 'Evening at leisure'];
      transports = ['Arrival pickup and transfer'];
    } else if (isLast) {
      title = `Day ${dayNumber}: Checkout and Departure`;
      description = `Enjoy breakfast, complete checkout, and transfer for the return journey with trip memories and support until departure.`;
      activities = ['Breakfast', 'Hotel checkout', 'Departure assistance'];
      transports = ['Departure transfer'];
    } else if (isMiddle) {
      title = `Day ${dayNumber}: ${destination} Sightseeing`;
      description = `Spend the day discovering ${destination} with sightseeing, local experiences, and enough free time to enjoy the place comfortably.`;
    }

    return {
      id: crypto.randomUUID(),
      title,
      description,
      hotels: [toItineraryItem('Selected hotel / stay as per package')],
      activities: [...activities, ...inclusionHighlights].map(toItineraryItem),
      transports: transports.map(toItineraryItem),
    };
  });
}

function wrapText(text, font, size, maxWidth) {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, size) <= maxWidth) {
      line = nextLine;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawWrappedText(state, text, options = {}) {
  const {
    size = 10,
    font = state.font,
    color = rgb(0.18, 0.18, 0.18),
    x = state.margin,
    maxWidth = state.width - state.margin * 2,
    lineGap = 4,
    paragraphGap = 6,
  } = options;
  const lines = wrapText(text, font, size, maxWidth);

  for (const line of lines) {
    if (state.y < state.margin + size + 20) {
      state.page = state.pdf.addPage([state.width, state.height]);
      state.y = state.height - state.margin;
    }
    state.page.drawText(line, { x, y: state.y, size, font, color });
    state.y -= size + lineGap;
  }
  state.y -= paragraphGap;
}

async function buildPackageItineraryPdfBuffer(pkg, itinerary) {
  const pdf = await PDFDocument.create();
  const title = cleanText(itinerary?.name || `${pkg?.name || 'Package'} Itinerary`);
  pdf.setTitle(title);
  pdf.setSubject(cleanText(`Travel itinerary for ${pkg?.name || 'selected package'}`));
  pdf.setAuthor('Wayon Travels');
  pdf.setProducer('TravelBot');
  pdf.setCreator('TravelBot');
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const state = {
    pdf,
    page,
    font,
    bold,
    width: 595.28,
    height: 841.89,
    margin: 46,
    y: 795,
  };
  const destinations = asList(pkg.destinations).join(', ') || cleanText(itinerary.destination || '');
  const inclusions = asList(pkg.inclusions);
  const exclusions = asList(pkg.exclusions);

  drawWrappedText(state, cleanText(pkg.name || 'Travel Itinerary'), {
    size: 22,
    font: bold,
    color: rgb(0.05, 0.05, 0.05),
    lineGap: 6,
    paragraphGap: 10,
  });
  drawWrappedText(state, [
    destinations ? `Destination: ${destinations}` : null,
    pkg.duration ? `Duration: ${cleanText(pkg.duration)}` : null,
    pkg.basePrice ? `Starting from ${money(pkg.basePrice)} per person` : null,
  ].filter(Boolean).join(' | '), { size: 11, color: rgb(0.35, 0.35, 0.35), paragraphGap: 12 });

  drawWrappedText(state, cleanText(pkg.summary || `A curated travel package for ${destinations || 'your selected destination'} with stay, transfers, experiences, and assistance planned for a smooth journey.`), {
    size: 11,
    paragraphGap: 12,
  });

  drawWrappedText(state, 'Day-by-day itinerary', { size: 15, font: bold, color: rgb(0.05, 0.05, 0.05), paragraphGap: 8 });
  for (const [index, day] of (itinerary.days || []).entries()) {
    drawWrappedText(state, day.title || `Day ${index + 1}`, { size: 12, font: bold, paragraphGap: 3 });
    drawWrappedText(state, day.description || 'Planned travel day with agency support.', { size: 10, paragraphGap: 4 });

    const activities = asList((day.activities || []).map((item) => item.name));
    const hotels = asList((day.hotels || []).map((item) => item.name));
    const transports = asList((day.transports || []).map((item) => item.name));
    if (hotels.length) drawWrappedText(state, `Stay: ${hotels.join(', ')}`, { size: 9, color: rgb(0.35, 0.35, 0.35), paragraphGap: 2 });
    if (activities.length) drawWrappedText(state, `Experiences: ${activities.join(', ')}`, { size: 9, color: rgb(0.35, 0.35, 0.35), paragraphGap: 2 });
    if (transports.length) drawWrappedText(state, `Transport: ${transports.join(', ')}`, { size: 9, color: rgb(0.35, 0.35, 0.35), paragraphGap: 7 });
  }

  if (inclusions.length) {
    drawWrappedText(state, 'Inclusions', { size: 14, font: bold, paragraphGap: 6 });
    inclusions.slice(0, 18).forEach((item) => drawWrappedText(state, `- ${item}`, { size: 9, paragraphGap: 1 }));
  }

  if (exclusions.length) {
    drawWrappedText(state, 'Exclusions', { size: 14, font: bold, paragraphGap: 6 });
    exclusions.slice(0, 18).forEach((item) => drawWrappedText(state, `- ${item}`, { size: 9, paragraphGap: 1 }));
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

function safePdfName(pkg) {
  const base = cleanText(pkg?.name || 'package-itinerary')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'package-itinerary';
  return `${base}-itinerary.pdf`;
}

async function createPackageItineraryPdf(pkg) {
  const days = buildAutoItineraryDays(pkg);
  const itinerary = await Itinerary.create({
    agencyId: pkg.agencyId,
    packageId: pkg.id,
    name: `${pkg.name} Itinerary`,
    destination: asList(pkg.destinations).join(', ') || null,
    status: 'DRAFT',
    adults: 0,
    children: 0,
    days,
    totalCost: 0,
    totalPrice: Number(pkg.basePrice || 0),
    isTemplate: true,
  });

  const buffer = await buildPackageItineraryPdfBuffer(pkg, itinerary);
  const uploaded = await mediaService.uploadItineraryPdf(buffer, pkg.agencyId, itinerary.id, safePdfName(pkg));
  await itinerary.update({ pdfUrl: uploaded.secureUrl });
  return itinerary;
}

async function listPackages(agencyId, options = false) {
  if (typeof options === 'boolean') {
    return packageRepository.findAllByAgency(agencyId, options);
  }

  const {
    active,
    activeOnly = active === 'true',
    tab = 'ALL',
    category,
    tourType,
    search,
    sortBy = 'newest',
    page,
    pageSize,
  } = options || {};

  const isPaginated = page !== undefined || pageSize !== undefined || options.paginated === 'true';
  const where = { agencyId };

  if (activeOnly) where.isActive = true;
  if (tab === 'DOMESTIC') where.category = { [Op.iLike]: '%domestic%' };
  else if (tab === 'INTERNATIONAL') where.category = { [Op.iLike]: '%international%' };
  else if (tab === 'INACTIVE') where.isActive = false;

  if (category && category !== 'ALL') where.category = category;
  if (tourType && tourType !== 'ALL') where.tourType = { [Op.iLike]: String(tourType) };

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { category: { [Op.iLike]: `%${search}%` } },
      { tourType: { [Op.iLike]: `%${search}%` } },
      { duration: { [Op.iLike]: `%${search}%` } },
      { summary: { [Op.iLike]: `%${search}%` } },
    ];
  }

  if (!isPaginated) {
    return Package.findAll({ where, order: buildOrder(sortBy) });
  }

  const limit = parsePositiveInt(pageSize, 15);
  const currentPage = parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER);
  const offset = (currentPage - 1) * limit;
  const { count, rows } = await Package.findAndCountAll({
    where,
    order: buildOrder(sortBy),
    limit,
    offset,
  });

  return { data: rows, total: count, page: currentPage, pageSize: limit };
}

/**
 * Gets a package by ID.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Package
 */
async function getPackageById(packageId, agencyId) {
  const pkg = await packageRepository.findByIdAndAgency(packageId, agencyId);
  if (!pkg) {
    throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return pkg;
}

/**
 * Creates a new travel package.
 * @param {object} data - Package data
 * @param {string} agencyId - Agency ID
 * @returns {Promise<object>} Created package
 */
async function createPackage(data, agencyId) {
  const pkg = await packageRepository.create({ ...data, agencyId });

  try {
    await createPackageItineraryPdf(pkg);
  } catch (err) {
    console.warn('[PackageService] Failed to auto-create itinerary PDF for package:', {
      packageId: pkg.id,
      agencyId,
      error: err.message,
    });
  }

  return pkg;
}

/**
 * Updates a package.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} Updated package
 */
async function updatePackage(packageId, agencyId, updates) {
  const pkg = await getPackageById(packageId, agencyId);

  const filtered = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  return packageRepository.update(pkg, filtered);
}

/**
 * Deletes (deactivates) a package.
 * @param {string} packageId - Package ID
 * @param {string} agencyId - Agency ID
 */
async function deletePackage(packageId, agencyId) {
  const pkg = await getPackageById(packageId, agencyId);
  return packageRepository.update(pkg, { isActive: false });
}

module.exports = {
  listPackages,
  getPackageById,
  createPackage,
  createPackageItineraryPdf,
  updatePackage,
  deletePackage,
};
