// FILE: /backend/src/services/catalogService.ts
//
// Builds the payload for an agency's public catalog mini-site (/s/:agencyKey).
// One live, always-fresh view of everything an agency offers — services,
// packages, properties, visas, cruises — plus the branding/theme the public
// page renders with. Replaces the old generate-to-HTML website builder.
//
// Every item exposes a URL-friendly `slug` derived from its name at request
// time (no schema change). The SAME slug map backs the list and the single-item
// lookup, so a card link always resolves to a detail page. Prices are stored in
// paise; we convert to rupees here so the client never has to know.

const { Op } = require('sequelize');
const { Package, Property, Service, Visa, Cruise } = require('../models');

// Public item types, in the order sections appear on the page. `fk` matches the
// `item` token the lead form understands ("PACKAGE:<id>") so an Enquire button
// pins the exact item onto the created lead.
const CATALOG_TYPES = ['package', 'property', 'service', 'visa', 'cruise'];

const TYPE_MODEL = {
  package: Package,
  property: Property,
  service: Service,
  visa: Visa,
  cruise: Cruise,
};

// The item-token type (uppercase) the lead form / publicController expect.
const TOKEN_TYPE = {
  package: 'PACKAGE',
  property: 'PROPERTY',
  service: 'SERVICE',
  visa: 'VISA',
  cruise: 'CRUISE',
};

const paiseToRupees = (paise) => {
  const n = Number(paise);
  return Number.isFinite(n) && n > 0 ? Math.round(n / 100) : null;
};

function slugifyName(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || fallback;
}

// Turns a list of rows into { slug -> row }, deduping collisions by append order
// so two "Kerala Escape" packages become kerala-escape and kerala-escape-2. The
// order is stable (createdAt DESC from the query) so a slug keeps pointing at the
// same item across requests as long as the set is unchanged.
function slugMap(rows, nameOf) {
  const used = new Map();
  const out = [];
  for (const row of rows) {
    const base = slugifyName(nameOf(row), String(row.id).slice(0, 8));
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    out.push({ slug: count === 0 ? base : `${base}-${count + 1}`, row });
  }
  return out;
}

// ── Per-type shaping ─────────────────────────────────────────────────────────
// `nameOf` gives the slug source. `card` is the compact grid payload. `detail`
// extends the card with everything the item page renders.

const NAME_OF = {
  package: (r) => r.name,
  property: (r) => r.name,
  service: (r) => r.name,
  visa: (r) => [r.country, r.visaType].filter(Boolean).join(' ') || r.country,
  cruise: (r) => r.name,
};

function cardPayload(type, row, slug) {
  const common = { id: row.id, type, slug, token: `${TOKEN_TYPE[type]}:${row.id}` };
  switch (type) {
    case 'package':
      return {
        ...common,
        name: row.name,
        eyebrow: row.category || 'Tour',
        subtitle: [row.duration, (row.destinations || [])[0]].filter(Boolean).join(' · '),
        summary: row.summary || '',
        imageUrl: row.imageUrl || null,
        price: paiseToRupees(row.basePrice),
        priceSuffix: 'per person',
      };
    case 'property':
      return {
        ...common,
        name: row.name,
        eyebrow: row.propertyType || 'Stay',
        subtitle: row.location || '',
        summary: row.description || '',
        imageUrl: row.imageUrl || (Array.isArray(row.images) ? row.images[0] : null) || null,
        price: paiseToRupees(row.pricePerNight),
        priceSuffix: 'per night',
      };
    case 'service':
      return {
        ...common,
        name: row.name,
        eyebrow: row.category || 'Service',
        subtitle: '',
        summary: row.description || '',
        imageUrl: row.imageUrl || null,
        price: row.pricingType === 'VARIABLE' ? null : paiseToRupees(row.basePrice),
        priceSuffix: row.pricingType === 'STARTING_FROM' ? 'onwards' : '',
      };
    case 'visa':
      return {
        ...common,
        name: NAME_OF.visa(row),
        eyebrow: 'Visa',
        subtitle: row.processingTime ? `Processing ${row.processingTime}` : '',
        summary: row.description || '',
        imageUrl: row.imageUrl || null,
        price: paiseToRupees(row.price),
        priceSuffix: '',
      };
    case 'cruise':
      return {
        ...common,
        name: row.name,
        eyebrow: row.cruiseLine || 'Cruise',
        subtitle: [row.duration, row.departurePort].filter(Boolean).join(' · '),
        summary: row.summary || '',
        imageUrl: row.imageUrl || null,
        price: paiseToRupees(row.basePrice),
        priceSuffix: 'per person',
      };
    default:
      return common;
  }
}

function detailPayload(type, row, slug) {
  const card = cardPayload(type, row, slug);
  switch (type) {
    case 'package':
      return {
        ...card,
        destinations: row.destinations || [],
        inclusions: row.inclusions || [],
        exclusions: row.exclusions || [],
        itinerary: row.itinerary || [],
        brochureUrl: row.brochureUrl || null,
        gallery: [row.imageUrl].filter(Boolean),
      };
    case 'property':
      return {
        ...card,
        location: row.location || '',
        address: row.address || '',
        amenities: row.amenities || [],
        description: row.description || '',
        gallery: [row.imageUrl, ...(Array.isArray(row.images) ? row.images : [])]
          .filter(Boolean)
          .filter((url, i, arr) => arr.indexOf(url) === i),
      };
    case 'service':
      return {
        ...card,
        description: row.description || '',
        features: row.features || [],
        pricingType: row.pricingType || 'FIXED',
        gallery: [row.imageUrl].filter(Boolean),
      };
    case 'visa':
      return {
        ...card,
        country: row.country,
        visaType: row.visaType || '',
        processingTime: row.processingTime || '',
        validityPeriod: row.validityPeriod || '',
        requiredDocuments: row.requiredDocuments || [],
        eligibilityNotes: row.eligibilityNotes || '',
        description: row.description || '',
        gallery: [row.imageUrl].filter(Boolean),
      };
    case 'cruise':
      return {
        ...card,
        cruiseLine: row.cruiseLine || '',
        departurePort: row.departurePort || '',
        destinations: row.destinations || [],
        duration: row.duration || '',
        cabinTypes: row.cabinTypes || [],
        inclusions: row.inclusions || [],
        exclusions: row.exclusions || [],
        summary: row.summary || '',
        gallery: [row.imageUrl].filter(Boolean),
      };
    default:
      return card;
  }
}

// Which catalog theme the page renders with. New curated presets replace the old
// static-site template ids; anything unknown (or a legacy id) falls back to the
// default so no agency ever renders blank.
const CATALOG_THEMES = ['aurora', 'midnight', 'coast', 'terra'];
function normalizeTheme(value) {
  const key = String(value || '').trim().toLowerCase();
  return CATALOG_THEMES.includes(key) ? key : 'aurora';
}

function brandingPayload(agency) {
  return {
    agencyId: agency.id,
    name: agency.websiteTitle || agency.name,
    tagline: agency.websiteDescription || '',
    theme: normalizeTheme(agency.websiteTheme),
    logoUrl: agency.websiteLogoUrl || agency.companyLogoUrl || '',
    heroImageUrl: agency.websiteHeroImageUrl || '',
    primaryColor: agency.websitePrimaryColor || '#00A884',
    contactPhone: agency.websiteContactPhone
      || agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || agency.phone || '',
    contactEmail: agency.websiteContactEmail || agency.email || '',
    whatsappNumber: agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || agency.websiteContactPhone || '',
    social: agency.websiteSocialLinks || {},
    seo: agency.websiteSeoMeta || {},
    // The lead-form path an Enquire button links to (default form). The client
    // appends ?item=TYPE:ID&source=catalog.
    leadFormPath: `/lead/${agency.subdomain || agency.id}`,
  };
}

async function fetchActive(type, agencyId) {
  const Model = TYPE_MODEL[type];
  return Model.findAll({
    where: { agencyId, isActive: true },
    order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
    limit: 300,
  }).catch(async () => {
    // Not every catalog model has a displayOrder column; retry without it.
    return Model.findAll({
      where: { agencyId, isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 300,
    });
  });
}

/**
 * The whole catalog for the public page: branding + every type that has at least
 * one active item, each item shaped as a compact card with a stable slug.
 */
async function getCatalog(agency) {
  const sections = [];
  for (const type of CATALOG_TYPES) {
    const rows = await fetchActive(type, agency.id);
    if (!rows.length) continue;
    const mapped = slugMap(rows, NAME_OF[type]);
    sections.push({
      type,
      items: mapped.map(({ slug, row }) => cardPayload(type, row, slug)),
    });
  }
  return {
    branding: brandingPayload(agency),
    sections,
  };
}

/**
 * A single catalog item by (type, slug), for its detail page. Recomputes the
 * slug map for that type and matches — cheap for per-agency counts. Returns null
 * when the type is unknown or no item carries that slug.
 */
async function getCatalogItem(agency, rawType, slug) {
  const type = String(rawType || '').trim().toLowerCase();
  if (!TYPE_MODEL[type]) return null;
  const rows = await fetchActive(type, agency.id);
  const match = slugMap(rows, NAME_OF[type]).find((entry) => entry.slug === slug);
  if (!match) return null;
  return detailPayload(type, match.row, match.slug);
}

module.exports = {
  CATALOG_TYPES,
  CATALOG_THEMES,
  normalizeTheme,
  brandingPayload,
  getCatalog,
  getCatalogItem,
};
