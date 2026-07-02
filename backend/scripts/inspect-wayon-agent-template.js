const { sequelize } = require('../src/models');

async function main() {
  const rows = await sequelize.query(
    `
      SELECT id, name, status, category, body, sample_variables AS "sampleVariables"
        FROM message_templates
       WHERE agency_id = '768f7576-35b4-4f83-bcf6-5e51bf3b9c81'
         AND name LIKE '%agent_new_enquiry_assignment'
       ORDER BY updated_at DESC
    `,
    { type: sequelize.QueryTypes.SELECT }
  );
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .then(async () => sequelize.close())
  .catch(async (err) => {
    console.error(err);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  });
