const { Op, fn, col } = require('sequelize');
const { Campaign, CampaignRecipient } = require('./backend/src/models');
const { processCampaignBroadcast } = require('./backend/src/services/marketingSchedulerService');

const CAMPAIGN_ID = 'aaea049a-bb3e-4ef1-8338-11c5b1e5d527';
const RETRY_REASON = 'WhatsApp provider rejected the outbound message';
const DELAY_MS = Number(process.env.RETRY_DELAY_MS || 10000);

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

async function getReasonBreakdown(campaignId) {
  const rows = await CampaignRecipient.findAll({
    where: { campaignId, status: 'FAILED' },
    attributes: [
      [fn('COALESCE', col('error_message'), 'No stored reason'), 'reason'],
      [fn('COUNT', col('CampaignRecipient.id')), 'count'],
    ],
    group: [fn('COALESCE', col('error_message'), 'No stored reason')],
    raw: true,
  });
  return rows
    .map((row) => ({ reason: row.reason, count: Number(row.count) || 0 }))
    .sort((a, b) => b.count - a.count);
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

async function main() {
  const campaign = await Campaign.findByPk(CAMPAIGN_ID);
  if (!campaign) throw new Error(`Campaign not found: ${CAMPAIGN_ID}`);

  const recipients = await CampaignRecipient.findAll({
    where: { campaignId: CAMPAIGN_ID, status: 'FAILED', errorMessage: RETRY_REASON },
    attributes: ['id'],
    order: [['updatedAt', 'ASC'], ['createdAt', 'ASC']],
  });

  const before = await getCounts(CAMPAIGN_ID);
  const beforeReasons = await getReasonBreakdown(CAMPAIGN_ID);
  log({
    event: 'eidul_provider_retry_started',
    campaignId: CAMPAIGN_ID,
    campaignName: campaign.name,
    eligibleRows: recipients.length,
    retryReason: RETRY_REASON,
    delayMs: DELAY_MS,
    before,
    beforeReasons,
  });

  let attempts = 0;
  for (const row of recipients) {
    const recipient = await CampaignRecipient.findByPk(row.id);
    if (!recipient || recipient.status !== 'FAILED' || recipient.errorMessage !== RETRY_REASON) continue;

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
    await Campaign.update({ status: 'SENDING' }, { where: { id: CAMPAIGN_ID } });
    await processCampaignBroadcast(CAMPAIGN_ID, campaign.agencyId);
    await sleep(DELAY_MS);
  }

  await refreshCampaignStats(CAMPAIGN_ID);
  await Campaign.update({ status: 'SENT' }, { where: { id: CAMPAIGN_ID, status: 'SENDING' } });

  const after = await getCounts(CAMPAIGN_ID);
  const afterReasons = await getReasonBreakdown(CAMPAIGN_ID);
  log({
    event: 'eidul_provider_retry_finished',
    campaignId: CAMPAIGN_ID,
    campaignName: campaign.name,
    eligibleRows: recipients.length,
    attempts,
    beforeFailed: before.FAILED || 0,
    afterFailed: after.FAILED || 0,
    recovered: (before.FAILED || 0) - (after.FAILED || 0),
    after,
    afterReasons,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log({ event: 'eidul_provider_retry_failed', error: err.message, stack: err.stack });
    process.exit(1);
  });
