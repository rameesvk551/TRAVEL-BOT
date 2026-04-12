const path = require('path');
const { Op } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Package } = require('../models');
const { v2: cloudinary } = require('cloudinary');

const TOTAL_RECORDS = 50;

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

function pick(arr, index) {
  return arr[index % arr.length];
}

function buildListing(seed) {
  const cities = ['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Kochi', 'Noida', 'Gurugram'];
  const localities = ['City Center', 'Tech Park Zone', 'Lakeview', 'Green Avenue', 'Downtown', 'Palm Residency'];
  const propertyTypes = ['Studio', '1BHK', '2BHK', '3BHK', 'Villa', 'Penthouse'];
  const furnishing = ['Unfurnished', 'Semi-furnished', 'Fully furnished'];
  const amenities = ['Power Backup', 'Lift', 'Parking', 'Gym', 'Clubhouse', '24x7 Security', 'Garden', 'Pool'];

  const city = pick(cities, seed);
  const locality = pick(localities, seed + 2);
  const type = pick(propertyTypes, seed + 1);
  const furnish = pick(furnishing, seed + 3);

  const bhk = type.includes('Studio') ? 1 : parseInt(type[0], 10) || 2;
  const areaSqFt = 550 + (seed % 12) * 120 + bhk * 100;
  const basePriceRupees = 3500000 + seed * 175000 + bhk * 250000;

  return {
    name: `RE Listing ${seed + 1} - ${type} in ${city}`,
    duration: `${type} • ${areaSqFt} sq ft • ${furnish}`,
    destinations: [city, locality],
    inclusions: [
      `Property Type: ${type}`,
      `Carpet Area: ${areaSqFt} sq ft`,
      `Bathrooms: ${bhk}`,
      `Furnishing: ${furnish}`,
      `RERA: Available`,
      `Amenities: ${amenities.slice(seed % 3, (seed % 3) + 3).join(', ')}`,
    ],
    exclusions: [
      'Registration charges',
      'Legal verification charges',
      'Maintenance deposit',
    ],
    basePrice: basePriceRupees * 100,
    itinerary: [
      { day: 1, title: 'Site Visit', description: `Visit ${locality}, ${city}` },
      { day: 2, title: 'Documentation Review', description: 'Review title and agreement documents' },
      { day: 3, title: 'Booking Discussion', description: 'Finalize offer and payment schedule' },
    ],
    isActive: true,
    city,
    type,
    areaSqFt,
  };
}

function makeListingSvg(listing, index) {
  const colors = ['#0f766e', '#1d4ed8', '#9a3412', '#166534', '#7c3aed'];
  const accent = colors[index % colors.length];

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="${accent}" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect x="80" y="80" width="1440" height="740" rx="24" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" />
  <text x="140" y="220" fill="#ffffff" font-size="68" font-family="Arial, sans-serif" font-weight="700">${listing.type} • ${listing.areaSqFt} sq ft</text>
  <text x="140" y="320" fill="#e2e8f0" font-size="44" font-family="Arial, sans-serif">${listing.destinations[1]}, ${listing.city}</text>
  <text x="140" y="420" fill="#f8fafc" font-size="54" font-family="Arial, sans-serif" font-weight="700">₹ ${(listing.basePrice / 100).toLocaleString('en-IN')}</text>
  <text x="140" y="500" fill="#cbd5e1" font-size="34" font-family="Arial, sans-serif">Demo seeded property image</text>
</svg>`;

  return Buffer.from(svg).toString('base64');
}

async function uploadListingImage(listing, index, agencyId) {
  const folderRoot = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${folderRoot}/real-estate-seed/${agencyId}`;
  const base64Svg = makeListingSvg(listing, index);

  const result = await cloudinary.uploader.upload(`data:image/svg+xml;base64,${base64Svg}`, {
    folder,
    public_id: `re-listing-${String(index + 1).padStart(3, '0')}`,
    overwrite: true,
    resource_type: 'image',
  });

  return result.secure_url;
}

async function seedRealEstateData() {
  ensureCloudinaryConfig();

  await sequelize.authenticate();
  const agency = await Agency.findOne({ order: [['createdAt', 'ASC']] });

  if (!agency) {
    throw new Error('No agency found. Create an agency/user first, then run seeding.');
  }

  console.log(`Using agency: ${agency.name} (${agency.id})`);

  await Package.destroy({
    where: {
      agencyId: agency.id,
      name: { [Op.like]: 'RE Listing %' },
    },
  });

  const rows = [];
  for (let i = 0; i < TOTAL_RECORDS; i += 1) {
    const listing = buildListing(i);
    const imageUrl = await uploadListingImage(listing, i, agency.id);

    rows.push({
      agencyId: agency.id,
      name: listing.name,
      duration: listing.duration,
      destinations: listing.destinations,
      inclusions: listing.inclusions,
      exclusions: listing.exclusions,
      basePrice: listing.basePrice,
      imageUrl,
      itinerary: listing.itinerary,
      isActive: true,
    });

    console.log(`Uploaded ${i + 1}/${TOTAL_RECORDS}: ${listing.name}`);
  }

  await Package.bulkCreate(rows);
  console.log(`Seed complete: ${rows.length} real-estate dummy records created.`);
}

if (require.main === module) {
  seedRealEstateData()
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

module.exports = { seedRealEstateData };