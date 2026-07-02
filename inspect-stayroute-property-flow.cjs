require('dotenv').config();

const { Agency, Property, WhatsAppFlow, sequelize } = require('../backend/dist/models');

(async () => {
  const agency = await Agency.findOne({ where: { name: 'Stayroute Ventures' } });
  if (!agency) {
    console.log(JSON.stringify({ error: 'Stayroute agency not found' }, null, 2));
    return;
  }

  const properties = await Property.findAll({
    where: { agencyId: agency.id },
    attributes: ['id', 'name', 'location', 'propertyType', 'isActive'],
    order: [['createdAt', 'DESC']],
  });

  const flows = await WhatsAppFlow.findAll({
    where: { agencyId: agency.id, flowType: 'PROPERTY' },
    order: [['updatedAt', 'DESC']],
  });

  console.log(JSON.stringify({
    agency: { id: agency.id, name: agency.name },
    properties: properties.map((property) => property.toJSON()),
    flows: flows.map((flow) => ({
      id: flow.id,
      name: flow.name,
      status: flow.status,
      metaFlowId: flow.metaFlowId,
      firstScreenId: flow.firstScreenId,
      validationErrors: flow.validationErrors,
      screens: (flow.jsonDefinition?.screens || []).map((screen) => ({
        id: screen.id,
        title: screen.title,
        fields: (((screen.layout || {}).children || [])[0]?.children || []).map((field) => ({
          type: field.type,
          name: field.name,
          label: field.label,
          dataSource: field['data-source'],
        })),
      })),
    })),
  }, null, 2));
})()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
