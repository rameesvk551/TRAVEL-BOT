const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { Op } = require('sequelize');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { sequelize, Agency, Package } = require('../models');
const mediaService = require('../services/mediaService');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    agencyName: null,
    force: false,
    limit: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--agency' && args[index + 1]) {
      parsed.agencyName = args[index + 1];
      index += 1;
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg === '--limit' && args[index + 1]) {
      parsed.limit = parseInt(args[index + 1], 10);
      index += 1;
    }
  }

  return parsed;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatCurrency(amountPaise) {
  return `Rs${Math.round((amountPaise || 0) / 100).toLocaleString('en-IN')}`;
}

function normalizeCategory(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'domestic') return 'DOMESTIC';
  if (normalized === 'international') return 'INTERNATIONAL';
  return null;
}

function inferCategory(pkg) {
  const explicit = normalizeCategory(pkg.category);
  if (explicit) return explicit;

  const searchable = [
    pkg.name,
    ...(Array.isArray(pkg.destinations) ? pkg.destinations : []),
    ...(Array.isArray(pkg.inclusions) ? pkg.inclusions : []),
    pkg.summary,
  ].join(' ').toLowerCase();

  const domesticKeywords = [
    'india', 'goa', 'kerala', 'munnar', 'alleppey', 'kochi', 'cochin', 'kovalam',
    'thekkady', 'himachal', 'manali', 'shimla', 'kashmir', 'srinagar', 'gulmarg',
    'pahalgam', 'kanyakumari', 'ahmedabad', 'surat', 'mumbai', 'delhi',
  ];

  return domesticKeywords.some((keyword) => searchable.includes(keyword))
    ? 'DOMESTIC'
    : 'INTERNATIONAL';
}

function buildSummary(pkg) {
  if (pkg.summary && String(pkg.summary).trim()) return String(pkg.summary).trim();

  const pieces = [];
  if (Array.isArray(pkg.destinations) && pkg.destinations.length) {
    pieces.push(`Route: ${pkg.destinations.join(' - ')}`);
  }
  if (pkg.duration) {
    pieces.push(`Duration: ${pkg.duration}`);
  }
  if (Array.isArray(pkg.inclusions) && pkg.inclusions.length) {
    pieces.push(`Includes ${pkg.inclusions.slice(0, 3).join(', ')}`);
  }

  return pieces.join('. ') || 'Curated holiday package brochure.';
}

function buildItineraryLines(pkg) {
  if (Array.isArray(pkg.itinerary) && pkg.itinerary.length) {
    return pkg.itinerary.map((day, index) => {
      const heading = `Day ${day.day || index + 1}: ${day.title || day.description || 'Planned activities'}`;
      const activities = Array.isArray(day.activities) && day.activities.length
        ? ` | ${day.activities.join(', ')}`
        : '';
      return `${heading}${activities}`;
    });
  }

  return [
    'Day 1: Arrival and check-in',
    'Day 2: Signature sightseeing',
    'Day 3: Free time or add-ons',
    'Final day: Checkout',
  ];
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

async function buildBrochurePdf(pkg, agencyName) {
  const pdfDoc = await PDFDocument.create();
  const pageSize = [595.28, 841.89];
  const marginX = 48;
  const topStart = 790;
  const lineGap = 16;
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage(pageSize);
  let y = topStart;

  const drawLines = (lines, options = {}) => {
    const font = options.bold ? fontBold : fontRegular;
    const fontSize = options.fontSize || 12;
    const color = options.color || rgb(0.11, 0.17, 0.27);

    for (const line of lines) {
      if (y < 70) {
        page = pdfDoc.addPage(pageSize);
        y = topStart;
      }

      page.drawText(line, {
        x: marginX,
        y,
        size: fontSize,
        font,
        color,
      });
      y -= options.lineGap || lineGap;
    }
  };

  drawLines([agencyName || 'Travel Agency'], {
    bold: true,
    fontSize: 13,
    color: rgb(0.0, 0.38, 0.65),
    lineGap: 18,
  });

  drawLines([pkg.name || 'Travel Package'], {
    bold: true,
    fontSize: 24,
    color: rgb(0.07, 0.11, 0.16),
    lineGap: 28,
  });

  drawLines([
    `${Array.isArray(pkg.destinations) && pkg.destinations.length ? pkg.destinations.join(' - ') : 'Custom route'} | ${pkg.duration || 'Custom duration'}`,
    `Price: ${formatCurrency(pkg.basePrice)} per person | Category: ${inferCategory(pkg) === 'INTERNATIONAL' ? 'International' : 'Domestic'}`,
  ], {
    fontSize: 12,
    color: rgb(0.25, 0.31, 0.38),
    lineGap: 18,
  });

  y -= 8;
  drawLines(['Package Summary'], {
    bold: true,
    fontSize: 14,
    color: rgb(0.0, 0.38, 0.65),
    lineGap: 20,
  });
  drawLines(wrapText(buildSummary(pkg), fontRegular, 11, 500), { fontSize: 11 });

  y -= 8;
  drawLines(['Package Includes'], {
    bold: true,
    fontSize: 14,
    color: rgb(0.0, 0.38, 0.65),
    lineGap: 20,
  });
  drawLines(
    (Array.isArray(pkg.inclusions) && pkg.inclusions.length ? pkg.inclusions : ['Hotel stay', 'Meals as mentioned', 'Sightseeing support'])
      .map((item) => `- ${item}`),
    { fontSize: 11 }
  );

  y -= 8;
  drawLines(['Itinerary'], {
    bold: true,
    fontSize: 14,
    color: rgb(0.0, 0.38, 0.65),
    lineGap: 20,
  });

  for (const line of buildItineraryLines(pkg)) {
    drawLines(wrapText(line, fontRegular, 11, 500), { fontSize: 11 });
  }

  if (Array.isArray(pkg.exclusions) && pkg.exclusions.length) {
    y -= 8;
    drawLines(['Exclusions'], {
      bold: true,
      fontSize: 14,
      color: rgb(0.0, 0.38, 0.65),
      lineGap: 20,
    });
    drawLines(pkg.exclusions.map((item) => `- ${item}`), { fontSize: 11 });
  }

  y -= 12;
  drawLines(['Contact us on WhatsApp to confirm the latest availability and final quote.'], {
    bold: true,
    fontSize: 11,
    color: rgb(0.66, 0.19, 0.09),
    lineGap: 16,
  });

  return Buffer.from(await pdfDoc.save());
}

async function resolveAgency(agencyName) {
  if (agencyName) {
    return Agency.findOne({ where: { name: agencyName } });
  }

  return null;
}

async function backfillPackageBrochures() {
  const args = parseArgs();

  await sequelize.authenticate();

  const agency = await resolveAgency(args.agencyName);
  const where = {};

  if (agency) {
    where.agencyId = agency.id;
  }

  if (!args.force) {
    where[Op.or] = [
      { brochureUrl: null },
      { brochureUrl: '' },
    ];
  }

  const packages = await Package.findAll({
    where,
    include: agency ? [] : [{ model: Agency, as: 'agency', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
    limit: args.limit || undefined,
  });

  if (packages.length === 0) {
    console.log('No packages found that need brochure generation.');
    return;
  }

  console.log(`Preparing brochures for ${packages.length} package(s)...`);

  for (const pkg of packages) {
    const agencyName = agency?.name || pkg.agency?.name || 'Travel Agency';
    const buffer = await buildBrochurePdf(pkg, agencyName);
    const brochureFileName = `${slugify(pkg.name || 'package')}-brochure.pdf`;
    const uploaded = await mediaService.uploadPackageBrochure(buffer, pkg.agencyId, brochureFileName);

    await pkg.update({
      brochureUrl: uploaded.secureUrl,
      brochureFileName,
      category: normalizeCategory(pkg.category) || inferCategory(pkg),
      summary: pkg.summary || buildSummary(pkg),
    });

    console.log(`Generated brochure for ${pkg.name}`);
  }

  console.log('Brochure backfill complete.');
}

if (require.main === module) {
  backfillPackageBrochures()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Brochure backfill failed:', err.message);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = { backfillPackageBrochures };
