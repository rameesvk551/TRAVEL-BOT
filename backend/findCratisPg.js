const { sequelize, Agency, AgencyChannel } = require('./src/models');
const { Op } = require('sequelize');

async function run() {
  console.log('Connecting to Postgres...');
  
  const agencies = await Agency.findAll({
    where: {
      name: { [Op.iLike]: '%Cratis%' }
    }
  });
  console.log('Agencies matching Cratis:', agencies.map(a => ({ name: a.name, email: a.email, id: a.id })));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
