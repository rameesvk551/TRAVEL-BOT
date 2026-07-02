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
  
  const b = await client.query(`SELECT id, status, notes FROM bookings WHERE notes ILIKE '%account%' OR id::text ILIKE '%account%'`);
  console.log(`Bookings with account: ${b.rows.length}`);
  
  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
