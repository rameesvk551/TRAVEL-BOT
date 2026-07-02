const { Agency, WhatsAppFlow, Sequelize, sequelize } = require('../backend/src/models');
const flowService = require('../backend/src/services/flowService');
const { Op } = Sequelize;

const SHOULD_PUBLISH = process.argv.includes('--publish');
const FLOW_NAME = 'GetOutHouse.in Stay Enquiry Flow';
const FIRST_SCREEN_ID = 'GETOUTHOUSE_STAY_ENQUIRY';

function flowDefinition() {
  return {
    version: '7.2',
    data_api_version: '3.0',
    routing_model: {
      [FIRST_SCREEN_ID]: [],
    },
    screens: [
      {
        id: FIRST_SCREEN_ID,
        title: 'Stay Enquiry',
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'getouthouse_stay_enquiry_form',
              children: [
                {
                  type: 'TextInput',
                  name: 'guestName',
                  label: 'Name',
                  required: true,
                  'input-type': 'text',
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
                  type: 'Dropdown',
                  name: 'groupType',
                  label: 'Group type',
                  required: true,
                  'data-source': [
                    { id: 'Family /Couple', title: 'Family /Couple' },
                    { id: 'Men /Boys Only', title: 'Men /Boys Only' },
                    { id: 'Ladies/ girls only', title: 'Ladies/ girls only' },
                  ],
                },
                {
                  type: 'TextInput',
                  name: 'adults',
                  label: 'No. of Adults',
                  required: true,
                  'input-type': 'number',
                  'helper-text': '12 years & above',
                },
                {
                  type: 'TextInput',
                  name: 'children6To12',
                  label: 'No. of Children',
                  required: false,
                  'input-type': 'number',
                  'helper-text': '6-12 years',
                },
                {
                  type: 'TextInput',
                  name: 'childrenBelow5',
                  label: 'No. of Children',
                  required: false,
                  'input-type': 'number',
                  'helper-text': 'Below 5 years',
                },
                {
                  type: 'TextInput',
                  name: 'rooms',
                  label: 'No. of rooms',
                  required: true,
                  'input-type': 'number',
                },
                {
                  type: 'TextBody',
                  text: "We'll get back to you shortly with availability and the best stay options!",
                },
                {
                  type: 'Footer',
                  label: 'Submit Enquiry',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      enquiryType: 'getouthouse_stay',
                      guestName: '${form.guestName}',
                      checkInDate: '${form.checkInDate}',
                      checkOutDate: '${form.checkOutDate}',
                      groupType: '${form.groupType}',
                      adults: '${form.adults}',
                      children6To12: '${form.children6To12}',
                      childrenBelow5: '${form.childrenBelow5}',
                      rooms: '${form.rooms}',
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

async function findAgency() {
  const agencies = await Agency.findAll({
    where: {
      [Op.or]: [
        { name: { [Op.iLike]: '%GetOutHouse%' } },
        { email: { [Op.iLike]: '%getouthouse%' } },
        { subdomain: { [Op.iLike]: '%getouthouse%' } },
        { customDomain: { [Op.iLike]: '%getouthouse%' } },
        { websiteTitle: { [Op.iLike]: '%GetOutHouse%' } },
      ],
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!agencies.length) {
    throw new Error('No agency matched GetOutHouse fields.');
  }

  if (agencies.length > 1) {
    console.log('Matched agencies:', agencies.map((agency) => ({
      id: agency.id,
      name: agency.name,
      email: agency.email,
      subdomain: agency.subdomain,
      customDomain: agency.customDomain,
      websiteTitle: agency.websiteTitle,
    })));
  }

  return agencies[0];
}

async function main() {
  const agency = await findAgency();
  const definition = flowDefinition();
  const payload = {
    agencyId: agency.id,
    name: FLOW_NAME,
    flowType: 'PROPERTY',
    status: 'DRAFT',
    endpointUri: process.env.WHATSAPP_FLOW_ENDPOINT_URL || 'https://travelbot.wayon.in/api/whatsapp/flow',
    firstScreenId: FIRST_SCREEN_ID,
    categories: ['OTHER'],
    jsonDefinition: definition,
    validationErrors: [],
  };

  const [flow, created] = await WhatsAppFlow.findOrCreate({
    where: { agencyId: agency.id, name: FLOW_NAME },
    defaults: payload,
  });

  if (!created) {
    await flow.update(payload);
  }

  let publishError = null;
  if (SHOULD_PUBLISH) {
    try {
      await flowService.publishFlow(flow.id, agency.id);
      await flow.reload();
    } catch (err) {
      publishError = err?.response?.data || err?.message || String(err);
    }
  }

  console.log(JSON.stringify({
    agency: {
      id: agency.id,
      name: agency.name,
      email: agency.email,
      subdomain: agency.subdomain,
      customDomain: agency.customDomain,
      whatsappProvider: agency.whatsappProvider,
      marketingOsTenantId: agency.marketingOsTenantId,
      whatsappConnectionStatus: agency.whatsappConnectionStatus,
    },
    flow: {
      id: flow.id,
      name: flow.name,
      flowType: flow.flowType,
      status: flow.status,
      metaFlowId: flow.metaFlowId,
      firstScreenId: flow.firstScreenId,
      endpointUri: flow.endpointUri,
      updatedAt: flow.updatedAt,
    },
    created,
    published: SHOULD_PUBLISH && !publishError,
    publishError,
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
