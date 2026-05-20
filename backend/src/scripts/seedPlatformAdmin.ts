require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const bcrypt = require('bcryptjs');
const { sequelize, PlatformAdmin } = require('../models');

async function seed() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    throw new Error('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required');
  }

  if (password.length < 10) {
    throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 10 characters');
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const passwordHash = await bcrypt.hash(password, 12);
  const [admin, created] = await PlatformAdmin.findOrCreate({
    where: { email: email.toLowerCase() },
    defaults: {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
  });

  if (!created) {
    await admin.update({ name, passwordHash, role: 'OWNER', isActive: true });
    console.log(`Updated platform admin ${email}`);
  } else {
    console.log(`Created platform admin ${email}`);
  }
}

seed()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message);
    try {
      await sequelize.close();
    } catch {}
    process.exit(1);
  });
