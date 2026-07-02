require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');

async function main() {
  const [rows] = await sequelize.query(
    `select id, name, header_type, header_content, sample_variables, status, meta_template_id
     from message_templates
     where id in ('dd5837d4-1978-4d71-9635-0b89ba7194c1', '80965799-d5f6-411e-807a-02aadff0ace1')
     order by name`
  );
  console.log(JSON.stringify(rows, null, 2));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
