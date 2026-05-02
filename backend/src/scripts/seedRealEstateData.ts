const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Property } = require('../models');
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

function buildListing(seed) {
  const cities = ['Goa', 'Munnar', 'Jaipur', 'Udaipur', 'Coorg', 'Ooty', 'Shimla', 'Manali', 'Srinagar', 'Wayanad'];
  const localities = ['Beachfront', 'Lake View', 'City Center', 'Hillside', 'Riverfront', 'Tea Estate', 'Heritage Quarter', 'Forest Edge'];
  const propertyTypes = ['Hotel', 'Resort', 'Villa', 'Homestay', 'Boutique Stay', 'Apartment'];
  const amenities = ['Breakfast', 'Airport Transfer', 'Pool', 'Spa', 'Wi-Fi', 'Parking', 'Restaurant', 'Bonfire', 'Mountain View', 'Sea View'];

  const city = pick(cities, seed);
  const locality = pick(localities, seed + 2);
  const propertyType = pick(propertyTypes, seed + 1);
  const pricePerNightRupees = 3200 + (seed % 15) * 850 + ((seed + 3) % 4) * 400;
  const selectedAmenities = [0, 1, 2, 3].map((offset) => pick(amenities, seed + offset));

  return {
    name: `Wayon Stay ${seed + 1} - ${propertyType} ${city}`,
    propertyType,
    location: `${locality}, ${city}`,
    address: `${10 + seed}, ${locality} Road, ${city}, India`,
    amenities: selectedAmenities,
    description: `${propertyType} stay in ${city} with ${selectedAmenities.slice(0, 3).join(', ').toLowerCase()} and smooth access to local sightseeing.`,
    pricePerNight: pricePerNightRupees * 100,
    city,
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
  <text x="140" y="220" fill="#ffffff" font-size="68" font-family="Arial, sans-serif" font-weight="700">${listing.propertyType} stay in ${listing.city}</text>
  <text x="140" y="320" fill="#e2e8f0" font-size="44" font-family="Arial, sans-serif">${listing.location}</text>
  <text x="140" y="420" fill="#f8fafc" font-size="54" font-family="Arial, sans-serif" font-weight="700">INR ${(listing.pricePerNight / 100).toLocaleString('en-IN')} / night</text>
  <text x="140" y="500" fill="#cbd5e1" font-size="34" font-family="Arial, sans-serif">Seeded property image for Wayon Travels</text>
</svg>`;

  return Buffer.from(svg).toString('base64');
}

async function uploadListingImage(listing, index, agencyId) {
  const folderRoot = process.env.CLOUDINARY_FOLDER || 'travel-bot/packages';
  const folder = `${folderRoot}/property-seed/${agencyId}`;
  const base64Svg = makeListingSvg(listing, index);

  const result = await cloudinary.uploader.upload(`data:image/svg+xml;base64,${base64Svg}`, {
    folder,
    public_id: `wayon-property-${String(index + 1).padStart(3, '0')}`,
    overwrite: true,
    resource_type: 'image',
  });

  return result.secure_url;
}

async function seedRealEstateData() {
  ensureCloudinaryConfig();

  const args = parseArgs();
  const agencyName = args.agencyName || process.env.SEED_AGENCY_NAME || 'Wayon Travels';

  await sequelize.authenticate();
  const agency = await Agency.findOne({ where: { name: agencyName } });

  if (!agency) {
    throw new Error(`Agency "${agencyName}" not found. Create an agency/user first, then run seeding.`);
  }

  console.log(`Using agency: ${agency.name} (${agency.id})`);

  await Property.destroy({ where: { agencyId: agency.id } });

  const rows = [];
  for (let index = 0; index < TOTAL_RECORDS; index += 1) {
    const listing = buildListing(index);
    const imageUrl = await uploadListingImage(listing, index, agency.id);

    rows.push({
      agencyId: agency.id,
      name: listing.name,
      propertyType: listing.propertyType,
      location: listing.location,
      address: listing.address,
      amenities: listing.amenities,
      description: listing.description,
      pricePerNight: listing.pricePerNight,
      imageUrl,
      images: [imageUrl],
      isActive: true,
    });

    console.log(`Uploaded ${index + 1}/${TOTAL_RECORDS}: ${listing.name}`);
  }

  await Property.bulkCreate(rows);
  console.log(`Seed complete: ${rows.length} property records created for ${agency.name}.`);
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
