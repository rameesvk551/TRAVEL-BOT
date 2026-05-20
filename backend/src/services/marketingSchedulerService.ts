// FILE: /backend/src/services/marketingSchedulerService.ts

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const dripService = require('./dripService');
const { Campaign, CampaignRecipient, Customer, MessageTemplate, BotSession, Agency, Package, Property, WhatsAppFlow } = require('../models');
const whatsappService = require('./whatsappService');
const mediaService = require('./mediaService');
const { Op } = require('sequelize');

const redisUrl = process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? null : 'redis://localhost:6379');
const campaignMediaCache = new Map();

function isRedisUsable(url) {
  if (!url) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  if (String(process.env.REDIS_ALLOW_LOCALHOST || 'false').toLowerCase() === 'true') return true;

  const normalized = String(url).toLowerCase();
  return !normalized.includes('localhost') && !normalized.includes('127.0.0.1');
}

const redisEnabled = isRedisUsable(redisUrl);
let redisWarningShown = false;

function logRedisDisabled(reason) {
  if (redisWarningShown) return;
  redisWarningShown = true;
  console.warn(`[MarketingScheduler] Redis unavailable, marketing queues are disabled${reason ? `: ${reason}` : ''}`);
}

let connection = null;
let campaignQueue = null;
let dripQueue = null;
let scheduledCampaignQueue = null;

if (redisEnabled) {
  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });
  connection.on('error', (err) => {
    logRedisDisabled(err.message);
  });

  campaignQueue = new Queue('campaign_broadcast', { connection });
  dripQueue = new Queue('drip_processor', { connection });
  scheduledCampaignQueue = new Queue('scheduled_campaign_checker', { connection });
} else {
  logRedisDisabled(redisUrl ? 'REDIS_URL points to localhost in production' : 'REDIS_URL is not configured');
}

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

function countTemplatePlaceholders(text = '') {
  const matches = String(text || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
  return matches.reduce((max, token) => {
    const index = parseInt(token.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(index) ? Math.max(max, index) : max;
  }, 0);
}

function getTemplateVariableCount(template) {
  const carouselVariableCount = Array.isArray(template?.carouselCards)
    ? template.carouselCards.reduce((max, card) => Math.max(max, countTemplatePlaceholders(card?.body)), 0)
    : 0;

  return Math.max(
    Number(template?.variableCount) || 0,
    countTemplatePlaceholders(template?.body),
    countTemplatePlaceholders(template?.headerContent),
    carouselVariableCount
  );
}

function cleanAgencyName(name) {
  return String(name || '').trim() || 'our travel team';
}

function replacePlaceholderAgencyText(text, agencyName) {
  if (!text) return text;
  return String(text)
    .replace(/ABC\s+Trours/gi, agencyName)
    .replace(/ABC\s+Tours/gi, agencyName)
    .replace(/abc\s+tours/gi, agencyName);
}

function sanitizeTemplateParameter(value) {
  return String(value || '')
    .replace(/\*/g, '＊')
    .replace(/[\r\n\t]+/g, ' - ')
    .replace(/ {4,}/g, '   ')
    .replace(/\s+-\s+-\s+/g, ' - ')
    .trim();
}

function buildTemplateVariables(template, customer, context = {}) {
  const agencyName = cleanAgencyName(context.agencyName);
  const featuredItem = context.featuredItem || null;
  const featuredRecord = featuredItem?.record || null;
  const campaignDescription = sanitizeTemplateParameter(context.campaignDescription || '');
  const featuredDetails = campaignDescription || context.featuredDetails || (featuredRecord
    ? buildCampaignCarouselCaption(featuredItem.itemType, featuredRecord)
    : null);

  const count = getTemplateVariableCount(template);
  const defaultVariables = ['there', 'travel', 'our offer', 'today'];
  const variables = Array.from({ length: count }, (_, index) => {
    if (index === 0) return sanitizeTemplateParameter(customer.name || 'there');
    if (index === 1 && featuredDetails) return sanitizeTemplateParameter(featuredDetails);
    if (index === 2 && featuredRecord?.name) return sanitizeTemplateParameter(featuredRecord.name);
    if (index === 3) return sanitizeTemplateParameter(agencyName);
    return sanitizeTemplateParameter(template.sampleVariables?.[index] || defaultVariables[index] || defaultVariables[defaultVariables.length - 1]);
  });

  return variables;
}

function hasInteractiveTemplateButtons(template) {
  return Array.isArray(template?.buttons) && template.buttons.length > 0;
}

async function sendReviewRatingPrompt(customer, agencyId) {
  const context = { customerId: customer.id, agencyId };
  const reviewFlow = await WhatsAppFlow.findOne({
    where: {
      agencyId,
      flowType: 'REVIEW',
      status: 'PUBLISHED',
    },
    order: [['updatedAt', 'DESC']],
  });

  if (reviewFlow?.metaFlowId) {
    const flowResponse = await whatsappService.sendFlowMessage(
      customer.phone,
      `Please rate your ${customer.destination || 'trip'} experience.`,
      {
        flowId: reviewFlow.metaFlowId,
        firstScreenId: reviewFlow.firstScreenId || 'RECOMMEND',
        flowCta: 'Write Review',
        flowToken: `review|${agencyId}|${customer.id}|${Date.now()}`,
      },
      context,
      {
        headerText: 'Share Your Review',
        footerText: 'If the form does not open, reply with a number from 1 to 5.',
      }
    );

    if (String(flowResponse?.status || flowResponse?.get?.('status') || '').toUpperCase() !== 'FAILED') {
      return flowResponse;
    }
  }

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
    { headerText: 'Explore Deals', footerText: 'Tap one option to continue.' }
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

function getCatalogRecordMediaUrl(record) {
  const link = String(record?.imageUrl || record?.coverImageUrl || '').trim();
  return link || null;
}

function isCloudinaryImageUrl(url) {
  return String(url || '').includes('res.cloudinary.com') && String(url || '').includes('/image/upload/');
}

async function ensureWhatsAppTemplateImageUrl(mediaUrl, agencyId) {
  const trimmed = String(mediaUrl || '').trim();
  if (!trimmed || isCloudinaryImageUrl(trimmed)) return trimmed || null;
  if (campaignMediaCache.has(trimmed)) return campaignMediaCache.get(trimmed);

  try {
    const uploaded = await mediaService.uploadRemoteTemplateMedia(trimmed, agencyId, 'image');
    const stableUrl = uploaded?.secureUrl || trimmed;
    campaignMediaCache.set(trimmed, stableUrl);
    return stableUrl;
  } catch (err) {
    console.error('[CampaignBroadcast] Failed to normalize campaign image for WhatsApp template header', {
      agencyId,
      mediaUrl: trimmed,
      message: err.message,
    });
    return trimmed;
  }
}

async function resolveCampaignFeaturedCatalogItem(campaign, agencyId) {
  const featuredType = String(campaign?.ctaConfig?.featuredItemType || '').toUpperCase();
  const featuredId = String(campaign?.ctaConfig?.featuredItemId || '').trim();

  if (featuredType && featuredId && ['PACKAGE', 'PROPERTY'].includes(featuredType)) {
    const Model = featuredType === 'PROPERTY' ? Property : Package;
    const record = await Model.findOne({
      where: { agencyId, id: featuredId, isActive: { [Op.ne]: false } },
    });
    if (record) {
      return { itemType: featuredType, record };
    }
  }

  const sections = getEnabledCampaignSections(campaign)
    .filter((section) => ['PACKAGE', 'PROPERTY'].includes(String(section.itemType || '').toUpperCase()));
  if (!sections.length) return null;

  const packageIds = [];
  const propertyIds = [];
  sections.forEach((section) => {
    const selectedIds = Array.isArray(section.selectedItemIds) ? section.selectedItemIds : [];
    if (section.itemType === 'PROPERTY') {
      propertyIds.push(...selectedIds);
      return;
    }
    packageIds.push(...selectedIds);
  });

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

  for (const section of sections) {
    const selectedIds = Array.isArray(section.selectedItemIds) ? section.selectedItemIds : [];
    for (const itemId of selectedIds) {
      const record = section.itemType === 'PROPERTY' ? propertyMap.get(itemId) : packageMap.get(itemId);
      if (record) {
        return { itemType: section.itemType, record };
      }
    }
  }

  return null;
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

async function buildRuntimeCampaignTemplate(campaign, template, agencyId) {
  if (!template) return null;

  const runtimeTemplate = template.toJSON ? template.toJSON() : { ...template };
  const agency = await Agency.findByPk(agencyId, { attributes: ['id', 'name'] });
  const agencyName = cleanAgencyName(agency?.name);
  const campaignDescription = sanitizeTemplateParameter(
    campaign?.ctaConfig?.description || campaign?.ctaConfig?.campaignDescription || ''
  );
  const templateType = String(runtimeTemplate.templateType || 'STANDARD').toUpperCase();
  const format = String(campaign.format || 'STANDARD').toUpperCase();

  runtimeTemplate.body = replacePlaceholderAgencyText(runtimeTemplate.body, agencyName);
  runtimeTemplate.footer = replacePlaceholderAgencyText(runtimeTemplate.footer, agencyName);

  if (format === 'ITEM_CAROUSEL' || templateType === 'CAROUSEL') {
    const items = await resolveCampaignCarouselItems(campaign, agencyId);
    if (items.length < 2) {
      throw new Error('Carousel campaigns require 2 to 10 selected packages or properties');
    }

    const missingMediaItem = items.find((item) => !getCatalogRecordMediaUrl(item.record));
    if (missingMediaItem) {
      throw new Error(`Selected ${missingMediaItem.itemType.toLowerCase()} "${missingMediaItem.record.name}" is missing an image`);
    }

    const baseCards = Array.isArray(runtimeTemplate.carouselCards) && runtimeTemplate.carouselCards.length > 0
      ? runtimeTemplate.carouselCards
      : [{}];

    if (baseCards.length > 1 && items.length !== baseCards.length) {
      console.warn('[CampaignBroadcast] Carousel item count does not match approved template cards; using approved template card structure.', {
        campaignId: campaign.id,
        selectedItems: items.length,
        templateCards: baseCards.length,
        templateName: runtimeTemplate.name,
      });
      runtimeTemplate.carouselCards = baseCards.map((card, index) => ({
        ...card,
        body: replacePlaceholderAgencyText(card.body || `Featured trip ${index + 1}`, agencyName).slice(0, 1024),
      }));
      return runtimeTemplate;
    }

    runtimeTemplate.carouselCards = items.map((item, index) => {
      const baseCard = baseCards[index] || baseCards[baseCards.length - 1] || {};
      const mediaUrl = getCatalogRecordMediaUrl(item.record);

      return {
        ...baseCard,
        itemType: item.itemType,
        itemId: item.record.id,
        title: item.record.name || baseCard.title || `Card ${index + 1}`,
        body: replacePlaceholderAgencyText(baseCard.body || buildCampaignCarouselCaption(item.itemType, item.record), agencyName).slice(0, 1024),
        mediaType: String(baseCard.mediaType || runtimeTemplate.mediaType || campaign.mediaType || 'IMAGE').toUpperCase() === 'VIDEO'
          ? 'VIDEO'
          : 'IMAGE',
        mediaUrl,
        imageUrl: mediaUrl,
      };
    });

    return runtimeTemplate;
  }

  if (format === 'SECTION_CTA') {
    const featuredItem = await resolveCampaignFeaturedCatalogItem(campaign, agencyId);
    const mediaUrl = await ensureWhatsAppTemplateImageUrl(getCatalogRecordMediaUrl(featuredItem?.record), agencyId);
    const headerType = String(runtimeTemplate.headerType || '').toUpperCase();
    if (headerType === 'IMAGE' && !mediaUrl) {
      throw new Error('CTA campaigns require at least one selected package or property with an image');
    }
    if (headerType === 'IMAGE') {
      runtimeTemplate.headerContent = mediaUrl;
    }
    if (featuredItem?.record) {
      runtimeTemplate.featuredItem = {
        itemType: featuredItem.itemType,
        itemId: featuredItem.record.id,
        name: featuredItem.record.name,
        details: campaignDescription || buildCampaignCarouselCaption(featuredItem.itemType, featuredItem.record),
      };
      runtimeTemplate.sampleVariables = Array.isArray(runtimeTemplate.sampleVariables)
        ? [...runtimeTemplate.sampleVariables]
        : [];
      runtimeTemplate.sampleVariables[1] = runtimeTemplate.featuredItem.details;
      runtimeTemplate.sampleVariables[2] = runtimeTemplate.featuredItem.name;
      runtimeTemplate.sampleVariables[3] = agencyName;
      runtimeTemplate.variableCount = Math.max(getTemplateVariableCount(runtimeTemplate), runtimeTemplate.variableCount || 0);
    }
  }

  runtimeTemplate.agencyName = agencyName;
  runtimeTemplate.campaignDescription = campaignDescription;
  return runtimeTemplate;
}

async function sendCampaignCarouselEntry(customer, campaign, agencyId) {
  const context = { customerId: customer.id, agencyId };
  const items = await resolveCampaignCarouselItems(campaign, agencyId);
  if (!items.length) return null;

  for (const item of items) {
    const buttons = [
      { id: `campaign_carousel_enquire:${campaign.id}:${item.itemType}:${item.record.id}`, title: 'View Details' },
      { id: `campaign_carousel_others:${campaign.id}:${item.itemType}`, title: 'View Others' },
    ];

    await whatsappService.sendMediaButtonsMessage(
      customer.phone,
      buildCampaignCarouselCaption(item.itemType, item.record),
      item.record.imageUrl,
      buttons,
      context,
      { footerText: 'Tap View Details to know more.' }
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
      const runtimeTemplate = await buildRuntimeCampaignTemplate(campaign, template, agencyId);
      const variables = buildTemplateVariables(runtimeTemplate, customer, {
        agencyName: runtimeTemplate.agencyName,
        featuredItem: runtimeTemplate.featuredItem ? {
          itemType: runtimeTemplate.featuredItem.itemType,
          record: {
            id: runtimeTemplate.featuredItem.itemId,
            name: runtimeTemplate.featuredItem.name,
          },
        } : null,
        featuredDetails: runtimeTemplate.featuredItem?.details,
        campaignDescription: runtimeTemplate.campaignDescription,
      });

      // Campaigns should send the actual approved template so Meta renders
      // carousel cards / media headers instead of falling back to plain text.
      result = await whatsappService.sendTemplateMessage(
        customer.phone,
        runtimeTemplate.name,
        variables,
        context,
        { template: runtimeTemplate }
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

    const messageStatus = String(
      result?.status
      || result?.dataValues?.status
      || result?.get?.('status')
      || ''
    ).toUpperCase();

    if (messageStatus === 'FAILED') {
      await recipient.update({
        status: 'FAILED',
        errorMessage: 'WhatsApp provider rejected the outbound message',
      });
      return 'FAILED';
    }

    // Update recipient with success status
    const waMessageId = result?.waMessageId || result?.dataValues?.waMessageId || result?.get?.('waMessageId') || null;
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
    const isApprovedCarouselTemplate = String(template?.templateType || '').toUpperCase() === 'CAROUSEL';
    if ((linkedPkgIds.length > 0 || hasDynamicSections || hasCarouselItems) && campaign.type !== 'REVIEW_COLLECTION') {
      const canSendInteractive = await whatsappService.isCustomerIn24hWindow(context);
      if (canSendInteractive) {
        // If the approved template already includes CTA buttons, let those be the only
        // entry point so customers do not receive a duplicate standalone CTA message.
        if (hasInteractiveTemplateButtons(template)) {
          return 'SENT';
        }

        if (format === 'ITEM_CAROUSEL') {
          if (isApprovedCarouselTemplate) {
            return 'SENT';
          }
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

async function processCampaignBroadcast(campaignId, agencyId, options = {}) {
  const progressCallback = typeof options.onProgress === 'function' ? options.onProgress : null;
  const campaign = await Campaign.findOne({ where: { id: campaignId, agencyId } });
  if (!campaign || campaign.status === 'CANCELLED') {
    console.log(`[MarketingScheduler] Campaign ${campaignId} not found or cancelled, skipping.`);
    return;
  }

  let template = null;
  if (campaign.templateId) {
    template = await MessageTemplate.findByPk(campaign.templateId);
  }

  let processedCount = 0;
  let sentCount = 0;
  let failedCount = 0;

  try {
    while (true) {
      const freshCampaign = await Campaign.findByPk(campaignId);
      if (!freshCampaign || freshCampaign.status === 'CANCELLED') {
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

      await campaign.update({
        sent: campaign.sent + sentCount,
        failed: campaign.failed + failedCount,
      });

      sentCount = 0;
      failedCount = 0;

      if (processedCount < campaign.totalRecipients) {
        await sleep(BATCH_DELAY_MS);
      }

      if (progressCallback) {
        await progressCallback(Math.round((processedCount / Math.max(campaign.totalRecipients || 1, 1)) * 100));
      }
    }

    const finalSent = await CampaignRecipient.count({ where: { campaignId, status: 'SENT' } });
    const finalDelivered = await CampaignRecipient.count({ where: { campaignId, status: 'DELIVERED' } });
    const finalRead = await CampaignRecipient.count({ where: { campaignId, status: 'READ' } });
    const finalReplied = await CampaignRecipient.count({ where: { campaignId, status: 'REPLIED' } });
    const finalFailed = await CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } });

    await campaign.update({
      status: finalFailed > 0 && finalSent === 0 ? 'FAILED' : 'SENT',
      completedAt: new Date(),
      sent: finalSent,
      delivered: finalDelivered,
      read: finalRead,
      replied: finalReplied,
      failed: finalFailed,
    });

    console.log(`[MarketingScheduler] Campaign ${campaignId} completed: ${finalSent} sent, ${finalFailed} failed.`);
  } catch (err) {
    console.error(`[MarketingScheduler] Campaign ${campaignId} processing failed:`, err.message);
    await campaign.update({
      status: 'FAILED',
      completedAt: new Date(),
    });
    throw err;
  }
}

/**
 * Campaign broadcast worker — processes campaigns in batches.
 */
async function startCampaignWorker() {
  if (!connection) return null;
  const worker = new Worker(
    'campaign_broadcast',
    async (job) => {
      const { campaignId, agencyId } = job.data;
      console.log(`[MarketingScheduler] Processing campaign broadcast: ${campaignId}`);
      await processCampaignBroadcast(campaignId, agencyId, {
        onProgress: (progress) => job.updateProgress(progress),
      });
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
  if (!connection) return null;
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
  if (!connection) return null;
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
  if (!dripQueue) return;
  await dripQueue.add('check-drips', {}, {
    repeat: {
      pattern: '* * * * *', // every minute
    },
  });
}

async function scheduleScheduledCampaignChecker() {
  if (!scheduledCampaignQueue) return;
  await scheduledCampaignQueue.add('check-scheduled', {}, {
    repeat: {
      pattern: '* * * * *', // every minute
    },
  });
}

function startMarketingWorkers() {
  if (!connection || !campaignQueue || !dripQueue || !scheduledCampaignQueue) {
    logRedisDisabled(redisEnabled ? 'connection could not be established' : 'REDIS_URL is not configured');
    return { campaignWorker: null, dripWorker: null, scheduledChecker: null };
  }
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
  processCampaignBroadcast,
};
