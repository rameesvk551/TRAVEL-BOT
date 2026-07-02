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
  const result = await client.query(`SELECT whatsapp_flow_config FROM agencies WHERE id = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'`);
  const config = result.rows[0].whatsapp_flow_config;
  const entryFlow = config.flows.find(f => f.id === config.entryFlowId);
  
  const servicesNode = entryFlow.nodes.find(n => n.id === 'services');
  console.log('Services node:', JSON.stringify(servicesNode, null, 2));
  
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
