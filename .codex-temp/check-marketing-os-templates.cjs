const { Pool } = require('pg');

const pool = new Pool({
  user: 'edger_user',
  password: 'edger_pass',
  host: 'localhost',
  port: 5436,
  database: 'travel_ops',
});

async function main() {
  const result = await pool.query(
    `select template_name, status, left(body_content, 120) as body_preview, components
     from message_templates
     where lower(template_name) in ('abc_carousel_image_v2', 'abc_carousel_video_v2', 'abc_carousel_image', 'abc_carousel_video')
     order by template_name`
  );
  console.log(JSON.stringify(result.rows, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end().catch(() => {});
  process.exit(1);
});
