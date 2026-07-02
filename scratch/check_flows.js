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
  
  console.log('Flows available:');
  console.log(config.flows.map(f => f.id));
  
  const servicesFlow = config.flows.find(f => f.id === 'services');
  if (servicesFlow) {
    console.log('Services flow nodes:', servicesFlow.nodes.map(n => n.id));
  }
  
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
