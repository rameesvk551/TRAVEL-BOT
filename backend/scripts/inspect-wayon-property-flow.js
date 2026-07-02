const { sequelize } = require('../src/models');

async function main() {
  const flows = await sequelize.query(
    `
      SELECT id,
             name,
             flow_type AS "flowType",
             meta_flow_id AS "metaFlowId",
             first_screen_id AS "firstScreenId",
             status,
             json_definition AS "jsonDefinition",
             updated_at AS "updatedAt"
        FROM whatsapp_flows
       WHERE agency_id = '768f7576-35b4-4f83-bcf6-5e51bf3b9c81'
       ORDER BY updated_at DESC
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  const properties = await sequelize.query(
    `
      SELECT id, name, property_type AS "propertyType", location, price_per_night AS "pricePerNight",
             is_active AS "isActive", image_url AS "imageUrl", left(description, 160) AS description
        FROM properties
       WHERE agency_id = '768f7576-35b4-4f83-bcf6-5e51bf3b9c81'
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 20
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ flows, properties }, null, 2));
}

main()
  .then(async () => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  });
