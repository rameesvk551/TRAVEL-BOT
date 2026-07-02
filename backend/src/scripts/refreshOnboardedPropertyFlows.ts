require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Op } = require('sequelize');
const { Agency, Property, WhatsAppFlow, sequelize } = require('../models');
const flowService = require('../services/flowService');
const { getDefaultFlowDefinitions } = require('../services/defaultFlowDefinitions');

function canRefreshAgency(agency) {
  if (!agency) return false;
  if (agency.whatsappProvider !== 'MARKETING_OS') return false;
  if (!agency.marketingOsTenantId) return false;

  const status = String(agency.whatsappConnectionStatus || '').toUpperCase();
  return status && status !== 'NOT_CONNECTED' && status !== 'FAILED';
}

function getPropertyDefaults(agency) {
  return getDefaultFlowDefinitions(agency).find((flow) => flow.flowType === 'PROPERTY');
}

function singleScreenStayRequestDefaults(defaults) {
  const stayRequestScreen = (defaults.jsonDefinition?.screens || []).find((screen) => screen.id === 'STAY_REQUEST');
  if (!stayRequestScreen) return defaults;

  return {
    ...defaults,
    firstScreenId: 'STAY_REQUEST',
    jsonDefinition: {
      ...defaults.jsonDefinition,
      routing_model: {
        STAY_REQUEST: [],
      },
      screens: [stayRequestScreen],
    },
  };
}

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

async function refreshAgencyPropertyFlow(agency, options = {}) {
  const basePropertyDefaults = getPropertyDefaults(agency);
  if (!basePropertyDefaults) return { created: 0, updated: 0, published: 0, errors: ['Missing default property flow'] };
  const activePropertyCount = await Property.count({ where: { agencyId: agency.id, isActive: true } });
  const propertyDefaults = activePropertyCount > 0
    ? basePropertyDefaults
    : singleScreenStayRequestDefaults(basePropertyDefaults);

  const propertyFlows = await WhatsAppFlow.findAll({
    where: {
      agencyId: agency.id,
      [Op.or]: [
        { flowType: 'PROPERTY' },
        { name: propertyDefaults.name },
      ],
    },
    order: [['createdAt', 'ASC']],
  });

  const flowsToPublish = [];
  if (!propertyFlows.length) {
    const flow = await WhatsAppFlow.create({
      agencyId: agency.id,
      ...propertyDefaults,
    });
    flowsToPublish.push(flow);
    if (!options.publish) return { created: 1, updated: 0, published: 0, errors: [] };
  }

  let updated = 0;
  for (const flow of propertyFlows) {
    const previous = {
      flowType: flow.flowType,
      endpointUri: flow.endpointUri,
      firstScreenId: flow.firstScreenId,
      categories: flow.categories,
      jsonDefinition: flow.jsonDefinition,
      validationErrors: flow.validationErrors,
    };

    try {
      await flow.update({
        flowType: 'PROPERTY',
        endpointUri: propertyDefaults.endpointUri,
        firstScreenId: propertyDefaults.firstScreenId,
        categories: propertyDefaults.categories,
        jsonDefinition: propertyDefaults.jsonDefinition,
        validationErrors: [],
      });
      updated += 1;
      flowsToPublish.push(flow);
    } catch (error) {
      await flow.update(previous);
      throw error;
    }
  }

  let published = 0;
  const errors = [];
  if (options.publish) {
    for (const flow of flowsToPublish) {
      try {
        await flowService.publishFlow(flow.id, agency.id);
        published += 1;
      } catch (error) {
        errors.push(`${flow.name}: ${error.message}`);
      }
    }
  }

  return { created: propertyFlows.length ? 0 : 1, updated, published, errors };
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

  let checked = 0;
  let skipped = 0;
  let created = 0;
  let updated = 0;
  let published = 0;
  const errors = [];

  for (const agency of agencies) {
    checked += 1;
    if (!canRefreshAgency(agency)) {
      skipped += 1;
      console.log(`${agency.name} (${agency.id}): skipped`);
      continue;
    }

    const result = await refreshAgencyPropertyFlow(agency, { publish });
    created += result.created;
    updated += result.updated;
    published += result.published;
    if (result.errors?.length) errors.push({ agency: agency.name, errors: result.errors });
    console.log(`${agency.name} (${agency.id}): created ${result.created}, updated ${result.updated}, published ${result.published}`);
  }

  console.log(JSON.stringify({
    publish,
    agencyFilters,
    checked,
    skipped,
    skippedByFilter: allAgencies.length - agencies.length,
    created,
    updated,
    published,
    errors,
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
