// Fix TravAround: Change services node from OPEN_SERVICE to OPEN_SERVICE_FLOW
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
  
  const entryFlow = flowConfig.flows.find(f => f.id === 'entry');
  if (!entryFlow) {
    console.log('Entry flow not found!');
    await client.end();
    return;
  }
  
  // Remove message_6 and end_7 which were trailing from the old OPEN_SERVICE node
  const removeNodeIds = new Set(['message_6', 'end_7']);
  entryFlow.nodes = entryFlow.nodes.filter(n => !removeNodeIds.has(n.id));
  entryFlow.edges = entryFlow.edges.filter(e => !removeNodeIds.has(e.source) && !removeNodeIds.has(e.target));

  // Find the services node and change its type to point to the services sub-flow
  const servicesNode = entryFlow.nodes.find(n => n.id === 'services');
  if (servicesNode) {
    servicesNode.type = 'OPEN_SERVICE_FLOW';
    servicesNode.data = { category: '' };
  }

  // Update timestamp
  entryFlow.updatedAt = new Date().toISOString();
  flowConfig.updatedAt = new Date().toISOString();

  await client.query(`UPDATE agencies SET whatsapp_flow_config = $1 WHERE id = $2`, [JSON.stringify(flowConfig), AGENCY_ID]);
  
  console.log('✅ Fixed! Services node in Entry Menu changed to route to the Services sub-flow.');
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
