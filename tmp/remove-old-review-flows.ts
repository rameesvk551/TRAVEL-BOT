const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const flowService = require(path.join(repoRoot, 'backend/src/services/flowService'));
const { Agency, WhatsAppFlow, sequelize } = require(path.join(repoRoot, 'backend/src/models'));

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function loadTargetAgencies() {
  const agencyId = readArg('agency-id');
  const agencyName = readArg('agency-name');

  if (agencyId) {
    const agency = await Agency.findByPk(agencyId);
    return agency ? [agency] : [];
  }

  if (agencyName) {
    const agency = await Agency.findOne({ where: { name: agencyName } });
    return agency ? [agency] : [];
  }

  return Agency.findAll({
    where: { whatsappProvider: 'MARKETING_OS' },
    order: [['createdAt', 'DESC']],
  });
}

async function removeOldReviewFlowsForAgency(agency) {
  const deleteRemote = hasFlag('delete-remote');
  const oldFlows = await WhatsAppFlow.findAll({
    where: {
      agencyId: agency.id,
      flowType: 'REVIEW',
      firstScreenId: 'REVIEW_FORM',
    },
    order: [['updatedAt', 'DESC']],
  });

  const removed = [];
  const warnings = [];

  for (const flow of oldFlows) {
    if (!deleteRemote) {
      await flow.destroy();
      removed.push({
        id: flow.id,
        name: flow.name,
        metaFlowId: flow.metaFlowId,
        deletedRemote: false,
      });
      continue;
    }

    try {
      await flowService.deleteFlow(flow.id, agency.id);
      removed.push({
        id: flow.id,
        name: flow.name,
        metaFlowId: flow.metaFlowId,
        deletedRemote: true,
      });
    } catch (error) {
      warnings.push({
        id: flow.id,
        name: flow.name,
        metaFlowId: flow.metaFlowId,
        message: error?.message || String(error),
      });
      await flow.destroy();
      removed.push({
        id: flow.id,
        name: flow.name,
        metaFlowId: flow.metaFlowId,
        deletedRemote: false,
      });
    }
  }

  return {
    agency: {
      id: agency.id,
      name: agency.name,
    },
    removed,
    warnings,
  };
}

async function main() {
  const agencies = await loadTargetAgencies();
  if (!agencies.length) throw new Error('No matching Marketing OS agencies found');

  const results = [];
  for (const agency of agencies) {
    results.push(await removeOldReviewFlowsForAgency(agency));
  }

  console.log(JSON.stringify({ results }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err?.stack || err?.message || err);
    if (err?.original) {
      console.error('Original error:', err.original?.stack || err.original?.message || err.original);
    }
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
