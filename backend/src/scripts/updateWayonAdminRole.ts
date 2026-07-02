const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { sequelize, Agent } = require('../models');
const { ALL_PERMISSIONS } = require('../constants/permissions');

async function main() {
  const email = 'rameesvk551@gmail.com';

  await sequelize.authenticate();

  const agent = await Agent.findOne({
    where: { email: email.toLowerCase() },
  });

  if (!agent) {
    throw new Error(`Agent not found: ${email}`);
  }

  const updated = await agent.update({
    role: 'ADMIN',
    permissions: ALL_PERMISSIONS,
    isActive: true,
  });

  console.log(JSON.stringify({
    success: true,
    agent: {
      id: updated.id,
      agencyId: updated.agencyId,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      updatedAt: updated.updatedAt,
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
