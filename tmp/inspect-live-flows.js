const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://edger_user:edger_pass@localhost:5436/travel_ops',
});

async function main() {
  await client.connect();

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  console.log(JSON.stringify({
    tables: tables.rows,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
