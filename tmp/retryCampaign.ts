const { Campaign, CampaignRecipient } = require('/home/ec2-user/travel-bot-git/backend/src/models');
const { processCampaignBroadcast } = require('/home/ec2-user/travel-bot-git/backend/src/services/marketingSchedulerService');

async function main() {
  const campaignId = 'e3f572e3-c990-48dd-9019-8d174cacf4c9';
  const agencyId = '46f29a79-84cf-415a-94bf-9df432b4589e';

  await CampaignRecipient.update({
    status: 'PENDING',
    waMessageId: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    repliedAt: null,
    errorMessage: null,
  }, {
    where: { campaignId },
  });

  await Campaign.update({
    status: 'SENDING',
    completedAt: null,
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  }, {
    where: { id: campaignId },
  });

  await processCampaignBroadcast(campaignId, agencyId);
  console.log('retry-finished');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
