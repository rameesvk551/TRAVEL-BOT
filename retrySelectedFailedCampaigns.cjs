const { Op, fn, col } = require('sequelize');
const { Campaign, CampaignRecipient } = require('./backend/src/models');
const { processCampaignBroadcast } = require('./backend/src/services/marketingSchedulerService');

const TARGET_CAMPAIGN_IDS = [
  '3ef6df35-ccd7-4a6b-8ccd-da76285f6ced',
  'aaea049a-bb3e-4ef1-8338-11c5b1e5d527',
  '48f54d56-1831-472b-996e-4b4469b0106f',
];

function log(payload) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...payload }));
}

async function getCounts(campaignId) {
  const rows = await CampaignRecipient.findAll({
    where: { campaignId },
    attributes: [
      'status',
      [fn('COUNT', col('CampaignRecipient.id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });
  return rows.reduce((acc, row) => {
    acc[row.status] = Number(row.count) || 0;
    return acc;
  }, {});
}

async function refreshCampaignStats(campaignId) {
  const [sent, delivered, read, replied, failed] = await Promise.all([
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['SENT', 'DELIVERED', 'READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['DELIVERED', 'READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: 'REPLIED' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
  ]);
  await Campaign.update({ sent, delivered, read, replied, failed }, { where: { id: campaignId } });
}

async function retryCampaign(campaignId) {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (campaign.status === 'CANCELLED') throw new Error(`Cannot retry cancelled campaign: ${campaign.name}`);

  const before = await getCounts(campaignId);
  const failedCount = before.FAILED || 0;
  if (!failedCount) {
    log({ event: 'skip_no_failed', campaignId, campaignName: campaign.name, before });
    return null;
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
  log({ event: 'retry_started', campaignId, campaignName: campaign.name, resetFailedToPending: failedCount, before });

  await processCampaignBroadcast(campaignId, campaign.agencyId);
  await refreshCampaignStats(campaignId);

  const refreshedCampaign = await Campaign.findByPk(campaignId);
  const after = await getCounts(campaignId);
  const result = {
    campaignId,
    campaignName: campaign.name,
    status: refreshedCampaign.status,
    beforeFailed: failedCount,
    afterFailed: after.FAILED || 0,
    recovered: failedCount - (after.FAILED || 0),
    after,
  };
  log({ event: 'retry_finished', ...result });
  return result;
}

async function main() {
  const results = [];
  log({ event: 'run_started', campaigns: TARGET_CAMPAIGN_IDS });
  for (const campaignId of TARGET_CAMPAIGN_IDS) {
    const result = await retryCampaign(campaignId);
    if (result) results.push(result);
  }
  log({
    event: 'run_finished',
    campaignsRetried: results.length,
    beforeFailed: results.reduce((sum, row) => sum + row.beforeFailed, 0),
    afterFailed: results.reduce((sum, row) => sum + row.afterFailed, 0),
    recovered: results.reduce((sum, row) => sum + row.recovered, 0),
    results,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log({ event: 'run_failed', error: err.message, stack: err.stack });
    process.exit(1);
  });
