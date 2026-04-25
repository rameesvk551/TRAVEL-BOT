const { WhatsAppFlow, Agency, sequelize } = require('./backend/src/models');

async function main() {
  const agency = await Agency.findOne({
    where: { name: 'ABC Trours' },
    attributes: ['id', 'name', 'whatsappTripFlowId'],
  });

  if (!agency) {
    throw new Error('Agency ABC Trours not found');
  }

  const updates = {
    PACKAGE: agency.whatsappTripFlowId,
    PROPERTY: '808725575254796',
    CUSTOM_TRIP: '1618243719453495',
  };

  for (const [flowType, metaFlowId] of Object.entries(updates)) {
    await WhatsAppFlow.update(
      {
        metaFlowId,
        status: 'PUBLISHED',
        lastSyncedAt: new Date(),
      },
      {
        where: {
          agencyId: agency.id,
          flowType,
        },
      }
    );
  }

  const flows = await WhatsAppFlow.findAll({
    where: { agencyId: agency.id },
    attributes: ['id', 'name', 'flowType', 'status', 'metaFlowId', 'firstScreenId', 'updatedAt'],
    order: [['flowType', 'ASC']],
    raw: true,
  });

  console.log(JSON.stringify({
    agency: agency.toJSON(),
    flows,
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
