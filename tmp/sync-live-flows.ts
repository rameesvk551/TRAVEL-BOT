const flowService = require('./backend/src/services/flowService');
const { Agency, sequelize } = require('./backend/src/models');

async function main() {
  const agency = await Agency.findOne({
    where: { name: 'ABC Trours' },
    attributes: ['id', 'name', 'marketingOsTenantId', 'whatsappTripFlowId'],
  });

  if (!agency) {
    throw new Error('Agency ABC Trours not found');
  }

  const result = await flowService.syncFlows(agency.id);
  console.log(JSON.stringify({
    agency: agency.toJSON(),
    result,
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err?.stack || err?.message || err);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
