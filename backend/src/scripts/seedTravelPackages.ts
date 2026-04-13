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
    }
  }

  return parsed;
}

function getPackageSeeds() {
  return [
    {
      name: 'Goa Beach Escape',
      duration: '3 Nights 4 Days',
      destinations: ['Goa', 'Candolim', 'Baga'],
      basePriceRupees: 28999,
      accent: '#0f766e',
      subAccent: '#67e8f9',
      tagline: 'Beach stays, nightlife, and sunset cruises',
      inclusions: [
        '3 nights hotel stay with breakfast',
        'Airport pickup and drop',
        'North Goa sightseeing',
        'Sunset cruise experience',
        'Scooter rental for one day',
      ],
      exclusions: [
        'Lunch and dinner',
        'Personal expenses',
        'Water sports add-ons',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Goa', description: 'Private transfer, hotel check-in, and evening at leisure in Candolim.', activities: ['Airport pickup', 'Beach walk', 'Shack dinner suggestions'] },
        { day: 2, title: 'North Goa Highlights', description: 'Explore Fort Aguada, Baga, Anjuna, and vibrant nightlife.', activities: ['Fort Aguada', 'Baga Beach', 'Anjuna market'] },
        { day: 3, title: 'Sunset and Leisure', description: 'Day at leisure with optional water sports and an evening cruise.', activities: ['Optional parasailing', 'Sunset cruise', 'Club recommendations'] },
        { day: 4, title: 'Departure', description: 'Breakfast and airport drop.', activities: ['Breakfast', 'Checkout', 'Airport transfer'] },
      ],
    },
    {
      name: 'Goa Couple Retreat',
      duration: '4 Nights 5 Days',
      destinations: ['Goa', 'South Goa', 'Colva'],
      basePriceRupees: 42999,
      accent: '#9d174d',
      subAccent: '#f9a8d4',
      tagline: 'Romantic beach resort with candlelight dinner',
      inclusions: [
        '4 nights resort stay',
        'Breakfast and one candlelight dinner',
        'South Goa sightseeing',
        'Private airport transfers',
        'Romantic room decor on arrival',
      ],
      exclusions: [
        'Airfare',
        'Optional spa services',
        'Travel insurance',
      ],
      itinerary: [
        { day: 1, title: 'Arrival and Resort Check-in', description: 'Welcome drink, resort check-in, and sunset by the beach.', activities: ['Private transfer', 'Room decor', 'Sunset walk'] },
        { day: 2, title: 'South Goa Tour', description: 'Visit Colva, Miramar, Dona Paula, and heritage churches.', activities: ['Beach hopping', 'Old Goa churches', 'Photo stops'] },
        { day: 3, title: 'Romantic Leisure Day', description: 'Relax at the resort with optional spa or yacht upgrade.', activities: ['Pool time', 'Spa upgrade', 'Candlelight dinner'] },
        { day: 4, title: 'Free Day', description: 'Enjoy shopping, cafes, or custom add-on experiences.', activities: ['Shopping', 'Cafe hopping', 'Optional island visit'] },
        { day: 5, title: 'Departure', description: 'Breakfast and private departure transfer.', activities: ['Breakfast', 'Checkout', 'Airport drop'] },
      ],
    },
    {
      name: 'Bali Island Bliss',
      duration: '5 Nights 6 Days',
      destinations: ['Bali', 'Ubud', 'Seminyak'],
      basePriceRupees: 67999,
      accent: '#1d4ed8',
      subAccent: '#93c5fd',
      tagline: 'Rice terraces, temples, and island sunsets',
      inclusions: [
        '5 nights hotel stay',
        'Daily breakfast',
        'Ubud and Kintamani tour',
        'Seminyak beach stay',
        'Airport transfers',
      ],
      exclusions: [
        'Visa fees',
        'Lunch and dinner',
        'Adventure activities not listed',
      ],
      itinerary: [
        { day: 1, title: 'Arrive in Bali', description: 'Transfer to Seminyak and relax at the resort.', activities: ['Airport transfer', 'Beach evening'] },
        { day: 2, title: 'Ubud Discovery', description: 'Explore Ubud market, Monkey Forest, and rice terraces.', activities: ['Monkey Forest', 'Tegalalang', 'Cafe stops'] },
        { day: 3, title: 'Kintamani Day Tour', description: 'Scenic volcano views and temple visits.', activities: ['Mt. Batur viewpoint', 'Tirta Empul', 'Art villages'] },
        { day: 4, title: 'Leisure in Seminyak', description: 'Beach clubs, shopping, or optional spa sessions.', activities: ['Beach club', 'Spa option', 'Shopping'] },
        { day: 5, title: 'Sunset Temple Tour', description: 'Visit Tanah Lot and enjoy the coast.', activities: ['Temple visit', 'Sunset photos'] },
        { day: 6, title: 'Departure', description: 'Checkout and airport transfer.', activities: ['Breakfast', 'Airport transfer'] },
      ],
    },
    {
      name: 'Bali Honeymoon Luxe',
      duration: '6 Nights 7 Days',
      destinations: ['Bali', 'Nusa Dua', 'Ubud'],
      basePriceRupees: 112999,
      accent: '#7c3aed',
      subAccent: '#ddd6fe',
      tagline: 'Private villa stay with floating breakfast',
      inclusions: [
        'Private pool villa stay',
        'Floating breakfast experience',
        'Couple spa session',
        'Full-day private sightseeing',
        'Airport transfers',
      ],
      exclusions: [
        'Flight tickets',
        'Optional water sports',
        'Visa charges',
      ],
      itinerary: [
        { day: 1, title: 'Villa Check-in', description: 'Private transfer to your villa and romantic setup.', activities: ['Flower decor', 'Welcome dinner suggestion'] },
        { day: 2, title: 'Ubud Romance Trail', description: 'Temples, scenic viewpoints, and boutique cafes.', activities: ['Temple visits', 'Swing photos', 'Cafe lunch'] },
        { day: 3, title: 'Relax and Rejuvenate', description: 'Couple spa and villa leisure.', activities: ['Spa session', 'Pool time'] },
        { day: 4, title: 'Private Island Tour', description: 'Custom Bali sightseeing with chauffeur.', activities: ['Private cab', 'Temple circuit', 'Sunset point'] },
        { day: 5, title: 'Beach Leisure', description: 'Nusa Dua beach and curated dining options.', activities: ['Beach time', 'Fine dining suggestion'] },
        { day: 6, title: 'Free Day', description: 'Optional cruise or photoshoot add-ons.', activities: ['Optional cruise', 'Photoshoot'] },
        { day: 7, title: 'Departure', description: 'Private checkout and airport transfer.', activities: ['Airport drop'] },
      ],
    },
    {
      name: 'Paris City Romance',
      duration: '5 Nights 6 Days',
      destinations: ['Paris', 'Eiffel Area', 'Seine'],
      basePriceRupees: 148999,
      accent: '#1f2937',
      subAccent: '#fca5a5',
      tagline: 'Classic Paris landmarks with Seine cruise',
      inclusions: [
        '5 nights central hotel stay',
        'Daily breakfast',
        'Seine river cruise',
        'Paris city sightseeing',
        'Airport transfers',
      ],
      exclusions: [
        'Schengen visa',
        'Lunch and dinner',
        'Museum entry tickets not listed',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Paris', description: 'Check-in near the city center and evening stroll.', activities: ['Airport transfer', 'Evening walk'] },
        { day: 2, title: 'Iconic Paris Tour', description: 'Visit the Eiffel Tower area, Champs-Elysees, and Arc de Triomphe.', activities: ['Eiffel stop', 'Arc de Triomphe', 'Shopping avenue'] },
        { day: 3, title: 'Art and River Cruise', description: 'Louvre exterior visit and evening Seine cruise.', activities: ['Museum district', 'River cruise'] },
        { day: 4, title: 'Montmartre and Cafes', description: 'Explore Montmartre, Sacre-Coeur, and cafe culture.', activities: ['Montmartre', 'Cafe hopping'] },
        { day: 5, title: 'Leisure Day', description: 'Optional Disneyland or shopping add-on.', activities: ['Optional tour', 'Shopping'] },
        { day: 6, title: 'Departure', description: 'Airport drop after breakfast.', activities: ['Breakfast', 'Transfer'] },
      ],
    },
    {
      name: 'Paris Family Explorer',
      duration: '6 Nights 7 Days',
      destinations: ['Paris', 'Disneyland', 'Seine'],
      basePriceRupees: 172999,
      accent: '#be123c',
      subAccent: '#fecdd3',
      tagline: 'Family-friendly city stay with Disneyland day',
      inclusions: [
        '6 nights family room stay',
        'Breakfast daily',
        'One-day Disneyland pass',
        'Hop-on hop-off city tour',
        'Airport transfers',
      ],
      exclusions: [
        'Visa and taxes',
        'Lunches',
        'Optional attraction upgrades',
      ],
      itinerary: [
        { day: 1, title: 'Arrival and Easy Evening', description: 'Family-friendly check-in and nearby exploration.', activities: ['Airport transfer', 'Leisure walk'] },
        { day: 2, title: 'Paris Highlights', description: 'Enjoy a relaxed city sightseeing circuit.', activities: ['City tour', 'Photo stops'] },
        { day: 3, title: 'Disneyland Day', description: 'Full day at Disneyland Paris.', activities: ['Theme park access'] },
        { day: 4, title: 'Cruise and Gardens', description: 'Seine cruise and family leisure time.', activities: ['Cruise', 'Park visit'] },
        { day: 5, title: 'Museums or Shopping', description: 'Flexible day based on family interest.', activities: ['Museum option', 'Shopping'] },
        { day: 6, title: 'Free Day', description: 'Explore local neighborhoods and cafes.', activities: ['Local exploration'] },
        { day: 7, title: 'Departure', description: 'Breakfast and airport transfer.', activities: ['Checkout', 'Transfer'] },
      ],
    },
    {
      name: 'Dubai Desert Escape',
      duration: '4 Nights 5 Days',
      destinations: ['Dubai', 'Downtown Dubai', 'Desert Safari'],
      basePriceRupees: 59999,
      accent: '#b45309',
      subAccent: '#fde68a',
      tagline: 'City lights, Burj views, and desert safari',
      inclusions: [
        '4 nights hotel stay',
        'Breakfast daily',
        'Desert safari with dinner',
        'Dubai city tour',
        'Airport transfers',
      ],
      exclusions: [
        'Visa fees',
        'Lunch',
        'Optional Burj Khalifa ticket upgrades',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Dubai', description: 'Transfer and easy evening in Downtown Dubai.', activities: ['Airport transfer', 'Dubai Mall area'] },
        { day: 2, title: 'City Tour', description: 'Explore old and new Dubai landmarks.', activities: ['Jumeirah', 'Dubai Frame photo stop', 'Marina drive'] },
        { day: 3, title: 'Desert Safari', description: 'Afternoon safari with cultural show and dinner.', activities: ['Dune bashing', 'Camp dinner'] },
        { day: 4, title: 'Leisure and Shopping', description: 'Optional Burj Khalifa, shopping, or marina cruise.', activities: ['Free time', 'Optional attractions'] },
        { day: 5, title: 'Departure', description: 'Breakfast and airport transfer.', activities: ['Transfer'] },
      ],
    },
    {
      name: 'Himachal Mountain Escape',
      duration: '5 Nights 6 Days',
      destinations: ['Himachal', 'Manali', 'Shimla'],
      basePriceRupees: 37999,
      accent: '#166534',
      subAccent: '#bbf7d0',
      tagline: 'Cool weather, mountain roads, and scenic stays',
      inclusions: [
        '5 nights hotel stay',
        'Breakfast and dinner',
        'Shimla and Manali transfers',
        'Local sightseeing',
        'Volvo pickup support',
      ],
      exclusions: [
        'Adventure activity tickets',
        'Lunch',
        'Personal expenses',
      ],
      itinerary: [
        { day: 1, title: 'Arrive in Shimla', description: 'Check-in and Mall Road evening.', activities: ['Check-in', 'Mall Road'] },
        { day: 2, title: 'Shimla Local', description: 'Explore Kufri and nearby viewpoints.', activities: ['Kufri', 'Scenic stops'] },
        { day: 3, title: 'Transfer to Manali', description: 'Scenic road journey to Manali.', activities: ['Road transfer', 'Check-in'] },
        { day: 4, title: 'Manali Highlights', description: 'Visit Hadimba Temple and local attractions.', activities: ['Temple visit', 'Club House', 'Market'] },
        { day: 5, title: 'Optional Solang Excursion', description: 'Snow points and optional adventure rides.', activities: ['Solang Valley', 'Adventure options'] },
        { day: 6, title: 'Departure', description: 'Checkout and onward journey.', activities: ['Breakfast', 'Departure'] },
      ],
    },
    {
      name: 'Kashmir Valley Delight',
      duration: '5 Nights 6 Days',
      destinations: ['Kashmir', 'Srinagar', 'Gulmarg', 'Pahalgam'],
      basePriceRupees: 48999,
      accent: '#0369a1',
      subAccent: '#bae6fd',
      tagline: 'Houseboats, valleys, and alpine views',
      inclusions: [
        'Houseboat and hotel stays',
        'Breakfast and dinner',
        'Airport pickup and drop',
        'Gulmarg and Pahalgam day trips',
        'Shikara ride',
      ],
      exclusions: [
        'Gondola tickets',
        'Union cabs where applicable',
        'Lunch',
      ],
      itinerary: [
        { day: 1, title: 'Arrive in Srinagar', description: 'Houseboat check-in and Shikara ride.', activities: ['Houseboat stay', 'Lake ride'] },
        { day: 2, title: 'Srinagar Sightseeing', description: 'Gardens and old-city highlights.', activities: ['Mughal gardens', 'Local market'] },
        { day: 3, title: 'Gulmarg Excursion', description: 'Snow views and optional gondola ride.', activities: ['Day trip', 'Optional gondola'] },
        { day: 4, title: 'Pahalgam Day', description: 'Riverside views and scenic valley experiences.', activities: ['Betaab Valley', 'Photo stops'] },
        { day: 5, title: 'Leisure in Srinagar', description: 'Relax or shop for local crafts.', activities: ['Shopping', 'Cafe time'] },
        { day: 6, title: 'Departure', description: 'Airport transfer after breakfast.', activities: ['Transfer'] },
      ],
    },
    {
      name: 'Thailand Party Break',
      duration: '4 Nights 5 Days',
      destinations: ['Thailand', 'Phuket', 'Patong'],
      basePriceRupees: 51999,
      accent: '#0f766e',
      subAccent: '#99f6e4',
      tagline: 'Island fun, nightlife, and sea-view stays',
      inclusions: [
        '4 nights hotel stay',
        'Breakfast daily',
        'Phi Phi island tour',
        'Airport transfers',
        'Patong area stay',
      ],
      exclusions: [
        'Visa',
        'Lunch and dinner',
        'Optional nightlife add-ons',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Phuket', description: 'Check-in and beach evening.', activities: ['Transfer', 'Patong walk'] },
        { day: 2, title: 'Phi Phi Day Tour', description: 'Island-hopping adventure.', activities: ['Boat tour', 'Beach stops'] },
        { day: 3, title: 'Leisure and Nightlife', description: 'Free day for cafes, shopping, and nightlife.', activities: ['Leisure', 'Nightlife'] },
        { day: 4, title: 'Optional Activities', description: 'Choose ATV, zipline, or spa.', activities: ['Adventure options'] },
        { day: 5, title: 'Departure', description: 'Checkout and airport transfer.', activities: ['Transfer'] },
      ],
    },
    {
      name: 'Thailand Family Fun',
      duration: '5 Nights 6 Days',
      destinations: ['Thailand', 'Bangkok', 'Pattaya'],
      basePriceRupees: 68999,
      accent: '#1d4ed8',
      subAccent: '#bfdbfe',
      tagline: 'Bangkok highlights with a smooth family pace',
      inclusions: [
        '5 nights family stay',
        'Breakfast daily',
        'Bangkok and Pattaya transfers',
        'Coral Island tour',
        'City sightseeing',
      ],
      exclusions: [
        'Visa fees',
        'Lunch and dinner',
        'Optional shows and theme parks',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Pattaya', description: 'Transfer and relax.', activities: ['Transfer', 'Leisure'] },
        { day: 2, title: 'Coral Island Tour', description: 'Family-friendly beach excursion.', activities: ['Island tour'] },
        { day: 3, title: 'Transfer to Bangkok', description: 'Travel to Bangkok and evening at leisure.', activities: ['Road transfer', 'Shopping'] },
        { day: 4, title: 'Bangkok City Tour', description: 'Temples and family attractions.', activities: ['Temple circuit', 'City sights'] },
        { day: 5, title: 'Flexible Family Day', description: 'Optional Safari World or shopping.', activities: ['Optional add-on'] },
        { day: 6, title: 'Departure', description: 'Airport transfer.', activities: ['Transfer'] },
      ],
    },
    {
      name: 'Maldives Water Villa Escape',
      duration: '3 Nights 4 Days',
      destinations: ['Maldives', 'Male', 'Private Island'],
      basePriceRupees: 135999,
      accent: '#0f766e',
      subAccent: '#a7f3d0',
      tagline: 'Luxury water villa with turquoise lagoon views',
      inclusions: [
        '3 nights water villa stay',
        'All-inclusive meals',
        'Speedboat transfers',
        'Sunset cruise',
        'Snorkeling experience',
      ],
      exclusions: [
        'International airfare',
        'Spa and premium activities',
        'Travel insurance',
      ],
      itinerary: [
        { day: 1, title: 'Island Arrival', description: 'Speedboat transfer and water villa check-in.', activities: ['Transfer', 'Villa leisure'] },
        { day: 2, title: 'Lagoon Leisure', description: 'Relax, snorkel, and enjoy the resort.', activities: ['Snorkeling', 'Beach leisure'] },
        { day: 3, title: 'Sunset Experience', description: 'Cruise and curated dining.', activities: ['Sunset cruise', 'Dinner'] },
        { day: 4, title: 'Departure', description: 'Checkout and transfer back.', activities: ['Return transfer'] },
      ],
    },
    {
      name: 'Singapore City Lights',
      duration: '4 Nights 5 Days',
      destinations: ['Singapore', 'Marina Bay', 'Sentosa'],
      basePriceRupees: 94999,
      accent: '#111827',
      subAccent: '#fca5a5',
      tagline: 'Clean city escapes, skyline views, and Sentosa fun',
      inclusions: [
        '4 nights hotel stay',
        'Breakfast daily',
        'Night safari or skyline experience',
        'Sentosa visit',
        'Airport transfers',
      ],
      exclusions: [
        'Visa fees',
        'Lunch and dinner',
        'Optional attraction upgrades',
      ],
      itinerary: [
        { day: 1, title: 'Arrival in Singapore', description: 'Transfer and relaxed city evening.', activities: ['Transfer', 'Marina walk'] },
        { day: 2, title: 'City Highlights', description: 'See Marina Bay and city landmarks.', activities: ['City tour', 'Photo stops'] },
        { day: 3, title: 'Sentosa Day', description: 'Cable car views and island attractions.', activities: ['Sentosa visit'] },
        { day: 4, title: 'Leisure and Night Views', description: 'Shopping and optional night safari.', activities: ['Shopping', 'Night attraction'] },
        { day: 5, title: 'Departure', description: 'Transfer to airport.', activities: ['Transfer'] },
      ],
    },
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
  <text x="120" y="270" fill="#e2e8f0" font-size="38" font-family="Arial, sans-serif">${primaryDestination} · ${pkg.duration}</text>
  <text x="120" y="360" fill="#f8fafc" font-size="42" font-family="Arial, sans-serif">${pkg.tagline}</text>
  <text x="120" y="470" fill="#ffffff" font-size="58" font-family="Arial, sans-serif" font-weight="700">${price}</text>
  <text x="120" y="570" fill="#dbeafe" font-size="32" font-family="Arial, sans-serif">Includes: ${highlight1}</text>
  <text x="120" y="625" fill="#dbeafe" font-size="32" font-family="Arial, sans-serif">Plus: ${highlight2}</text>
  <text x="120" y="725" fill="#f8fafc" font-size="30" font-family="Arial, sans-serif">Seeded package image for TravelBot</text>
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
  const agencyName = args.agencyName || process.env.SEED_AGENCY_NAME || 'ABC Trours';
  const limit = Number.isInteger(args.limit) && args.limit > 0 ? args.limit : getPackageSeeds().length;

  await sequelize.authenticate();
  const agency = await resolveAgency(agencyName);

  if (!agency) {
    throw new Error(`Agency "${agencyName}" not found. Create the agency first, then rerun the seeder.`);
  }

  const seeds = getPackageSeeds().slice(0, limit);
  const packageNames = seeds.map((item) => item.name);

  console.log(`Using agency: ${agency.name} (${agency.id})`);
  console.log(`Preparing ${seeds.length} travel packages...`);

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
      duration: pkg.duration,
      destinations: pkg.destinations,
      inclusions: pkg.inclusions,
      exclusions: pkg.exclusions,
      basePrice: pkg.basePriceRupees * 100,
      imageUrl,
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
