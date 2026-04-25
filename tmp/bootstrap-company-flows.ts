const fs = require('fs');
const path = require('path');

const flowService = require('./backend/src/services/flowService');
const { Agency, WhatsAppFlow, sequelize } = require('./backend/src/models');

function readJson(relativePath) {
  const absolutePath = path.resolve(__dirname, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

async function ensureFlowRecord(agencyId, payload) {
  const existing = await WhatsAppFlow.findOne({
    where: { agencyId, flowType: payload.flowType },
    order: [['updatedAt', 'DESC']],
  });

  if (existing) {
    await flowService.updateFlow(existing.id, agencyId, payload);
    return await WhatsAppFlow.findOne({ where: { id: existing.id, agencyId } });
  }

  return flowService.createFlow(agencyId, payload);
}

async function main() {
  const agency = await Agency.findOne({
    where: { name: 'ABC Trours' },
    attributes: ['id', 'name', 'whatsappTripFlowId'],
  });

  if (!agency) {
    throw new Error('Agency ABC Trours not found');
  }

  const packageJson = readJson('./docs/whatsapp/trip-planner-flow.json');
  const propertyJson = readJson('./docs/whatsapp/property-selector-flow.json');
  const customTripJson = readJson('./docs/whatsapp/custom-trip-flow.json');

  const packageFlow = await ensureFlowRecord(agency.id, {
    name: `${agency.name} Package Flow`,
    flowType: 'PACKAGE',
    status: agency.whatsappTripFlowId ? 'PUBLISHED' : 'DRAFT',
    metaFlowId: agency.whatsappTripFlowId || null,
    firstScreenId: 'PACKAGE_SELECTOR',
    categories: ['OTHER'],
    jsonDefinition: packageJson,
  });

  const propertyFlow = await ensureFlowRecord(agency.id, {
    name: `${agency.name} Property Flow`,
    flowType: 'PROPERTY',
    status: 'DRAFT',
    firstScreenId: 'PROPERTY_SELECTOR',
    categories: ['OTHER'],
    jsonDefinition: propertyJson,
  });

  const customTripFlow = await ensureFlowRecord(agency.id, {
    name: `${agency.name} Custom Trip Flow`,
    flowType: 'CUSTOM_TRIP',
    status: 'DRAFT',
    firstScreenId: 'CUSTOM_TRIP_FORM',
    categories: ['OTHER'],
    jsonDefinition: customTripJson,
  });

  const publishResults = {};

  publishResults.package = await flowService.publishFlow(packageFlow.id, agency.id);
  publishResults.property = await flowService.publishFlow(propertyFlow.id, agency.id);
  publishResults.customTrip = await flowService.publishFlow(customTripFlow.id, agency.id);

  const flows = await WhatsAppFlow.findAll({
    where: { agencyId: agency.id },
    attributes: ['id', 'name', 'flowType', 'status', 'metaFlowId', 'firstScreenId', 'updatedAt'],
    order: [['flowType', 'ASC'], ['updatedAt', 'DESC']],
    raw: true,
  });

  console.log(JSON.stringify({
    agency: agency.toJSON(),
    publishResults,
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
