const path = require('path');
const backendDir = path.join(__dirname, 'backend');

// Add backend/node_modules to the module search path
module.paths.unshift(path.join(backendDir, 'node_modules'));

require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const { sequelize, PlatformAdmin } = require(path.join(backendDir, 'dist', 'models'));

(async () => {
  await sequelize.authenticate();
  console.log('DB connected');

  const hash = await bcrypt.hash('Aminaraiha@123', 12);
  const [admin, created] = await PlatformAdmin.findOrCreate({
    where: { email: 'admin@wayon.in' },
    defaults: {
      name: 'Platform Admin',
      email: 'admin@wayon.in',
      passwordHash: hash,
      role: 'OWNER',
      isActive: true,
    },
  });

  if (!created) {
    await admin.update({ name: 'Platform Admin', passwordHash: hash, role: 'OWNER', isActive: true });
    console.log('Updated platform admin admin@wayon.in');
  } else {
    console.log('Created platform admin admin@wayon.in');
  }

  await sequelize.close();
  process.exit(0);
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
