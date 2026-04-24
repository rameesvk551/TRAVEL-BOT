const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'travelbot',
});

async function main() {
  const result = await pool.query(
    "select display_name, status, template_type, jsonb_array_length(coalesce(buttons, '[]'::jsonb)) as button_count, jsonb_array_length(coalesce(carousel_cards, '[]'::jsonb)) as card_count from message_templates where agency_id is not null and status = 'APPROVED' order by updated_at desc limit 20"
  );
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});
