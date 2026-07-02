const bcrypt = require('bcryptjs');
const { sequelize, Agent } = require('../src/models');

async function main() {
  const email = 'aalamcgabudhabi@gmail.com';
  const password = process.env.CHECK_PASSWORD || '';
  if (!password) throw new Error('CHECK_PASSWORD is required');

  const user = await Agent.findOne({
    where: { email },
    attributes: ['id', 'name', 'email', 'role', 'passwordHash'],
  });

  if (!user) {
    console.log(JSON.stringify({ found: false, valid: false }, null, 2));
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log(JSON.stringify({
    found: true,
    valid,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
