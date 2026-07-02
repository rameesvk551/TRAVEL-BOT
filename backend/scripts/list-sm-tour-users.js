const { sequelize, Agent } = require('../src/models');

async function main() {
  const [agency] = await sequelize.query(
    `SELECT id, name, email, phone, whatsapp_number AS "whatsappNumber", is_active AS "isActive",
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (!agency) {
    console.log(JSON.stringify({ agency: null, users: [] }, null, 2));
    return;
  }

  const users = await Agent.findAll({
    where: { agencyId: agency.id },
    attributes: [
      'id',
      'name',
      'email',
      'phone',
      'role',
      'permissions',
      'isOnline',
      'lastSeenAt',
      'createdAt',
      'updatedAt',
    ],
    order: [['createdAt', 'ASC']],
    raw: true,
  });

  console.log(JSON.stringify({ agency, users }, null, 2));
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
