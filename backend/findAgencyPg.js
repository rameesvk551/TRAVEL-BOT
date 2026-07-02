const { sequelize, Agency, AgencyChannel } = require('./src/models');
const { Op } = require('sequelize');

async function run() {
  console.log('Connecting to Postgres...');
  
  const agencies = await Agency.findAll({
    where: {
      [Op.or]: [
        { whatsappNumber: { [Op.like]: '%9074823588%' } },
        { phone: { [Op.like]: '%9074823588%' } }
      ]
    }
  });
  console.log('Found in Agency collection:', agencies.map(a => a.name));

  const channels = await AgencyChannel.findAll({
    where: {
      [Op.or]: [
        { whatsappDisplayPhoneNumber: { [Op.like]: '%9074823588%' } },
        { whatsappPhoneNumberId: '2478492146002706' },
        { whatsappBusinessAccountId: '2478492146002706' }
      ]
    }
  });

  if (channels.length > 0) {
     const agency = await Agency.findByPk(channels[0].agencyId);
     console.log('Found channel attached to Agency:', agency ? agency.name : 'Unknown Agency', 'ID:', channels[0].agencyId);
  } else {
     console.log('No channels found for this number or WABA ID in AgencyChannels.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
