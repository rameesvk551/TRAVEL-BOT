const { Campaign, CampaignRecipient } = require('/home/ec2-user/travel-bot-git/backend/src/models');

async function main() {
  const campaignId = 'e3f572e3-c990-48dd-9019-8d174cacf4c9';
  const campaign = await Campaign.findByPk(campaignId);
  const recipients = await CampaignRecipient.findAll({
    where: { campaignId },
    attributes: ['status', 'waMessageId', 'errorMessage', 'sentAt', 'deliveredAt', 'readAt'],
    raw: true,
  });

  console.log(JSON.stringify({
    campaign: campaign ? {
      status: campaign.status,
      sent: campaign.sent,
      delivered: campaign.delivered,
      read: campaign.read,
      replied: campaign.replied,
      failed: campaign.failed,
      completedAt: campaign.completedAt,
    } : null,
    recipients,
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
