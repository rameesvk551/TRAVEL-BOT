const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const { Agency, WhatsAppFlow, sequelize } = require(path.join(repoRoot, 'backend/src/models'));

async function main() {
  const draftFlows = await WhatsAppFlow.findAll({
    where: {
      flowType: 'REVIEW',
      status: 'DRAFT',
    },
    order: [['updatedAt', 'DESC']],
  });

  const removed = [];
  for (const flow of draftFlows) {
    const agency = await Agency.findByPk(flow.agencyId, { attributes: ['id', 'name'] });
    removed.push({
      id: flow.id,
      agencyId: flow.agencyId,
      agencyName: agency?.name || null,
      name: flow.name,
      metaFlowId: flow.metaFlowId,
      firstScreenId: flow.firstScreenId,
      status: flow.status,
    });
    await flow.destroy();
  }

  console.log(JSON.stringify({ removed }, null, 2));
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
