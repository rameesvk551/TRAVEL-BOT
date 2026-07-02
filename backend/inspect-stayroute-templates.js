require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');

async function main() {
  const agencyId = 'bc915bd9-0b3b-4c43-9a48-aeb8689434d8';

  const [templateCols] = await sequelize.query(
    "select column_name from information_schema.columns where table_name='message_templates' order by ordinal_position"
  );
  console.log('TEMPLATE_COLUMNS', templateCols.map((c) => c.column_name).join(','));

  const [templates] = await sequelize.query(
    `select id, name, display_name, category, language, status, header_type, body, footer, buttons, template_type, meta_template_id, is_prebuilt
     from message_templates
     where agency_id = $1
     order by created_at desc`,
    { bind: [agencyId] }
  );

  console.log(JSON.stringify(templates, null, 2));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
