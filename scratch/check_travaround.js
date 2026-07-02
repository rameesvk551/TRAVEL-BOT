// Check what service f5c2bb95 is, and dump the services sub-flow
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '55432'),
  database: process.env.DB_NAME || 'travelbot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

(async () => {
  await client.connect();
  
  // Check the hardcoded service
  const svc = await client.query(`SELECT id, name, category FROM services WHERE id = 'f5c2bb95-dded-4b10-86d4-db5812eae11b'`);
  console.log('Hardcoded service:', svc.rows[0] || 'NOT FOUND');
  
  // List all services for TravAround
  const allSvc = await client.query(`SELECT id, name, category FROM services WHERE agency_id = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018' ORDER BY name`);
  console.log('\nAll TravAround services:');
  for (const s of allSvc.rows) {
    console.log(`  - ${s.name} (ID: ${s.id}, category: ${s.category})`);
  }

  // Get the services sub-flow
  const result = await client.query(`SELECT whatsapp_flow_config FROM agencies WHERE id = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'`);
  const flowConfig = result.rows[0].whatsapp_flow_config;
  const servicesFlow = flowConfig.flows.find(f => f.id === 'services');
  if (servicesFlow) {
    console.log('\n========== SERVICES SUB-FLOW ==========');
    console.log('startNodeId:', servicesFlow.startNodeId);
    console.log('\nNODES:');
    for (const node of (servicesFlow.nodes || [])) {
      console.log(`  [${node.id}] type=${node.type} data=${JSON.stringify(node.data)}`);
    }
    console.log('\nEDGES:');
    for (const edge of (servicesFlow.edges || [])) {
      console.log(`  ${edge.source} --(${edge.sourceHandle || 'default'})--> ${edge.target}`);
    }
  }
  
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
