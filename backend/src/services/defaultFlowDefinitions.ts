const DEFAULT_ENDPOINT_URI = process.env.WHATSAPP_FLOW_ENDPOINT_URL || 'https://travelbot.wayon.in/api/whatsapp/flow';

const EMPTY_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yh8cAAAAASUVORK5CYII=';

function agencyPrefix(agency) {
  return String(agency?.name || 'Company').trim() || 'Company';
}

function packageFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      PACKAGE_SELECTOR: [],
    },
    screens: [
      {
        id: 'PACKAGE_SELECTOR',
        title: 'Choose Package',
        terminal: true,
        data: {
          category_label: {
            type: 'string',
            __example__: 'Domestic',
          },
          package_options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                metadata: { type: 'string' },
                image: { type: 'string' },
              },
            },
            __example__: [
              {
                id: 'pkg_goa_01',
                title: 'Goa Bliss Escape',
                description: 'INR 24,999 - 3 Nights 4 Days\nBeach stay, breakfast, transfers, and sunset cruise.',
                metadata: 'Domestic',
                image: EMPTY_PIXEL,
              },
              {
                id: 'pkg_bali_01',
                title: 'Bali Romance',
                description: 'INR 68,999 - 5 Nights 6 Days\nResort stay, island tours, and curated couple moments.',
                metadata: 'International',
                image: EMPTY_PIXEL,
              },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'package_selector_form',
              children: [
                { type: 'TextHeading', text: 'Available Packages' },
                { type: 'TextBody', text: 'Choose one package to view details or start enquiry.' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'packageId',
                  label: 'Available Packages',
                  required: true,
                  'data-source': '${data.package_options}',
                },
                {
                  type: 'Footer',
                  label: 'View Package',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      packageId: '${form.packageId}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function propertyFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      PROPERTY_FILTER: ['PROPERTY_SELECTOR'],
      PROPERTY_SELECTOR: ['PROPERTY_DATES'],
      PROPERTY_DATES: [],
    },
    screens: [
      {
        id: 'PROPERTY_FILTER',
        title: 'Find a Stay',
        data: {
          property_locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
            __example__: [
              { id: 'ALL', title: 'All locations' },
              { id: 'Goa', title: 'Goa' },
              { id: 'Munnar', title: 'Munnar' },
            ],
          },
          property_types: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
            __example__: [
              { id: 'ALL', title: 'All stay types' },
              { id: 'Villa', title: 'Villa' },
              { id: 'Resort', title: 'Resort' },
              { id: 'Hotel', title: 'Hotel' },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'property_filter_form',
              children: [
                { type: 'TextHeading', text: 'Find Your Stay' },
                { type: 'TextBody', text: 'Choose a place and stay type to see matching properties.' },
                {
                  type: 'Dropdown',
                  name: 'propertyLocation',
                  label: 'Location',
                  required: true,
                  'data-source': '${data.property_locations}',
                },
                {
                  type: 'Dropdown',
                  name: 'propertyType',
                  label: 'Stay Type',
                  required: true,
                  'data-source': '${data.property_types}',
                },
                {
                  type: 'Footer',
                  label: 'Show Properties',
                  'on-click-action': {
                    name: 'data_exchange',
                    payload: {
                      propertyLocation: '${form.propertyLocation}',
                      propertyType: '${form.propertyType}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'PROPERTY_SELECTOR',
        title: 'Choose Property',
        terminal: true,
        data: {
          propertyLocation: {
            type: 'string',
            __example__: 'Goa',
          },
          propertyType: {
            type: 'string',
            __example__: 'Villa',
          },
          property_options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                metadata: { type: 'string' },
                image: { type: 'string' },
              },
            },
            __example__: [
              {
                id: 'stay_villa_01',
                title: 'Private Pool Villa',
                description: 'INR 12,000 per night\n2 bedrooms, breakfast, and private pool.',
                metadata: 'Villa',
                image: EMPTY_PIXEL,
              },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'property_selector_form',
              children: [
                { type: 'TextHeading', text: 'Matching Properties' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'propertyId',
                  label: 'Available Properties',
                  required: true,
                  'data-source': '${data.property_options}',
                },
                {
                  type: 'Footer',
                  label: 'Select Property',
                  'on-click-action': {
                    name: 'data_exchange',
                    payload: {
                      propertyId: '${form.propertyId}',
                      propertyLocation: '${data.propertyLocation}',
                      propertyType: '${data.propertyType}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'PROPERTY_DATES',
        title: 'Stay Details',
        terminal: true,
        data: {
          propertyId: {
            type: 'string',
            __example__: 'stay_villa_01',
          },
          propertyLocation: {
            type: 'string',
            __example__: 'Goa',
          },
          propertyType: {
            type: 'string',
            __example__: 'Villa',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'property_dates_form',
              children: [
                { type: 'TextHeading', text: 'Check Availability' },
                { type: 'TextBody', text: 'Add your dates and guests for the selected property.' },
                {
                  type: 'TextInput',
                  name: 'checkInDate',
                  label: 'Check-in Date',
                  required: true,
                  'input-type': 'text',
                  'helper-text': 'Example: 20 May 2026',
                },
                {
                  type: 'TextInput',
                  name: 'checkOutDate',
                  label: 'Check-out Date',
                  required: true,
                  'input-type': 'text',
                  'helper-text': 'Example: 23 May 2026',
                },
                {
                  type: 'TextInput',
                  name: 'guests',
                  label: 'Guests',
                  required: true,
                  'input-type': 'number',
                  'helper-text': 'Total guests',
                },
                {
                  type: 'Footer',
                  label: 'Request Availability',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      propertyId: '${data.propertyId}',
                      propertyLocation: '${data.propertyLocation}',
                      propertyType: '${data.propertyType}',
                      checkInDate: '${form.checkInDate}',
                      checkOutDate: '${form.checkOutDate}',
                      guests: '${form.guests}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function customTripFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      CUSTOM_TRIP_FORM: [],
    },
    screens: [
      {
        id: 'CUSTOM_TRIP_FORM',
        title: 'Custom Trip',
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'custom_trip_form',
              children: [
                { type: 'TextHeading', text: 'Plan Your Custom Trip' },
                {
                  type: 'TextBody',
                  text: 'Share your preferences and our team will build a package around your dates, budget, and travel style.',
                },
                {
                  type: 'TextInput',
                  name: 'name',
                  label: 'Full Name',
                  required: true,
                  'input-type': 'text',
                },
                {
                  type: 'TextInput',
                  name: 'destination',
                  label: 'Destination or Route',
                  required: true,
                  'input-type': 'text',
                },
                {
                  type: 'TextInput',
                  name: 'travelDate',
                  label: 'Travel Date or Month',
                  required: true,
                  'input-type': 'text',
                },
                {
                  type: 'TextInput',
                  name: 'travellers',
                  label: 'Travellers',
                  required: true,
                  'input-type': 'number',
                },
                {
                  type: 'TextInput',
                  name: 'budget',
                  label: 'Budget per Person',
                  required: true,
                  'input-type': 'number',
                },
                {
                  type: 'TextInput',
                  name: 'notes',
                  label: 'Trip Notes',
                  required: false,
                  'input-type': 'text',
                },
                {
                  type: 'Footer',
                  label: 'Submit Request',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      name: '${form.name}',
                      destination: '${form.destination}',
                      travelDate: '${form.travelDate}',
                      travellers: '${form.travellers}',
                      budget: '${form.budget}',
                      notes: '${form.notes}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function travelReadinessQuestionnaireFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      TRAVELLER_COUNT: ['BOOKING_READINESS'],
      BOOKING_READINESS: ['DEPARTURE_AIRPORT'],
      DEPARTURE_AIRPORT: [],
    },
    screens: [
      {
        id: 'TRAVELLER_COUNT',
        title: 'Trip Questionnaire',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Plan Your Trip' },
                {
                  type: 'TextBody',
                  text: 'Answer a few quick questions so our team can match the right travel option.',
                },
                {
                  type: 'RadioButtonsGroup',
                  name: 'travellerCount',
                  label: 'How many people are planning to travel?',
                  required: true,
                  'data-source': [
                    { id: '1_PERSON', title: '1 person' },
                    { id: '2_PEOPLE', title: '2 people' },
                    { id: '3_TO_5_PEOPLE', title: '3-5 people' },
                    { id: 'FAMILY_OR_GROUP', title: 'Family / Group' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Next',
                  'on-click-action': {
                    name: 'navigate',
                    next: { type: 'screen', name: 'BOOKING_READINESS' },
                    payload: {
                      travellerCount: '${form.travellerCount}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'BOOKING_READINESS',
        title: 'Trip Questionnaire',
        data: {
          travellerCount: {
            type: 'string',
            __example__: '2_PEOPLE',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Plan Your Trip' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'bookingReadiness',
                  label: 'Are you ready if the details match?',
                  required: true,
                  'data-source': [
                    { id: 'READY_TO_BOOK', title: 'Yes, ready to book' },
                    { id: 'NEED_MORE_DETAILS', title: 'Need more details' },
                    { id: 'JUST_EXPLORING', title: 'Just exploring' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Next',
                  'on-click-action': {
                    name: 'navigate',
                    next: { type: 'screen', name: 'DEPARTURE_AIRPORT' },
                    payload: {
                      travellerCount: '${data.travellerCount}',
                      bookingReadiness: '${form.bookingReadiness}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'DEPARTURE_AIRPORT',
        title: 'Trip Questionnaire',
        terminal: true,
        data: {
          travellerCount: {
            type: 'string',
            __example__: '2_PEOPLE',
          },
          bookingReadiness: {
            type: 'string',
            __example__: 'READY_TO_BOOK',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Plan Your Trip' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'departureAirport',
                  label: 'Preferred departure airport',
                  required: true,
                  'data-source': [
                    { id: 'CCJ', title: 'Kozhikode' },
                    { id: 'COK', title: 'Kochi' },
                    { id: 'TRV', title: 'Thiruvananthapuram' },
                    { id: 'FLEXIBLE', title: 'Flexible' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Submit',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      travellerCount: '${data.travellerCount}',
                      bookingReadiness: '${data.bookingReadiness}',
                      departureAirport: '${form.departureAirport}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function reviewFlowDefinition() {
  return {
    version: '7.3',
    data_api_version: '3.0',
    routing_model: {
      RECOMMEND: ['RATE'],
      RATE: [],
    },
    screens: [
      {
        id: 'RECOMMEND',
        title: 'Feedback 1 of 2',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'flow_path',
              children: [
                {
                  type: 'Image',
                  src: EMPTY_PIXEL,
                  height: 200,
                  'scale-type': 'contain',
                },
                {
                  type: 'TextSubheading',
                  text: 'Would you recommend this trip experience to a friend?',
                },
                {
                  type: 'RadioButtonsGroup',
                  label: 'Choose one',
                  name: 'Choose_one',
                  required: true,
                  'data-source': [
                    { id: '0_Yes', title: 'Yes' },
                    { id: '1_No', title: 'No' },
                  ],
                },
                {
                  type: 'TextSubheading',
                  text: 'How can we make your next trip better?',
                },
                {
                  type: 'TextArea',
                  label: 'Share your trip feedback',
                  required: false,
                  name: 'Leave_a_comment',
                },
                {
                  type: 'Footer',
                  label: 'Continue',
                  'on-click-action': {
                    name: 'navigate',
                    next: {
                      type: 'screen',
                      name: 'RATE',
                    },
                    payload: {
                      screen_0_Choose_0: '${form.Choose_one}',
                      screen_0_Leave_a_1: '${form.Leave_a_comment}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'RATE',
        title: 'Feedback 2 of 2',
        terminal: true,
        data: {
          screen_0_Choose_0: {
            type: 'string',
            __example__: '0_Yes',
          },
          screen_0_Leave_a_1: {
            type: 'string',
            __example__: 'Good support from the team.',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'flow_path',
              children: [
                {
                  type: 'TextSubheading',
                  text: 'Rate the following:',
                },
                {
                  type: 'Dropdown',
                  label: 'Booking experience',
                  required: true,
                  name: 'Purchase_experience',
                  'data-source': [
                    { id: '0_Excellent', title: '★★★★★ - Excellent (5/5)' },
                    { id: '1_Good', title: '★★★★☆ - Good (4/5)' },
                    { id: '2_Average', title: '★★★☆☆ - Average (3/5)' },
                    { id: '3_Poor', title: '★★☆☆☆ - Poor (2/5)' },
                    { id: '4_Very_Poor', title: '★☆☆☆☆ - Very Poor (1/5)' },
                  ],
                },
                {
                  type: 'Dropdown',
                  label: 'Trip arrangements',
                  required: true,
                  name: 'Delivery_and_setup',
                  'data-source': [
                    { id: '0_Excellent', title: '★★★★★ - Excellent (5/5)' },
                    { id: '1_Good', title: '★★★★☆ - Good (4/5)' },
                    { id: '2_Average', title: '★★★☆☆ - Average (3/5)' },
                    { id: '3_Poor', title: '★★☆☆☆ - Poor (2/5)' },
                    { id: '4_Very_Poor', title: '★☆☆☆☆ - Very Poor (1/5)' },
                  ],
                },
                {
                  type: 'Dropdown',
                  label: 'Travel support',
                  required: true,
                  name: 'Customer_service',
                  'data-source': [
                    { id: '0_Excellent', title: '★★★★★ - Excellent (5/5)' },
                    { id: '1_Good', title: '★★★★☆ - Good (4/5)' },
                    { id: '2_Average', title: '★★★☆☆ - Average (3/5)' },
                    { id: '3_Poor', title: '★★☆☆☆ - Poor (2/5)' },
                    { id: '4_Very_Poor', title: '★☆☆☆☆ - Very Poor (1/5)' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Done',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      screen_1_Purchase_0: '${form.Purchase_experience}',
                      screen_1_Delivery_and_1: '${form.Delivery_and_setup}',
                      screen_1_Customer_2: '${form.Customer_service}',
                      screen_0_Choose_0: '${data.screen_0_Choose_0}',
                      screen_0_Leave_a_1: '${data.screen_0_Leave_a_1}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function getDefaultFlowDefinitions(agency) {
  const prefix = agencyPrefix(agency);

  return [
    {
      name: `${prefix} Package Flow`,
      flowType: 'PACKAGE',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'PACKAGE_SELECTOR',
      categories: ['OTHER'],
      jsonDefinition: packageFlowDefinition(),
    },
    {
      name: `${prefix} Property Flow`,
      flowType: 'PROPERTY',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'PROPERTY_FILTER',
      categories: ['OTHER'],
      jsonDefinition: propertyFlowDefinition(),
    },
    {
      name: `${prefix} Custom Trip Flow`,
      flowType: 'CUSTOM_TRIP',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'CUSTOM_TRIP_FORM',
      categories: ['OTHER'],
      jsonDefinition: customTripFlowDefinition(),
    },
    {
      name: `${prefix} Travel Readiness Questionnaire`,
      flowType: 'GENERIC',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'TRAVELLER_COUNT',
      categories: ['OTHER'],
      jsonDefinition: travelReadinessQuestionnaireFlowDefinition(),
    },
    {
      name: `${prefix} Review Flow`,
      flowType: 'REVIEW',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'RECOMMEND',
      categories: ['OTHER'],
      jsonDefinition: reviewFlowDefinition(),
    },
  ];
}

module.exports = {
  getDefaultFlowDefinitions,
};
