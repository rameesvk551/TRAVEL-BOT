require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');

async function main() {
  const [rows] = await sequelize.query(
    `select id, name, image_url, brochure_url
     from packages
     where agency_id = 'bc915bd9-0b3b-4c43-9a48-aeb8689434d8'
       and (lower(name) like '%kashmir%' or image_url is not null)
     order by lower(name)`
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
