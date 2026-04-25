const { Agency } = require('/home/ec2-user/travel-bot-git/backend/src/models');

async function main() {
  const candidates = [
    { name: 'ABC Trours' },
    { name: 'ABC Tours' },
    { marketingOsTenantId: '5f11f2a7-edbb-4c02-a39a-bb57fcd110d2' },
  ];

  let agency = null;
  for (const where of candidates) {
    agency = await Agency.findOne({ where });
    if (agency) break;
  }

  console.log(JSON.stringify(
    agency ? {
      id: agency.id,
      name: agency.name,
      whatsappProvider: agency.whatsappProvider,
      whatsappBusinessAccountId: agency.whatsappBusinessAccountId,
      whatsappPhoneNumberId: agency.whatsappPhoneNumberId,
      whatsappDisplayPhoneNumber: agency.whatsappDisplayPhoneNumber,
      whatsappNumber: agency.whatsappNumber,
      marketingOsTenantId: agency.marketingOsTenantId,
    } : null,
    null,
    2
  ));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
