const { sequelize, Customer, Lead } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    'SELECT id, name FROM agencies WHERE lower(name)=lower(:name) LIMIT 1',
    { replacements: { name: 'wayon travels' }, type: sequelize.QueryTypes.SELECT }
  );

  if (!agency) {
    console.log(JSON.stringify({ agency: null }, null, 2));
    return;
  }

  const customer = await Customer.findOne({
    where: { agencyId: agency.id },
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  const lead = customer
    ? await Lead.findOne({
      where: { agencyId: agency.id, customerId: customer.id },
      order: [['createdAt', 'DESC']],
      raw: true,
    })
    : null;

  console.log(JSON.stringify({ agency, customer, lead }, null, 2));
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
