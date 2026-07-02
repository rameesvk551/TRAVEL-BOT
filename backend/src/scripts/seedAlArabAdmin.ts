const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agent } = require('../models');
const { ALL_PERMISSIONS } = require('../constants/permissions');

async function resolveAgency() {
  const [agency] = await sequelize.query(
    `SELECT id, name
       FROM agencies
      WHERE upper(name) = upper(:name)
         OR upper(name) LIKE upper(:likeName)
      ORDER BY created_at DESC
      LIMIT 1`,
    {
      replacements: {
        name: 'AL ARAB TOURISM',
        likeName: '%AL ARAB%',
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );
  return agency || null;
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@alarabtourism.com';
  const password = process.env.ADMIN_PASSWORD || 'admin@123';
  const name = process.env.ADMIN_NAME || 'Admin';

  await sequelize.authenticate();

  const agency = await resolveAgency();
  if (!agency) throw new Error('AL ARAB TOURISM agency not found');

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
      agencyId: agency.id,
      isActive: true,
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
      isActive: true,
      isOnline: false,
      lastSeenAt: null,
    });
    action = 'created_new_user';
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log(JSON.stringify({
    action,
    valid,
    agency: { id: agency.id, name: agency.name },
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

if (require.main === module) {
  main()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err.message);
      try {
        await sequelize.close();
      } catch (_) {}
      process.exit(1);
    });
}
