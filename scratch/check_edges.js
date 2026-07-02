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
  const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018';
  const result = await client.query(`SELECT whatsapp_flow_config FROM agencies WHERE id = $1`, [agencyId]);
  const flowConfig = result.rows[0].whatsapp_flow_config;
  const servicesFlow = flowConfig.flows.find(f => f.id === 'services');
  console.log('EDGES:');
  for (const edge of servicesFlow.edges) {
    if (edge.source === 'services_detail') {
      console.log(`Source: ${edge.source}, Target: ${edge.target}, Handle: ${edge.sourceHandle}`);
    }
  }
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
