const { sequelize, Agency } = require('../src/models');

async function main() {
  const [row] = await sequelize.query(
    `SELECT id
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (!row) throw new Error('SM TOURS AND TRAVELS agency not found');

  const welcomeMessage = [
    'Hi {customerName}, welcome to SM Tours and Travels.',
    '',
    'We can help you with visa, ticketing, holiday packages, insurance, and money transfer services.',
    '',
    'Please choose an option to get started.',
  ].join('\n');

  const agency = await Agency.findByPk(row.id);
  await agency.update({ welcomeMessage });

  console.log(JSON.stringify({
    success: true,
    agency: agency.name,
    welcomeMessage: agency.welcomeMessage,
  }, null, 2));
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
