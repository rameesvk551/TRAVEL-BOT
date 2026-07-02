const { Op } = require('sequelize');
const { Campaign, CampaignRecipient, Customer, MessageTemplate } = require('./backend/src/models');

(async () => {
  const campaigns = await Campaign.findAll({
    order: [['createdAt', 'DESC']],
    limit: 8,
  });

  for (const campaign of campaigns) {
    const recipients = await CampaignRecipient.findAll({
      where: { campaignId: campaign.id },
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    });
    const template = campaign.templateId
      ? await MessageTemplate.findByPk(campaign.templateId, { attributes: ['id', 'name', 'displayName', 'status', 'metaTemplateId', 'buttons'] })
      : null;
    const counts = await CampaignRecipient.findAll({
      where: { campaignId: campaign.id },
      attributes: ['status', [CampaignRecipient.sequelize.fn('COUNT', CampaignRecipient.sequelize.col('CampaignRecipient.id')), 'count']],
      group: ['status'],
      raw: true,
    });

    console.log(JSON.stringify({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      format: campaign.format,
      mediaType: campaign.mediaType,
      createdAt: campaign.createdAt,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      completedAt: campaign.completedAt,
      totalRecipients: campaign.totalRecipients,
      sent: campaign.sent,
      failed: campaign.failed,
      template: template ? {
        id: template.id,
        name: template.name,
        displayName: template.displayName,
        status: template.status,
        metaTemplateId: template.metaTemplateId,
        buttons: template.buttons,
      } : null,
      ctaConfig: campaign.ctaConfig,
      campaignSections: campaign.campaignSections,
      statusCounts: counts,
      recipients: recipients.map((recipient) => ({
        id: recipient.id,
        status: recipient.status,
        errorMessage: recipient.errorMessage,
        waMessageId: recipient.waMessageId,
        sentAt: recipient.sentAt,
        customer: recipient.customer ? {
          id: recipient.customer.id,
          name: recipient.customer.name,
          phone: recipient.customer.phone,
        } : null,
      })),
    }, null, 2));
  }

  await Campaign.sequelize.close();
})().catch(async (err) => {
  console.error(err);
  try { await Campaign.sequelize.close(); } catch (_) {}
  process.exit(1);
});
