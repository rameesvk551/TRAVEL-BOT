const path = require('path');
const { Op } = require('sequelize');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agency, Visa, Service, Package } = require('../models');
const { ensureProductionSchema } = require('../services/schemaBootstrap');

const AGENCY_NAME = 'AL ARAB TOURISM';

const whatsappFlowConfig = {
  welcomeMenu: [
    {
      id: 'al_arab_visa_services',
      title: 'Visa Services',
      description: 'Visa change, visit visas, border support',
      action: 'OPEN_SERVICE_MENU',
      category: 'VISA_SERVICES',
    },
    {
      id: 'al_arab_travel_services',
      title: 'Travel Services',
      description: 'Air tickets, hotels, tours',
      action: 'OPEN_SERVICE_MENU',
      category: 'TRAVEL_SERVICES',
    },
    {
      id: 'al_arab_packages',
      title: 'Packages',
      description: 'Dubai and holiday packages',
      action: 'OPEN_PACKAGE_CATEGORY_MENU',
    },
  ],
  serviceMenu: [
    {
      id: 'al_arab_visa_change_by_bus',
      title: 'Visa Change by Bus',
      description: '30 day and 60 day visa change options',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'VISA_CHANGE_BY_BUS',
    },
    {
      id: 'al_arab_oman_visa',
      title: 'Oman Visa Included',
      description: 'Border fee included options',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'OMAN_VISA_INCLUDED',
    },
    {
      id: 'al_arab_air_tickets',
      title: 'Air Tickets',
      description: 'Domestic and international ticketing',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'AIR_TICKETS',
    },
    {
      id: 'al_arab_hotel_booking',
      title: 'Hotel Booking',
      description: 'Hotel stays and room arrangements',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'HOTEL_BOOKING',
    },
    {
      id: 'al_arab_tourist_visas',
      title: 'Tourist Visas',
      description: 'Visit visa support',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'TOURIST_VISAS',
    },
    {
      id: 'al_arab_desert_safari',
      title: 'Desert Safari',
      description: 'Evening and private safari trips',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'DESERT_SAFARI',
    },
    {
      id: 'al_arab_dhow_cruise',
      title: 'Dhow Cruise',
      description: 'Creek and marina cruise bookings',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'DHOW_CRUISE',
    },
    {
      id: 'al_arab_city_tours',
      title: 'City Tours',
      description: 'Dubai and UAE city tours',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'CITY_TOURS',
    },
    {
      id: 'al_arab_travel_insurance',
      title: 'Travel Insurance',
      description: 'Travel protection plans',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'TRAVEL_INSURANCE',
    },
    {
      id: 'al_arab_weekend_picnics',
      title: 'Weekend Picnics',
      description: 'Short leisure trips',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TRAVEL_SERVICES',
      tourType: 'WEEKEND_PICNICS',
    },
  ],
};

function rupees(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN')}`;
}

async function resolveAgency() {
  const [agencyRow] = await sequelize.query(
    `SELECT id, name
       FROM agencies
      WHERE upper(name) = upper(:name)
         OR upper(name) LIKE upper(:likeName)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: {
        name: AGENCY_NAME,
        likeName: '%AL ARAB%',
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );
  return agencyRow ? Agency.findByPk(agencyRow.id) : null;
}

async function seedAlArabTourismData() {
  await sequelize.authenticate();
  await ensureProductionSchema();

  const agency = await resolveAgency();
  if (!agency) throw new Error(`Agency "${AGENCY_NAME}" not found`);

  const visaRows = [
    {
      agencyId: agency.id,
      country: 'UAE',
      visaType: 'Visa Change by Bus',
      validityPeriod: '30 Days',
      description: 'Border fee included, Oman visa included, two way transfer, next day return, no hidden charges.',
      requiredDocuments: ['Passport copy', 'Photo', 'Travel date', 'Entry permit copy'],
      isActive: true,
    },
    {
      agencyId: agency.id,
      country: 'UAE',
      visaType: 'Visa Change by Bus',
      validityPeriod: '60 Days',
      description: 'Border fee included, Oman visa included, two way transfer, next day return, no hidden charges.',
      requiredDocuments: ['Passport copy', 'Photo', 'Travel date', 'Entry permit copy'],
      isActive: true,
    },
    {
      agencyId: agency.id,
      country: 'UAE',
      visaType: 'Visit Visa',
      validityPeriod: '30 Days',
      description: 'UAE visit visa option with clean processing and support.',
      requiredDocuments: ['Passport copy', 'Photo', 'Travel date'],
      isActive: true,
    },
    {
      agencyId: agency.id,
      country: 'Oman',
      visaType: 'Visit Visa',
      validityPeriod: '30 Days',
      description: 'Oman visa support with border-fee handling.',
      requiredDocuments: ['Passport copy', 'Photo', 'Travel date'],
      isActive: true,
    },
  ];

  const serviceRows = [
    ['Air Tickets', 'TICKETING', 'Air ticket booking and fare support'],
    ['Holiday Packages', 'OTHER', 'Custom and fixed holiday packages'],
    ['Hotel Booking', 'OTHER', 'Hotel reservation and stay support'],
    ['Visit Visas', 'VISA', 'Short visit visa assistance'],
    ['Tourist Visas', 'VISA', 'Tourist visa processing and follow-up'],
    ['Desert Safari', 'OTHER', 'Dubai desert safari bookings'],
    ['Dhow Cruise', 'OTHER', 'Dubai creek and marina cruises'],
    ['City Tours', 'OTHER', 'Dubai and UAE city tours'],
    ['Travel Insurance', 'INSURANCE', 'Travel protection plans'],
    ['Visa Change Tickets', 'VISA', 'Visa change ticketing support'],
    ['Weekend Picnics', 'OTHER', 'Weekend leisure and picnic trips'],
  ].map(([name, category, description], index) => ({
    agencyId: agency.id,
    name,
    category,
    description,
    icon: ['plane', 'globe', 'hotel', 'stamp', 'shield'][index % 5],
    basePrice: null,
    pricingType: 'FIXED',
    features: [],
    isActive: true,
    displayOrder: index,
  }));

  const packageRows = [
    {
      agencyId: agency.id,
      name: 'UAE Visit Visa',
      category: 'INTERNATIONAL',
      tourType: 'UAE_VISIT_VISA',
      duration: '30 Days',
      summary: 'Explore Dubai with UAE visit visa support and flexible durations.',
      destinations: ['Dubai', 'UAE'],
      inclusions: ['Visa support', 'Border fee included', 'Two way transfer'],
      exclusions: ['Personal expenses'],
      isActive: true,
    },
  ];

  await Visa.destroy({
    where: {
      agencyId: agency.id,
      [Op.or]: [
        { visaType: 'Visa Change by Bus' },
        { visaType: 'Visit Visa' },
        { country: 'UAE' },
        { country: 'Oman' },
      ],
    },
  });
  await Service.destroy({ where: { agencyId: agency.id, name: { [Op.in]: serviceRows.map((row) => row.name) } } });
  await Package.destroy({ where: { agencyId: agency.id, name: { [Op.in]: packageRows.map((row) => row.name) } } });

  await Visa.bulkCreate(visaRows.map((row) => ({
    ...row,
    price: row.visaType === 'Visa Change by Bus' && row.validityPeriod === '30 Days' ? 0 : null,
  })));
  await Service.bulkCreate(serviceRows);
  await Package.bulkCreate(packageRows);

  await agency.update({
    whatsappFlowConfig,
    whatsappMenuConfig: [],
  });

  console.log(JSON.stringify({
    success: true,
    agency: { id: agency.id, name: agency.name },
    counts: {
      visas: visaRows.length,
      services: serviceRows.length,
      packages: packageRows.length,
    },
    whatsappFlowConfig: agency.whatsappFlowConfig,
  }, null, 2));
}

if (require.main === module) {
  seedAlArabTourismData()
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

module.exports = { seedAlArabTourismData };
