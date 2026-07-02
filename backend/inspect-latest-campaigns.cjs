require('dotenv').config();

const { Campaign, CampaignRecipient, Customer, MessageTemplate, sequelize } = require('./dist/models');

(async () => {
  const campaigns = await Campaign.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5,
    include: [{ model: MessageTemplate, as: 'template', attributes: ['id', 'name', 'displayName', 'status', 'templateType'] }],
  });

  for (const campaign of campaigns) {
    const c = campaign.toJSON();
    const recipients = await CampaignRecipient.findAll({
      where: { campaignId: c.id },
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
      order: [['updatedAt', 'DESC']],
      limit: 20,
    });
    const counts = await CampaignRecipient.findAll({
      where: { campaignId: c.id },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('CampaignRecipient.id')), 'count']],
      group: ['status'],
      raw: true,
    });

    console.log(JSON.stringify({
      campaign: {
        id: c.id,
        name: c.name,
        status: c.status,
        type: c.type,
        format: c.format,
        mediaType: c.mediaType,
        template: c.template,
        createdAt: c.createdAt,
        sentAt: c.sentAt,
        completedAt: c.completedAt,
        totalRecipients: c.totalRecipients,
        sent: c.sent,
        delivered: c.delivered,
        read: c.read,
        failed: c.failed,
        audienceFilter: c.audienceFilter,
      },
      counts,
      recipients: recipients.map((r) => ({
        id: r.id,
        status: r.status,
        customer: r.customer,
        waMessageId: r.waMessageId,
        sentAt: r.sentAt,
        errorMessage: r.errorMessage,
        updatedAt: r.updatedAt,
      })),
    }, null, 2));
  }
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
