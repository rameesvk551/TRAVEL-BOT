const path = require('path');
const { Op } = require(path.resolve(process.cwd(), 'backend/node_modules/sequelize'));

require(path.resolve(process.cwd(), 'backend/node_modules/dotenv')).config({ path: path.resolve(process.cwd(), '.env') });

const { Agency, WhatsAppFlow, sequelize } = require(path.resolve(process.cwd(), 'backend/src/models'));

async function main() {
  await sequelize.authenticate();
  const flows = await WhatsAppFlow.findAll({
    where: {
      name: { [Op.iLike]: '%Travel Readiness Questionnaire%' },
    },
    include: [{ model: Agency, as: 'agency', attributes: ['name'] }],
    order: [['createdAt', 'ASC']],
  });

  console.log(JSON.stringify({
    count: flows.length,
    flows: flows.map((flow) => ({
      agency: flow.agency?.name || null,
      name: flow.name,
      status: flow.status,
      flowType: flow.flowType,
      firstScreenId: flow.firstScreenId,
      hasDefinition: !!flow.jsonDefinition?.screens?.length,
    })),
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error.stack || error.message || error);
    try {
      await sequelize.close();
    } catch {}
    process.exit(1);
  });
