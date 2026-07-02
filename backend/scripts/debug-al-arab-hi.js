const { sequelize } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    `
      SELECT id, name
        FROM agencies
       WHERE lower(name) LIKE '%al%arab%tour%'
       ORDER BY created_at DESC
       LIMIT 1
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  if (!agency) {
    console.log(JSON.stringify({ agency: null }, null, 2));
    return;
  }

  const messages = await sequelize.query(
    `
      SELECT m.id,
             c.phone AS "customerPhone",
             c.name AS "customerName",
             m.direction,
             m.content,
             m.type,
             m.status,
             m.wa_message_id AS "waMessageId",
             m.timestamp
        FROM messages m
        JOIN customers c ON c.id = m.customer_id
       WHERE m.agency_id = :agencyId
       ORDER BY m.timestamp DESC
       LIMIT 20
    `,
    { replacements: { agencyId: agency.id }, type: sequelize.QueryTypes.SELECT }
  );

  const sessions = await sequelize.query(
    `
      SELECT c.phone AS "customerPhone",
             c.name AS "customerName",
             s.current_step AS "currentStep",
             s.is_handed_off AS "isHandedOff",
             s.handed_off_to_id AS "handedOffToId",
             s.last_activity_at AS "lastActivityAt",
             s.collected_data AS "collectedData"
        FROM bot_sessions s
        JOIN customers c ON c.id = s.customer_id
       WHERE s.agency_id = :agencyId
       ORDER BY s.last_activity_at DESC NULLS LAST
       LIMIT 10
    `,
    { replacements: { agencyId: agency.id }, type: sequelize.QueryTypes.SELECT }
  );

  console.log(JSON.stringify({ agency, messages, sessions }, null, 2));
}

main()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (error) => {
    console.error(error);
    try {
      await sequelize.close();
    } catch (_) {}
    process.exit(1);
  });
