const { Op, fn, col } = require('sequelize');
const { Agency, Campaign, CampaignRecipient } = require('./backend/src/models');

async function main() {
  const agencyNameArg = process.argv.slice(2).join(' ').trim();
  const agencyWhere = agencyNameArg
    ? { name: { [Op.iLike]: `%${agencyNameArg}%` } }
    : { name: { [Op.iLike]: '%Stayroute%' } };

  const agency = await Agency.findOne({ where: agencyWhere, attributes: ['id', 'name'] });
  if (!agency) throw new Error(`Agency not found for ${agencyNameArg || 'Stayroute'}`);

  const campaigns = await Campaign.findAll({
    where: { agencyId: agency.id },
    attributes: ['id', 'name', 'status', 'type', 'sent', 'delivered', 'read', 'replied', 'failed', 'createdAt', 'sentAt'],
    order: [['createdAt', 'DESC']],
  });

  const results = [];
  for (const campaign of campaigns) {
    const failedRows = await CampaignRecipient.count({ where: { campaignId: campaign.id, status: 'FAILED' } });
    if (!failedRows) continue;

    const reasonRows = await CampaignRecipient.findAll({
      where: { campaignId: campaign.id, status: 'FAILED' },
      attributes: [
        [fn('COALESCE', col('error_message'), 'No stored reason'), 'reason'],
        [fn('COUNT', col('CampaignRecipient.id')), 'count'],
      ],
      group: [fn('COALESCE', col('error_message'), 'No stored reason')],
      order: [[fn('COUNT', col('CampaignRecipient.id')), 'DESC']],
      raw: true,
    });

    results.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      createdAt: campaign.createdAt,
      sentAt: campaign.sentAt,
      failedRows,
      metrics: {
        sent: campaign.sent,
        delivered: campaign.delivered,
        read: campaign.read,
        replied: campaign.replied,
        failed: campaign.failed,
      },
      reasons: reasonRows.map((row) => ({
        reason: row.reason,
        count: Number(row.count) || 0,
      })),
    });
  }

  console.log(JSON.stringify({
    agency,
    campaignsWithFailures: results.length,
    totalFailedRows: results.reduce((sum, c) => sum + c.failedRows, 0),
    campaigns: results,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
