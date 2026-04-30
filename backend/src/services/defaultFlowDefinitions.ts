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
                { type: 'TextHeading', text: '${data.category_label} Packages' },
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
      PROPERTY_SELECTOR: [],
    },
    screens: [
      {
        id: 'PROPERTY_SELECTOR',
        title: 'Choose Property',
        terminal: true,
        data: {
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
              {
                id: 'stay_resort_01',
                title: 'Beach Resort',
                description: 'INR 8,500 per night\nSea view room, breakfast, and resort access.',
                metadata: 'Resort',
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
                { type: 'TextHeading', text: 'Select a Stay' },
                { type: 'TextBody', text: 'Choose one property and our team will help with availability.' },
                {
                  type: 'RadioButtonsGroup',
                  name: 'propertyId',
                  label: 'Available Properties',
                  required: true,
                  'data-source': '${data.property_options}',
                },
                {
                  type: 'Footer',
                  label: 'Request Availability',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      propertyId: '${form.propertyId}',
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
      firstScreenId: 'PROPERTY_SELECTOR',
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
  ];
}

module.exports = {
  getDefaultFlowDefinitions,
};
