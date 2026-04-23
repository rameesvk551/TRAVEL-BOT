// FILE: /backend/src/controllers/whatsappWebhookController.js
const { Message, CampaignRecipient, Campaign } = require('../models');

/**
 * Handle incoming WhatsApp webhooks (proxied from Marketing OS or sent directly by Meta).
 * This controller processes status updates (delivered, read, failed) for messages.
 */
async function handleWebhook(req, res, next) {
  try {
    const rawBody = req.body;

    // Acknowledge receipt to prevent retries
    res.status(200).send('OK');

    // Parse the payload
    if (rawBody?.object === 'whatsapp_business_account' && rawBody.entry) {
      for (const entry of rawBody.entry) {
        if (!entry.changes) continue;
        for (const change of entry.changes) {
          const value = change.value;
          if (!value) continue;

          // Handle statuses
          if (value.statuses && value.statuses.length > 0) {
            for (const statusObj of value.statuses) {
              const waMessageId = statusObj.id;
              const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
              const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

              if (!waMessageId) continue;

              let mappedStatus = status.toUpperCase();
              
              // Update Message table
              await Message.update(
                { status: mappedStatus },
                { where: { waMessageId } }
              );

              // Update CampaignRecipient table
              const recipient = await CampaignRecipient.findOne({ where: { waMessageId } });
              
              if (recipient) {
                // Determine what fields to update based on status progression
                const updateData = {};
                
                // Only upgrade status, don't downgrade (e.g. if DELIVERED arrives after READ)
                const statusPriority = {
                  'PENDING': 0, 'SENT': 1, 'DELIVERED': 2, 'READ': 3, 'REPLIED': 4, 'FAILED': 5
                };
                
                const currentPriority = statusPriority[recipient.status] || 0;
                const newPriority = statusPriority[mappedStatus] || 0;

                // For FAILED, we always update. Otherwise we only upgrade (like SENT -> DELIVERED -> READ).
                if (mappedStatus === 'FAILED' || newPriority > currentPriority) {
                  updateData.status = mappedStatus;
                }

                if (mappedStatus === 'DELIVERED' && !recipient.deliveredAt) {
                  updateData.deliveredAt = timestamp;
                } else if (mappedStatus === 'READ' && !recipient.readAt) {
                  updateData.readAt = timestamp;
                } else if (mappedStatus === 'FAILED') {
                  updateData.errorMessage = statusObj.errors ? JSON.stringify(statusObj.errors) : 'Webhook reported failure';
                }

                if (Object.keys(updateData).length > 0) {
                  await recipient.update(updateData);

                  // Update Campaign aggregate counts
                  const campaign = await Campaign.findByPk(recipient.campaignId);
                  if (campaign) {
                    if (mappedStatus === 'DELIVERED' && currentPriority < statusPriority['DELIVERED']) {
                      await campaign.increment('delivered', { by: 1 });
                    } else if (mappedStatus === 'READ' && currentPriority < statusPriority['READ']) {
                      await campaign.increment('read', { by: 1 });
                    } else if (mappedStatus === 'FAILED' && currentPriority < statusPriority['FAILED']) {
                      await campaign.increment('failed', { by: 1 });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error processing webhook:', err);
    // Even if it fails, we've already responded 200 to prevent retry flooding
  }
}

module.exports = {
  handleWebhook,
};
