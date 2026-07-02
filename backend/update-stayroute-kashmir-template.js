require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');

const TEMPLATE_IDS = [
  'dd5837d4-1978-4d71-9635-0b89ba7194c1',
  '80965799-d5f6-411e-807a-02aadff0ace1',
];

function updateBody(body) {
  return String(body || '')
    .replace(/scheduled for 7th June/g, 'scheduled for 15th June')
    .replace(/₹40,000 per person/g, '₹43,000 per person')
    .replace(/Rs\.?\s*39,999 per person/gi, 'Rs 43,000 per person')
    .replace(/₹39,999 per person/g, '₹43,000 per person');
}

async function main() {
  const [before] = await sequelize.query(
    `select id, name, body
     from message_templates
     where agency_id = $1 and id = any($2::uuid[])
     order by name`,
    { bind: ['bc915bd9-0b3b-4c43-9a48-aeb8689434d8', TEMPLATE_IDS] }
  );

  console.log('BEFORE');
  console.log(JSON.stringify(before, null, 2));

  for (const template of before) {
    const nextBody = updateBody(template.body);
    if (nextBody === template.body) {
      console.log(`NO_CHANGE ${template.name}`);
      continue;
    }

    await sequelize.query(
      `update message_templates
       set body = $1, updated_at = now()
       where id = $2 and agency_id = $3`,
      {
        bind: [
          nextBody,
          template.id,
          'bc915bd9-0b3b-4c43-9a48-aeb8689434d8',
        ],
      }
    );
    console.log(`UPDATED ${template.name}`);
  }

  const [after] = await sequelize.query(
    `select id, name, body
     from message_templates
     where agency_id = $1 and id = any($2::uuid[])
     order by name`,
    { bind: ['bc915bd9-0b3b-4c43-9a48-aeb8689434d8', TEMPLATE_IDS] }
  );

  console.log('AFTER');
  console.log(JSON.stringify(after, null, 2));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
