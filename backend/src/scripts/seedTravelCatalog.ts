const path = require('path');
const { Op } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Visa, Service, Cruise } = require('../models');
const { ensureProductionSchema } = require('../services/schemaBootstrap');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function ensureCloudinaryConfig() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary env vars are required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--agency' && args[index + 1]) {
      parsed.agencyName = args[index + 1];
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

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rupees(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`;
}

function buildSvg({ title, subtitle, price, tag, accent, subAccent }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="${subAccent}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="72" y="72" width="1456" height="756" rx="34" fill="rgba(15,23,42,0.34)" stroke="rgba(255,255,255,0.30)" />
  <text x="128" y="190" fill="#ffffff" font-size="72" font-family="Arial, sans-serif" font-weight="700">${escapeXml(title)}</text>
  <text x="128" y="280" fill="#e2e8f0" font-size="38" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>
  <text x="128" y="420" fill="#ffffff" font-size="58" font-family="Arial, sans-serif" font-weight="700">${escapeXml(price)}</text>
  <text x="128" y="540" fill="#dbeafe" font-size="34" font-family="Arial, sans-serif">${escapeXml(tag)}</text>
  <text x="128" y="715" fill="#f8fafc" font-size="30" font-family="Arial, sans-serif">Seeded catalog image for Wayon Travels</text>
</svg>`;
}

async function uploadSeedImage(kind, name, agencyId, image) {
  const folderRoot = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${folderRoot}/${kind}-seed/${agencyId}`;
  const base64Svg = Buffer.from(buildSvg(image)).toString('base64');

  const result = await cloudinary.uploader.upload(`data:image/svg+xml;base64,${base64Svg}`, {
    folder,
    public_id: slugify(name),
    overwrite: true,
    resource_type: 'image',
  });

  return result.secure_url;
}

function getVisaSeeds() {
  return [
    ['United Arab Emirates', 'Tourist', 6999, '3-5 working days', '60 days', '#0f766e', '#67e8f9'],
    ['Saudi Arabia', 'Tourist', 12999, '5-7 working days', '90 days', '#166534', '#bbf7d0'],
    ['Oman', 'Tourist', 7999, '4-6 working days', '30 days', '#0c4a6e', '#7dd3fc'],
    ['Qatar', 'Tourist', 8999, '4-7 working days', '30 days', '#7c2d12', '#fdba74'],
    ['Singapore', 'Tourist', 8499, '5-8 working days', '30 days', '#1d4ed8', '#bfdbfe'],
    ['Malaysia', 'Tourist', 5499, '3-5 working days', '30 days', '#047857', '#a7f3d0'],
    ['Thailand', 'Tourist', 6499, '4-6 working days', '60 days', '#be123c', '#fecdd3'],
    ['Vietnam', 'Tourist', 5999, '4-7 working days', '30 days', '#15803d', '#86efac'],
    ['Indonesia', 'Tourist', 7499, '5-7 working days', '30 days', '#991b1b', '#fecaca'],
    ['Turkey', 'Tourist', 10999, '3-5 working days', '180 days', '#92400e', '#fde68a'],
    ['Schengen', 'Tourist', 18999, '15-21 working days', '90 days', '#1f2937', '#cbd5e1'],
    ['United Kingdom', 'Tourist', 21999, '15-25 working days', '6 months', '#312e81', '#c7d2fe'],
    ['United States', 'Tourist', 24999, 'Appointment based', '10 years', '#1e3a8a', '#93c5fd'],
    ['Canada', 'Tourist', 19999, '20-35 working days', '10 years', '#991b1b', '#fca5a5'],
    ['Australia', 'Tourist', 17499, '20-30 working days', '1 year', '#0369a1', '#bae6fd'],
  ].map(([country, visaType, priceRupees, processingTime, validityPeriod, accent, subAccent]) => ({
    country,
    visaType,
    price: priceRupees * 100,
    processingTime,
    validityPeriod,
    requiredDocuments: ['Passport copy', 'Photo', 'Bank statement', 'Travel itinerary'],
    description: `${country} ${visaType.toLowerCase()} visa support with document review, application filing, and status follow-up.`,
    eligibilityNotes: 'Subject to embassy approval and current destination rules.',
    accent,
    subAccent,
  }));
}

function getServiceSeeds() {
  return [
    ['Flight Ticketing', 'TICKETING', 'plane', 750, 'FAST ISSUE'],
    ['Train Ticket Booking', 'TICKETING', 'train', 350, 'RAIL DESK'],
    ['Hotel Reservation Desk', 'OTHER', 'hotel', 999, 'STAY SUPPORT'],
    ['Airport Transfer', 'OTHER', 'car', 1499, 'CITY RIDES'],
    ['Travel Insurance', 'INSURANCE', 'shield', 899, 'COVER PLAN'],
    ['Passport Assistance', 'DOCUMENTATION', 'document', 2499, 'DOC HELP'],
    ['Visa File Review', 'VISA', 'stamp', 1299, 'VISA CHECK'],
    ['Certificate Attestation', 'DOCUMENTATION', 'file', 3499, 'ATTESTATION'],
    ['Forex Card Assistance', 'OTHER', 'globe', 499, 'FOREX DESK'],
    ['Umrah Ground Services', 'OTHER', 'globe', 2999, 'PILGRIM CARE'],
    ['Honeymoon Add-ons', 'OTHER', 'hotel', 1999, 'SPECIAL SETUP'],
    ['MICE Travel Desk', 'TICKETING', 'plane', 4999, 'GROUP DESK'],
    ['Cruise Booking Support', 'TICKETING', 'globe', 1499, 'CRUISE DESK'],
    ['Document Translation', 'DOCUMENTATION', 'document', 1799, 'TRANSLATION'],
    ['24/7 Trip Assistance', 'OTHER', 'shield', 999, 'HELP DESK'],
  ].map(([name, category, icon, priceRupees, tag], index) => {
    const colors = [
      ['#0f766e', '#99f6e4'],
      ['#1d4ed8', '#bfdbfe'],
      ['#92400e', '#fed7aa'],
      ['#7c3aed', '#ddd6fe'],
      ['#be123c', '#fecdd3'],
    ][index % 5];

    return {
      name,
      category,
      icon,
      basePrice: priceRupees * 100,
      pricingType: index % 4 === 0 ? 'STARTING_FROM' : 'FIXED',
      description: `${name} handled by the Wayon operations team with clear timelines and customer updates.`,
      features: ['Dedicated coordinator', 'Status updates', 'Document checklist', 'Agency support'],
      displayOrder: index,
      tag,
      accent: colors[0],
      subAccent: colors[1],
    };
  });
}

function getCruiseSeeds() {
  return [
    ['Arabian Gulf Weekend', 'MSC Cruises', 'Dubai', ['Dubai', 'Doha', 'Bahrain'], 72999, 320],
    ['Singapore Penang Escape', 'Royal Caribbean', 'Singapore', ['Singapore', 'Penang', 'Phuket'], 84999, 420],
    ['Mediterranean Highlights', 'Costa Cruises', 'Rome', ['Rome', 'Barcelona', 'Marseille'], 156999, 650],
    ['Greek Islands Dream', 'Celestyal Cruises', 'Athens', ['Athens', 'Mykonos', 'Santorini'], 139999, 520],
    ['Norwegian Fjords', 'Norwegian Cruise Line', 'Bergen', ['Bergen', 'Geiranger', 'Flam'], 188999, 480],
    ['Alaska Glacier Route', 'Princess Cruises', 'Seattle', ['Seattle', 'Juneau', 'Skagway'], 214999, 700],
    ['Maldives Yacht Break', 'Premium Yacht', 'Male', ['Male', 'Ari Atoll', 'Baa Atoll'], 119999, 80],
    ['Red Sea Discovery', 'MSC Cruises', 'Jeddah', ['Jeddah', 'Yanbu', 'Aqaba'], 98999, 360],
    ['Japan Sakura Cruise', 'Celebrity Cruises', 'Yokohama', ['Yokohama', 'Kobe', 'Nagasaki'], 199999, 560],
    ['Vietnam Halong Bay', 'Heritage Line', 'Hanoi', ['Halong Bay', 'Lan Ha Bay'], 66999, 120],
    ['Thailand Island Cruise', 'Star Clippers', 'Phuket', ['Phuket', 'Krabi', 'Phi Phi'], 92999, 180],
    ['Australia Reef Cruise', 'P and O Cruises', 'Sydney', ['Sydney', 'Cairns', 'Airlie Beach'], 174999, 620],
    ['Baltic Capitals', 'MSC Cruises', 'Copenhagen', ['Copenhagen', 'Stockholm', 'Tallinn'], 169999, 540],
    ['Caribbean Blue Water', 'Royal Caribbean', 'Miami', ['Miami', 'Nassau', 'Cozumel'], 149999, 610],
    ['Kerala Backwater Luxury', 'Private Houseboat', 'Alleppey', ['Alleppey', 'Kumarakom'], 42999, 12],
  ].map(([name, cruiseLine, departurePort, destinations, priceRupees, capacity], index) => {
    const colors = [
      ['#0c4a6e', '#7dd3fc'],
      ['#1d4ed8', '#93c5fd'],
      ['#312e81', '#c7d2fe'],
      ['#0f766e', '#99f6e4'],
      ['#92400e', '#fde68a'],
    ][index % 5];

    return {
      name,
      cruiseLine,
      departurePort,
      destinations,
      duration: `${3 + (index % 5)} Nights ${4 + (index % 5)} Days`,
      cabinTypes: ['Interior', 'Ocean View', 'Balcony', 'Suite'],
      inclusions: ['Cabin stay', 'All meals onboard', 'Port taxes', 'Cruise entertainment'],
      exclusions: ['Flights', 'Visa charges', 'Shore excursions', 'Personal expenses'],
      basePrice: priceRupees * 100,
      departureDate: new Date(Date.now() + (30 + index * 12) * 24 * 60 * 60 * 1000),
      capacity,
      summary: `${name} cruise with curated ports, onboard dining, and smooth planning support.`,
      accent: colors[0],
      subAccent: colors[1],
    };
  });
}

async function resolveAgency(agencyName) {
  return Agency.findOne({ where: { name: agencyName } });
}

async function seedTravelCatalog() {
  ensureCloudinaryConfig();

  const args = parseArgs();
  const agencyName = args.agencyName || process.env.SEED_AGENCY_NAME || 'Wayon Travels';

  await sequelize.authenticate();
  await ensureProductionSchema();

  const agency = await resolveAgency(agencyName);
  if (!agency) {
    throw new Error(`Agency "${agencyName}" not found. Create the agency first, then rerun the seeder.`);
  }

  const visaSeeds = getVisaSeeds();
  const serviceSeeds = getServiceSeeds();
  const cruiseSeeds = getCruiseSeeds();

  console.log(`Using agency: ${agency.name} (${agency.id})`);
  console.log('Preparing 15 visas, 15 services, and 15 cruises...');

  await Visa.destroy({ where: { agencyId: agency.id, country: { [Op.in]: visaSeeds.map((item) => item.country) } } });
  await Service.destroy({ where: { agencyId: agency.id, name: { [Op.in]: serviceSeeds.map((item) => item.name) } } });
  await Cruise.destroy({ where: { agencyId: agency.id, name: { [Op.in]: cruiseSeeds.map((item) => item.name) } } });

  const visaRows = [];
  for (let index = 0; index < visaSeeds.length; index += 1) {
    const visa = visaSeeds[index];
    const imageUrl = await uploadSeedImage('visa', `${visa.country}-${visa.visaType}`, agency.id, {
      title: `${visa.country} Visa`,
      subtitle: `${visa.visaType} | ${visa.processingTime}`,
      price: rupees(visa.price / 100),
      tag: `Validity ${visa.validityPeriod} | ${visa.requiredDocuments.length} core documents`,
      accent: visa.accent,
      subAccent: visa.subAccent,
    });

    visaRows.push({
      agencyId: agency.id,
      country: visa.country,
      visaType: visa.visaType,
      price: visa.price,
      processingTime: visa.processingTime,
      validityPeriod: visa.validityPeriod,
      requiredDocuments: visa.requiredDocuments,
      description: visa.description,
      imageUrl,
      eligibilityNotes: visa.eligibilityNotes,
      isActive: true,
    });
    console.log(`Visa image ${index + 1}/15: ${visa.country}`);
  }
  await Visa.bulkCreate(visaRows);

  const serviceRows = [];
  for (let index = 0; index < serviceSeeds.length; index += 1) {
    const service = serviceSeeds[index];
    const imageUrl = await uploadSeedImage('service', service.name, agency.id, {
      title: service.name,
      subtitle: `${service.category} | ${service.pricingType.replace('_', ' ')}`,
      price: service.pricingType === 'STARTING_FROM' ? `From ${rupees(service.basePrice / 100)}` : rupees(service.basePrice / 100),
      tag: service.tag,
      accent: service.accent,
      subAccent: service.subAccent,
    });

    serviceRows.push({
      agencyId: agency.id,
      name: service.name,
      category: service.category,
      description: service.description,
      icon: service.icon,
      basePrice: service.basePrice,
      imageUrl,
      pricingType: service.pricingType,
      features: service.features,
      isActive: true,
      displayOrder: service.displayOrder,
    });
    console.log(`Service image ${index + 1}/15: ${service.name}`);
  }
  await Service.bulkCreate(serviceRows);

  const cruiseRows = [];
  for (let index = 0; index < cruiseSeeds.length; index += 1) {
    const cruise = cruiseSeeds[index];
    const imageUrl = await uploadSeedImage('cruise', cruise.name, agency.id, {
      title: cruise.name,
      subtitle: `${cruise.cruiseLine} | ${cruise.duration}`,
      price: rupees(cruise.basePrice / 100),
      tag: `${cruise.departurePort} to ${cruise.destinations.slice(-1)[0]} | ${cruise.capacity} seats`,
      accent: cruise.accent,
      subAccent: cruise.subAccent,
    });

    cruiseRows.push({
      agencyId: agency.id,
      name: cruise.name,
      cruiseLine: cruise.cruiseLine,
      departurePort: cruise.departurePort,
      destinations: cruise.destinations,
      duration: cruise.duration,
      cabinTypes: cruise.cabinTypes,
      inclusions: cruise.inclusions,
      exclusions: cruise.exclusions,
      basePrice: cruise.basePrice,
      imageUrl,
      departureDate: cruise.departureDate,
      capacity: cruise.capacity,
      summary: cruise.summary,
      isActive: true,
    });
    console.log(`Cruise image ${index + 1}/15: ${cruise.name}`);
  }
  await Cruise.bulkCreate(cruiseRows);

  console.log(`Seed complete: ${visaRows.length} visas, ${serviceRows.length} services, ${cruiseRows.length} cruises created for ${agency.name}.`);
}

if (require.main === module) {
  seedTravelCatalog()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seeding failed:', err.message);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = { seedTravelCatalog };
