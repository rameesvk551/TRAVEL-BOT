// Fix TravAround: Change services node from OPEN_SERVICE to CATALOG_LIST with follow-up questions
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '55432'),
  database: process.env.DB_NAME || 'travelbot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const AGENCY_ID = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018';

(async () => {
  await client.connect();
  
  const result = await client.query(`SELECT whatsapp_flow_config FROM agencies WHERE id = $1`, [AGENCY_ID]);
  const flowConfig = result.rows[0].whatsapp_flow_config;
  
  // Find the entry flow
  const entryFlow = flowConfig.flows.find(f => f.id === 'entry');
  if (!entryFlow) {
    console.log('Entry flow not found!');
    await client.end();
    return;
  }
  
  // Remove the old "services" node and the downstream message_6 and end_7 nodes
  const removeNodeIds = new Set(['services', 'message_6', 'end_7']);
  entryFlow.nodes = entryFlow.nodes.filter(n => !removeNodeIds.has(n.id));
  
  // Remove edges that reference removed nodes
  entryFlow.edges = entryFlow.edges.filter(e => !removeNodeIds.has(e.source) && !removeNodeIds.has(e.target));

  // Add new nodes for the services flow (catalog list → detail → follow-up questions → save)
  const newNodes = [
    {
      id: 'services_catalog',
      type: 'CATALOG_LIST',
      data: {
        body: 'Choose a service.',
        buttonLabel: 'View Services',
        catalogType: 'SERVICE',
        emptyMessage: 'No active services are available right now.',
        itemOverrides: [],
      },
      position: { x: 600, y: 400 },
    },
    {
      id: 'services_detail',
      type: 'SEND_ITEM_DETAIL',
      data: { message: '', catalogType: 'AUTO' },
      position: { x: 860, y: 400 },
    },
    {
      id: 'services_from',
      type: 'QUESTION',
      data: { prompt: 'From where?', fieldKey: 'from' },
      position: { x: 1120, y: 400 },
    },
    {
      id: 'services_to',
      type: 'QUESTION',
      data: { prompt: 'To where?', fieldKey: 'to' },
      position: { x: 1380, y: 400 },
    },
    {
      id: 'services_traveldate',
      type: 'QUESTION',
      data: { prompt: 'When do you want to travel?', fieldKey: 'traveldate' },
      position: { x: 1640, y: 400 },
    },
    {
      id: 'services_people',
      type: 'QUESTION',
      data: { prompt: 'How many people?', fieldKey: 'people' },
      position: { x: 1900, y: 400 },
    },
    {
      id: 'services_save',
      type: 'SAVE_ENQUIRY',
      data: {
        status: 'ENQUIRY',
        notePrefix: 'Services enquiry',
        finalMessage: 'Thank you. Our team will contact you shortly.',
      },
      position: { x: 2160, y: 400 },
    },
    {
      id: 'services_empty_end',
      type: 'END',
      data: { message: 'Please message us with your requirement and our team will help you shortly.' },
      position: { x: 860, y: 550 },
    },
  ];
  entryFlow.nodes.push(...newNodes);

  // Add new edges:
  // main_menu --(services)--> services_catalog  (replace old edge to "services" node)
  // Plus the chain: catalog → detail → from → to → traveldate → people → save
  const newEdges = [
    { id: 'main_menu_services', source: 'main_menu', target: 'services_catalog', sourceHandle: 'services' },
    { id: 'services_catalog_selected', source: 'services_catalog', target: 'services_detail', sourceHandle: 'selected' },
    { id: 'services_catalog_empty', source: 'services_catalog', target: 'services_empty_end', sourceHandle: 'empty' },
    { id: 'services_detail_from', source: 'services_detail', target: 'services_from', sourceHandle: 'default' },
    { id: 'services_from_to', source: 'services_from', target: 'services_to', sourceHandle: 'default' },
    { id: 'services_to_date', source: 'services_to', target: 'services_traveldate', sourceHandle: 'default' },
    { id: 'services_date_people', source: 'services_traveldate', target: 'services_people', sourceHandle: 'default' },
    { id: 'services_people_save', source: 'services_people', target: 'services_save', sourceHandle: 'default' },
  ];
  
  // Remove the old main_menu → services edge
  entryFlow.edges = entryFlow.edges.filter(e => !(e.source === 'main_menu' && e.sourceHandle === 'services'));
  entryFlow.edges.push(...newEdges);
  
  // Update timestamp
  entryFlow.updatedAt = new Date().toISOString();
  flowConfig.updatedAt = new Date().toISOString();

  // Save back to DB
  await client.query(`UPDATE agencies SET whatsapp_flow_config = $1 WHERE id = $2`, [JSON.stringify(flowConfig), AGENCY_ID]);
  
  console.log('✅ Fixed! Entry flow now shows service catalog instead of hardcoded Train Ticket.');
  console.log('\nUpdated entry flow nodes:');
  for (const node of entryFlow.nodes) {
    console.log(`  [${node.id}] type=${node.type}`);
  }
  console.log('\nUpdated entry flow edges:');
  for (const edge of entryFlow.edges) {
    console.log(`  ${edge.source} --(${edge.sourceHandle || 'default'})--> ${edge.target}`);
  }
  
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
