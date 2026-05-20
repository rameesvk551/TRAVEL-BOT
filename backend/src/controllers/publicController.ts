const { Op } = require('sequelize');
const { Package, Property, Agency } = require('../models');
const leadService = require('../services/leadService');
const websiteBuilderService = require('../services/websiteBuilderService');

async function resolveAgency(key) {
  const normalized = websiteBuilderService.normalizeHost(key);
  const agency = await Agency.findOne({
    where: {
      isActive: true,
      websiteEnabled: true,
      [Op.or]: [
        { id: key },
        { subdomain: key },
        { customDomain: normalized },
      ],
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

module.exports = {
  getInfo,
  listPackages,
  getPackage,
  listProperties,
  getProperty,
  submitEnquiry,
  allowDomain,
};
