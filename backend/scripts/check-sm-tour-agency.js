const { sequelize } = require('../src/models');

async function main() {
  const agencies = await sequelize.query(
    `SELECT id, name, email, phone, whatsapp_number AS "whatsappNumber", is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 10`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  const latest = await sequelize.query(
    `SELECT id, name, email, phone, whatsapp_number AS "whatsappNumber", is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agencies
      ORDER BY created_at DESC
      LIMIT 5`,
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ matches: agencies, latestAgencies: latest }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
