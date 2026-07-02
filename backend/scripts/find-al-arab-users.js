const { sequelize } = require('../src/models');

async function main() {
  const agencies = await sequelize.query(
    `
      SELECT id,
             name,
             email,
             phone,
             whatsapp_number AS "whatsappNumber",
             created_at AS "createdAt"
        FROM agencies
       WHERE lower(name) LIKE '%al%arab%tour%'
          OR lower(name) LIKE '%alarab%tour%'
          OR lower(email) LIKE '%alarab%'
       ORDER BY created_at DESC
    `,
    { type: sequelize.QueryTypes.SELECT }
  );

  const agencyIds = agencies.map((agency) => agency.id);
  let agents = [];
  if (agencyIds.length) {
    agents = await sequelize.query(
      `
        SELECT id,
               agency_id AS "agencyId",
               name,
               email,
               phone,
               role,
               is_online AS "isOnline",
               created_at AS "createdAt",
               last_seen_at AS "lastSeenAt"
          FROM agents
         WHERE agency_id IN (:agencyIds)
         ORDER BY created_at ASC
      `,
      { replacements: { agencyIds }, type: sequelize.QueryTypes.SELECT }
    );
  }

  console.log(JSON.stringify({ agencies, agents }, null, 2));
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
