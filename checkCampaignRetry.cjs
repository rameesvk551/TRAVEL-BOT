const { Campaign, CampaignRecipient, MessageTemplate } = require('./backend/src/models');

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) throw new Error('Usage: node checkCampaignRetry.cjs <campaignId>');

  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

  const failedRows = await CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } });
  const pendingRows = await CampaignRecipient.count({ where: { campaignId, status: 'PENDING' } });
  const template = campaign.templateId ? await MessageTemplate.findByPk(campaign.templateId) : null;

  console.log(JSON.stringify({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    type: campaign.type,
    totalRecipients: campaign.totalRecipients,
    sent: campaign.sent,
    delivered: campaign.delivered,
    read: campaign.read,
    replied: campaign.replied,
    failed: campaign.failed,
    templateId: campaign.templateId,
    templateName: template ? template.name : null,
    hasMessageBody: Boolean(campaign.messageBody),
    failedRows,
    pendingRows,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
