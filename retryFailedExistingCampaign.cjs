const { Campaign, CampaignRecipient } = require('./backend/src/models');
const { processCampaignBroadcast } = require('./backend/src/services/marketingSchedulerService');

async function getCounts(campaignId) {
  const rows = await CampaignRecipient.findAll({
    where: { campaignId },
    attributes: [
      'status',
      [CampaignRecipient.sequelize.fn('COUNT', CampaignRecipient.sequelize.col('id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    acc[row.status] = Number(row.count) || 0;
    return acc;
  }, {});
}

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) throw new Error('Usage: retryFailedExistingCampaign.cjs <campaignId>');

  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (campaign.status === 'CANCELLED') throw new Error('Cannot retry a cancelled campaign');

  const before = await getCounts(campaignId);
  const failedCount = before.FAILED || 0;
  if (failedCount === 0) {
    console.log(JSON.stringify({ campaignId, message: 'No failed recipients to retry', before }, null, 2));
    return;
  }

  await CampaignRecipient.update(
    {
      status: 'PENDING',
      waMessageId: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      repliedAt: null,
      errorMessage: null,
    },
    { where: { campaignId, status: 'FAILED' } }
  );

  await campaign.update({ status: 'SENDING' });

  console.log(JSON.stringify({
    campaignId,
    campaignName: campaign.name,
    resetFailedToPending: failedCount,
    before,
    startedAt: new Date().toISOString(),
  }, null, 2));

  await processCampaignBroadcast(campaignId, campaign.agencyId);

  const refreshedCampaign = await Campaign.findByPk(campaignId);
  const after = await getCounts(campaignId);
  console.log(JSON.stringify({
    campaignId,
    campaignName: refreshedCampaign.name,
    status: refreshedCampaign.status,
    sent: refreshedCampaign.sent,
    delivered: refreshedCampaign.delivered,
    read: refreshedCampaign.read,
    replied: refreshedCampaign.replied,
    failed: refreshedCampaign.failed,
    after,
    finishedAt: new Date().toISOString(),
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
