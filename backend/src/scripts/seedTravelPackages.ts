const path = require('path');
const { Op } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Package } = require('../models');
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

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--agency' && args[index + 1]) {
      parsed.agencyName = args[index + 1];
      index += 1;
    } else if (arg === '--limit' && args[index + 1]) {
      parsed.limit = parseInt(args[index + 1], 10);
      index += 1;
    } else if (arg === '--category' && args[index + 1]) {
      parsed.category = String(args[index + 1]).toUpperCase();
      index += 1;
    }
  }

  return parsed;
}

function makeSeed(template, category) {
  const [name, destinations, basePriceRupees, accent, subAccent, tagline] = template;
  const duration = `${3 + (destinations.length % 4)} Nights ${4 + (destinations.length % 4)} Days`;

  return {
    name,
    category,
    duration,
    destinations,
    basePriceRupees,
    accent,
    subAccent,
    tagline,
    summary: `${tagline}. Ideal for ${category === 'DOMESTIC' ? 'Indian getaways' : 'international holiday planning'} with Wayon Travels.`,
    inclusions: [
      `${duration} hotel stay with breakfast`,
      'Airport or station transfers',
      `${destinations[0]} sightseeing support`,
      'Curated local experiences',
      'Trip coordination assistance',
    ],
    exclusions: [
      category === 'INTERNATIONAL' ? 'Visa charges' : 'Airfare or train fare',
      'Lunch and dinner unless specified',
      'Personal expenses and optional add-ons',
    ],
    itinerary: [
      {
        day: 1,
        title: `Arrival in ${destinations[1] || destinations[0]}`,
        description: `Arrival, transfer, and relaxed check-in for your ${destinations[0]} trip.`,
        activities: ['Transfer', 'Hotel check-in', 'Leisure time'],
      },
      {
        day: 2,
        title: `${destinations[0]} Highlights`,
        description: `Explore the signature experiences around ${destinations[1] || destinations[0]}.`,
        activities: ['Sightseeing', 'Photo stops', 'Local recommendations'],
      },
      {
        day: 3,
        title: 'Flexible Discovery Day',
        description: 'Use the day for leisure, upgrades, or additional local experiences.',
        activities: ['Leisure', 'Optional activities', 'Shopping or cafes'],
      },
      {
        day: 4,
        title: 'Departure',
        description: 'Checkout and onward transfer with support from the team.',
        activities: ['Breakfast', 'Checkout', 'Transfer'],
      },
    ],
  };
}

function getPackageSeeds() {
  const domesticTemplates = [
    ['Goa Beach Escape', ['Goa', 'Candolim', 'Baga'], 28999, '#0f766e', '#67e8f9', 'Beach stays, nightlife, and sunset cruises'],
    ['Goa Couple Retreat', ['Goa', 'South Goa', 'Colva'], 42999, '#9d174d', '#f9a8d4', 'Romantic beach resort with candlelight dinner'],
    ['Himachal Mountain Escape', ['Himachal', 'Manali', 'Shimla'], 37999, '#166534', '#bbf7d0', 'Cool weather, mountain roads, and scenic stays'],
    ['Kashmir Valley Delight', ['Kashmir', 'Srinagar', 'Gulmarg', 'Pahalgam'], 48999, '#0369a1', '#bae6fd', 'Houseboats, valleys, and alpine views'],
    ['Kerala Backwater Calm', ['Kerala', 'Alleppey', 'Munnar'], 35999, '#0f766e', '#99f6e4', 'Houseboat nights and hill-station mornings'],
    ['Rajasthan Royal Circuit', ['Rajasthan', 'Jaipur', 'Jodhpur', 'Udaipur'], 45999, '#b45309', '#fde68a', 'Forts, palaces, and heritage stays'],
    ['Andaman Island Escape', ['Andaman', 'Port Blair', 'Havelock'], 52999, '#1d4ed8', '#93c5fd', 'Clear water beaches and island hopping'],
    ['Leh Ladakh Adventure', ['Ladakh', 'Leh', 'Nubra', 'Pangong'], 58999, '#475569', '#cbd5e1', 'High-altitude roads and iconic lake views'],
    ['Sikkim Scenic Trails', ['Sikkim', 'Gangtok', 'Pelling'], 41999, '#15803d', '#86efac', 'Himalayan views with easy-paced sightseeing'],
    ['Coorg Coffee Retreat', ['Coorg', 'Madikeri', 'Dubare'], 29999, '#166534', '#d9f99d', 'Estate stays, waterfalls, and fresh mountain air'],
    ['Ooty Coonoor Classic', ['Ooty', 'Coonoor', 'Nilgiris'], 27999, '#0f766e', '#ccfbf1', 'Toy train charm and tea garden drives'],
    ['Munnar Tea Escape', ['Munnar', 'Thekkady', 'Alleppey'], 38999, '#14532d', '#bbf7d0', 'Tea gardens, spice trails, and backwaters'],
    ['Darjeeling Hills Break', ['Darjeeling', 'Kalimpong'], 31999, '#1d4ed8', '#bfdbfe', 'Toy train views and cool hill station days'],
    ['Rishikesh Mussoorie Duo', ['Uttarakhand', 'Rishikesh', 'Mussoorie'], 33499, '#0f766e', '#a7f3d0', 'Riverfront calm and hill-town evenings'],
    ['Kutch White Desert Trip', ['Gujarat', 'Bhuj', 'Rann of Kutch'], 36999, '#92400e', '#fed7aa', 'Salt desert sunsets and cultural nights'],
    ['Meghalaya Waterfall Trail', ['Meghalaya', 'Shillong', 'Cherrapunji'], 44999, '#0f766e', '#99f6e4', 'Cloud forests, waterfalls, and caves'],
    ['Temple Trail Tamil Nadu', ['Tamil Nadu', 'Madurai', 'Rameswaram', 'Kanyakumari'], 33999, '#7c2d12', '#fdba74', 'Sacred circuits with coastal stops'],
    ['Lakshadweep Lagoon Days', ['Lakshadweep', 'Agatti', 'Bangaram'], 61999, '#0c4a6e', '#7dd3fc', 'Lagoon leisure and barefoot island time'],
    ['Pondicherry Coastal Escape', ['Pondicherry', 'Auroville'], 26999, '#be123c', '#fecdd3', 'French quarters, cafes, and beach drives'],
    ['Varanasi Spiritual Circuit', ['Varanasi', 'Sarnath'], 24999, '#7c2d12', '#fdba74', 'Ghat ceremonies and timeless heritage'],
  ];

  const internationalTemplates = [
    ['Bali Island Bliss', ['Bali', 'Ubud', 'Seminyak'], 67999, '#1d4ed8', '#93c5fd', 'Rice terraces, temples, and island sunsets'],
    ['Bali Honeymoon Luxe', ['Bali', 'Nusa Dua', 'Ubud'], 112999, '#7c3aed', '#ddd6fe', 'Private villa stay with floating breakfast'],
    ['Paris City Romance', ['Paris', 'Eiffel Area', 'Seine'], 148999, '#1f2937', '#fca5a5', 'Classic Paris landmarks with Seine cruise'],
    ['Paris Family Explorer', ['Paris', 'Disneyland', 'Seine'], 172999, '#be123c', '#fecdd3', 'Family-friendly city stay with Disneyland day'],
    ['Dubai Desert Escape', ['Dubai', 'Downtown Dubai', 'Desert Safari'], 59999, '#b45309', '#fde68a', 'City lights, Burj views, and desert safari'],
    ['Thailand Party Break', ['Thailand', 'Phuket', 'Patong'], 51999, '#0f766e', '#99f6e4', 'Island fun, nightlife, and sea-view stays'],
    ['Thailand Family Fun', ['Thailand', 'Bangkok', 'Pattaya'], 68999, '#1d4ed8', '#bfdbfe', 'Bangkok highlights with a smooth family pace'],
    ['Maldives Water Villa Escape', ['Maldives', 'Male', 'Private Island'], 135999, '#0f766e', '#a7f3d0', 'Luxury water villa with turquoise lagoon views'],
    ['Singapore City Lights', ['Singapore', 'Marina Bay', 'Sentosa'], 94999, '#111827', '#fca5a5', 'Clean city escapes, skyline views, and Sentosa fun'],
    ['Swiss Alps Panorama', ['Switzerland', 'Lucerne', 'Interlaken'], 189999, '#1d4ed8', '#dbeafe', 'Mountain rail journeys and postcard-perfect towns'],
    ['Turkey Cappadocia Dream', ['Turkey', 'Istanbul', 'Cappadocia'], 104999, '#7c2d12', '#fdba74', 'Balloon skies, bazaars, and heritage stays'],
    ['Vietnam Discovery Route', ['Vietnam', 'Hanoi', 'Halong Bay', 'Da Nang'], 82999, '#0f766e', '#99f6e4', 'Old quarters, cruises, and coastal energy'],
    ['Japan Sakura Cities', ['Japan', 'Tokyo', 'Kyoto', 'Osaka'], 184999, '#be123c', '#fecdd3', 'City contrast, tradition, and seasonal blossoms'],
    ['Mauritius Blue Lagoon', ['Mauritius', 'Grand Baie', 'Belle Mare'], 129999, '#0c4a6e', '#7dd3fc', 'Indian Ocean beaches and luxury resort time'],
    ['Sri Lanka Coastal Loop', ['Sri Lanka', 'Colombo', 'Bentota', 'Kandy'], 71999, '#166534', '#bbf7d0', 'Easy island circuit with coast and culture'],
    ['Georgia Tbilisi Escape', ['Georgia', 'Tbilisi', 'Gudauri'], 88999, '#1f2937', '#cbd5e1', 'Old-town charm and mountain scenery'],
    ['Azerbaijan City And Flame', ['Azerbaijan', 'Baku', 'Gabala'], 92999, '#92400e', '#fdba74', 'Modern skyline mixed with mountain breaks'],
    ['Italy Classic Trio', ['Italy', 'Rome', 'Florence', 'Venice'], 196999, '#991b1b', '#fecaca', 'Historic cities, art, and canal evenings'],
    ['Egypt Nile Discovery', ['Egypt', 'Cairo', 'Luxor', 'Aswan'], 118999, '#b45309', '#fde68a', 'Pyramids, temples, and Nile-side experiences'],
    ['Australia East Coast Highlights', ['Australia', 'Sydney', 'Gold Coast', 'Melbourne'], 214999, '#1d4ed8', '#93c5fd', 'Skyline cities and iconic coastal sights'],
  ];

  return [
    ...domesticTemplates.map((template) => makeSeed(template, 'DOMESTIC')),
    ...internationalTemplates.map((template) => makeSeed(template, 'INTERNATIONAL')),
  ];
}

function makePackageSvg(pkg) {
  const primaryDestination = pkg.destinations[0];
  const price = `INR ${pkg.basePriceRupees.toLocaleString('en-IN')} / person`;
  const highlight1 = pkg.inclusions[0] || 'Curated stay';
  const highlight2 = pkg.inclusions[1] || 'Guided sightseeing';

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${pkg.accent}" />
      <stop offset="100%" stop-color="${pkg.subAccent}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="64" y="64" width="1472" height="772" rx="36" fill="rgba(15,23,42,0.30)" stroke="rgba(255,255,255,0.28)" />
  <text x="120" y="190" fill="#ffffff" font-size="72" font-family="Arial, sans-serif" font-weight="700">${pkg.name}</text>
  <text x="120" y="270" fill="#e2e8f0" font-size="38" font-family="Arial, sans-serif">${primaryDestination} | ${pkg.duration}</text>
  <text x="120" y="360" fill="#f8fafc" font-size="42" font-family="Arial, sans-serif">${pkg.tagline}</text>
  <text x="120" y="470" fill="#ffffff" font-size="58" font-family="Arial, sans-serif" font-weight="700">${price}</text>
  <text x="120" y="570" fill="#dbeafe" font-size="32" font-family="Arial, sans-serif">Includes: ${highlight1}</text>
  <text x="120" y="625" fill="#dbeafe" font-size="32" font-family="Arial, sans-serif">Plus: ${highlight2}</text>
  <text x="120" y="725" fill="#f8fafc" font-size="30" font-family="Arial, sans-serif">Seeded package image for Wayon Travels</text>
</svg>`;
}

async function uploadPackageImage(pkg, agencyId) {
  const folderRoot = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${folderRoot}/travel-seed/${agencyId}`;
  const base64Svg = Buffer.from(makePackageSvg(pkg)).toString('base64');

  const result = await cloudinary.uploader.upload(`data:image/svg+xml;base64,${base64Svg}`, {
    folder,
    public_id: slugify(pkg.name),
    overwrite: true,
    resource_type: 'image',
  });

  return result.secure_url;
}

async function resolveAgency(agencyName) {
  if (agencyName) {
    return Agency.findOne({ where: { name: agencyName } });
  }

  return Agency.findOne({ order: [['createdAt', 'ASC']] });
}

async function seedTravelPackages() {
  ensureCloudinaryConfig();

  const args = parseArgs();
  const agencyName = args.agencyName || process.env.SEED_AGENCY_NAME || 'Wayon Travels';
  const requestedCategory = ['DOMESTIC', 'INTERNATIONAL'].includes(args.category) ? args.category : null;

  await sequelize.authenticate();
  const agency = await resolveAgency(agencyName);

  if (!agency) {
    throw new Error(`Agency "${agencyName}" not found. Create the agency first, then rerun the seeder.`);
  }

  const allSeeds = getPackageSeeds();
  const categorySeeds = requestedCategory ? allSeeds.filter((item) => item.category === requestedCategory) : allSeeds;
  const limit = Number.isInteger(args.limit) && args.limit > 0 ? args.limit : categorySeeds.length;
  const seeds = categorySeeds.slice(0, limit);
  const packageNames = seeds.map((item) => item.name);

  console.log(`Using agency: ${agency.name} (${agency.id})`);
  console.log(`Preparing ${seeds.length} travel packages${requestedCategory ? ` in ${requestedCategory}` : ''}...`);

  await Package.destroy({
    where: {
      agencyId: agency.id,
      name: { [Op.in]: packageNames },
    },
  });

  const rows = [];
  for (let index = 0; index < seeds.length; index += 1) {
    const pkg = seeds[index];
    const imageUrl = await uploadPackageImage(pkg, agency.id);

    rows.push({
      agencyId: agency.id,
      name: pkg.name,
      category: pkg.category,
      duration: pkg.duration,
      destinations: pkg.destinations,
      inclusions: pkg.inclusions,
      exclusions: pkg.exclusions,
      basePrice: pkg.basePriceRupees * 100,
      imageUrl,
      summary: pkg.summary,
      itinerary: pkg.itinerary,
      isActive: true,
    });

    console.log(`Uploaded ${index + 1}/${seeds.length}: ${pkg.name}`);
  }

  await Package.bulkCreate(rows);
  console.log(`Seed complete: ${rows.length} travel packages created for ${agency.name}.`);
}

if (require.main === module) {
  seedTravelPackages()
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

module.exports = { seedTravelPackages };
