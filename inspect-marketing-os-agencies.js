const path = require('path');
const { Op } = require(path.resolve(process.cwd(), 'backend/node_modules/sequelize'));

require(path.resolve(process.cwd(), 'backend/node_modules/dotenv')).config({ path: path.resolve(process.cwd(), '.env') });

const { Agency, WhatsAppFlow, sequelize } = require(path.resolve(process.cwd(), 'backend/src/models'));

async function main() {
  await sequelize.authenticate();
  const agencies = await Agency.findAll({
    where: { whatsappProvider: 'MARKETING_OS' },
    order: [['createdAt', 'ASC']],
  });

  const rows = [];
  for (const agency of agencies) {
    const questionnaire = await WhatsAppFlow.findOne({
      where: {
        agencyId: agency.id,
        name: { [Op.iLike]: '%Travel Readiness Questionnaire%' },
      },
    });
    rows.push({
      name: agency.name,
      id: agency.id,
      provider: agency.whatsappProvider,
      connectionStatus: agency.whatsappConnectionStatus,
      tenantId: agency.marketingOsTenantId,
      questionnaire: questionnaire ? questionnaire.status : null,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
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
