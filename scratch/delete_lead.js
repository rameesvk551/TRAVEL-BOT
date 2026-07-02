// Delete TravAround lead for 9605734995
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
  
  const phone = '%9605734995%';
  const agencyId = '5f64bd06-24d7-4f8a-beb2-c37e6e1b1018'; // TravAround Tours and Travels
  
  const result = await client.query(`
    DELETE FROM leads 
    WHERE customer_id IN (
      SELECT id FROM customers WHERE phone LIKE $1 AND agency_id = $2
    )
    RETURNING id;
  `, [phone, agencyId]);
  
  console.log(`Deleted ${result.rowCount} lead(s) for TravAround:`, result.rows.map(r => r.id));

  await client.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
