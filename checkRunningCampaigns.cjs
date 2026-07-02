const { Op } = require('sequelize');
const { Agency, Campaign, CampaignRecipient } = require('./backend/src/models');

async function main() {
  const agency = await Agency.findOne({
    where: { name: { [Op.iLike]: '%Stayroute%' } },
    attributes: ['id', 'name'],
  });
  if (!agency) throw new Error('Stayroute agency not found');

  const sendingCampaigns = await Campaign.findAll({
    where: { agencyId: agency.id, status: 'SENDING' },
    attributes: ['id', 'name', 'status', 'updatedAt'],
    raw: true,
  });

  const pendingRecipients = await CampaignRecipient.count({
    include: [{
      model: Campaign,
      as: 'campaign',
      attributes: [],
      where: { agencyId: agency.id },
      required: true,
    }],
    where: { status: 'PENDING' },
  });

  console.log(JSON.stringify({
    agency,
    sendingCampaigns,
    pendingRecipients,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
