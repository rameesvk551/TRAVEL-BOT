const { Op } = require('sequelize');
const { Agent, Agency } = require('./src/models');

async function main() {
  const term = process.argv[2];
  if (!term) {
    throw new Error('Usage: node backend/check-agent-prod.cjs <email-or-name-fragment>');
  }

  const rows = await Agent.findAll({
    where: {
      [Op.or]: [
        { email: term },
        { name: { [Op.iLike]: `%${term}%` } },
        { email: { [Op.iLike]: `%${term}%` } },
      ],
    },
    include: [
      {
        model: Agency,
        as: 'agency',
        attributes: ['id', 'name', 'sidebarPreferences'],
      },
    ],
    attributes: ['id', 'name', 'email', 'role', 'permissions', 'sidebarPreferences', 'agencyId'],
  });

  console.log(JSON.stringify(rows.map((row) => row.toJSON()), null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
