require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Agency, sequelize } = require('../models');
const flowService = require('../services/flowService');

async function main() {
  await sequelize.authenticate();

  const agencies = await Agency.findAll({
    where: {
      whatsappProvider: 'MARKETING_OS',
    },
    order: [['createdAt', 'ASC']],
  });

  let checked = 0;
  let created = 0;

  for (const agency of agencies) {
    checked += 1;
    const result = await flowService.ensureDefaultFlowsForAgency(agency);
    created += result.created || 0;
    console.log(`${agency.name} (${agency.id}): created ${result.created || 0}`);
  }

  console.log(JSON.stringify({ checked, created }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.stack || err.message || err);
    try {
      await sequelize.close();
    } catch {}
    process.exit(1);
  });
