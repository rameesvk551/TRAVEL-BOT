const { fn, col } = require('sequelize');
const { Campaign, CampaignRecipient } = require('./backend/src/models');

const IDS = [
  'aaea049a-bb3e-4ef1-8338-11c5b1e5d527',
  '48f54d56-1831-472b-996e-4b4469b0106f',
];

async function main() {
  const results = [];
  for (const id of IDS) {
    const campaign = await Campaign.findByPk(id, {
      attributes: ['id', 'name', 'status', 'type', 'totalRecipients', 'sent', 'delivered', 'read', 'replied', 'failed', 'sentAt'],
    });
    if (!campaign) continue;

    const reasons = await CampaignRecipient.findAll({
      where: { campaignId: id, status: 'FAILED' },
      attributes: [
        [fn('COALESCE', col('error_message'), 'No stored reason'), 'reason'],
        [fn('COUNT', col('CampaignRecipient.id')), 'count'],
      ],
      group: [fn('COALESCE', col('error_message'), 'No stored reason')],
      raw: true,
    });

    results.push({
      campaign: campaign.toJSON(),
      reasons: reasons
        .map((row) => ({ reason: row.reason, count: Number(row.count) || 0 }))
        .sort((a, b) => b.count - a.count),
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
