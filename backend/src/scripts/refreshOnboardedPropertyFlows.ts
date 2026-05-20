require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { Op } = require('sequelize');
const { Agency, WhatsAppFlow, sequelize } = require('../models');
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

async function refreshAgencyPropertyFlow(agency) {
  const propertyDefaults = getPropertyDefaults(agency);
  if (!propertyDefaults) return { created: 0, updated: 0 };

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

  if (!propertyFlows.length) {
    await WhatsAppFlow.create({
      agencyId: agency.id,
      ...propertyDefaults,
    });
    return { created: 1, updated: 0 };
  }

  for (const flow of propertyFlows) {
    await flow.update({
      flowType: 'PROPERTY',
      endpointUri: propertyDefaults.endpointUri,
      firstScreenId: propertyDefaults.firstScreenId,
      categories: propertyDefaults.categories,
      jsonDefinition: propertyDefaults.jsonDefinition,
      validationErrors: [],
    });
  }

  return { created: 0, updated: propertyFlows.length };
}

async function main() {
  await sequelize.authenticate();

  const agencies = await Agency.findAll({
    where: {
      whatsappProvider: 'MARKETING_OS',
    },
    order: [['createdAt', 'ASC']],
  });

  let checked = 0;
  let skipped = 0;
  let created = 0;
  let updated = 0;

  for (const agency of agencies) {
    checked += 1;
    if (!canRefreshAgency(agency)) {
      skipped += 1;
      console.log(`${agency.name} (${agency.id}): skipped`);
      continue;
    }

    const result = await refreshAgencyPropertyFlow(agency);
    created += result.created;
    updated += result.updated;
    console.log(`${agency.name} (${agency.id}): created ${result.created}, updated ${result.updated}`);
  }

  console.log(JSON.stringify({ checked, skipped, created, updated }, null, 2));
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
