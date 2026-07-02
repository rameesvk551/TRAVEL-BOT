const { sequelize } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    `SELECT id, name, welcome_message AS "welcomeMessage",
            whatsapp_menu_labels AS "whatsappMenuLabels",
            whatsapp_menu_config AS "whatsappMenuConfig",
            whatsapp_flow_config AS "whatsappFlowConfig",
            updated_at AS "updatedAt"
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  console.log(JSON.stringify({ agency }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
