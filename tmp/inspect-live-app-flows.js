const models = require('/home/ec2-user/travel-bot-git/backend/src/models/index.ts');

async function main() {
  const { Agency, WhatsAppFlow, sequelize } = models;

  const agencies = await Agency.findAll({
    attributes: ['id', 'name', 'whatsappNumber', 'marketingOsTenantId', 'whatsappTripFlowId'],
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  const flows = await WhatsAppFlow.findAll({
    attributes: ['id', 'agencyId', 'name', 'flowType', 'status', 'metaFlowId', 'firstScreenId', 'updatedAt'],
    order: [['agencyId', 'ASC'], ['flowType', 'ASC'], ['updatedAt', 'DESC']],
    raw: true,
  });

  console.log(JSON.stringify({ agencies, flows }, null, 2));
  await sequelize.close();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await models.sequelize.close();
  } catch (_) {}
  process.exit(1);
});
