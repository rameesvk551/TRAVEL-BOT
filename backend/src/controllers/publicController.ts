const { Op } = require('sequelize');
const { Package, Property, Service, Visa, Cruise, Agency, Lead, Customer } = require('../models');
const leadService = require('../services/leadService');
const websiteBuilderService = require('../services/websiteBuilderService');
const catalogService = require('../services/catalogService');
const leadFormConfig = require('../services/leadFormConfig');
const leadFormService = require('../services/leadFormService');
const { normalizePhone } = require('../utils/phoneUtils');

// Catalog models a lead-form submission may reference via its `item` token.
const ITEM_MODEL = {
  PACKAGE: Package,
  PROPERTY: Property,
  SERVICE: Service,
  VISA: Visa,
  CRUISE: Cruise,
};

/**
 * Validates an incoming `item` token ("PROPERTY:<uuid>") and confirms the record
 * actually belongs to THIS agency before we let it attach to the lead — otherwise a
 * crafted link could pin another agency's property onto an enquiry. Returns the
 * canonical token, or '' when absent/unknown/foreign.
 */
async function verifiedItemToken(agency, raw) {
  const item = leadFormConfig.parseItemToken(raw);
  if (!item) return '';
  const Model = ITEM_MODEL[item.itemType];
  if (!Model) return '';
  const row = await Model.findOne({
    where: { id: item.itemId, agencyId: agency.id },
    attributes: ['id'],
  });
  if (!row) return '';
  return `${item.itemType}:${item.itemId}`;
}

/**
 * Display info for the catalog item the visitor arrived on (e.g. the villa whose "Check
 * availability" button they tapped). Showing it back to them — photo, name, price — is what turns
 * a generic form into "you are enquiring about THIS one", which is the single biggest lift in
 * completion. Agency-scoped: an item from another agency is simply not returned.
 */
async function publicItemPreview(agency, raw) {
  const item = leadFormConfig.parseItemToken(raw);
  if (!item) return null;
  const Model = ITEM_MODEL[item.itemType];
  if (!Model) return null;

  const row = await Model.findOne({ where: { id: item.itemId, agencyId: agency.id } });
  if (!row) return null;

  // `destination` is what a field flagged hideWhenItemKnown gets prefilled with, so the lead still
  // carries a place even though we never asked for it.
  const byType = {
    PROPERTY: () => ({
      name: row.name,
      subtitle: [row.location, row.propertyType].filter(Boolean).join(' · '),
      destination: row.location || row.name || '',
      imageUrl: row.imageUrl || (Array.isArray(row.images) ? row.images[0] : null) || null,
      price: row.pricePerNight,
      priceSuffix: 'per night',
    }),
    PACKAGE: () => ({
      name: row.name,
      subtitle: [row.duration, (row.destinations || [])[0]].filter(Boolean).join(' · '),
      destination: (row.destinations || [])[0] || row.name || '',
      imageUrl: row.imageUrl || null,
      price: row.basePrice,
      priceSuffix: 'per person',
    }),
    CRUISE: () => ({
      name: row.name,
      subtitle: [row.cruiseLine, row.duration].filter(Boolean).join(' · '),
      destination: (row.destinations || [])[0] || row.departurePort || row.name || '',
      imageUrl: row.imageUrl || null,
      price: row.basePrice,
      priceSuffix: 'per person',
    }),
    VISA: () => ({
      name: [row.country, row.visaType].filter(Boolean).join(' — '),
      subtitle: row.processingTime || '',
      destination: row.country || '',
      imageUrl: row.imageUrl || null,
      price: row.price,
      priceSuffix: '',
    }),
    SERVICE: () => ({
      name: row.name,
      subtitle: row.category || '',
      destination: '',
      imageUrl: row.imageUrl || null,
      price: row.basePrice,
      priceSuffix: '',
    }),
  };

  const shaped = byType[item.itemType]();
  return {
    itemType: item.itemType,
    itemId: item.itemId,
    token: `${item.itemType}:${item.itemId}`,
    ...shaped,
    // Prices are stored in paise. Send rupees so the client never has to know that.
    price: Number.isFinite(Number(shaped.price)) && Number(shaped.price) > 0
      ? Math.round(Number(shaped.price) / 100)
      : null,
  };
}

// Agency.id is a UUID column. Only match it when the key actually looks like a
// UUID — otherwise Postgres throws "invalid input syntax for type uuid" (a 500)
// before it can fall through to a subdomain / customDomain match.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function agencyKeyOr(key, normalizedHost) {
  const or = [{ subdomain: key }, { customDomain: normalizedHost }];
  if (UUID_RE.test(String(key))) or.push({ id: key });
  return or;
}

async function resolveAgency(key) {
  const normalized = websiteBuilderService.normalizeHost(key);
  const agency = await Agency.findOne({
    where: {
      isActive: true,
      websiteEnabled: true,
      [Op.or]: agencyKeyOr(key, normalized),
    },
  });

  if (!agency) {
    throw Object.assign(new Error('Public website not found'), {
      statusCode: 404,
      code: 'PUBLIC_SITE_NOT_FOUND',
    });
  }

  return agency;
}

function packagePayload(pkg) {
  return {
    id: pkg.id,
    name: pkg.name,
    category: pkg.category,
    tourType: pkg.tourType,
    duration: pkg.duration,
    destinations: pkg.destinations || [],
    inclusions: pkg.inclusions || [],
    exclusions: pkg.exclusions || [],
    basePrice: pkg.basePrice,
    imageUrl: pkg.imageUrl,
    summary: pkg.summary,
    brochureUrl: pkg.brochureUrl,
    itinerary: pkg.itinerary || [],
  };
}

function propertyPayload(property) {
  return {
    id: property.id,
    name: property.name,
    propertyType: property.propertyType,
    location: property.location,
    address: property.address,
    amenities: property.amenities || [],
    description: property.description,
    pricePerNight: property.pricePerNight,
    imageUrl: property.imageUrl,
    images: property.images || [],
  };
}

async function getInfo(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    res.json({ success: true, data: websiteBuilderService.publicAgencyPayload(agency) });
  } catch (err) {
    next(err);
  }
}

async function listPackages(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    const packages = await Package.findAll({
      where: { agencyId: agency.id, isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, data: packages.map(packagePayload) });
  } catch (err) {
    next(err);
  }
}

async function getPackage(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    const pkg = await Package.findOne({ where: { id: req.params.id, agencyId: agency.id, isActive: true } });
    if (!pkg) throw Object.assign(new Error('Package not found'), { statusCode: 404, code: 'NOT_FOUND' });
    res.json({ success: true, data: packagePayload(pkg) });
  } catch (err) {
    next(err);
  }
}

async function listProperties(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    const properties = await Property.findAll({
      where: { agencyId: agency.id, isActive: true },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    res.json({ success: true, data: properties.map(propertyPayload) });
  } catch (err) {
    next(err);
  }
}

async function getProperty(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    const property = await Property.findOne({ where: { id: req.params.id, agencyId: agency.id, isActive: true } });
    if (!property) throw Object.assign(new Error('Property not found'), { statusCode: 404, code: 'NOT_FOUND' });
    res.json({ success: true, data: propertyPayload(property) });
  } catch (err) {
    next(err);
  }
}

async function submitEnquiry(req, res, next) {
  try {
    const agency = await resolveAgency(req.params.agencyKey);
    if (String(req.body?.company || '').trim()) {
      return res.status(202).json({ success: true, data: null, message: 'Enquiry received' });
    }

    const itemType = String(req.body.itemType || '').toUpperCase();
    const itemId = req.body.itemId || '';
    const packageId = itemType === 'PACKAGE' ? itemId : req.body.packageId;
    const propertyId = itemType === 'PROPERTY' ? itemId : req.body.propertyId;

    const lead = await leadService.createLead({
      customerName: req.body.name,
      customerPhone: req.body.phone,
      customerEmail: req.body.email,
      customerSource: 'website',
      destination: req.body.destination,
      travelDates: req.body.travelDates,
      travellers: req.body.travellers,
      budgetPerPerson: req.body.budgetPerPerson,
      packageId,
      propertyId,
      itemType: propertyId ? 'PROPERTY' : packageId ? 'PACKAGE' : 'CUSTOM_TRIP',
      notes: String(req.body.message || '').trim() || 'Website enquiry',
      status: 'ENQUIRY',
      source: 'website',
      tags: ['website'],
      selectedItems: [
        packageId ? { itemType: 'PACKAGE', itemId: packageId } : null,
        propertyId ? { itemType: 'PROPERTY', itemId: propertyId } : null,
      ].filter(Boolean),
      customTripDetails: {
        source: 'website',
        submittedAt: new Date().toISOString(),
        message: req.body.message || '',
      },
    }, agency.id);

    res.status(201).json({ success: true, data: { id: lead.id }, message: 'Enquiry received' });
  } catch (err) {
    next(err);
  }
}

// The public lead form is independent of the website builder — an agency can share
// its capture link without ever publishing a site, so we don't require websiteEnabled.
async function resolveAgencyForLeadForm(key) {
  const normalized = websiteBuilderService.normalizeHost(key);
  const agency = await Agency.findOne({
    where: {
      isActive: true,
      [Op.or]: agencyKeyOr(key, normalized),
    },
  });

  if (!agency) {
    throw Object.assign(new Error('Lead form not found'), {
      statusCode: 404,
      code: 'LEAD_FORM_NOT_FOUND',
    });
  }

  return agency;
}

// GET /public/:agencyKey/lead-form         → the agency's default form
// GET /public/:agencyKey/lead-form/:slug   → that named form
async function getLeadForm(req, res, next) {
  try {
    const agency = await resolveAgencyForLeadForm(req.params.agencyKey);
    const form = await leadFormService.resolvePublicForm(agency, req.params.slug);
    if (!form) {
      throw Object.assign(new Error('Lead form not found'), {
        statusCode: 404,
        code: 'LEAD_FORM_NOT_FOUND',
      });
    }
    res.json({
      success: true,
      data: {
        ...leadFormConfig.publicLeadFormPayload(agency, leadFormService.toConfig(form)),
        // The catalog item the visitor tapped (?item=PROPERTY:<id>), so the form can show it back.
        item: await publicItemPreview(agency, req.query.item),
      },
    });
  } catch (err) {
    next(err);
  }
}

// Returns an existing recent lead id when the same phone re-submits the same source
// inside a short window, so a double-tap or refresh doesn't create duplicate leads.
async function findRecentDuplicateLead(agencyId, phone, source) {
  const normalized = normalizePhone(String(phone || '').trim());
  if (!normalized) return null;
  const customer = await Customer.findOne({ where: { agencyId, phone: normalized } });
  if (!customer) return null;

  const since = new Date(Date.now() - 10 * 60 * 1000);
  return Lead.findOne({
    where: {
      agencyId,
      customerId: customer.id,
      source,
      createdAt: { [Op.gte]: since },
    },
    order: [['createdAt', 'DESC']],
  });
}

async function submitLeadForm(req, res, next) {
  try {
    const agency = await resolveAgencyForLeadForm(req.params.agencyKey);
    const form = await leadFormService.resolvePublicForm(agency, req.params.slug);
    if (!form) {
      throw Object.assign(new Error('Lead form not found'), {
        statusCode: 404,
        code: 'LEAD_FORM_NOT_FOUND',
      });
    }

    // Honeypot — bots fill the hidden "company" field; humans never see it.
    if (String(req.body?.company || '').trim()) {
      return res.status(202).json({ success: true, data: null, message: 'Enquiry received' });
    }

    const meta = {
      source: String(req.body?.source || '').trim().slice(0, 100),
      utm_source: String(req.body?.utm_source || '').trim().slice(0, 200),
      utm_medium: String(req.body?.utm_medium || '').trim().slice(0, 200),
      utm_campaign: String(req.body?.utm_campaign || '').trim().slice(0, 200),
      utm_content: String(req.body?.utm_content || '').trim().slice(0, 200),
      utm_term: String(req.body?.utm_term || '').trim().slice(0, 200),
      // The catalog item the customer came in on (e.g. the property card they
      // tapped "Check availability" on). Verified against this agency.
      item: await verifiedItemToken(agency, req.body?.item),
    };

    const { leadInput } = leadFormConfig.mapSubmissionToLead(
      agency,
      req.body,
      meta,
      leadFormService.toConfig(form),
    );

    const existing = await findRecentDuplicateLead(agency.id, leadInput.customerPhone, leadInput.source);
    if (existing) {
      return res.status(200).json({ success: true, data: { id: existing.id }, message: 'Enquiry received' });
    }

    const lead = await leadService.createLead(leadInput, agency.id);
    res.status(201).json({ success: true, data: { id: lead.id }, message: 'Enquiry received' });
  } catch (err) {
    next(err);
  }
}

async function allowDomain(req, res, next) {
  try {
    const domain = websiteBuilderService.normalizeHost(req.query.domain || req.query.host || '');
    if (!domain) return res.status(404).json({ success: false });

    const rootDomain = websiteBuilderService.publicRootDomain();
    const or = [{ customDomain: domain }];
    if (rootDomain && domain.endsWith(`.${rootDomain}`)) {
      const subdomain = domain.slice(0, -(rootDomain.length + 1));
      if (subdomain && !subdomain.includes('.')) or.push({ subdomain });
    }

    const agency = await Agency.findOne({
      where: {
        isActive: true,
        websiteEnabled: true,
        [Op.or]: or,
      },
    });

    if (!agency) return res.status(404).json({ success: false });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// The catalog mini-site is a paid, deny-by-default add-on (agency.features.catalogSite,
// toggled by platform admin — same entitlement model as the brochure builder). Unlike
// the lead form it must also be published (websiteEnabled). A visitor who fails any gate
// gets a plain 404, never a hint that the agency exists.
async function resolveAgencyForCatalog(key) {
  const normalized = websiteBuilderService.normalizeHost(key);
  const agency = await Agency.findOne({
    where: {
      isActive: true,
      websiteEnabled: true,
      [Op.or]: agencyKeyOr(key, normalized),
    },
  });

  const entitled = agency
    && agency.features
    && typeof agency.features === 'object'
    && agency.features.catalogSite === true;

  if (!agency || !entitled) {
    throw Object.assign(new Error('Catalog not found'), {
      statusCode: 404,
      code: 'CATALOG_NOT_FOUND',
    });
  }

  return agency;
}

// GET /public/:agencyKey/catalog → branding + every catalog section with items.
async function getCatalog(req, res, next) {
  try {
    const agency = await resolveAgencyForCatalog(req.params.agencyKey);
    res.json({ success: true, data: await catalogService.getCatalog(agency) });
  } catch (err) {
    next(err);
  }
}

// GET /public/:agencyKey/catalog/:type/:slug → one item's detail page payload.
async function getCatalogItem(req, res, next) {
  try {
    const agency = await resolveAgencyForCatalog(req.params.agencyKey);
    const item = await catalogService.getCatalogItem(agency, req.params.type, req.params.slug);
    if (!item) {
      throw Object.assign(new Error('Item not found'), { statusCode: 404, code: 'NOT_FOUND' });
    }
    res.json({
      success: true,
      data: { branding: catalogService.brandingPayload(agency), item },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInfo,
  listPackages,
  getPackage,
  listProperties,
  getProperty,
  submitEnquiry,
  getLeadForm,
  submitLeadForm,
  allowDomain,
  getCatalog,
  getCatalogItem,
};
