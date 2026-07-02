const path = require('path');

const root = path.resolve(__dirname, '..');
const { Agency, WhatsAppFlow, sequelize } = require(path.join(root, 'backend/src/models'));
const flowService = require(path.join(root, 'backend/src/services/flowService'));

const AGENCY_ID = '9bf0d4d3-9f53-480c-8674-495f5e32f9ad';
const FLOW_ID = '0d92b16e-5dbe-4fa7-ae28-67da31fec47d';

async function main() {
  const agency = await Agency.findByPk(AGENCY_ID, {
    attributes: [
      'id',
      'name',
      'whatsappNumber',
      'whatsappPhoneNumberId',
      'whatsappBusinessAccountId',
      'marketingOsTenantId',
      'whatsappConnectionStatus',
    ],
  });
  if (!agency) throw new Error(`Agency not found: ${AGENCY_ID}`);

  const flow = await WhatsAppFlow.findOne({ where: { id: FLOW_ID, agencyId: AGENCY_ID } });
  if (!flow) throw new Error(`Flow not found: ${FLOW_ID}`);

  const before = {
    id: flow.id,
    name: flow.name,
    status: flow.status,
    metaFlowId: flow.metaFlowId,
    firstScreenId: flow.firstScreenId,
    updatedAt: flow.updatedAt,
  };

  await flow.update({
    metaFlowId: null,
    status: 'DRAFT',
    validationErrors: [],
    healthStatus: null,
    lastSyncedAt: null,
  });

  let published;
  try {
    published = await flowService.publishFlow(flow.id, agency.id);
    await published.reload();
  } catch (error) {
    await flow.reload();
    console.log(JSON.stringify({
      ok: false,
      agency,
      before,
      afterFailedPublish: {
        id: flow.id,
        status: flow.status,
        metaFlowId: flow.metaFlowId,
        validationErrors: flow.validationErrors,
      },
      error: error?.response?.data || error?.message || String(error),
    }, null, 2));
    throw error;
  }

  console.log(JSON.stringify({
    ok: true,
    agency,
    before,
    after: {
      id: published.id,
      name: published.name,
      status: published.status,
      metaFlowId: published.metaFlowId,
      firstScreenId: published.firstScreenId,
      validationErrors: published.validationErrors,
      updatedAt: published.updatedAt,
      lastSyncedAt: published.lastSyncedAt,
    },
  }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
