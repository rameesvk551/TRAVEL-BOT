const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const flowService = require(path.join(repoRoot, 'backend/src/services/flowService'));
const { Agency, WhatsAppFlow, sequelize } = require(path.join(repoRoot, 'backend/src/models'));

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? '' : (process.argv[index + 1] || '');
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8'));
}

async function loadTargetAgencies() {
  const agencyId = readArg('agency-id');
  const agencyName = readArg('agency-name');
  const all = ['1', 'true', 'yes'].includes(String(readArg('all')).toLowerCase());

  if (agencyId) {
    const agency = await Agency.findByPk(agencyId);
    return agency ? [agency] : [];
  }

  if (agencyName) {
    const agency = await Agency.findOne({ where: { name: agencyName } });
    return agency ? [agency] : [];
  }

  if (!all) {
    throw new Error('Pass --agency-id, --agency-name, or --all before replacing review flows');
  }

  return Agency.findAll({
    where: {
      whatsappProvider: 'MARKETING_OS',
    },
    order: [['createdAt', 'DESC']],
  });
}

async function replaceReviewFlowForAgency(agency, reviewJson) {
  const existingFlows = await WhatsAppFlow.findAll({
    where: {
      agencyId: agency.id,
      flowType: 'REVIEW',
    },
    order: [['updatedAt', 'DESC']],
  });

  const alreadyPublished = existingFlows.find((flow) =>
    flow.status === 'PUBLISHED'
      && flow.firstScreenId === 'RECOMMEND'
      && flow.metaFlowId
  );

  if (alreadyPublished) {
    return {
      agency: {
        id: agency.id,
        name: agency.name,
      },
      skipped: true,
      reason: 'travel review flow already published',
      published: {
        id: alreadyPublished.id,
        name: alreadyPublished.name,
        metaFlowId: alreadyPublished.metaFlowId,
        status: alreadyPublished.status,
        firstScreenId: alreadyPublished.firstScreenId,
      },
      removed: [],
      warnings: [],
    };
  }

  const agencyName = String(agency.name || 'Company').trim() || 'Company';
  let newFlow = existingFlows.find((flow) =>
    flow.firstScreenId === 'RECOMMEND'
      && flow.status !== 'PUBLISHED'
      && String(flow.name || '').includes('Travel Review Flow')
  );

  if (newFlow) {
    await flowService.updateFlow(newFlow.id, agency.id, {
      name: `${agencyName} Travel Review Flow`,
      flowType: 'REVIEW',
      status: 'DRAFT',
      firstScreenId: 'RECOMMEND',
      categories: ['OTHER'],
      jsonDefinition: reviewJson,
    });
    newFlow = await WhatsAppFlow.findOne({ where: { id: newFlow.id, agencyId: agency.id } });
  } else {
    newFlow = await flowService.createFlow(agency.id, {
      name: `${agencyName} Travel Review Flow`,
      flowType: 'REVIEW',
      status: 'DRAFT',
      firstScreenId: 'RECOMMEND',
      categories: ['OTHER'],
      jsonDefinition: reviewJson,
    });
  }

  const publishedFlow = await flowService.publishFlow(newFlow.id, agency.id);
  const removed = [];
  const warnings = [];

  for (const flow of existingFlows) {
    if (flow.id === publishedFlow.id) continue;

    try {
      await flowService.deleteFlow(flow.id, agency.id);
      removed.push({ id: flow.id, metaFlowId: flow.metaFlowId, deletedRemote: true });
    } catch (error) {
      warnings.push({
        id: flow.id,
        metaFlowId: flow.metaFlowId,
        message: error?.message || String(error),
      });
      await flow.destroy();
      removed.push({ id: flow.id, metaFlowId: flow.metaFlowId, deletedRemote: false });
    }
  }

  return {
    agency: {
      id: agency.id,
      name: agency.name,
    },
    published: {
      id: publishedFlow.id,
      name: publishedFlow.name,
      metaFlowId: publishedFlow.metaFlowId,
      status: publishedFlow.status,
      firstScreenId: publishedFlow.firstScreenId,
    },
    removed,
    warnings,
  };
}

async function main() {
  const reviewJson = readJson('./docs/whatsapp/review-collection-flow.json');
  const agencies = await loadTargetAgencies();
  if (!agencies.length) throw new Error('No matching Marketing OS agencies found');

  const results = [];
  for (const agency of agencies) {
    results.push(await replaceReviewFlowForAgency(agency, reviewJson));
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
