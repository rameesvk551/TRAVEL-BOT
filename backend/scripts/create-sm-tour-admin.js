const bcrypt = require('bcryptjs');
const { sequelize, Agent } = require('../src/models');
const { ALL_PERMISSIONS } = require('../src/constants/permissions');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');

  const [agency] = await sequelize.query(
    `SELECT id, name
       FROM agencies
      WHERE lower(name) LIKE lower(:name)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: { name: '%sm%tour%travel%' },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  if (!agency) throw new Error('SM TOURS AND TRAVELS agency not found');

  const existing = await Agent.findOne({ where: { email: email.toLowerCase() } });
  if (existing && existing.agencyId !== agency.id) {
    throw new Error(`Email ${email} already belongs to another agency`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  let action;

  if (existing) {
    user = await existing.update({
      name: existing.name || name,
      role: 'ADMIN',
      permissions: ALL_PERMISSIONS,
      passwordHash,
    });
    action = 'updated_existing_user';
  } else {
    user = await Agent.create({
      agencyId: agency.id,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      permissions: ALL_PERMISSIONS,
      isOnline: false,
      lastSeenAt: null,
    });
    action = 'created_new_user';
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log(JSON.stringify({
    action,
    valid,
    agency,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  }, null, 2));
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
