const path = require('path');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const {
  sequelize,
  Agency,
  Agent,
  Customer,
  Lead,
  Package,
  Property,
  Booking,
  Payment,
  Message,
  MessageTemplate,
  Campaign,
  CampaignRecipient,
  DripSequence,
  DripStep,
  DripEnrollment,
  FollowUp,
  LeadNote,
  Itinerary,
  ScheduledJob,
  Review,
} = require('../models');
const { ALL_PERMISSIONS, DEFAULT_AGENT_PERMISSIONS } = require('../constants/permissions');

const DEMO_SOURCE = 'wayon_demo_seed';
const DEMO_TAG = 'demo-client-meeting';
const DEFAULT_AGENCY_NAME = 'Wayon Travels';
const DEFAULT_COUNT = 100;
const PASSWORD = process.env.WAYON_DEMO_PASSWORD || 'WayonDemo@2026';

const destinations = [
  'Bali', 'Dubai', 'Thailand', 'Maldives', 'Singapore', 'Kashmir', 'Goa', 'Kerala',
  'Himachal', 'Rajasthan', 'Vietnam', 'Turkey', 'Sri Lanka', 'Paris', 'Andaman',
  'Ladakh', 'Meghalaya', 'Sikkim', 'Azerbaijan', 'Georgia',
];

const firstNames = [
  'Aarav', 'Diya', 'Vihaan', 'Ananya', 'Kabir', 'Isha', 'Rohan', 'Meera', 'Arjun', 'Naina',
  'Dev', 'Tara', 'Aditya', 'Pooja', 'Karthik', 'Sneha', 'Rahul', 'Aisha', 'Vikram', 'Riya',
];

const lastNames = [
  'Menon', 'Sharma', 'Nair', 'Patel', 'Khan', 'Iyer', 'Reddy', 'Kapoor', 'Joshi', 'Pillai',
  'Verma', 'Das', 'Mehta', 'Rao', 'George', 'Thomas', 'Bose', 'Singh', 'Kulkarni', 'Mishra',
];

const sources = [
  'whatsapp_organic',
  'instagram_ad',
  'facebook_ad',
  'referral',
  'website',
  'qr_code',
  'manual',
];

const statusPlan = [
  ['JUST_CONTACTED', 8],
  ['PACKAGE_SEARCHED', 8],
  ['PACKAGE_INTERESTED', 12],
  ['NEW', 10],
  ['ENQUIRY', 14],
  ['CONTACTED', 14],
  ['QUOTED', 12],
  ['NEGOTIATING', 8],
  ['BOOKED', 10],
  ['LOST', 3],
  ['CANCELLED', 1],
];

const imageUrls = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    agencyName: process.env.SEED_AGENCY_NAME || DEFAULT_AGENCY_NAME,
    count: DEFAULT_COUNT,
    dryRun: false,
    allowProduction: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--agency' && args[index + 1]) {
      parsed.agencyName = args[index + 1];
      index += 1;
    } else if (arg === '--count' && args[index + 1]) {
      parsed.count = Math.max(1, parseInt(args[index + 1], 10) || DEFAULT_COUNT);
      index += 1;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--confirm-production') {
      parsed.allowProduction = true;
    }
  }

  return parsed;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function setTime(date, hour, minute = 0) {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function pick(list, index) {
  return list[index % list.length];
}

function expandStatuses(count) {
  const statuses = [];
  for (const [status, amount] of statusPlan) {
    for (let index = 0; index < amount; index += 1) statuses.push(status);
  }

  while (statuses.length < count) {
    statuses.push(pick(['NEW', 'ENQUIRY', 'CONTACTED', 'QUOTED', 'NEGOTIATING'], statuses.length));
  }

  return statuses.slice(0, count);
}

function amountRupees(value) {
  return Math.round(value * 100);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

async function findAgencyByName(name, transaction) {
  const rows = await sequelize.query('SELECT id, name FROM agencies WHERE lower(name) = lower(:name) LIMIT 1', {
    replacements: { name },
    type: sequelize.QueryTypes.SELECT,
    transaction,
  });
  return rows[0] || null;
}

async function ensureAgency(agencyName, transaction) {
  const existing = await findAgencyByName(agencyName, transaction);
  if (existing) return existing;

  return Agency.create({
    name: DEFAULT_AGENCY_NAME,
    phone: '+919900011100',
    email: 'hello@wayontravels.demo',
    whatsappNumber: '+919900022200',
    plan: 'PRO',
    isActive: true,
  }, { transaction });
}

async function ensureAgents(agencyId, transaction) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const agentSeeds = [
    {
      name: 'Nihal Founder',
      email: 'founder@wayontravels.demo',
      phone: '+919900030001',
      role: 'ADMIN',
      permissions: ALL_PERMISSIONS,
      isOnline: true,
    },
    {
      name: 'Aisha Sales Lead',
      email: 'aisha@wayontravels.demo',
      phone: '+919900030002',
      role: 'AGENT',
      permissions: DEFAULT_AGENT_PERMISSIONS,
      isOnline: true,
    },
    {
      name: 'Rahul Trip Consultant',
      email: 'rahul@wayontravels.demo',
      phone: '+919900030003',
      role: 'AGENT',
      permissions: DEFAULT_AGENT_PERMISSIONS,
      isOnline: true,
    },
    {
      name: 'Meera Visa Desk',
      email: 'meera@wayontravels.demo',
      phone: '+919900030004',
      role: 'AGENT',
      permissions: DEFAULT_AGENT_PERMISSIONS,
      isOnline: false,
    },
  ];

  const agents = [];
  for (const seed of agentSeeds) {
    const [agent] = await Agent.findOrCreate({
      where: { email: seed.email },
      defaults: {
        agencyId,
        passwordHash,
        lastSeenAt: addDays(new Date(), seed.isOnline ? 0 : -2),
        ...seed,
      },
      transaction,
    });

    await agent.update({
      agencyId,
      name: seed.name,
      phone: seed.phone,
      role: seed.role,
      permissions: seed.permissions,
      isOnline: seed.isOnline,
      lastSeenAt: addDays(new Date(), seed.isOnline ? 0 : -2),
    }, { transaction });
    agents.push(agent);
  }

  return agents;
}

function packageSeeds() {
  const rows = [
    ['Bali Honeymoon Signature', 'INTERNATIONAL', '5 Nights 6 Days', ['Bali', 'Ubud', 'Nusa Dua'], 118000, 'Private villa, swing tour, candlelight dinner'],
    ['Dubai Family Premium', 'INTERNATIONAL', '4 Nights 5 Days', ['Dubai', 'Abu Dhabi'], 78000, 'Burj Khalifa, desert safari, city transfers'],
    ['Thailand Friends Escape', 'INTERNATIONAL', '5 Nights 6 Days', ['Phuket', 'Krabi', 'Bangkok'], 64000, 'Island hopping, nightlife, shopping'],
    ['Maldives Water Villa', 'INTERNATIONAL', '4 Nights 5 Days', ['Maldives', 'Male'], 154000, 'Water villa, speedboat, all-inclusive meals'],
    ['Singapore Sentosa Week', 'INTERNATIONAL', '4 Nights 5 Days', ['Singapore', 'Sentosa'], 98000, 'Universal Studios, Marina Bay, Night Safari'],
    ['Vietnam Discovery Route', 'INTERNATIONAL', '6 Nights 7 Days', ['Hanoi', 'Halong Bay', 'Da Nang'], 88000, 'Cruise, old quarter, coastal stays'],
    ['Turkey Cappadocia Dream', 'INTERNATIONAL', '7 Nights 8 Days', ['Istanbul', 'Cappadocia'], 126000, 'Balloon view stay, bazaars, heritage tours'],
    ['Paris Anniversary Luxe', 'INTERNATIONAL', '5 Nights 6 Days', ['Paris', 'Disneyland'], 186000, 'Seine cruise, Eiffel dinner, Disneyland'],
    ['Kashmir Valley Delight', 'DOMESTIC', '5 Nights 6 Days', ['Srinagar', 'Gulmarg', 'Pahalgam'], 52000, 'Houseboat, gondola, valley drives'],
    ['Goa Couple Escape', 'DOMESTIC', '3 Nights 4 Days', ['Goa', 'Candolim'], 34000, 'Beach resort, cruise, cafe trail'],
    ['Kerala Backwater Calm', 'DOMESTIC', '5 Nights 6 Days', ['Munnar', 'Alleppey', 'Kochi'], 46000, 'Houseboat, tea estates, private cab'],
    ['Himachal Mountain Loop', 'DOMESTIC', '6 Nights 7 Days', ['Shimla', 'Manali'], 43000, 'Snow point, mall road, mountain stays'],
    ['Rajasthan Royal Circuit', 'DOMESTIC', '6 Nights 7 Days', ['Jaipur', 'Jodhpur', 'Udaipur'], 56000, 'Palaces, forts, lake-view dinner'],
    ['Andaman Island Break', 'DOMESTIC', '5 Nights 6 Days', ['Port Blair', 'Havelock'], 68000, 'Radhanagar beach, ferry, snorkeling'],
    ['Ladakh Adventure Run', 'DOMESTIC', '6 Nights 7 Days', ['Leh', 'Nubra', 'Pangong'], 74000, 'High passes, lake camp, bike add-on'],
    ['Meghalaya Waterfall Trail', 'DOMESTIC', '5 Nights 6 Days', ['Shillong', 'Cherrapunji'], 51000, 'Caves, waterfalls, living root bridge'],
    ['Sikkim Scenic North', 'DOMESTIC', '5 Nights 6 Days', ['Gangtok', 'Lachen', 'Lachung'], 59000, 'Himalayan views and permit support'],
    ['Georgia Winter Escape', 'INTERNATIONAL', '5 Nights 6 Days', ['Tbilisi', 'Gudauri'], 96000, 'Snow resort, old town, winery day'],
    ['Azerbaijan City & Snow', 'INTERNATIONAL', '5 Nights 6 Days', ['Baku', 'Gabala'], 92000, 'Flame towers, cable car, mountain day'],
    ['Sri Lanka Coastal Loop', 'INTERNATIONAL', '5 Nights 6 Days', ['Colombo', 'Bentota', 'Kandy'], 76000, 'Coast, culture, tea gardens'],
    ['Coorg Coffee Retreat', 'DOMESTIC', '3 Nights 4 Days', ['Coorg', 'Madikeri'], 31000, 'Estate stay, waterfalls, bonfire'],
    ['Munnar Tea Escape', 'DOMESTIC', '3 Nights 4 Days', ['Munnar', 'Thekkady'], 33000, 'Tea gardens, spice trail, boating'],
    ['Ooty Coonoor Classic', 'DOMESTIC', '3 Nights 4 Days', ['Ooty', 'Coonoor'], 29000, 'Toy train, tea factory, hill views'],
    ['Varanasi Spiritual Weekend', 'DOMESTIC', '2 Nights 3 Days', ['Varanasi', 'Sarnath'], 24000, 'Ganga aarti, temples, guided walks'],
  ];

  return rows.map((row, index) => {
    const [name, category, duration, destinationList, price, tagline] = row;
    return {
      name,
      category,
      tourType: pick(['COUPLE', 'FAMILY', 'FRIENDS', 'PREMIUM', 'BUDGET'], index),
      duration,
      destinations: destinationList,
      inclusions: [
        `${duration} stay with breakfast`,
        'Private transfers',
        'Sightseeing coordination',
        'Wayon trip manager support',
      ],
      exclusions: [
        category === 'INTERNATIONAL' ? 'Visa and travel insurance' : 'Flight or train fare',
        'Personal expenses',
        'Optional activities',
      ],
      basePrice: amountRupees(price),
      imageUrl: pick(imageUrls, index),
      summary: `${tagline}. Demo-ready itinerary curated by Wayon Travels.`,
      itinerary: [1, 2, 3, 4].map((day) => ({
        day,
        title: day === 1 ? `Arrive in ${destinationList[0]}` : day === 4 ? 'Departure and checkout' : `${destinationList[0]} curated experiences`,
        description: day === 1 ? 'Arrival, transfer, and easy check-in.' : 'Balanced sightseeing with flexible leisure time.',
        activities: ['Transfer', 'Sightseeing', 'Local recommendations'].slice(0, day === 4 ? 2 : 3),
      })),
      isActive: true,
    };
  });
}

function propertySeeds() {
  return [
    ['Wayon Bayview Resort Goa', 'Resort', 'Candolim, Goa', 9200, ['Pool', 'Breakfast', 'Beach Access']],
    ['Wayon Tea Valley Munnar', 'Hotel', 'Chithirapuram, Munnar', 7200, ['Breakfast', 'Valley View', 'Parking']],
    ['Wayon Royal Haveli Jaipur', 'Boutique Stay', 'Bani Park, Jaipur', 8800, ['Heritage', 'Restaurant', 'Guided Walk']],
    ['Wayon Lake Palace Udaipur', 'Hotel', 'Lake Pichola, Udaipur', 12200, ['Lake View', 'Breakfast', 'Airport Transfer']],
    ['Wayon Snowline Manali', 'Resort', 'Old Manali, Manali', 7900, ['Mountain View', 'Bonfire', 'Wi-Fi']],
    ['Wayon Houseboat Srinagar', 'Houseboat', 'Dal Lake, Srinagar', 9900, ['Lake View', 'Shikara', 'Breakfast']],
    ['Wayon Island Havelock', 'Villa', 'Radhanagar, Havelock', 14800, ['Beach Access', 'Snorkeling', 'Restaurant']],
    ['Wayon Coffee Estate Coorg', 'Homestay', 'Madikeri, Coorg', 6900, ['Estate Walk', 'Bonfire', 'Breakfast']],
    ['Wayon Sentosa Partner Stay', 'Hotel', 'Sentosa, Singapore', 18500, ['City View', 'Metro Access', 'Breakfast']],
    ['Wayon Dubai Marina Suites', 'Apartment', 'Dubai Marina, Dubai', 21000, ['Marina View', 'Kitchenette', 'Pool']],
    ['Wayon Bali Pool Villa', 'Villa', 'Ubud, Bali', 17600, ['Private Pool', 'Breakfast', 'Spa']],
    ['Wayon Maldives Beach Villa', 'Villa', 'North Male Atoll', 34000, ['Lagoon View', 'All Meals', 'Speedboat']],
  ].map(([name, propertyType, location, price, amenities], index) => ({
    name,
    propertyType,
    location,
    address: `${location}, demo inventory by Wayon Travels`,
    amenities,
    description: `${propertyType} option in ${location} for premium Wayon demo itineraries.`,
    pricePerNight: amountRupees(price),
    imageUrl: pick(imageUrls, index + 2),
    images: [pick(imageUrls, index + 2)],
    isActive: true,
  }));
}

async function cleanupDemoData(agencyId, transaction) {
  const demoLeads = await Lead.findAll({
    where: {
      agencyId,
      [Op.or]: [
        { source: DEMO_SOURCE },
        { tags: { [Op.contains]: [DEMO_TAG] } },
      ],
    },
    attributes: ['id', 'customerId'],
    transaction,
  });
  const leadIds = demoLeads.map((lead) => lead.id);
  const customerIds = [...new Set(demoLeads.map((lead) => lead.customerId).filter(Boolean))];

  const demoCampaigns = await Campaign.findAll({
    where: {
      agencyId,
      [Op.or]: [
        { name: { [Op.iLike]: 'Wayon Demo%' } },
        { audienceFilter: { [Op.contains]: { source: DEMO_SOURCE } } },
      ],
    },
    attributes: ['id'],
    transaction,
  });
  const campaignIds = demoCampaigns.map((campaign) => campaign.id);

  const demoBookings = await Booking.findAll({
    where: {
      agencyId,
      [Op.or]: [
        { bookingRef: { [Op.like]: 'WY-%' } },
        leadIds.length ? { leadId: { [Op.in]: leadIds } } : { id: null },
      ],
    },
    attributes: ['id'],
    transaction,
  });
  const bookingIds = demoBookings.map((booking) => booking.id);

  if (campaignIds.length) await CampaignRecipient.destroy({ where: { campaignId: { [Op.in]: campaignIds } }, transaction });
  if (leadIds.length) {
    await DripEnrollment.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction });
    await FollowUp.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction });
    await LeadNote.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction });
    await Itinerary.destroy({ where: { leadId: { [Op.in]: leadIds } }, transaction });
  }
  if (bookingIds.length) {
    await Payment.destroy({ where: { bookingId: { [Op.in]: bookingIds } }, transaction });
    await ScheduledJob.destroy({ where: { bookingId: { [Op.in]: bookingIds } }, transaction });
    await Review.destroy({ where: { bookingId: { [Op.in]: bookingIds } }, transaction });
  }
  if (customerIds.length) {
    await Message.destroy({ where: { agencyId, customerId: { [Op.in]: customerIds } }, transaction });
    await Review.destroy({ where: { agencyId, customerId: { [Op.in]: customerIds } }, transaction });
  }

  if (bookingIds.length) await Booking.destroy({ where: { id: { [Op.in]: bookingIds } }, transaction });
  if (leadIds.length) await Lead.destroy({ where: { id: { [Op.in]: leadIds } }, transaction });
  if (customerIds.length) await Customer.destroy({ where: { id: { [Op.in]: customerIds } }, transaction });

  if (campaignIds.length) await Campaign.destroy({ where: { id: { [Op.in]: campaignIds } }, transaction });
  const demoDrips = await DripSequence.findAll({
    where: { agencyId, name: { [Op.like]: 'Wayon Demo%' } },
    attributes: ['id'],
    transaction,
  });
  const dripIds = demoDrips.map((sequence) => sequence.id);
  if (dripIds.length) await DripStep.destroy({ where: { sequenceId: { [Op.in]: dripIds } }, transaction });
  if (dripIds.length) await DripSequence.destroy({ where: { id: { [Op.in]: dripIds } }, transaction });
  await MessageTemplate.destroy({ where: { agencyId, name: { [Op.like]: 'wayon_demo_%' } }, transaction });
  await Package.destroy({ where: { agencyId, summary: { [Op.iLike]: `%${DEMO_SOURCE}%` } }, transaction });
  await Package.destroy({ where: { agencyId, name: { [Op.in]: packageSeeds().map((pkg) => pkg.name) } }, transaction });
  await Property.destroy({ where: { agencyId, description: { [Op.iLike]: `%Wayon demo%` } }, transaction });
}

async function createCatalog(agencyId, transaction) {
  const packages = await Package.bulkCreate(
    packageSeeds().map((pkg) => ({
      agencyId,
      ...pkg,
      summary: `${pkg.summary} Seed marker: ${DEMO_SOURCE}.`,
    })),
    { transaction, returning: true }
  );

  const properties = await Property.bulkCreate(
    propertySeeds().map((property) => ({
      agencyId,
      ...property,
    })),
    { transaction, returning: true }
  );

  return { packages, properties };
}

async function createTemplatesAndCampaigns(agencyId, packages, transaction) {
  const templates = await MessageTemplate.bulkCreate([
    {
      agencyId,
      name: 'wayon_demo_flash_sale',
      displayName: 'Wayon Demo Flash Sale',
      category: 'MARKETING',
      templateType: 'STANDARD',
      language: 'en',
      headerType: 'IMAGE',
      headerContent: packages[0]?.imageUrl,
      body: 'Hi {{1}}, Wayon Travels has a curated {{2}} plan ready from Rs {{3}}. Reply PLAN to get options.',
      footer: 'Wayon Travels',
      buttons: [{ type: 'QUICK_REPLY', text: 'Plan Trip' }, { type: 'QUICK_REPLY', text: 'Talk to Expert' }],
      variableCount: 3,
      sampleVariables: ['Aarav', 'Bali', '1,18,000'],
      tags: ['demo', 'travel', 'campaign'],
      icon: '✈',
      isPrebuilt: false,
      status: 'APPROVED',
      usageCount: 64,
    },
    {
      agencyId,
      name: 'wayon_demo_payment_reminder',
      displayName: 'Wayon Demo Payment Reminder',
      category: 'UTILITY',
      templateType: 'STANDARD',
      language: 'en',
      headerType: 'NONE',
      body: 'Hi {{1}}, your Wayon Travels booking {{2}} has a pending balance of Rs {{3}}.',
      footer: 'Secure your trip',
      buttons: [{ type: 'URL', text: 'Pay Now', url: 'https://travelbot.wayon.in/pay/{{1}}' }],
      variableCount: 3,
      sampleVariables: ['Diya', 'WY-2026-0008', '24,000'],
      tags: ['demo', 'payment'],
      icon: '₹',
      isPrebuilt: false,
      status: 'APPROVED',
      usageCount: 18,
    },
  ], { transaction, returning: true });

  const now = new Date();
  const campaignSeeds = [
    {
      name: 'Wayon Demo - Summer Family Escapes',
      type: 'SEASONAL',
      format: 'ITEM_CAROUSEL',
      mediaType: 'IMAGE',
      mediaUrl: packages[1]?.imageUrl,
      templateId: templates[0].id,
      messageBody: 'Summer family packages for Dubai, Singapore, Kashmir, and Kerala are live.',
      linkedPackageIds: packages.slice(1, 7).map((pkg) => pkg.id),
      totalRecipients: 42,
      sent: 42,
      delivered: 39,
      read: 31,
      replied: 11,
      failed: 3,
      status: 'SENT',
      sentAt: addDays(now, -12),
      completedAt: addDays(now, -12),
    },
    {
      name: 'Wayon Demo - Honeymoon Retargeting',
      type: 'RE_ENGAGEMENT',
      format: 'SECTION_CTA',
      mediaType: 'IMAGE',
      mediaUrl: packages[0]?.imageUrl,
      templateId: templates[0].id,
      messageBody: 'Handpicked honeymoon plans with villa, transfers, and experiences.',
      linkedPackageIds: [packages[0]?.id, packages[3]?.id, packages[10]?.id].filter(Boolean),
      totalRecipients: 31,
      sent: 31,
      delivered: 30,
      read: 25,
      replied: 9,
      failed: 1,
      status: 'SENT',
      sentAt: addDays(now, -5),
      completedAt: addDays(now, -5),
    },
    {
      name: 'Wayon Demo - Long Weekend Push',
      type: 'PROMOTIONAL',
      format: 'STANDARD',
      mediaType: 'NONE',
      templateId: templates[0].id,
      messageBody: 'Goa, Coorg, Munnar, and Ooty long-weekend slots are filling fast.',
      linkedPackageIds: packages.slice(20, 24).map((pkg) => pkg.id),
      totalRecipients: 27,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      status: 'SCHEDULED',
      scheduledAt: addDays(now, 2),
    },
  ];

  const campaigns = await Campaign.bulkCreate(
    campaignSeeds.map((campaign) => ({
      agencyId,
      audienceFilter: { source: DEMO_SOURCE, tag: DEMO_TAG },
      campaignSections: [{ title: 'Featured Trips', type: 'packages', packageIds: campaign.linkedPackageIds }],
      carouselConfig: { cardCta: 'View Package', source: DEMO_SOURCE },
      ctaConfig: { primary: 'Plan this trip', secondary: 'Talk to expert' },
      audienceCount: campaign.totalRecipients,
      ...campaign,
    })),
    { transaction, returning: true }
  );

  return { templates, campaigns };
}

async function createDrips(agencyId, transaction) {
  const sequence = await DripSequence.create({
    agencyId,
    name: 'Wayon Demo - Hot Lead Nurture',
    description: 'Demo sequence for fresh enquiries who have viewed a package but not paid.',
    trigger: 'LEAD_CREATED',
    destinationFilter: { destinations: ['Bali', 'Dubai', 'Kashmir', 'Goa'] },
    isActive: true,
    enrollmentCount: 0,
    completedCount: 0,
  }, { transaction });

  await DripStep.bulkCreate([
    {
      sequenceId: sequence.id,
      order: 1,
      delayHours: 1,
      messageType: 'TEXT',
      messageBody: 'Hi {name}, I found 3 strong {destination} options for your dates. Want the best-value one first?',
      buttons: [{ text: 'Send options' }, { text: 'Talk to advisor' }],
    },
    {
      sequenceId: sequence.id,
      order: 2,
      delayHours: 24,
      messageType: 'TEXT',
      messageBody: 'Quick reminder: fares for {destination} are moving this week. We can hold the itinerary today.',
      buttons: [{ text: 'Hold itinerary' }],
    },
  ], { transaction });

  return sequence;
}

async function createCustomersAndLeads(agencyId, agents, packages, properties, campaigns, dripSequence, count, transaction) {
  const statuses = expandStatuses(count);
  const now = new Date();
  const customers = [];
  const leads = [];

  for (let index = 0; index < count; index += 1) {
    const firstName = pick(firstNames, index);
    const lastName = pick(lastNames, index * 3);
    const destination = pick(destinations, index * 2);
    const pkg = pick(packages, index);
    const property = index % 9 === 0 ? pick(properties, index) : null;
    const status = statuses[index];
    const createdAt = setTime(addDays(now, -(index % 45)), 9 + (index % 9), (index * 7) % 60);
    const travelStart = addDays(now, status === 'BOOKED' && index % 3 === 0 ? -(index % 14) : 12 + (index % 120));
    const travelEnd = addDays(travelStart, 3 + (index % 5));
    const source = pick(sources, index);
    const campaign = index % 4 === 0 ? pick(campaigns, index) : null;
    const agent = pick(agents.slice(1), index);
    const travellers = 1 + (index % 5);
    const budget = amountRupees(28000 + (index % 18) * 9000);
    const phone = `+9198${String(50000000 + index).padStart(8, '0')}`;

    const customer = await Customer.create({
      agencyId,
      name: `${firstName} ${lastName}`,
      phone,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@demo.wayontravels.in`,
      language: index % 7 === 0 ? 'ML' : 'EN',
      source: DEMO_SOURCE,
      notes: `Founder-ready demo customer from ${source}. Original channel: ${source}.`,
      isCustomer: ['BOOKED', 'CONVERTED'].includes(status),
      documents: status === 'BOOKED' ? [{ type: 'passport', status: index % 2 ? 'received' : 'pending' }] : [],
      createdAt,
      updatedAt: addDays(createdAt, Math.min(index % 8, 4)),
    }, { transaction });

    const lead = await Lead.create({
      customerId: customer.id,
      agencyId,
      assignedAgentId: agent?.id || null,
      destination,
      travelDates: `${dateOnly(travelStart)} to ${dateOnly(travelEnd)}`,
      travelStart,
      travelEnd,
      travellers,
      budgetPerPerson: budget,
      packageId: property ? null : pkg.id,
      propertyId: property?.id || null,
      itemType: property ? 'PROPERTY' : 'PACKAGE',
      campaignId: campaign?.id || null,
      campaignName: campaign?.name || null,
      campaignAction: campaign ? pick(['carousel_click', 'plan_trip_cta', 'talk_to_expert'], index) : null,
      interest: pkg.category,
      status,
      lostReason: status === 'LOST' ? pick(['Budget mismatch', 'Travel dates postponed', 'Booked with another provider'], index) : null,
      notes: `Seed marker: ${DEMO_SOURCE}. Demo story: ${firstName} is interested in ${destination} with ${travellers} traveller(s).`,
      source: DEMO_SOURCE,
      leadScore: status === 'BOOKED' ? 100 : Math.min(95, 28 + (index % 60)),
      tags: [
        DEMO_TAG,
        source,
        pkg.category.toLowerCase(),
        status === 'NEGOTIATING' || status === 'QUOTED' ? 'hot-lead' : 'demo',
      ],
      selectedItems: [{ itemType: property ? 'PROPERTY' : 'PACKAGE', itemId: property?.id || pkg.id }],
      customTripDetails: {
        source,
        destination,
        travellers,
        budgetPerPerson: budget,
        submittedAt: createdAt.toISOString(),
        campaignName: campaign?.name || null,
      },
      createdAt,
      updatedAt: addDays(createdAt, Math.min(index % 10, 6)),
    }, { transaction });

    customers.push(customer);
    leads.push({ lead, customer, package: pkg, property, agent, campaign, status, createdAt, travelStart, travelEnd });
  }

  const enrollments = leads
    .filter((item, index) => index < 28 && !['BOOKED', 'LOST', 'CANCELLED'].includes(item.status))
    .map((item, index) => ({
      sequenceId: dripSequence.id,
      customerId: item.customer.id,
      leadId: item.lead.id,
      agencyId,
      currentStepOrder: 1 + (index % 2),
      status: index % 5 === 0 ? 'PAUSED' : 'ACTIVE',
      nextRunAt: addDays(now, index % 4),
      lastStepSentAt: index % 3 === 0 ? addDays(now, -1) : null,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    }));

  await DripEnrollment.bulkCreate(enrollments, { transaction });
  await dripSequence.update({
    enrollmentCount: enrollments.length,
    completedCount: enrollments.filter((item) => item.status === 'COMPLETED').length,
  }, { transaction });

  return leads;
}

async function createLeadActivity(agencyId, leadItems, campaigns, transaction) {
  const now = new Date();
  const messageRows = [];
  const noteRows = [];
  const followUpRows = [];
  const itineraryRows = [];
  const recipientRows = [];

  for (let index = 0; index < leadItems.length; index += 1) {
    const item = leadItems[index];
    const base = item.createdAt;
    const customerName = item.customer.name.split(' ')[0];

    messageRows.push({
      agencyId,
      customerId: item.customer.id,
      direction: 'IN',
      content: `Hi Wayon, I am planning ${item.destination || item.lead.destination}. Can you share options?`,
      type: 'TEXT',
      status: 'READ',
      timestamp: setTime(base, 10, 5),
    });

    if (!['JUST_CONTACTED', 'NEW'].includes(item.status) || index % 2 === 0) {
      messageRows.push({
        agencyId,
        customerId: item.customer.id,
        agentId: item.agent?.id || null,
        direction: 'OUT',
        content: `Hi ${customerName}, sharing the best ${item.lead.destination} options from Wayon Travels now.`,
        type: index % 5 === 0 ? 'TEMPLATE' : 'TEXT',
        templateName: index % 5 === 0 ? 'wayon_demo_flash_sale' : null,
        waMessageId: `wamid.demo.${slug(item.customer.phone)}.${index}`,
        status: pick(['SENT', 'DELIVERED', 'READ'], index),
        timestamp: setTime(base, 10, 9 + (index % 20)),
      });
    }

    if (['QUOTED', 'NEGOTIATING', 'BOOKED'].includes(item.status)) {
      messageRows.push({
        agencyId,
        customerId: item.customer.id,
        agentId: item.agent?.id || null,
        direction: 'OUT',
        content: `Quote ready: ${item.package?.name || item.property?.name} for ${item.lead.travellers} traveller(s).`,
        type: 'DOCUMENT',
        status: 'READ',
        timestamp: addDays(setTime(base, 15, 10), 1),
      });
    }

    noteRows.push({
      leadId: item.lead.id,
      agentId: item.agent?.id || null,
      content: `Demo note: ${item.status} lead for ${item.lead.destination}. Next best action prepared for client walkthrough.`,
      createdAt: addDays(base, 1),
      updatedAt: addDays(base, 1),
    });

    if (!['BOOKED', 'LOST', 'CANCELLED'].includes(item.status) && index % 3 !== 0) {
      followUpRows.push({
        leadId: item.lead.id,
        agencyId,
        agentId: item.agent?.id || null,
        scheduledAt: setTime(addDays(now, 1 + (index % 14)), 11 + (index % 6), 30),
        note: `Call ${customerName} about ${item.lead.destination} ${pick(['flight lock-in', 'hotel upgrade', 'visa documents', 'family package'], index)}.`,
        status: index % 11 === 0 ? 'Done' : 'Scheduled',
        notificationSent: index % 5 === 0,
        createdAt: base,
        updatedAt: base,
      });
    }

    if (['QUOTED', 'NEGOTIATING', 'BOOKED'].includes(item.status)) {
      itineraryRows.push({
        agencyId,
        customerId: item.customer.id,
        packageId: item.package?.id || null,
        leadId: item.lead.id,
        name: `${item.customer.name} - ${item.lead.destination} Quote`,
        destination: item.lead.destination,
        status: item.status === 'BOOKED' ? 'CONFIRMED' : 'SENT',
        adults: Math.max(1, item.lead.travellers - (index % 2)),
        children: index % 2,
        travelStartDate: dateOnly(item.travelStart),
        travelEndDate: dateOnly(item.travelEnd),
        totalCost: (item.package?.basePrice || item.property?.pricePerNight || amountRupees(45000)) * item.lead.travellers,
        totalPrice: Math.round((item.package?.basePrice || item.property?.pricePerNight || amountRupees(45000)) * item.lead.travellers * 1.18),
        days: [0, 1, 2, 3].map((offset) => ({
          id: `day-${offset + 1}`,
          title: offset === 0 ? `Arrival in ${item.lead.destination}` : `${item.lead.destination} experience day`,
          date: dateOnly(addDays(item.travelStart, offset)),
          description: 'Founder-ready itinerary item for demo walkthrough.',
          hotels: item.property ? [item.property.name] : [],
          activities: ['Sightseeing', 'Local experience', 'Leisure'],
          transports: ['Private cab'],
        })),
        isTemplate: false,
        createdAt: addDays(base, 1),
        updatedAt: addDays(base, 2),
      });
    }

    if (item.campaign) {
      recipientRows.push({
        campaignId: item.campaign.id,
        customerId: item.customer.id,
        leadId: item.lead.id,
        status: pick(['SENT', 'DELIVERED', 'READ', 'REPLIED'], index),
        waMessageId: `wamid.campaign.${slug(item.customer.phone)}.${index}`,
        sentAt: addDays(item.campaign.sentAt || now, 0),
        deliveredAt: addDays(item.campaign.sentAt || now, 0),
        readAt: index % 2 ? addDays(item.campaign.sentAt || now, 1) : null,
        repliedAt: index % 4 === 0 ? addDays(item.campaign.sentAt || now, 1) : null,
        clickedAt: index % 3 === 0 ? addDays(item.campaign.sentAt || now, 1) : null,
        clickedAction: pick(['plan_trip_cta', 'carousel_card', 'talk_to_expert'], index),
        selectedItemType: item.property ? 'PROPERTY' : 'PACKAGE',
        selectedItemId: item.property?.id || item.package?.id || null,
        flowSubmittedAt: index % 5 === 0 ? addDays(item.campaign.sentAt || now, 1) : null,
        createdAt: item.campaign.sentAt || item.createdAt,
        updatedAt: addDays(item.campaign.sentAt || item.createdAt, 1),
      });
    }
  }

  await Message.bulkCreate(messageRows, { transaction });
  await LeadNote.bulkCreate(noteRows, { transaction });
  await FollowUp.bulkCreate(followUpRows, { transaction });
  await Itinerary.bulkCreate(itineraryRows, { transaction });
  await CampaignRecipient.bulkCreate(recipientRows, { ignoreDuplicates: true, transaction });
}

async function createBookingsPaymentsAndReviews(agencyId, leadItems, transaction) {
  const now = new Date();
  const booked = leadItems.filter((item) => item.status === 'BOOKED').slice(0, 10);
  const extraHighIntent = leadItems.filter((item) => ['NEGOTIATING', 'QUOTED'].includes(item.status)).slice(0, 6);
  const bookingItems = [...booked, ...extraHighIntent];
  const year = now.getFullYear();
  const bookings = [];

  for (let index = 0; index < bookingItems.length; index += 1) {
    const item = bookingItems[index];
    const basePrice = item.package?.basePrice || item.property?.pricePerNight || amountRupees(45000);
    const totalAmount = Math.round(basePrice * item.lead.travellers * (1.08 + (index % 4) * 0.05));
    const advancePaid = index % 4 === 0 ? totalAmount : Math.round(totalAmount * pick([0.25, 0.4, 0.6, 1], index));
    const bookingCreatedAt = addDays(now, -(index % 24));
    const travelDate = index < 4 ? addDays(now, -(18 - index * 4)) : addDays(now, 5 + index * 6);
    const returnDate = addDays(travelDate, 3 + (index % 5));
    const booking = await Booking.create({
      leadId: item.lead.id,
      customerId: item.customer.id,
      agencyId,
      packageId: item.package?.id || null,
      bookingRef: `WY-${year}-${String(index + 1).padStart(4, '0')}`,
      status: index < 4 ? 'COMPLETED' : pick(['CONFIRMED', 'PENDING', 'CONFIRMED', 'CANCELLED'], index),
      totalAmount,
      advancePaid,
      travelDate,
      returnDate,
      travellers: item.lead.travellers,
      notes: `Seed marker: ${DEMO_SOURCE}. Founder-ready booking for ${item.lead.destination}.`,
      createdAt: bookingCreatedAt,
      updatedAt: addDays(bookingCreatedAt, 1),
    }, { transaction });

    await item.lead.update({ status: 'BOOKED' }, { transaction });
    await item.customer.update({ isCustomer: true }, { transaction });
    bookings.push({ booking, item, totalAmount, advancePaid, travelDate, returnDate });
  }

  const paymentRows = [];
  const scheduledRows = [];
  const reviewRows = [];

  for (let index = 0; index < bookings.length; index += 1) {
    const { booking, item, totalAmount, advancePaid, returnDate } = bookings[index];
    const paidAt = addDays(booking.createdAt || now, 1);
    paymentRows.push({
      bookingId: booking.id,
      agencyId,
      razorpayPaymentLinkId: `plink_demo_${booking.bookingRef.toLowerCase().replace(/-/g, '_')}_advance`,
      razorpayPaymentId: index % 5 === 0 ? null : `pay_demo_${booking.bookingRef.toLowerCase().replace(/-/g, '_')}`,
      amount: advancePaid,
      status: index % 5 === 0 ? 'PENDING' : 'PAID',
      type: advancePaid >= totalAmount ? 'FULL' : 'ADVANCE',
      paymentLinkUrl: `https://travelbot.wayon.in/demo/pay/${booking.bookingRef}`,
      paidAt: index % 5 === 0 ? null : paidAt,
      expiresAt: addDays(now, 7),
      createdAt: booking.createdAt,
      updatedAt: paidAt,
    });

    const balance = totalAmount - advancePaid;
    if (balance > 0) {
      paymentRows.push({
        bookingId: booking.id,
        agencyId,
        razorpayPaymentLinkId: `plink_demo_${booking.bookingRef.toLowerCase().replace(/-/g, '_')}_balance`,
        amount: balance,
        status: index % 3 === 0 ? 'PAID' : 'PENDING',
        type: 'BALANCE',
        paymentLinkUrl: `https://travelbot.wayon.in/demo/pay/${booking.bookingRef}/balance`,
        paidAt: index % 3 === 0 ? addDays(paidAt, 2) : null,
        expiresAt: addDays(now, 10),
        createdAt: addDays(booking.createdAt, 1),
        updatedAt: addDays(booking.createdAt, 2),
      });
    }

    scheduledRows.push({
      bookingId: booking.id,
      agencyId,
      jobType: 'REMINDER_3DAY',
      scheduledAt: addDays(booking.travelDate, -3),
      status: new Date(booking.travelDate) < now ? 'SENT' : 'PENDING',
      bullJobId: `demo-${booking.bookingRef}-3day`,
    });
    scheduledRows.push({
      bookingId: booking.id,
      agencyId,
      jobType: 'REVIEW_REQUEST',
      scheduledAt: addDays(returnDate, 2),
      status: addDays(returnDate, 2) < now ? 'SENT' : 'PENDING',
      bullJobId: `demo-${booking.bookingRef}-review`,
    });

    if (booking.status === 'COMPLETED') {
      reviewRows.push({
        agencyId,
        customerId: item.customer.id,
        bookingId: booking.id,
        rating: pick([5, 5, 4, 5], index),
        testimonial: `Wayon handled our ${item.lead.destination} trip beautifully. The itinerary, payments, and follow-up were smooth.`,
        destination: item.lead.destination,
        isPublished: true,
        googleReviewSent: true,
        createdAt: addDays(returnDate, 3),
        updatedAt: addDays(returnDate, 3),
      });
    }
  }

  await Payment.bulkCreate(paymentRows, { transaction });
  await ScheduledJob.bulkCreate(scheduledRows, { transaction });
  await Review.bulkCreate(reviewRows, { transaction });
}

async function summarize(agencyId) {
  const [
    customers,
    leads,
    packages,
    properties,
    bookings,
    paidRevenue,
    campaigns,
    reviews,
    followUps,
  ] = await Promise.all([
    Customer.count({ where: { agencyId, source: DEMO_SOURCE } }),
    Lead.count({ where: { agencyId, source: DEMO_SOURCE } }),
    Package.count({ where: { agencyId, summary: { [Op.iLike]: `%${DEMO_SOURCE}%` } } }),
    Property.count({ where: { agencyId, description: { [Op.iLike]: '%Wayon demo%' } } }),
    Booking.count({ where: { agencyId, bookingRef: { [Op.like]: 'WY-%' } } }),
    Payment.sum('amount', { where: { agencyId, status: 'PAID' } }),
    Campaign.count({ where: { agencyId, name: { [Op.like]: 'Wayon Demo%' } } }),
    Review.count({ where: { agencyId } }),
    FollowUp.count({ where: { agencyId } }),
  ]);

  const byStatus = await Lead.findAll({
    where: { agencyId, source: DEMO_SOURCE },
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  return {
    customers,
    leads,
    packages,
    properties,
    bookings,
    paidRevenue,
    campaigns,
    reviews,
    followUps,
    byStatus,
  };
}

async function seedWayonDemoData() {
  const args = parseArgs();
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !args.allowProduction && !args.dryRun) {
    throw new Error('Production seeding requires --confirm-production. Run --dry-run first.');
  }

  await sequelize.authenticate();

  const existingAgency = await findAgencyByName(args.agencyName);
  if (args.dryRun) {
    const summary = existingAgency ? await summarize(existingAgency.id) : null;
    console.log(JSON.stringify({
      dryRun: true,
      agencyFound: Boolean(existingAgency),
      agencyName: existingAgency?.name || args.agencyName,
      requestedLeadCount: args.count,
      currentDemoSummary: summary,
      willReplaceOnlyRowsMarkedWith: { source: DEMO_SOURCE, tag: DEMO_TAG, bookingRefPrefix: 'WY-' },
    }, null, 2));
    return;
  }

  await sequelize.transaction(async (transaction) => {
    const agency = await ensureAgency(args.agencyName, transaction);
    const agents = await ensureAgents(agency.id, transaction);
    await cleanupDemoData(agency.id, transaction);

    const { packages, properties } = await createCatalog(agency.id, transaction);
    const { campaigns } = await createTemplatesAndCampaigns(agency.id, packages, transaction);
    const dripSequence = await createDrips(agency.id, transaction);
    const leadItems = await createCustomersAndLeads(
      agency.id,
      agents,
      packages,
      properties,
      campaigns,
      dripSequence,
      args.count,
      transaction
    );

    await createLeadActivity(agency.id, leadItems, campaigns, transaction);
    await createBookingsPaymentsAndReviews(agency.id, leadItems, transaction);
  });

  const agency = await findAgencyByName(args.agencyName);
  const summary = await summarize(agency.id);
  console.log(JSON.stringify({
    success: true,
    agency: agency.name,
    login: {
      email: 'founder@wayontravels.demo',
      password: PASSWORD,
    },
    summary,
  }, null, 2));
}

if (require.main === module) {
  seedWayonDemoData()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Wayon demo seeding failed:', err.message);
      try {
        await sequelize.close();
      } catch (_) {
        // Ignore close errors during failure handling.
      }
      process.exit(1);
    });
}

module.exports = { seedWayonDemoData };
