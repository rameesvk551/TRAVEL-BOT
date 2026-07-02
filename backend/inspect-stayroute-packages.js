require('dotenv').config({ path: '../.env' });

const { sequelize } = require('./dist/models');

async function main() {
  const [agencyCols] = await sequelize.query(
    "select column_name from information_schema.columns where table_name='agencies' order by ordinal_position"
  );
  const [packageCols] = await sequelize.query(
    "select column_name from information_schema.columns where table_name='packages' order by ordinal_position"
  );

  console.log('AGENCY_COLUMNS', agencyCols.map((c) => c.column_name).join(','));
  console.log('PACKAGE_COLUMNS', packageCols.map((c) => c.column_name).join(','));

  const [agencies] = await sequelize.query(
    "select id, name, email from agencies where lower(coalesce(name, '')) like '%stay%' or lower(coalesce(email, '')) like '%stay%' order by created_at desc"
  );

  console.log('MATCHING_AGENCIES');
  console.log(JSON.stringify(agencies, null, 2));

  for (const agency of agencies) {
    const [packages] = await sequelize.query(
      'select id, name, destinations, duration, base_price, category, summary, is_active from packages where agency_id = $1 order by created_at desc',
      { bind: [agency.id] }
    );
    console.log(`PACKAGES_FOR ${agency.id} ${agency.name}`);
    console.log(JSON.stringify(packages, null, 2));
  }

  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await sequelize.close();
  } catch (_) {}
  process.exit(1);
});
