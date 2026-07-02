const { Agency } = require('./backend/src/models');
const campaignService = require('./backend/src/services/campaignService');

async function main() {
  const agency = await Agency.findOne({ where: { name: 'Stayroute Ventures' }, attributes: ['id', 'name'] });
  if (!agency) throw new Error('Stayroute Ventures not found');

  const result = await campaignService.listCampaigns(agency.id, {});
  console.log(JSON.stringify({
    agency: agency.name,
    summary: result.summary,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
