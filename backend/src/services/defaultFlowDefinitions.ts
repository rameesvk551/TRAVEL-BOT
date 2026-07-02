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
      STAY_REQUEST: [],
      PROPERTY_FILTER: ['PROPERTY_SELECTOR', 'STAY_REQUEST'],
      PROPERTY_SELECTOR: ['PROPERTY_DATES'],
      PROPERTY_DATES: [],
    },
    screens: [
      {
        id: 'STAY_REQUEST',
        title: 'Stay Request',
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
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'stay_request_form',
              children: [
                { type: 'TextHeading', text: 'Request a Stay' },
                { type: 'TextBody', text: 'Share what you need and our team will help with matching stay options.' },
                {
                  type: 'TextInput',
                  name: 'propertyLocation',
                  label: 'Location',
                  required: true,
                  'input-type': 'text',
                  'helper-text': 'Example: Munnar',
                },
                {
                  type: 'Dropdown',
                  name: 'propertyType',
                  label: 'Stay Type',
                  required: true,
                  'data-source': [
                    { id: 'Villa', title: 'Villa' },
                    { id: 'Resort', title: 'Resort' },
                    { id: 'Hotel', title: 'Hotel' },
                    { id: 'Apartment', title: 'Apartment' },
                    { id: 'Homestay', title: 'Homestay' },
                    { id: 'Any', title: 'Any stay type' },
                  ],
                },
                {
                  type: 'DatePicker',
                  name: 'checkInDate',
                  label: 'Check-in Date',
                  required: true,
                },
                {
                  type: 'DatePicker',
                  name: 'checkOutDate',
                  label: 'Check-out Date',
                  required: true,
                },
                {
                  type: 'TextInput',
                  name: 'guests',
                  label: 'Number of People',
                  required: true,
                  'input-type': 'number',
                  'helper-text': 'Total people',
                },
                {
                  type: 'Footer',
                  label: 'Submit Request',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      stayRequest: 'true',
                      propertyLocation: '${form.propertyLocation}',
                      propertyType: '${form.propertyType}',
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
                  type: 'TextInput',
                  name: 'propertyLocation',
                  label: 'Location',
                  required: true,
                  'input-type': 'text',
                  'helper-text': 'Example: Munnar',
                },
                {
                  type: 'TextInput',
                  name: 'propertyType',
                  label: 'Stay Type',
                  required: true,
                  'input-type': 'text',
                  'helper-text': 'Villa, Resort, Hotel, Apartment, Homestay, or Any',
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
                  type: 'DatePicker',
                  name: 'checkInDate',
                  label: 'Check-in Date',
                  required: true,
                },
                {
                  type: 'DatePicker',
                  name: 'checkOutDate',
                  label: 'Check-out Date',
                  required: true,
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
                  type: 'DatePicker',
                  name: 'travelDate',
                  label: 'Travel Date',
                  required: true,
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
      TRAVELLER_COUNT: ['TRIP_TYPE'],
      TRIP_TYPE: ['DEPARTURE_AIRPORT'],
      DEPARTURE_AIRPORT: ['ROOM_TYPE'],
      ROOM_TYPE: [],
    },
    screens: [
      {
        id: 'TRAVELLER_COUNT',
        title: 'Kashmir Onam',
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Hi 👋' },
                {
                  type: 'TextBody',
                  text: 'Thank you for your interest in our Kashmir Onam Special (27th–31st August).',
                },
                {
                  type: 'RadioButtonsGroup',
                  name: 'travellerCount',
                  label: 'May I know the number of travellers joining the trip?',
                  required: true,
                  'data-source': [
                    { id: 'ONE_PERSON', title: '1 traveller' },
                    { id: 'TWO_PEOPLE', title: '2 travellers' },
                    { id: 'THREE_TO_FIVE', title: '3-5 travellers' },
                    { id: 'SIX_OR_MORE', title: '6 or more travellers' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Next',
                  'on-click-action': {
                    name: 'navigate',
                    next: { type: 'screen', name: 'TRIP_TYPE' },
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
        id: 'TRIP_TYPE',
        title: 'Kashmir Onam',
        data: {
          travellerCount: {
            type: 'string',
            __example__: 'TWO_PEOPLE',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Travel Details' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'tripType',
                  label: 'Could you please tell us who this trip is for?',
                  required: true,
                  'data-source': [
                    { id: 'SOLO', title: 'Solo traveller' },
                    { id: 'BACHELOR_GROUP', title: 'Bachelor group' },
                    { id: 'COUPLE', title: 'Couple' },
                    { id: 'FAMILY', title: 'Family' },
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
                      tripType: '${form.tripType}',
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
        title: 'Kashmir Onam',
        data: {
          travellerCount: {
            type: 'string',
            __example__: 'TWO_PEOPLE',
          },
          tripType: {
            type: 'string',
            __example__: 'COUPLE',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Departure Airport' },
                {
                  type: 'Dropdown',
                  name: 'departureAirport',
                  label: 'Please choose your preferred departure airport',
                  required: true,
                  'data-source': [
                    { id: 'COK', title: 'Kochi (COK)' },
                    { id: 'TRV', title: 'Thiruvananthapuram (TRV)' },
                    { id: 'CCJ', title: 'Kozhikode (CCJ)' },
                    { id: 'CNN', title: 'Kannur (CNN)' },
                    { id: 'FLEXIBLE', title: 'Flexible / Any Kerala airport' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Next',
                  'on-click-action': {
                    name: 'navigate',
                    next: { type: 'screen', name: 'ROOM_TYPE' },
                    payload: {
                      travellerCount: '${data.travellerCount}',
                      tripType: '${data.tripType}',
                      departureAirport: '${form.departureAirport}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'ROOM_TYPE',
        title: 'Kashmir Onam',
        terminal: true,
        data: {
          travellerCount: {
            type: 'string',
            __example__: 'TWO_PEOPLE',
          },
          tripType: {
            type: 'string',
            __example__: 'COUPLE',
          },
          departureAirport: {
            type: 'string',
            __example__: 'COK',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'travel_readiness_form',
              children: [
                { type: 'TextHeading', text: 'Room Preference' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'roomType',
                  label: 'What is your preferred room type?',
                  required: true,
                  'data-source': [
                    { id: 'COUPLE_ROOM', title: 'Couple room' },
                    { id: 'FAMILY_ROOM', title: 'Family room' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Submit',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      travellerCount: '${data.travellerCount}',
                      tripType: '${data.tripType}',
                      departureAirport: '${data.departureAirport}',
                      roomType: '${form.roomType}',
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

function visaFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      VISA_SELECTOR: [],
    },
    screens: [
      {
        id: 'VISA_SELECTOR',
        title: 'Visa Services',
        terminal: true,
        data: {
          category_label: {
            type: 'string',
            __example__: 'Visa Services',
          },
          visa_options: {
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
                id: 'visa_uae_01',
                title: 'UAE Tourist Visa',
                description: 'INR 6,500 - 3 to 4 working days\nSingle entry, 30 days validity.',
                metadata: 'Tourist',
                image: EMPTY_PIXEL,
              },
              {
                id: 'visa_schengen_01',
                title: 'Schengen Visa',
                description: 'INR 9,500 - 10 to 15 working days\nMulti-country Europe travel.',
                metadata: 'Tourist',
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
              name: 'visa_selector_form',
              children: [
                { type: 'TextHeading', text: 'Visa Services' },
                { type: 'TextBody', text: 'Choose a visa to view documents, fees, and processing time.' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'visaId',
                  label: 'Available Visas',
                  required: true,
                  'data-source': '${data.visa_options}',
                },
                {
                  type: 'Footer',
                  label: 'View Visa',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      visaId: '${form.visaId}',
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

function cruiseFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      CRUISE_SELECTOR: [],
    },
    screens: [
      {
        id: 'CRUISE_SELECTOR',
        title: 'Cruise Holidays',
        terminal: true,
        data: {
          category_label: {
            type: 'string',
            __example__: 'Cruise Holidays',
          },
          cruise_options: {
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
                id: 'cruise_dubai_01',
                title: 'Dubai Getaway Cruise',
                description: 'INR 32,000 - 4 Nights\nDubai, Sir Bani Yas, Abu Dhabi.',
                metadata: 'Costa',
                image: EMPTY_PIXEL,
              },
              {
                id: 'cruise_singapore_01',
                title: 'Singapore - Malaysia',
                description: 'INR 45,000 - 5 Nights\nSingapore, Penang, Phuket.',
                metadata: 'Royal Caribbean',
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
              name: 'cruise_selector_form',
              children: [
                { type: 'TextHeading', text: 'Cruise Holidays' },
                { type: 'TextBody', text: 'Choose a cruise to view itinerary, cabins, and pricing.' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'cruiseId',
                  label: 'Available Cruises',
                  required: true,
                  'data-source': '${data.cruise_options}',
                },
                {
                  type: 'Footer',
                  label: 'View Cruise',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      cruiseId: '${form.cruiseId}',
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

function serviceFlowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      SERVICE_SELECTOR: [],
    },
    screens: [
      {
        id: 'SERVICE_SELECTOR',
        title: 'Our Services',
        terminal: true,
        data: {
          category_label: {
            type: 'string',
            __example__: 'Our Services',
          },
          service_options: {
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
                id: 'service_flight_01',
                title: 'Flight Ticketing',
                description: 'Domestic and international air tickets at the best fares.',
                metadata: 'Ticketing',
                image: EMPTY_PIXEL,
              },
              {
                id: 'service_insurance_01',
                title: 'Travel Insurance',
                description: 'Comprehensive cover for medical, baggage, and delays.',
                metadata: 'Insurance',
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
              name: 'service_selector_form',
              children: [
                { type: 'TextHeading', text: 'Our Services' },
                { type: 'TextBody', text: 'Choose a service to view details or start an enquiry.' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'serviceId',
                  label: 'Available Services',
                  required: true,
                  'data-source': '${data.service_options}',
                },
                {
                  type: 'Footer',
                  label: 'View Service',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      serviceId: '${form.serviceId}',
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
      firstScreenId: 'STAY_REQUEST',
      categories: ['OTHER'],
      jsonDefinition: propertyFlowDefinition(),
    },
    {
      name: `${prefix} Visa Flow`,
      flowType: 'VISA',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'VISA_SELECTOR',
      categories: ['OTHER'],
      jsonDefinition: visaFlowDefinition(),
    },
    {
      name: `${prefix} Cruise Flow`,
      flowType: 'CRUISE',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'CRUISE_SELECTOR',
      categories: ['OTHER'],
      jsonDefinition: cruiseFlowDefinition(),
    },
    {
      name: `${prefix} Service Flow`,
      flowType: 'SERVICE',
      status: 'DRAFT',
      endpointUri: DEFAULT_ENDPOINT_URI,
      firstScreenId: 'SERVICE_SELECTOR',
      categories: ['OTHER'],
      jsonDefinition: serviceFlowDefinition(),
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
