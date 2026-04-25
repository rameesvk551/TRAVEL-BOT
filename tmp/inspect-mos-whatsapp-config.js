const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://edger_user:edger_pass@localhost:5436/travel_ops',
});

async function main() {
  await client.connect();

  const result = await client.query(`
    SELECT tenant_id, business_name, waba_id, phone_number_id, phone_display, status
    FROM whatsapp_business_configs
    ORDER BY updated_at DESC
  `);

  console.log(JSON.stringify(result.rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
