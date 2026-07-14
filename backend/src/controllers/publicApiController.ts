// FILE: /backend/src/controllers/publicApiController.js
// DEPS: sequelize

const { Op } = require('sequelize');
const { Package, Property, Service, Visa, Cruise, Customer, Lead } = require('../models');
const leadService = require('../services/leadService');
const { normalizePhone } = require('../utils/phoneUtils');
const { isCatalogResourceEnabled, enabledCatalogResources } = require('../utils/catalogVisibility');

const LIST_LIMIT = 200;
// Window in which an identical website lead is treated as a duplicate submit.
const DEDUP_WINDOW_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- Sanitized public payloads. Only safe, display-oriented fields leak. ----

function packagePayload(p) {
  return {
    id: p.id,
    type: 'PACKAGE',
    name: p.name,
    category: p.category,
    tourType: p.tourType,
    duration: p.duration,
    destinations: p.destinations || [],
    inclusions: p.inclusions || [],
    exclusions: p.exclusions || [],
    basePrice: p.basePrice,
    imageUrl: p.imageUrl,
    summary: p.summary,
    brochureUrl: p.brochureUrl,
    itinerary: p.itinerary || [],
  };
}

function propertyPayload(p) {
  return {
    id: p.id,
    type: 'PROPERTY',
    name: p.name,
    propertyType: p.propertyType,
    location: p.location,
    address: p.address,
    amenities: p.amenities || [],
    description: p.description,
    pricePerNight: p.pricePerNight,
    imageUrl: p.imageUrl,
    images: p.images || [],
  };
}

function servicePayload(s) {
  return {
    id: s.id,
    type: 'SERVICE',
    name: s.name,
    category: s.category,
    description: s.description,
    icon: s.icon,
    basePrice: s.basePrice,
    pricingType: s.pricingType,
    features: s.features || [],
    imageUrl: s.imageUrl,
  };
}

function visaPayload(v) {
  return {
    id: v.id,
    type: 'VISA',
    country: v.country,
    visaType: v.visaType,
    price: v.price,
    processingTime: v.processingTime,
    validityPeriod: v.validityPeriod,
    requiredDocuments: v.requiredDocuments || [],
    description: v.description,
    eligibilityNotes: v.eligibilityNotes,
    imageUrl: v.imageUrl,
  };
}

function cruisePayload(c) {
  return {
    id: c.id,
    type: 'CRUISE',
    name: c.name,
    cruiseLine: c.cruiseLine,
    departurePort: c.departurePort,
    destinations: c.destinations || [],
    duration: c.duration,
    cabinTypes: c.cabinTypes || [],
    inclusions: c.inclusions || [],
    exclusions: c.exclusions || [],
    basePrice: c.basePrice,
    departureDate: c.departureDate,
    summary: c.summary,
    imageUrl: c.imageUrl,
  };
}

// Catalog registry keyed by the public resource name.
const CATALOG = {
  packages: { model: Package, payload: packagePayload, order: [['createdAt', 'DESC']] },
  properties: { model: Property, payload: propertyPayload, order: [['createdAt', 'DESC']] },
  services: { model: Service, payload: servicePayload, order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']] },
  visas: { model: Visa, payload: visaPayload, order: [['createdAt', 'DESC']] },
  cruises: { model: Cruise, payload: cruisePayload, order: [['createdAt', 'DESC']] },
};

/**
 * GET /api/public/v1/catalog/:resource
 * Lists active items of one catalog resource for the key's agency.
 */
async function listResource(req, res, next) {
  try {
    const entry = CATALOG[req.params.resource];
    // Unknown OR disabled-for-this-agency resources both return 404 — we never
    // reveal that a resource exists but is hidden by the agency's sidebar config.
    if (!entry || !isCatalogResourceEnabled(req.publicAgency, req.params.resource)) {
      return res.status(404).json({ success: false, error: 'Unknown catalog resource', code: 'NOT_FOUND' });
    }
    const rows = await entry.model.findAll({
      where: { agencyId: req.publicAgency.id, isActive: true },
      order: entry.order,
      limit: LIST_LIMIT,
    });
    res.json({ success: true, data: rows.map(entry.payload) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/public/v1/catalog/:resource/:id
 * Fetches a single active item, strictly scoped to the key's agency.
 */
async function getResource(req, res, next) {
  try {
    const entry = CATALOG[req.params.resource];
    if (!entry || !isCatalogResourceEnabled(req.publicAgency, req.params.resource)) {
      return res.status(404).json({ success: false, error: 'Unknown catalog resource', code: 'NOT_FOUND' });
    }
    // Guard the UUID column: a non-UUID id would otherwise make Postgres throw a
    // 500. Treat malformed ids as a clean 404.
    if (!UUID_RE.test(String(req.params.id))) {
      return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    }
    const row = await entry.model.findOne({
      where: { id: req.params.id, agencyId: req.publicAgency.id, isActive: true },
    });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    }
    res.json({ success: true, data: entry.payload(row) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/public/v1/catalog
 * One call returning every active catalog resource — convenient for a homepage.
 */
async function listAll(req, res, next) {
  try {
    const agencyId = req.publicAgency.id;
    // Only query the resources the agency exposes in its sidebar.
    const resources = enabledCatalogResources(req.publicAgency);

    const results = await Promise.all(
      resources.map((resource) =>
        CATALOG[resource].model
          .findAll({ where: { agencyId, isActive: true }, order: CATALOG[resource].order, limit: LIST_LIMIT })
          .then((rows) => [resource, rows.map(CATALOG[resource].payload)]),
      ),
    );

    res.json({
      success: true,
      data: Object.fromEntries(results),
      meta: { resources },
    });
  } catch (err) {
    next(err);
  }
}

// Maps a submitted itemType to the Lead foreign-key field it should populate.
const ITEM_FK = {
  PACKAGE: 'packageId',
  PROPERTY: 'propertyId',
  SERVICE: 'serviceId',
  VISA: 'visaId',
  CRUISE: 'cruiseId',
};

/**
 * Returns a recent identical website lead for this customer+item, if one exists.
 * Cheap idempotency: blunts double-clicks and rapid duplicate spam.
 */
async function findRecentDuplicate(agencyId, phone, itemFkField, itemId) {
  if (!phone) return null;
  const customer = await Customer.findOne({ where: { agencyId, phone }, attributes: ['id'] });
  if (!customer) return null;

  const where = {
    agencyId,
    customerId: customer.id,
    source: 'website',
    createdAt: { [Op.gte]: new Date(Date.now() - DEDUP_WINDOW_MS) },
  };
  if (itemFkField && itemId) where[itemFkField] = itemId;

  return Lead.findOne({ where, order: [['createdAt', 'DESC']], attributes: ['id'] });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAssignmentActionPage(rawTitle, rawMessage) {
  const title = escapeHtml(rawTitle);
  const message = escapeHtml(rawMessage);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background:#f5f5f5; color:#111827; margin:0; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { max-width:520px; width:100%; background:#fff; border:1px solid #e5e7eb; border-radius:20px; padding:28px; box-shadow:0 10px 30px rgba(0,0,0,.06); }
      h1 { margin:0 0 12px; font-size:24px; }
      p { margin:0; line-height:1.6; color:#4b5563; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${title}</h1>
        <p>${message}</p>
      </div>
    </div>
  </body>
</html>`;
}

async function handleStaffWhatsAppAssignmentAction(req, res) {
  const token = String(req.query.t || '').trim();
  if (!token) {
    return res
      .status(400)
      .type('html')
      .send(renderAssignmentActionPage('Missing link', 'This chat action link is incomplete. Please ask your admin to resend the assignment message.'));
  }

  try {
    const result = await leadService.triggerStaffAssignmentAction(token);
    return res.redirect(302, result.redirectUrl);
  } catch (err) {
    // Only our own deliberate errors carry a statusCode; anything else is a downstream
    // failure whose message may embed stored customer data, so it never reaches the page.
    const safeMessage = err?.statusCode
      ? err.message
      : 'We could not send the first outreach for this customer.';
    return res
      .status(err?.statusCode || 500)
      .type('html')
      .send(renderAssignmentActionPage('Could not start chat', safeMessage));
  }
}

/**
 * POST /api/public/v1/leads
 * Creates a website lead. Honeypot + dedup + (router-level) strict rate limits.
 * Validation/phone-normalization/agent-routing all happen in leadService.
 */
async function submitLead(req, res, next) {
  try {
    const agencyId = req.publicAgency.id;

    // Honeypot: bots fill hidden fields humans never see. Accept silently so the
    // bot believes it succeeded, but create nothing.
    if (String(req.body?.company || req.body?.website_url || '').trim()) {
      return res.status(202).json({ success: true, data: null, message: 'Received' });
    }

    const rawType = String(req.body.itemType || '').toUpperCase();
    // Only honour an item link if that resource is enabled in the agency sidebar;
    // otherwise the enquiry falls back to a generic custom-trip lead.
    const RESOURCE_FOR_TYPE = {
      PACKAGE: 'packages', PROPERTY: 'properties', SERVICE: 'services', VISA: 'visas', CRUISE: 'cruises',
    };
    const typeEnabled = RESOURCE_FOR_TYPE[rawType]
      && isCatalogResourceEnabled(req.publicAgency, RESOURCE_FOR_TYPE[rawType]);
    const itemType = (ITEM_FK[rawType] && typeEnabled) ? rawType : null;
    const itemId = String(req.body.itemId || '').trim() || null;
    const itemFkField = itemType ? ITEM_FK[itemType] : null;

    // Idempotency: return the existing lead instead of creating a duplicate.
    const normalizedPhone = normalizePhone(String(req.body.phone || '').trim());
    const duplicate = await findRecentDuplicate(agencyId, normalizedPhone, itemFkField, itemId);
    if (duplicate) {
      return res.status(200).json({ success: true, data: { id: duplicate.id }, message: 'Already received', duplicate: true });
    }

    const leadInput = {
      customerName: req.body.name,
      customerPhone: req.body.phone,
      customerEmail: req.body.email,
      customerSource: 'website',
      destination: req.body.destination,
      travelDates: req.body.travelDates,
      travellers: req.body.travellers,
      budgetPerPerson: req.body.budgetPerPerson,
      itemType: itemType || 'CUSTOM_TRIP',
      notes: String(req.body.message || '').trim() || 'Website enquiry',
      status: 'ENQUIRY',
      source: 'website',
      tags: ['website'],
      selectedItems: itemType && itemId ? [{ itemType, itemId }] : [],
      customTripDetails: {
        source: 'website',
        submittedAt: new Date().toISOString(),
        message: String(req.body.message || ''),
        apiKeyId: req.apiKey ? req.apiKey.id : null,
      },
    };
    if (itemFkField && itemId) leadInput[itemFkField] = itemId;

    const lead = await leadService.createLead(leadInput, agencyId);
    res.status(201).json({ success: true, data: { id: lead.id }, message: 'Enquiry received' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAll,
  listResource,
  getResource,
  submitLead,
  handleStaffWhatsAppAssignmentAction,
};
