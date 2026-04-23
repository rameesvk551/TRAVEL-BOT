// FILE: /backend/src/services/marketingSchedulerService.ts

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const dripService = require('./dripService');
const { Campaign, CampaignRecipient, Customer, MessageTemplate, BotSession, Agency, Package, Property } = require('../models');
const whatsappService = require('./whatsappService');
const { Op } = require('sequelize');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const campaignQueue = new Queue('campaign_broadcast', { connection });
const dripQueue = new Queue('drip_processor', { connection });

// Rate limit: max messages per second (WhatsApp Business API limits ~80/sec)
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve template body placeholders with actual values.
 */
function resolveTemplateBody(body, variables) {
  if (!body) return '';
  let resolved = body;
  (variables || []).forEach((v, i) => {
    const placeholder = `{{${i + 1}}}`;
    resolved = resolved.split(placeholder).join(v);
  });
  return resolved;
}

function buildTemplateVariables(template, customer) {
  const count = template.variableCount || template.sampleVariables?.length || 0;
  const variables = Array.from({ length: count }, (_, index) => {
    if (index === 0) return customer.name || 'there';
    return template.sampleVariables?.[index] || '';
  });

  return variables;
}

async function sendReviewRatingPrompt(customer, agencyId) {
  const context = { customerId: customer.id, agencyId };

  return whatsappService.sendListMessage(
    customer.phone,
    'Please tap a rating for your trip experience.',
    'Rate Trip',
    [
      {
        title: 'Your rating',
        rows: [
          { id: 'review_rating_5', title: '5 Stars', description: 'Amazing experience' },
          { id: 'review_rating_4', title: '4 Stars', description: 'Good experience' },
          { id: 'review_rating_3', title: '3 Stars', description: 'Average experience' },
          { id: 'review_rating_2', title: '2 Stars', description: 'Could be better' },
          { id: 'review_rating_1', title: '1 Star', description: 'Poor experience' },
        ],
      },
    ],
    context,
    {
      headerText: 'Share Your Review',
      footerText: 'You can also type a number from 1 to 5.',
    }
  );
}

/**
 * Send interactive action buttons after a campaign broadcast message.
 * Gives customers quick-tap access to view linked packages or call the agency.
 */
async function sendCampaignActionButtons(customer, campaign, agencyId) {
  const context = { customerId: customer.id, agencyId };
  const agency = await Agency.findByPk(agencyId, { attributes: ['id', 'name', 'phone', 'whatsappNumber'] });
  const linkedCount = Array.isArray(campaign.linkedPackageIds) ? campaign.linkedPackageIds.length : 0;

  const buttons = [
    { id: `campaign_view_packages:${campaign.id}`, title: `🏖️ View Packages` },
  ];

  if (agency?.phone || agency?.whatsappNumber) {
    buttons.push({ id: `campaign_call_now:${campaign.id}`, title: '📞 Call Us' });
  }

  return whatsappService.sendButtonsMessage(
    customer.phone,
    `Tap below to explore ${linkedCount} curated package${linkedCount > 1 ? 's' : ''} handpicked for you! 👇`,
    buttons,
    context,
    { footerText: 'Reply Hi anytime to restart.' }
  );
}

function getEnabledCampaignSections(campaign) {
  const sections = Array.isArray(campaign.campaignSections) ? campaign.campaignSections : [];
  if (sections.length) {
    return sections
      .filter((section) => section.enabled !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  const linkedPackageIds = Array.isArray(campaign.linkedPackageIds) ? campaign.linkedPackageIds : [];
  if (linkedPackageIds.length) {
    return [{
      key: 'packages',
      label: 'View Packages',
      itemType: 'PACKAGE',
      selectionMode: 'MANUAL',
      selectedItemIds: linkedPackageIds,
    }];
  }

  return [];
}

async function sendCampaignSectionEntry(customer, campaign, agencyId) {
  const context = { customerId: customer.id, agencyId };
  const sections = getEnabledCampaignSections(campaign);
  if (sections.length === 0) return null;

  if (sections.length <= 3) {
    const buttons = sections.map((section) => ({
      id: section.itemType === 'CUSTOM_TRIP'
        ? `campaign_custom_trip:${campaign.id}`
        : `campaign_section:${campaign.id}:${section.key}`,
      title: String(section.label || section.key || 'View Deals').slice(0, 20),
    }));

    return whatsappService.sendButtonsMessage(
      customer.phone,
      'Choose what you want to explore from this campaign.',
      buttons,
      context,
      { footerText: 'Reply Hi anytime to restart.' }
    );
  }

  const rows = sections.map((section) => ({
    id: section.itemType === 'CUSTOM_TRIP'
      ? `campaign_custom_trip:${campaign.id}`
      : `campaign_section:${campaign.id}:${section.key}`,
    title: String(section.label || section.key || 'View Deals').slice(0, 24),
    description: section.itemType === 'PROPERTY'
      ? 'Browse stays and properties'
      : section.itemType === 'CUSTOM_TRIP'
        ? 'Share your trip preferences'
        : 'Browse package deals',
  }));

  return whatsappService.sendListMessage(
    customer.phone,
    'Choose what you want to explore from this campaign.',
    'Explore',
    [{ title: 'Campaign Deals', rows }],
    context,
    { headerText: campaign.name, footerText: 'Tap one option to continue.' }
  );
}

function moneyFromPaise(value) {
  const amount = Math.round(Number(value || 0) / 100);
  if (!amount) return null;
  return `₹${amount.toLocaleString('en-IN')}`;
}

async function resolveCampaignCarouselItems(campaign, agencyId) {
  const configItems = Array.isArray(campaign.carouselConfig?.items) ? campaign.carouselConfig.items : [];
  if (!configItems.length) return [];

  const packageIds = configItems
    .filter((item) => item.itemType === 'PACKAGE' && item.itemId)
    .map((item) => item.itemId);
  const propertyIds = configItems
    .filter((item) => item.itemType === 'PROPERTY' && item.itemId)
    .map((item) => item.itemId);

  const [packages, properties] = await Promise.all([
    packageIds.length
      ? Package.findAll({ where: { agencyId, id: { [Op.in]: packageIds }, isActive: { [Op.ne]: false } } })
      : [],
    propertyIds.length
      ? Property.findAll({ where: { agencyId, id: { [Op.in]: propertyIds }, isActive: { [Op.ne]: false } } })
      : [],
  ]);

  const packageMap = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const propertyMap = new Map(properties.map((property) => [property.id, property]));

  return configItems.slice(0, 10).map((item) => {
    const record = item.itemType === 'PROPERTY' ? propertyMap.get(item.itemId) : packageMap.get(item.itemId);
    return record ? { itemType: item.itemType, record } : null;
  }).filter(Boolean);
}

function buildCampaignCarouselCaption(itemType, record) {
  if (itemType === 'PROPERTY') {
    const price = moneyFromPaise(record.pricePerNight);
    return [
      `*${record.name}*`,
      [record.propertyType, record.location].filter(Boolean).join(' | '),
      record.description,
      price ? `From ${price}/night` : null,
    ].filter(Boolean).join('\n');
  }

  const price = moneyFromPaise(record.basePrice);
  return [
    `*${record.name}*`,
    [record.category, record.duration].filter(Boolean).join(' | '),
    Array.isArray(record.destinations) && record.destinations.length ? `Destinations: ${record.destinations.join(', ')}` : null,
    record.summary,
    price ? `From ${price}/person` : null,
  ].filter(Boolean).join('\n');
}

async function sendCampaignCarouselEntry(customer, campaign, agencyId) {
  const context = { customerId: customer.id, agencyId };
  const items = await resolveCampaignCarouselItems(campaign, agencyId);
  if (!items.length) return null;

  for (const item of items) {
    const buttons = [
      { id: `campaign_carousel_enquire:${campaign.id}:${item.itemType}:${item.record.id}`, title: 'Enquiry' },
      { id: `campaign_carousel_others:${campaign.id}`, title: 'See Others' },
    ];

    await whatsappService.sendMediaButtonsMessage(
      customer.phone,
      buildCampaignCarouselCaption(item.itemType, item.record),
      item.record.imageUrl,
      buttons,
      context,
      { footerText: campaign.name }
    );
  }

  return items.length;
}

/**
 * Process a single recipient: send WhatsApp message and update status.
 */
async function sendToRecipient(recipient, campaign, template, agencyId) {
  try {
    const customer = await Customer.findByPk(recipient.customerId, {
      attributes: ['id', 'name', 'phone'],
    });

    if (!customer || !customer.phone) {
      await recipient.update({
        status: 'FAILED',
        errorMessage: 'Missing phone number',
      });
      return 'FAILED';
    }

    let result;
    const context = { customerId: customer.id, agencyId };

    if (template) {
      const variables = buildTemplateVariables(template, customer);
      const renderedBody = resolveTemplateBody(template.body, variables);

      result = await whatsappService.sendTemplateOrTextIn24hWindow(
        customer.phone,
        {
          templateName: template.name,
          variables,
          text: renderedBody,
          context,
        }
      );
    } else if (campaign.messageBody) {
      // Send text message (non-template)
      const body = (campaign.messageBody || '')
        .replace(/\{\{name\}\}/gi, customer.name || 'there')
        .replace(/\{\{phone\}\}/gi, customer.phone || '');

      result = await whatsappService.sendTextMessage(
        customer.phone,
        body,
        context
      );
    } else {
      await recipient.update({
        status: 'FAILED',
        errorMessage: 'No template or message body configured',
      });
      return 'FAILED';
    }

    // Update recipient with success status
    const waMessageId = result?.waMessageId || result?.get?.('waMessageId') || null;
    await recipient.update({
      status: 'SENT',
      waMessageId,
      sentAt: new Date(),
    });

    if (campaign.type === 'REVIEW_COLLECTION') {
      const [session] = await BotSession.findOrCreate({
        where: { customerId: recipient.customerId, agencyId },
        defaults: { currentStep: 'REVIEW', isHandedOff: false }
      });
      if (session) {
        await session.update({ currentStep: 'REVIEW', isHandedOff: false });
      }

      const canSendInteractivePrompt = await whatsappService.isCustomerIn24hWindow(context);
      if (canSendInteractivePrompt) {
        await sendReviewRatingPrompt(customer, agencyId).catch((err) => {
          console.error(`[CampaignBroadcast] Failed to send review rating prompt to ${customer.phone}:`, err.message);
        });
      }
    }

    // Send follow-up interactive entry points if the customer is in the 24h service window.
    const linkedPkgIds = Array.isArray(campaign.linkedPackageIds) ? campaign.linkedPackageIds : [];
    const hasDynamicSections = Array.isArray(campaign.campaignSections) && campaign.campaignSections.length > 0;
    const format = String(campaign.format || 'STANDARD').toUpperCase();
    const hasCarouselItems = Array.isArray(campaign.carouselConfig?.items) && campaign.carouselConfig.items.length > 0;
    if ((linkedPkgIds.length > 0 || hasDynamicSections || hasCarouselItems) && campaign.type !== 'REVIEW_COLLECTION') {
      const canSendInteractive = await whatsappService.isCustomerIn24hWindow(context);
      if (canSendInteractive) {
        if (format === 'ITEM_CAROUSEL') {
          await sendCampaignCarouselEntry(customer, campaign, agencyId).catch((err) => {
            console.error(`[CampaignBroadcast] Failed to send campaign carousel to ${customer.phone}:`, err.message);
          });
        } else if (format === 'SECTION_CTA' || hasDynamicSections) {
          await sendCampaignSectionEntry(customer, campaign, agencyId).catch((err) => {
            console.error(`[CampaignBroadcast] Failed to send campaign section entry to ${customer.phone}:`, err.message);
          });
        } else {
          await sendCampaignActionButtons(customer, campaign, agencyId).catch((err) => {
            console.error(`[CampaignBroadcast] Failed to send campaign action buttons to ${customer.phone}:`, err.message);
          });
        }
      }
    }

    return 'SENT';
  } catch (err) {
    console.error(`[CampaignBroadcast] Failed to send to recipient ${recipient.id}:`, err.message);
    await recipient.update({
      status: 'FAILED',
      errorMessage: err.message?.substring(0, 500),
    });
    return 'FAILED';
  }
}

/**
 * Campaign broadcast worker — processes campaigns in batches.
 */
async function startCampaignWorker() {
  const worker = new Worker(
    'campaign_broadcast',
    async (job) => {
      const { campaignId, agencyId } = job.data;
      console.log(`[MarketingScheduler] Processing campaign broadcast: ${campaignId}`);

      const campaign = await Campaign.findOne({ where: { id: campaignId, agencyId } });
      if (!campaign || campaign.status === 'CANCELLED') {
        console.log(`[MarketingScheduler] Campaign ${campaignId} not found or cancelled, skipping.`);
        return;
      }

      // Load template if set
      let template = null;
      if (campaign.templateId) {
        template = await MessageTemplate.findByPk(campaign.templateId);
      }

      // Process in batches
      let processedCount = 0;
      let sentCount = 0;
      let failedCount = 0;

      while (true) {
        // Check if campaign was cancelled mid-send
        const freshCampaign = await Campaign.findByPk(campaignId);
        if (freshCampaign.status === 'CANCELLED') {
          console.log(`[MarketingScheduler] Campaign ${campaignId} was cancelled during send.`);
          break;
        }

        const batch = await CampaignRecipient.findAll({
          where: { campaignId, status: 'PENDING' },
          limit: BATCH_SIZE,
          order: [['createdAt', 'ASC']],
        });

        if (batch.length === 0) break;

        for (const recipient of batch) {
          const result = await sendToRecipient(recipient, campaign, template, agencyId);
          processedCount++;
          if (result === 'SENT') sentCount++;
          else failedCount++;
        }

        // Update campaign aggregate counts
        await campaign.update({
          sent: campaign.sent + sentCount,
          failed: campaign.failed + failedCount,
        });

        // Reset batch counters
        sentCount = 0;
        failedCount = 0;

        // Rate limit delay between batches
        await sleep(BATCH_DELAY_MS);

        // Report progress
        await job.updateProgress(Math.round((processedCount / campaign.totalRecipients) * 100));
      }

      // Finalize campaign
      const finalSent = await CampaignRecipient.count({ where: { campaignId, status: 'SENT' } });
      const finalDelivered = await CampaignRecipient.count({ where: { campaignId, status: 'DELIVERED' } });
      const finalRead = await CampaignRecipient.count({ where: { campaignId, status: 'READ' } });
      const finalReplied = await CampaignRecipient.count({ where: { campaignId, status: 'REPLIED' } });
      const finalFailed = await CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } });

      await campaign.update({
        status: 'SENT',
        completedAt: new Date(),
        sent: finalSent,
        delivered: finalDelivered,
        read: finalRead,
        replied: finalReplied,
        failed: finalFailed,
      });

      console.log(`[MarketingScheduler] Campaign ${campaignId} completed: ${finalSent} sent, ${finalFailed} failed.`);
    },
    { connection, concurrency: 1 }
  );

  worker.on('error', (err) => {
    console.error('[MarketingScheduler] Campaign worker error:', err.message);
  });

  worker.on('failed', (job, err) => {
    console.error(`[MarketingScheduler] Campaign job ${job?.id} failed:`, err.message);
  });

  return worker;
}

async function startDripWorker() {
  const worker = new Worker(
    'drip_processor',
    async (job) => {
      console.log(`[MarketingScheduler] Processing drip check`);
      try {
        const due = await dripService.getDueEnrollments();
        for (const enrollment of due) {
          // Process next step...
          // For simplicity in this demo, just mark them as completed
          await dripService.updateEnrollment(enrollment.id, enrollment.agencyId, 'COMPLETED');
        }
      } catch (err) {
        console.error('[MarketingScheduler] Drip processing failed:', err);
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('error', (err) => {
    console.error('[MarketingScheduler] Drip worker error:', err.message);
  });

  return worker;
}

/**
 * Scheduled campaign checker — auto-sends campaigns whose scheduledAt has passed.
 */
async function startScheduledCampaignChecker() {
  const worker = new Worker(
    'scheduled_campaign_checker',
    async () => {
      try {
        const dueCampaigns = await Campaign.findAll({
          where: {
            status: 'SCHEDULED',
            scheduledAt: { [Op.lte]: new Date() },
          },
        });

        for (const campaign of dueCampaigns) {
          console.log(`[MarketingScheduler] Auto-sending scheduled campaign: ${campaign.id} (${campaign.name})`);

          const campaignService = require('./campaignService');
          try {
            await campaignService.sendCampaign(campaign.id, campaign.agencyId);
          } catch (err) {
            console.error(`[MarketingScheduler] Failed to auto-send campaign ${campaign.id}:`, err.message);
            await campaign.update({ status: 'FAILED' });
          }
        }
      } catch (err) {
        console.error('[MarketingScheduler] Scheduled campaign check failed:', err);
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on('error', (err) => {
    console.error('[MarketingScheduler] Scheduled checker error:', err.message);
  });

  return worker;
}

// Add a repeating job to check drips every minute
async function scheduleDripChecker() {
  await dripQueue.add('check-drips', {}, {
    repeat: {
      pattern: '* * * * *', // every minute
    },
  });
}

// Add a repeating job to check scheduled campaigns every minute
const scheduledCampaignQueue = new Queue('scheduled_campaign_checker', { connection });

async function scheduleScheduledCampaignChecker() {
  await scheduledCampaignQueue.add('check-scheduled', {}, {
    repeat: {
      pattern: '* * * * *', // every minute
    },
  });
}

function startMarketingWorkers() {
  const campaignWorker = startCampaignWorker();
  const dripWorker = startDripWorker();
  const scheduledChecker = startScheduledCampaignChecker();
  scheduleDripChecker().catch(err => console.error(err));
  scheduleScheduledCampaignChecker().catch(err => console.error(err));
  
  console.log('[MarketingScheduler] Campaign, Drip, and Scheduled Campaign workers started');
  return { campaignWorker, dripWorker, scheduledChecker };
}

module.exports = {
  startMarketingWorkers,
  campaignQueue,
  dripQueue,
};
