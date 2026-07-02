const { sequelize, Agency } = require('../src/models');

const welcomeMessage = [
  'Hi {customerName}, welcome to AL ARAB TOURISM.',
  '',
  'Please choose what you need today.',
].join('\n');

const whatsappMenuLabels = {
  visaTicketing: 'Visa Services',
  planTrip: 'Tour Packages',
  flight: 'Flight Tickets',
  rail: 'Oman Visa',
  domestic: 'Desert Safari',
  international: 'Holiday Packages',
  customTrip: 'Custom Travel Plan',
};

const whatsappFlowConfig = {
  welcomeMenu: [
    {
      id: 'al_arab_visa_services',
      title: 'Visa Services',
      description: 'UAE visa, bus change, Oman visa',
      action: 'OPEN_SERVICE_MENU',
      category: 'VISA_SERVICES',
    },
    {
      id: 'al_arab_flight_tickets',
      title: 'Flight Tickets',
      description: 'One way, return, multi city',
      action: 'OPEN_SERVICE_MENU',
      category: 'FLIGHT_TICKETS',
    },
    {
      id: 'al_arab_tour_packages',
      title: 'Tour Packages',
      description: 'Safari, cruise, Dubai tours',
      action: 'OPEN_SERVICE_MENU',
      category: 'TOUR_PACKAGES',
    },
  ],
  packageCategories: [
    {
      id: 'al_arab_holiday_packages',
      title: 'Holiday Packages',
      description: 'Family, group, or custom package',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'HOLIDAY_TRIPS',
      tourType: 'HOLIDAY_PACKAGES',
    },
    {
      id: 'al_arab_weekend_trips',
      title: 'Weekend Trips',
      description: 'Short UAE and nearby escapes',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'HOLIDAY_TRIPS',
      tourType: 'WEEKEND_TRIPS',
    },
    {
      id: 'al_arab_custom_plan',
      title: 'Custom Travel Plan',
      description: 'Let our team plan it for you',
      action: 'OPEN_CUSTOM_TRIP_FLOW',
    },
  ],
  serviceMenu: [
    {
      id: 'al_arab_uae_tourist_visa',
      title: 'UAE Tourist Visa',
      description: 'New UAE visit or tourist visa',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'UAE_TOURIST_VISA',
    },
    {
      id: 'al_arab_visa_change_bus',
      title: 'Visa Change by Bus',
      description: 'Bus visa change support',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'VISA_CHANGE_BY_BUS',
    },
    {
      id: 'al_arab_oman_visa',
      title: 'Oman Visa',
      description: 'Oman visa and border support',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'OMAN_VISA',
    },
    {
      id: 'al_arab_travel_insurance',
      title: 'Travel Insurance',
      description: 'Insurance for visa or travel',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'VISA_SERVICES',
      tourType: 'TRAVEL_INSURANCE',
    },
    {
      id: 'al_arab_one_way_ticket',
      title: 'One Way Ticket',
      description: 'Single-sector flight enquiry',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'FLIGHT_TICKETS',
      tourType: 'ONE_WAY_TICKET',
    },
    {
      id: 'al_arab_return_ticket',
      title: 'Return Ticket',
      description: 'Round-trip flight enquiry',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'FLIGHT_TICKETS',
      tourType: 'RETURN_TICKET',
    },
    {
      id: 'al_arab_multi_city_booking',
      title: 'Multi City Booking',
      description: 'Multiple cities or sectors',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'FLIGHT_TICKETS',
      tourType: 'MULTI_CITY_BOOKING',
    },
    {
      id: 'al_arab_desert_safari',
      title: 'Desert Safari',
      description: 'Safari date and guest count',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TOUR_PACKAGES',
      tourType: 'DESERT_SAFARI',
    },
    {
      id: 'al_arab_dhow_cruise',
      title: 'Dhow Cruise',
      description: 'Creek or marina cruise enquiry',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TOUR_PACKAGES',
      tourType: 'DHOW_CRUISE',
    },
    {
      id: 'al_arab_dubai_city_tour',
      title: 'Dubai City Tour',
      description: 'Dubai, Abu Dhabi, or custom tour',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TOUR_PACKAGES',
      tourType: 'DUBAI_CITY_TOUR',
    },
    {
      id: 'al_arab_holiday_packages',
      title: 'Holiday Packages',
      description: 'Complete trip package enquiry',
      action: 'CAPTURE_SERVICE_DETAILS',
      category: 'TOUR_PACKAGES',
      tourType: 'HOLIDAY_PACKAGES',
    },
  ],
};

async function main() {
  const [agencyRow] = await sequelize.query(
    `SELECT id, name
       FROM agencies
      WHERE lower(name) LIKE '%al%arab%tour%'
      ORDER BY created_at DESC
      LIMIT 1`,
    { type: sequelize.QueryTypes.SELECT }
  );

  if (!agencyRow) throw new Error('AL ARAB TOURISM agency not found');

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
