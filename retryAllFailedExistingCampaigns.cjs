const { Op, fn, col } = require('sequelize');
const { Agency, Campaign, CampaignRecipient } = require('./backend/src/models');
const { processCampaignBroadcast } = require('./backend/src/services/marketingSchedulerService');

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

async function retryCampaign(campaign) {
  const before = await getCounts(campaign.id);
  const failedCount = before.FAILED || 0;
  if (!failedCount) {
    log({ event: 'skip_no_failed', campaignId: campaign.id, campaignName: campaign.name, before });
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
    { where: { campaignId: campaign.id, status: 'FAILED' } }
  );

  await campaign.update({ status: 'SENDING' });
  log({ event: 'retry_started', campaignId: campaign.id, campaignName: campaign.name, resetFailedToPending: failedCount, before });

  await processCampaignBroadcast(campaign.id, campaign.agencyId);
  await refreshCampaignStats(campaign.id);

  const refreshedCampaign = await Campaign.findByPk(campaign.id);
  const after = await getCounts(campaign.id);
  const result = {
    campaignId: campaign.id,
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
  const agencyNameArg = process.argv.slice(2).join(' ').trim();
  const agency = await Agency.findOne({
    where: { name: { [Op.iLike]: `%${agencyNameArg || 'Stayroute'}%` } },
    attributes: ['id', 'name'],
  });
  if (!agency) throw new Error(`Agency not found for ${agencyNameArg || 'Stayroute'}`);

  const campaigns = await Campaign.findAll({
    where: { agencyId: agency.id, status: { [Op.notIn]: ['DRAFT', 'SCHEDULED', 'CANCELLED'] } },
    order: [['createdAt', 'DESC']],
  });

  const results = [];
  log({ event: 'run_started', agencyId: agency.id, agencyName: agency.name, campaignsChecked: campaigns.length });
  for (const campaign of campaigns) {
    const result = await retryCampaign(campaign);
    if (result) results.push(result);
  }
  log({
    event: 'run_finished',
    agencyId: agency.id,
    agencyName: agency.name,
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
