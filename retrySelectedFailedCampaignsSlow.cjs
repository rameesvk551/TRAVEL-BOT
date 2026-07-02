const { Op, fn, col } = require('sequelize');
const { Campaign, CampaignRecipient } = require('./backend/src/models');
const { processCampaignBroadcast } = require('./backend/src/services/marketingSchedulerService');

const TARGET_CAMPAIGN_IDS = [
  '3ef6df35-ccd7-4a6b-8ccd-da76285f6ced',
  'aaea049a-bb3e-4ef1-8338-11c5b1e5d527',
  '48f54d56-1831-472b-996e-4b4469b0106f',
];

const DELAY_MS = Number(process.env.RETRY_DELAY_MS || 6000);
const MAX_ATTEMPTS = Number(process.env.RETRY_MAX_ATTEMPTS || 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function normalizeInterruptedPending(campaignId) {
  const pendingCount = await CampaignRecipient.count({ where: { campaignId, status: 'PENDING' } });
  if (!pendingCount) return 0;

  await CampaignRecipient.update(
    { status: 'FAILED', errorMessage: 'Retry paused before send completed' },
    { where: { campaignId, status: 'PENDING' } }
  );
  await refreshCampaignStats(campaignId);
  return pendingCount;
}

async function retryCampaignSlow(campaignId) {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);
  if (campaign.status === 'CANCELLED') throw new Error(`Cannot retry cancelled campaign: ${campaign.name}`);

  const normalizedPending = await normalizeInterruptedPending(campaignId);
  const before = await getCounts(campaignId);
  const beforeFailed = before.FAILED || 0;
  log({ event: 'campaign_started', campaignId, campaignName: campaign.name, normalizedPending, before, delayMs: DELAY_MS });

  let attempts = 0;
  while (true) {
    if (MAX_ATTEMPTS > 0 && attempts >= MAX_ATTEMPTS) {
      log({ event: 'max_attempts_reached', campaignId, campaignName: campaign.name, attempts });
      break;
    }

    const recipient = await CampaignRecipient.findOne({
      where: { campaignId, status: 'FAILED' },
      order: [['updatedAt', 'ASC'], ['createdAt', 'ASC']],
    });
    if (!recipient) break;

    attempts += 1;
    await recipient.update({
      status: 'PENDING',
      waMessageId: null,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      repliedAt: null,
      errorMessage: null,
    });
    await Campaign.update({ status: 'SENDING' }, { where: { id: campaignId } });

    await processCampaignBroadcast(campaignId, campaign.agencyId);

    if (attempts % 25 === 0) {
      const counts = await getCounts(campaignId);
      log({ event: 'campaign_progress', campaignId, campaignName: campaign.name, attempts, counts });
    }

    await sleep(DELAY_MS);
  }

  await refreshCampaignStats(campaignId);
  const refreshedCampaign = await Campaign.findByPk(campaignId);
  const after = await getCounts(campaignId);
  const result = {
    campaignId,
    campaignName: campaign.name,
    status: refreshedCampaign.status,
    attempts,
    beforeFailed,
    afterFailed: after.FAILED || 0,
    recovered: beforeFailed - (after.FAILED || 0),
    after,
  };
  log({ event: 'campaign_finished', ...result });
  return result;
}

async function main() {
  const results = [];
  log({ event: 'slow_run_started', campaigns: TARGET_CAMPAIGN_IDS, delayMs: DELAY_MS, maxAttempts: MAX_ATTEMPTS });
  for (const campaignId of TARGET_CAMPAIGN_IDS) {
    const result = await retryCampaignSlow(campaignId);
    results.push(result);
  }
  log({
    event: 'slow_run_finished',
    campaignsRetried: results.length,
    attempts: results.reduce((sum, row) => sum + row.attempts, 0),
    beforeFailed: results.reduce((sum, row) => sum + row.beforeFailed, 0),
    afterFailed: results.reduce((sum, row) => sum + row.afterFailed, 0),
    recovered: results.reduce((sum, row) => sum + row.recovered, 0),
    results,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log({ event: 'slow_run_failed', error: err.message, stack: err.stack });
    process.exit(1);
  });
