const { sequelize, Agency } = require('../src/models');

const welcomeMessage = [
  'Hi, welcome to SM Tours and Travels.',
  '',
  'We can help you with visa, ticketing, holiday packages, insurance, and money transfer services.',
  '',
  'Please choose an option to get started.',
].join('\n');

const whatsappMenuLabels = {
  visaTicketing: 'Visa & Ticketing',
  planTrip: 'Holiday Packages',
  flight: 'Flight Tickets',
  rail: 'Train Tickets',
  domestic: 'Domestic Packages',
  international: 'Umrah Packages',
  customTrip: 'Custom Holiday',
};

const whatsappFlowConfig = {
  welcomeMenu: [
    {
      id: 'sm_visa_ticketing',
      title: 'Visa & Ticketing',
      description: 'Flights, train, visa, passport',
      action: 'OPEN_SERVICE_MENU',
      category: 'VISA_TICKETING',
    },
    {
      id: 'sm_holiday_packages',
      title: 'Holiday Packages',
      description: 'Umrah and domestic packages',
      action: 'OPEN_PACKAGE_CATEGORY_MENU',
    },
    {
      id: 'sm_services',
      title: 'Services',
      description: 'Insurance and money transfer',
      action: 'OPEN_SERVICE_MENU',
      category: 'SERVICES',
    },
  ],
  packageCategories: [
    {
      id: 'sm_umrah_packages',
      title: 'Umrah Packages',
      description: 'Pilgrimage package enquiry',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'SERVICES',
      tourType: 'UMRAH_PACKAGES',
    },
    {
      id: 'sm_domestic_packages',
      title: 'Domestic Packages',
      description: 'India holiday packages',
      action: 'OPEN_PACKAGE_FLOW',
      category: 'DOMESTIC',
    },
    {
      id: 'sm_custom_holiday',
      title: 'Custom Holiday',
      description: 'Plan a custom trip',
      action: 'OPEN_CUSTOM_TRIP_FLOW',
    },
  ],
  serviceMenu: [
    {
      id: 'sm_flight_tickets',
      title: 'Flight Tickets',
      description: 'Share route, date, passengers',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_TICKETING',
      tourType: 'FLIGHT_TICKETS',
    },
    {
      id: 'sm_train_tickets',
      title: 'Train Tickets',
      description: 'Train route and passenger details',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_TICKETING',
      tourType: 'TRAIN_TICKETS',
    },
    {
      id: 'sm_visit_visa',
      title: 'Visit Visa',
      description: 'Country, travel date, applicant count',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_TICKETING',
      tourType: 'VISIT_VISA',
    },
    {
      id: 'sm_passport_service',
      title: 'Passport Service',
      description: 'New passport or renewal support',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_TICKETING',
      tourType: 'PASSPORT_SERVICE',
    },
    {
      id: 'sm_travel_insurance',
      title: 'Travel Insurance',
      description: 'Destination and travel dates',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'SERVICES',
      tourType: 'TRAVEL_INSURANCE',
    },
    {
      id: 'sm_money_transfer',
      title: 'Money Transfer',
      description: 'Domestic money transfer support',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'SERVICES',
      tourType: 'DOMESTIC_MONEY_TRANSFER',
    },
  ],
};

async function main() {
  const [agencyRow] = await sequelize.query(
    `SELECT id, name
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (!agencyRow) throw new Error('SM TOURS AND TRAVELS agency not found');

  const agency = await Agency.findByPk(agencyRow.id);
  await agency.update({
    welcomeMessage,
    whatsappMenuLabels,
    whatsappMenuConfig: [],
    whatsappFlowConfig,
  });

  console.log(JSON.stringify({
    success: true,
    agency: { id: agency.id, name: agency.name },
    welcomeMessage: agency.welcomeMessage,
    whatsappMenuLabels: agency.whatsappMenuLabels,
    whatsappFlowConfig: agency.whatsappFlowConfig,
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
