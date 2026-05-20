require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Agency, WhatsAppFlow, sequelize } = require('../models');
const flowService = require('../services/flowService');
const { getDefaultFlowDefinitions } = require('../services/defaultFlowDefinitions');

const FLOW_NAME_MARKER = 'Travel Readiness Questionnaire';

function getCliValues(flag) {
  const values = [];
  process.argv.forEach((arg, index) => {
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      return;
    }
    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  });
  return values.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean);
}

function agencyMatchesFilters(agency, filters = []) {
  if (!filters.length) return true;
  const name = String(agency?.name || '').trim().toLowerCase();
  const id = String(agency?.id || '').trim().toLowerCase();
  return filters.some((filter) => name === filter || id === filter);
}

function getReadinessDefaults(agency) {
  return getDefaultFlowDefinitions(agency).find((flow) => String(flow.name || '').includes(FLOW_NAME_MARKER));
}

async function refreshAgencyReadinessFlow(agency, options = {}) {
  const defaults = getReadinessDefaults(agency);
  if (!defaults) return { agency: agency.name, updated: 0, published: 0, error: 'Missing default definition' };

  await flowService.ensureDefaultFlowsForAgency(agency);

  const flows = await WhatsAppFlow.findAll({
    where: {
      agencyId: agency.id,
      name: defaults.name,
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!flows.length) return { agency: agency.name, updated: 0, published: 0 };

  let updated = 0;
  let published = 0;
  const errors = [];

  for (const flow of flows) {
    const previous = {
      jsonDefinition: flow.jsonDefinition,
      firstScreenId: flow.firstScreenId,
      endpointUri: flow.endpointUri,
      categories: flow.categories,
      status: flow.status,
      validationErrors: flow.validationErrors,
      healthStatus: flow.healthStatus,
    };

    await flow.update({
      endpointUri: flow.endpointUri || defaults.endpointUri,
      firstScreenId: defaults.firstScreenId,
      categories: defaults.categories,
      jsonDefinition: defaults.jsonDefinition,
    });
    updated += 1;

    if (options.publish) {
      try {
        await flowService.publishFlow(flow.id, agency.id);
        published += 1;
      } catch (error) {
        await flow.update(previous);
        errors.push(`${flow.name}: ${error.message}`);
      }
    }
  }

  return { agency: agency.name, updated, published, errors };
}

async function main() {
  const publish = process.argv.includes('--publish');
  const agencyFilters = getCliValues('--agency');
  await sequelize.authenticate();

  const allAgencies = await Agency.findAll({
    where: {
      whatsappProvider: 'MARKETING_OS',
    },
    order: [['createdAt', 'ASC']],
  });
  const agencies = allAgencies.filter((agency) => agencyMatchesFilters(agency, agencyFilters));

  const results = [];
  for (const agency of agencies) {
    results.push(await refreshAgencyReadinessFlow(agency, { publish }));
  }

  console.log(JSON.stringify({
    publish,
    agencyFilters,
    checked: agencies.length,
    skippedByFilter: allAgencies.length - agencies.length,
    results,
  }, null, 2));
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
