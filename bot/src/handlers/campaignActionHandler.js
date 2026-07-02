// FILE: /bot/src/handlers/campaignActionHandler.js
// Handles campaign CTA, carousel, package, property, and custom-trip actions.

const path = require('path');
const axios = require('axios');
const { Op } = require('sequelize');
const {
  Campaign,
  CampaignRecipient,
  MessageTemplate,
  Agent,
  Package,
  Property,
  Itinerary,
  WhatsAppFlow,
} = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const leadService = require(path.resolve(__dirname, '../../../backend/src/services/leadService.ts'));
const { updateSession } = require('../utils/sessionManager');
const {
  ensureLead,
  getFlowBase64Image,
  buildFlowPackageOptions,
  buildFlowPropertyOptions,
  buildFlowPropertyLocationOptions,
  buildFlowPropertyTypeOptions,
  getAgencyTripFlowId,
  isMetaTripFlowConfigured,
  quickPackageEnquiry,
  startFlowGraph,
  PROPERTY_FLOW_FIRST_SCREEN_ID,
  CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
} = require('./travelFlowHandler');
const templates = require('../utils/messageTemplates');
const { sendAgentLeadAssignment, sendAgentTalkToAgentIntent } = require('../utils/agentNotificationSender');

const CAMPAIGN_PREFIXES = [
  'campaign_view_packages:',
  'campaign_call_now:',
  'campaign_pkg_pick:',
  'campaign_section:',
  'campaign_custom_trip:',
  'campaign_item_pick:',
  'campaign_carousel_enquire:',
  'campaign_carousel_others:',
  'campaign_property_enquire:',
  'campaign_card_btn:',
];
const CTA_BUTTON_ACTIONS = new Set([
  'VIEW_PACKAGES',
  'VIEW_PROPERTIES',
  'CUSTOM_TRIP',
  'VIEW_DETAILS',
  'SEND_ITINERARY',
  'CHECK_AVAILABILITY',
  'TALK_TO_AGENT',
  'OPEN_FLOW',
  'OPEN_URL',
]);
const TRAVEL_READINESS_FLOW_NAME = 'Travel Readiness Questionnaire';

function isCampaignAction(actionId = '') {
  return CAMPAIGN_PREFIXES.some((prefix) => String(actionId).startsWith(prefix));
}

function escapeMarkdown(text = '') {
  return String(text || '').replace(/\*/g, '＊').trim();
}

function packageDescriptionText(text = '') {
  return escapeMarkdown(text);
}

function phoneDigits(phone = '') {
  return String(phone || '').replace(/\D/g, '');
}

function buildWhatsAppChatLink(phone = '', message = '') {
  const digits = phoneDigits(phone);
  if (!digits) return '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

function buildSpecialistPrefill({ customer, pkg, campaign, lead }) {
  return [
    `Hi, I am ${customer?.name || 'interested customer'}.`,
    pkg?.name ? `I want to discuss ${pkg.name}.` : 'I want to discuss this campaign.',
  ].filter(Boolean).join('\n');
}

function money(amountPaise = 0) {
  return `INR ${Math.round(Number(amountPaise || 0) / 100).toLocaleString('en-IN')}`;
}

function packagePriceLabel(amountPaise) {
  const amount = Number(amountPaise || 0);
  return Number.isFinite(amount) && amount > 0 ? money(amount) : '';
}

function packageSummaryLine(pkg, separator = ' - ') {
  return [
    packagePriceLabel(pkg?.basePrice),
    escapeMarkdown(pkg?.duration || 'Custom itinerary'),
  ].filter(Boolean).join(separator);
}

function parseAction(actionId = '') {
  return String(actionId || '').split(':');
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeLooseText(value = '') {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textIncludesAny(text, candidates = []) {
  const normalized = normalizeLooseText(text);
  return candidates.some((candidate) => normalized.includes(normalizeLooseText(candidate)));
}

function normalizeButtonTextKey(value = '') {
  return normalizeLooseText(value).replace(/\s+/g, '_');
}

function getButtonActionKey(button, index) {
  return `${normalizeButtonTextKey(button?.text || button?.title || `button_${index + 1}`)}:${index}`;
}

async function getCampaign(campaignId, agency) {
  if (!campaignId) return null;
  return Campaign.findOne({ where: { id: campaignId, agencyId: agency.id } });
}

async function getLatestCampaignRecipient(customer, agency) {
  if (!customer?.id || !agency?.id) return null;

  return CampaignRecipient.findOne({
    where: {
      customerId: customer.id,
      status: { [Op.in]: ['SENT', 'DELIVERED', 'READ', 'REPLIED'] },
    },
    include: [{
      model: Campaign,
      as: 'campaign',
      where: { agencyId: agency.id },
      include: [{ model: MessageTemplate, as: 'template', attributes: ['id', 'buttons'] }],
      required: true,
    }],
    order: [['sentAt', 'DESC'], ['createdAt', 'DESC']],
  });
}

function getRouteForSection(section) {
  const itemType = String(section?.itemType || '').toUpperCase();
  if (itemType === 'PACKAGE') return 'VIEW_PACKAGES';
  if (itemType === 'PROPERTY') return 'VIEW_PROPERTIES';
  if (itemType === 'CUSTOM_TRIP') return 'CUSTOM_TRIP';
  return null;
}

function getTemplateButtonRoute(campaign, text, sections = []) {
  const normalizedText = normalizeLooseText(text);
  if (!normalizedText) return null;

  const buttons = Array.isArray(campaign?.template?.buttons) ? campaign.template.buttons : [];
  const matchingIndex = buttons.findIndex((button) => normalizeLooseText(button.text || button.title) === normalizedText);
  if (matchingIndex < 0) return null;

  const matchingButton = buttons[matchingIndex];
  const route = String(matchingButton?.route || '').toUpperCase();
  if (CTA_BUTTON_ACTIONS.has(route)) return route;

  return getRouteForSection(sections[matchingIndex]);
}

function getCampaignButtonAction(campaign, text) {
  const normalizedText = normalizeLooseText(text);
  if (!normalizedText) return null;

  const buttonActions = campaign?.ctaConfig && typeof campaign.ctaConfig === 'object'
    ? campaign.ctaConfig.buttonActions || {}
    : {};
  if (!buttonActions || typeof buttonActions !== 'object') return null;

  const buttons = Array.isArray(campaign?.template?.buttons) ? campaign.template.buttons : [];
  const matchingIndex = buttons.findIndex((button) => normalizeLooseText(button.text || button.title) === normalizedText);
  const keys = [];
  if (matchingIndex > -1) {
    const matchingButton = buttons[matchingIndex];
    keys.push(getButtonActionKey(matchingButton, matchingIndex));
    keys.push(normalizeButtonTextKey(matchingButton.text || matchingButton.title));
  }
  keys.push(normalizeButtonTextKey(text));

  for (const key of keys) {
    if (buttonActions[key]) return buttonActions[key];
  }

  return Object.values(buttonActions).find((entry) => normalizeLooseText(entry?.buttonText) === normalizedText) || null;
}

function getSections(campaign) {
  const sections = Array.isArray(campaign?.campaignSections) ? campaign.campaignSections : [];
  if (sections.length) {
    return sections
      .filter((section) => section.enabled !== false)
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  }

  const linkedPackageIds = Array.isArray(campaign?.linkedPackageIds) ? campaign.linkedPackageIds : [];
  if (linkedPackageIds.length) {
    return [{
      key: 'packages',
      label: 'View Packages',
      itemType: 'PACKAGE',
      selectionMode: 'MANUAL',
      selectedItemIds: linkedPackageIds,
      filter: {},
    }];
  }

  return [];
}

async function getPublishedFlowByType(agencyId, flowType) {
  if (!agencyId || !flowType) return null;

  return WhatsAppFlow.findOne({
    where: {
      agencyId,
      flowType,
      status: 'PUBLISHED',
      metaFlowId: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });
}

async function getPackageFlowConfig(agency) {
  const packageFlow = await getPublishedFlowByType(agency.id, 'PACKAGE');
  const legacyFlowId = getAgencyTripFlowId(agency);
  if (!packageFlow?.metaFlowId && !legacyFlowId) return null;

  return {
    flowId: packageFlow?.metaFlowId || legacyFlowId,
    firstScreenId: packageFlow?.firstScreenId || null,
  };
}

async function getPropertyFlowConfig(agency) {
  const propertyFlow = await getPublishedFlowByType(agency.id, 'PROPERTY');
  if (!propertyFlow?.metaFlowId) return null;

  return {
    flowId: propertyFlow.metaFlowId,
    firstScreenId: propertyFlow.firstScreenId || PROPERTY_FLOW_FIRST_SCREEN_ID,
  };
}

async function getCustomTripFlowConfig(agency) {
  const customTripFlow = await getPublishedFlowByType(agency.id, 'CUSTOM_TRIP');
  if (!customTripFlow?.metaFlowId) return null;

  return {
    flowId: customTripFlow.metaFlowId,
    firstScreenId: customTripFlow.firstScreenId || CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
  };
}

async function getTravelReadinessFlowConfig(agency) {
  const readinessFlow = await WhatsAppFlow.findOne({
    where: {
      agencyId: agency.id,
      status: { [Op.in]: ['PUBLISHED', 'DRAFT'] },
      metaFlowId: { [Op.ne]: null },
      name: { [Op.iLike]: `%${TRAVEL_READINESS_FLOW_NAME}%` },
    },
    order: [
      ['status', 'DESC'],
      ['updatedAt', 'DESC'],
    ],
  });

  if (!readinessFlow?.metaFlowId) return null;
  return {
    flowId: readinessFlow.metaFlowId,
    firstScreenId: readinessFlow.firstScreenId || 'TRAVELLER_COUNT',
    name: readinessFlow.name,
  };
}

async function trackCampaignClick(campaignId, customer, agency, details = {}) {
  if (!campaignId || !customer?.id || !agency?.id) return null;

  const recipient = await CampaignRecipient.findOne({
    where: { campaignId, customerId: customer.id },
  });

  if (!recipient) return null;

  const updates = {
    clickedAt: recipient.clickedAt || new Date(),
    clickedAction: details.clickedAction || recipient.clickedAction || null,
    selectedItemType: details.selectedItemType || recipient.selectedItemType || null,
    selectedItemId: details.selectedItemId || recipient.selectedItemId || null,
  };

  if (!recipient.repliedAt && ['SENT', 'DELIVERED', 'READ'].includes(recipient.status)) {
    updates.status = 'REPLIED';
    updates.repliedAt = new Date();
  }

  await recipient.update(updates);
  return recipient;
}

async function attachLeadToRecipient(campaignId, customer, lead, extra = {}) {
  if (!campaignId || !customer?.id || !lead?.id) return;
  await CampaignRecipient.update(
    {
      leadId: lead.id,
      flowSubmittedAt: extra.flowSubmittedAt || null,
      selectedItemType: extra.selectedItemType || undefined,
      selectedItemId: extra.selectedItemId || undefined,
    },
    { where: { campaignId, customerId: customer.id } }
  );
}

function isStayrouteAgency(agency = {}) {
  return normalizeLooseText(agency.name || '').includes('stayroute');
}

async function findBisminaAgent(agency) {
  if (!agency?.id || !isStayrouteAgency(agency)) return null;
  return Agent.findOne({
    where: {
      agencyId: agency.id,
      name: { [Op.iLike]: '%bismina%' },
      phone: { [Op.ne]: null },
    },
    order: [['createdAt', 'ASC']],
  });
}

async function autoAssignStayrouteCampaignInteraction(session, campaignOrId, customer, agency, actionLabel, extra = {}) {
  const bismina = await findBisminaAgent(agency);
  if (!bismina?.phone) return null;

  const campaign = typeof campaignOrId === 'string'
    ? await getCampaign(campaignOrId, agency)
    : campaignOrId;
  if (!campaign?.id) return null;

  const selectedPackageId = extra.packageId || session.collectedData?.selectedPackageId || null;
  const pkg = selectedPackageId
    ? await Package.findOne({ where: { id: selectedPackageId, agencyId: agency.id, isActive: true } })
    : null;

  let lead = await ensureLead(session, customer, agency, {
    packageId: pkg?.id || null,
    itemType: pkg ? 'PACKAGE' : null,
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: actionLabel || 'CAMPAIGN_BUTTON_CLICK',
    destination: pkg?.destinations?.[0] || null,
    interest: 'CAMPAIGN_BUTTON_CLICK',
    status: 'ENQUIRY',
    notes: `Campaign button clicked: ${actionLabel || 'Unknown action'}${pkg ? ` | Package: ${pkg.name}` : ''}`,
  });

  if (lead?.id && lead.assignedAgentId !== bismina.id) {
    lead = await leadService.updateLead(lead.id, agency.id, { assignedAgentId: bismina.id });
  }

  await attachLeadToRecipient(campaign.id, customer, lead, {
    selectedItemType: pkg ? 'PACKAGE' : extra.selectedItemType || null,
    selectedItemId: pkg?.id || extra.selectedItemId || null,
  });

  await sendAgentLeadAssignment(bismina.phone, agency.id, {
    customerName: customer?.name,
    phone: customer?.phone,
    packageName: pkg?.name || campaign.name,
    notes: `Campaign: ${campaign.name}. Button clicked: ${actionLabel || 'Unknown action'}.`,
  }, { customerId: customer.id, agencyId: agency.id }).catch((err) => {
    console.warn('[CampaignAction] Could not notify Bismina of campaign interaction:', err.message);
  });

  return lead;
}

async function resolveSectionItems(campaign, section, agency) {
  const itemType = String(section.itemType || 'PACKAGE').toUpperCase();
  const filter = section.filter && typeof section.filter === 'object' ? section.filter : {};
  const selectedIds = Array.isArray(section.selectedItemIds) ? section.selectedItemIds.filter(Boolean) : [];
  const isManual = String(section.selectionMode || '').toUpperCase() === 'MANUAL' || selectedIds.length > 0;

  if (itemType === 'PACKAGE') {
    const where = { agencyId: agency.id, isActive: true };
    if (isManual) where.id = selectedIds;
    if (!isManual && filter.category) where.category = String(filter.category).toUpperCase();
    return Package.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  if (itemType === 'PROPERTY') {
    const where = { agencyId: agency.id, isActive: true };
    if (isManual) where.id = selectedIds;
    if (!isManual && filter.propertyType && filter.propertyType !== 'ALL') where.propertyType = filter.propertyType;
    return Property.findAll({ where, order: [['createdAt', 'DESC']] });
  }

  return [];
}

async function resolveAllCampaignItems(campaign, agency) {
  const grouped = [];
  const carouselItems = Array.isArray(campaign?.carouselConfig?.items) ? campaign.carouselConfig.items : [];

  if (carouselItems.length) {
    const packageIds = carouselItems
      .filter((item) => item.itemType === 'PACKAGE' && item.itemId)
      .map((item) => item.itemId);
    const propertyIds = carouselItems
      .filter((item) => item.itemType === 'PROPERTY' && item.itemId)
      .map((item) => item.itemId);

    if (packageIds.length) {
      const items = await Package.findAll({ where: { agencyId: agency.id, id: packageIds, isActive: true } });
      if (items.length) {
        grouped.push({
          section: { key: 'carousel_packages', label: 'Package Deals', itemType: 'PACKAGE', filter: {} },
          items,
        });
      }
    }

    if (propertyIds.length) {
      const items = await Property.findAll({ where: { agencyId: agency.id, id: propertyIds, isActive: true } });
      if (items.length) {
        grouped.push({
          section: { key: 'carousel_properties', label: 'Properties', itemType: 'PROPERTY', filter: {} },
          items,
        });
      }
    }
  }

  const sections = getSections(campaign).filter((section) => section.itemType !== 'CUSTOM_TRIP');

  for (const section of sections) {
    const items = await resolveSectionItems(campaign, section, agency);
    if (items.length > 0) grouped.push({ section, items });
  }

  return grouped;
}

async function showCampaignSection(session, campaignId, sectionKey, customer, agency) {
  const campaign = await getCampaign(campaignId, agency);
  const ctx = { customerId: customer.id, agencyId: agency.id };
  if (!campaign) {
    return whatsappService.sendTextMessage(customer.phone, 'This campaign is no longer available. Send Hi to browse current deals.', ctx);
  }

  const section = getSections(campaign).find((entry) => entry.key === sectionKey);
  if (!section && String(sectionKey || '').startsWith('carousel_')) {
    const groups = await resolveAllCampaignItems(campaign, agency);
    const carouselGroup = groups.find((group) => group.section?.key === sectionKey);
    if (carouselGroup) {
      await trackCampaignClick(campaign.id, customer, agency, {
        clickedAction: `SECTION_${String(sectionKey || '').toUpperCase()}`,
      });
      return showCampaignItems(session, campaign, carouselGroup.section, carouselGroup.items, customer, agency);
    }
  }

  if (!section) {
    return whatsappService.sendTextMessage(customer.phone, 'That campaign section is no longer available. Please choose another option.', ctx);
  }

  await trackCampaignClick(campaign.id, customer, agency, {
    clickedAction: `SECTION_${String(section.key || '').toUpperCase()}`,
  });

  if (section.itemType === 'CUSTOM_TRIP') {
    return startCustomTripLead(session, campaign, customer, agency);
  }

  const items = await resolveSectionItems(campaign, section, agency);
  return showCampaignItems(session, campaign, section, items, customer, agency);
}

async function openCampaignPackageFlow(campaign, section, items, customer, agency, ctx) {
  const packageFlow = await getPackageFlowConfig(agency);
  if (!packageFlow?.flowId) return null;

  const packageOptions = await buildFlowPackageOptions(items.map((pkg) => ({ pkg })));
  const pkgSectionLabel = escapeMarkdown(section?.label || 'View Packages');
  return whatsappService.sendFlowMessage(
    customer.phone,
    `Browse selected packages from ${pkgSectionLabel} 👇`,
    {
      flowId: packageFlow.flowId,
      firstScreenId: packageFlow.firstScreenId,
      flowCta: String(section?.label || 'View Packages').slice(0, 30),
      flowToken: `campaign-pkg|${agency.id}|${campaign.id}|${customer.id}|${Date.now()}`,
      data: {
        category_label: escapeMarkdown(section?.label || 'Featured').slice(0, 20),
        package_options: packageOptions,
      },
    },
    ctx,
    {
      headerText: pkgSectionLabel,
      footerText: 'Reply LIST if the flow does not open.',
    }
  );
}

async function openCampaignPropertyFlow(campaign, section, items, customer, agency, ctx) {
  const propertyFlow = await getPropertyFlowConfig(agency);
  if (!propertyFlow?.flowId) return null;

  const propertyOptions = await buildFlowPropertyOptions(items);
  const propertyLocationOptions = buildFlowPropertyLocationOptions(items);
  const propertyTypeOptions = buildFlowPropertyTypeOptions(items);
  const propSectionLabel = escapeMarkdown(section?.label || 'View Properties');
  return whatsappService.sendFlowMessage(
    customer.phone,
    `Browse selected properties from ${propSectionLabel} 👇`,
    {
      flowId: propertyFlow.flowId,
      firstScreenId: propertyFlow.firstScreenId,
      flowCta: String(section?.label || 'View Properties').slice(0, 30),
      flowToken: `campaign-prop|${agency.id}|${campaign.id}|${customer.id}|${Date.now()}`,
      data: {
        property_category_label: escapeMarkdown(section?.label || 'Featured').slice(0, 20),
        property_locations: propertyLocationOptions,
        property_types: propertyTypeOptions,
        property_options: propertyOptions,
      },
    },
    ctx,
    {
      headerText: propSectionLabel,
      footerText: 'Reply LIST if the flow does not open.',
    }
  );
}

async function showCampaignItems(session, campaign, section, items, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const itemType = String(section?.itemType || 'PACKAGE').toUpperCase();

  if (!items || items.length === 0) {
    return whatsappService.sendTextMessage(
      customer.phone,
      'No active deals are available in this section right now. Send Hi to browse other options.',
      ctx
    );
  }

  await updateSession(session, {
    currentStep: itemType === 'PROPERTY' ? 'CAMPAIGN_PROPERTIES' : 'CATEGORY_PACKAGES',
    collectedData: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      packageResults: itemType === 'PACKAGE' ? items.map((item) => item.id) : [],
      propertyResults: itemType === 'PROPERTY' ? items.map((item) => item.id) : [],
      packageCategory: section?.filter?.category || null,
      selectedPackageId: null,
      selectedPropertyId: null,
      selectedPackageIds: [],
      selectedPropertyIds: [],
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  await ensureLead(session, customer, agency, {
    interest: `Campaign: ${campaign.name}`,
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: `VIEW_${itemType}_SECTION`,
    preserveExistingStatus: true,
    notes: `Viewed ${itemType.toLowerCase()} items from campaign: ${campaign.name}`,
  });

  if (itemType === 'PACKAGE') {
    const flowResponse = await openCampaignPackageFlow(campaign, section, items, customer, agency, ctx);
    if (flowResponse?.status !== 'FAILED') {
      return flowResponse;
    }
  }

  if (itemType === 'PROPERTY') {
    const flowResponse = await openCampaignPropertyFlow(campaign, section, items, customer, agency, ctx);
    if (flowResponse?.status !== 'FAILED') {
      return flowResponse;
    }
  }

  if (items.length <= 3) {
    const buttons = items.map((item) => ({
      id: `campaign_item_pick:${campaign.id}:${itemType}:${item.id}`,
      title: String(item.name || 'View').slice(0, 20),
    }));

    return whatsappService.sendButtonsMessage(
      customer.phone,
      formatItemListText(items, itemType),
      buttons,
      ctx,
      { footerText: 'Tap one item to see full details.' }
    );
  }

  const rows = items.map((item) => ({
    id: `campaign_item_pick:${campaign.id}:${itemType}:${item.id}`,
    title: String(item.name || 'Deal').slice(0, 24),
    description: formatItemRow(item, itemType).slice(0, 72),
  }));

  return whatsappService.sendListMessage(
    customer.phone,
    `Here are more ${itemType === 'PROPERTY' ? 'properties' : 'packages'} available for you.`,
    'View Deals',
    [{ title: section?.label || 'Available Deals', rows }],
    ctx,
    { headerText: section?.label || 'Available Deals', footerText: 'Tap one item for full details.' }
  );
}

async function showCampaignOverview(session, campaignId, customer, agency) {
  const campaign = await getCampaign(campaignId, agency);
  const ctx = { customerId: customer.id, agencyId: agency.id };
  if (!campaign) return whatsappService.sendTextMessage(customer.phone, 'This campaign is no longer available.', ctx);

  await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'SEE_OTHERS' });

  const groups = await resolveAllCampaignItems(campaign, agency);
  if (groups.length === 0) {
    return whatsappService.sendTextMessage(customer.phone, 'No more active items are available in this campaign.', ctx);
  }

  if (groups.length === 1) {
    return showCampaignItems(session, campaign, groups[0].section, groups[0].items, customer, agency);
  }

  const rows = groups.map(({ section, items }) => ({
    id: `campaign_section:${campaign.id}:${section.key}`,
    title: String(section.label || section.key).slice(0, 24),
    description: `${items.length} ${section.itemType === 'PROPERTY' ? 'properties' : 'packages'} available`,
  }));

  return whatsappService.sendListMessage(
    customer.phone,
    'What would you like to explore?',
    'Explore',
    [{ title: 'Available Deals', rows }],
    ctx,
    { headerText: 'Explore Deals', footerText: 'Choose a section to continue.' }
  );
}

async function showCampaignCarouselOthers(session, campaignId, requestedItemType, customer, agency) {
  const campaign = await getCampaign(campaignId, agency);
  const ctx = { customerId: customer.id, agencyId: agency.id };
  if (!campaign) {
    return whatsappService.sendTextMessage(customer.phone, 'This campaign is no longer available.', ctx);
  }

  const normalizedItemType = String(requestedItemType || '').toUpperCase();
  await trackCampaignClick(campaign.id, customer, agency, {
    clickedAction: `SEE_OTHERS_${normalizedItemType || 'UNKNOWN'}`,
    selectedItemType: normalizedItemType || null,
  });

  const groups = await resolveAllCampaignItems(campaign, agency);
  const matchingGroups = groups.filter(({ section }) => String(section?.itemType || '').toUpperCase() === normalizedItemType);

  if (!matchingGroups.length) {
    return showCampaignOverview(session, campaignId, customer, agency);
  }

  const preferredGroup = matchingGroups.find(({ section }) => String(section?.key || '').startsWith('carousel_'))
    || matchingGroups[0];

  return showCampaignItems(session, campaign, preferredGroup.section, preferredGroup.items, customer, agency);
}

async function showCampaignPackageDetail(session, campaignId, packageId, customer, agency, action = 'PACKAGE_SELECTED') {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const [campaign, pkg] = await Promise.all([
    getCampaign(campaignId, agency),
    Package.findOne({ where: { id: packageId, agencyId: agency.id, isActive: true } }),
  ]);

  if (!pkg) {
    return whatsappService.sendTextMessage(customer.phone, 'This package is no longer available. Send Hi to browse latest packages.', ctx);
  }

  await trackCampaignClick(campaignId, customer, agency, {
    clickedAction: action,
    selectedItemType: 'PACKAGE',
    selectedItemId: pkg.id,
  });

  const lead = await ensureLead(session, customer, agency, {
    packageId: pkg.id,
    itemType: 'PACKAGE',
    source: 'whatsapp_campaign',
    campaignId,
    campaignName: campaign?.name || null,
    campaignAction: action,
    destination: pkg.destinations?.[0] || null,
    notes: `Package selected from campaign: ${pkg.name}`,
  });
  await attachLeadToRecipient(campaignId, customer, lead, { selectedItemType: 'PACKAGE', selectedItemId: pkg.id });

  await updateSession(session, {
    currentStep: 'PACKAGE_DETAIL',
    collectedData: {
      selectedPackageId: pkg.id,
      selectedPackageIds: Array.from(new Set([...(session.collectedData?.selectedPackageIds || []), pkg.id].filter(Boolean))),
      selectedPackageName: pkg.name,
      packageResults: session.collectedData?.packageResults || [pkg.id],
      campaignId,
      campaignName: campaign?.name || null,
    },
  });

  const detailMessage = [
    `*${escapeMarkdown(pkg.name)}*`,
    '',
    packagePriceLabel(pkg.basePrice) ? `${packagePriceLabel(pkg.basePrice)}/person` : 'Price on request',
    `${escapeMarkdown(pkg.duration || 'Custom itinerary')}`,
    '',
    packageDescriptionText(pkg.summary || 'Curated holiday package with handpicked stays.').slice(0, 180),
    '',
    'Highlights:',
    buildPackageHighlights(pkg),
  ].join('\n');

  const buttons = [
    { id: 'action_enquire', title: 'Enquiry' },
    { id: 'action_call_now', title: 'Call Now' },
  ];

  if (pkg.imageUrl) {
    const mediaResult = await whatsappService.sendMediaButtonsMessage(customer.phone, detailMessage, pkg.imageUrl, buttons, ctx, { footerText: 'Reply BACK for more deals.' });
    if (mediaResult?.status !== 'FAILED') return mediaResult;
  }

  return whatsappService.sendButtonsMessage(customer.phone, detailMessage, buttons, ctx, { footerText: 'Reply BACK for more deals.' });
}

async function showCampaignPropertyDetail(session, campaignId, propertyId, customer, agency, action = 'PROPERTY_SELECTED') {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const [campaign, property] = await Promise.all([
    getCampaign(campaignId, agency),
    Property.findOne({ where: { id: propertyId, agencyId: agency.id, isActive: true } }),
  ]);

  if (!property) {
    return whatsappService.sendTextMessage(customer.phone, 'This property is no longer available. Send Hi to browse other options.', ctx);
  }

  await trackCampaignClick(campaignId, customer, agency, {
    clickedAction: action,
    selectedItemType: 'PROPERTY',
    selectedItemId: property.id,
  });

  const lead = await ensureLead(session, customer, agency, {
    propertyId: property.id,
    itemType: 'PROPERTY',
    source: 'whatsapp_campaign',
    campaignId,
    campaignName: campaign?.name || null,
    campaignAction: action,
    destination: property.location || null,
    interest: 'PROPERTY',
    status: 'ENQUIRY',
    notes: `Property selected from campaign: ${property.name}`,
  });
  await attachLeadToRecipient(campaignId, customer, lead, { selectedItemType: 'PROPERTY', selectedItemId: property.id });

  await updateSession(session, {
    currentStep: 'CAMPAIGN_PROPERTY_DETAIL',
    collectedData: {
      selectedPropertyId: property.id,
      selectedPropertyIds: Array.from(new Set([...(session.collectedData?.selectedPropertyIds || []), property.id].filter(Boolean))),
      selectedPropertyName: property.name,
      campaignId,
      campaignName: campaign?.name || null,
      activeLeadId: lead.id,
    },
  });

  const amenities = Array.isArray(property.amenities) && property.amenities.length
    ? property.amenities.slice(0, 5).map((item) => `- ${escapeMarkdown(item)}`).join('\n')
    : '- Stay support\n- Travel assistance';

  const detailMessage = [
    `*${escapeMarkdown(property.name)}*`,
    '',
    `${escapeMarkdown(property.propertyType || 'Property')} in ${escapeMarkdown(property.location || 'selected destination')}`,
    property.pricePerNight ? `${money(property.pricePerNight)}/night` : 'Price on request',
    '',
    escapeMarkdown(property.description || 'Handpicked property for your trip.').slice(0, 220),
    '',
    'Amenities:',
    amenities,
  ].join('\n');

  const buttons = [
    { id: `campaign_property_enquire:${campaignId}:${property.id}`, title: 'Enquiry' },
    { id: `campaign_call_now:${campaignId}`, title: 'Call Now' },
  ];

  if (property.imageUrl) {
    const mediaResult = await whatsappService.sendMediaButtonsMessage(customer.phone, detailMessage, property.imageUrl, buttons, ctx, { footerText: 'Tap Enquiry for this property.' });
    if (mediaResult?.status !== 'FAILED') return mediaResult;
  }

  return whatsappService.sendButtonsMessage(customer.phone, detailMessage, buttons, ctx, { footerText: 'Tap Enquiry for this property.' });
}

async function startPropertyLead(session, campaignId, propertyId, customer, agency) {
  const [campaign, property] = await Promise.all([
    getCampaign(campaignId, agency),
    Property.findOne({ where: { id: propertyId, agencyId: agency.id, isActive: true } }),
  ]);
  const ctx = { customerId: customer.id, agencyId: agency.id };

  if (!property) return whatsappService.sendTextMessage(customer.phone, 'This property is no longer available.', ctx);

  const lead = await ensureLead(session, customer, agency, {
    propertyId: property.id,
    itemType: 'PROPERTY',
    source: 'whatsapp_campaign',
    campaignId,
    campaignName: campaign?.name || null,
    campaignAction: 'PROPERTY_ENQUIRY',
    destination: property.location || null,
    interest: 'PROPERTY',
    status: 'ENQUIRY',
    notes: `Property enquiry from campaign: ${property.name}`,
  });

  await trackCampaignClick(campaignId, customer, agency, {
    clickedAction: 'PROPERTY_ENQUIRY',
    selectedItemType: 'PROPERTY',
    selectedItemId: property.id,
  });
  await attachLeadToRecipient(campaignId, customer, lead, { selectedItemType: 'PROPERTY', selectedItemId: property.id, flowSubmittedAt: new Date() });

  await updateSession(session, {
    currentStep: 'COMPLETE',
    collectedData: {
      activeLeadId: lead.id,
      selectedPropertyId: property.id,
      selectedPropertyIds: Array.from(new Set([...(session.collectedData?.selectedPropertyIds || []), property.id].filter(Boolean))),
      campaignId,
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    `Thanks. Your enquiry for ${escapeMarkdown(property.name)} is created. Our travel expert will contact you shortly. You can reply with stay dates, guests, rooms, or budget to add more details.`,
    ctx
  );
}

async function startCustomTripLead(session, campaign, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const lead = await ensureLead(session, customer, agency, {
    itemType: 'CUSTOM_TRIP',
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'CUSTOM_TRIP',
    interest: 'CUSTOM_TRIP',
    status: 'ENQUIRY',
    notes: `Custom trip request from campaign: ${campaign.name}`,
  });

  const customTripFlow = await getCustomTripFlowConfig(agency);
  if (customTripFlow?.flowId) {
    await updateSession(session, {
      currentStep: 'COMPLETE',
      collectedData: {
        activeLeadId: lead.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        enquiryDraft: customer.name ? { name: customer.name } : {},
      },
    });

    const flowResponse = await whatsappService.sendFlowMessage(
      customer.phone,
      `Share your custom trip preferences 👇`,
      {
        flowId: customTripFlow.flowId,
        firstScreenId: customTripFlow.firstScreenId,
        flowCta: 'Custom Trip',
        flowToken: `campaign-custom|${agency.id}|${campaign.id}|${customer.id}|${Date.now()}`,
        data: {
          campaign_name: escapeMarkdown(campaign.name).slice(0, 60),
          customer_name: String(customer.name || '').trim(),
        },
      },
      ctx,
      {
        headerText: 'Custom Trip',
        footerText: 'Submit your trip preferences in the flow.',
      }
    );

    if (flowResponse?.status !== 'FAILED') {
      return flowResponse;
    }
  }

  await attachLeadToRecipient(campaign.id, customer, lead, { selectedItemType: 'CUSTOM_TRIP', selectedItemId: null, flowSubmittedAt: new Date() });
  await updateSession(session, {
    currentStep: 'ENQUIRY_NAME',
    collectedData: {
      activeLeadId: lead.id,
      campaignId: campaign.id,
      campaignName: campaign.name,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  return whatsappService.sendTextMessage(
    customer.phone,
    'Great. I will collect your custom trip details.\n\nPlease share your full name.',
    ctx
  );
}

function safeCampaignPdfName(pkg) {
  const base = String(pkg?.brochureFileName || pkg?.name || 'package')
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'package';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function safeItineraryPdfName(itinerary, pkg) {
  const base = String(itinerary?.name || pkg?.name || 'itinerary')
    .trim()
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'itinerary';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

async function findPackageItineraryPdf(pkg, agency) {
  if (!pkg?.id || !agency?.id) return null;

  const itineraries = await Itinerary.findAll({
    where: {
      agencyId: agency.id,
      packageId: pkg.id,
      pdfUrl: { [Op.ne]: null },
    },
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC'],
    ],
    limit: 10,
  });

  return itineraries.find((itinerary) => String(itinerary?.pdfUrl || '').trim()) || null;
}

function buildCampaignItineraryDescription(pkg) {
  const destinations = Array.isArray(pkg?.destinations) && pkg.destinations.length
    ? pkg.destinations.slice(0, 3).map(escapeMarkdown).join(', ')
    : '';
  const summary = packageDescriptionText(pkg?.summary || 'Here is the itinerary brochure for your selected package.');
  const highlights = buildPackageHighlights(pkg);

  return [
    `*${escapeMarkdown(pkg?.name || 'Selected Package')}*`,
    destinations ? `Destination: ${destinations}` : null,
    pkg?.duration ? `Duration: ${escapeMarkdown(pkg.duration)}` : null,
    pkg?.basePrice ? `Starting from ${money(pkg.basePrice)}/person` : null,
    '',
    summary.slice(0, 320),
    '',
    highlights ? `Highlights:\n${highlights}` : null,
  ].filter((line) => line !== null && line !== undefined && line !== '').join('\n');
}

async function isPublicPdfUrl(url) {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return false;

  try {
    const response = await axios.head(target, {
      maxRedirects: 3,
      timeout: 10000,
      validateStatus: () => true,
    });
    if (response.status >= 200 && response.status < 300) return true;
    console.warn('[CampaignAction] itinerary_pdf_not_public', {
      status: response.status,
      url: target,
      cloudinaryError: response.headers?.['x-cld-error'],
    });
    return false;
  } catch (err) {
    console.warn('[CampaignAction] itinerary_pdf_preflight_failed', {
      url: target,
      error: err.message,
    });
    return false;
  }
}

async function sendCampaignPackageItinerary(session, campaignId, packageId, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const [campaign, pkg] = await Promise.all([
    getCampaign(campaignId, agency),
    Package.findOne({ where: { id: packageId, agencyId: agency.id, isActive: true } }),
  ]);

  if (!pkg) {
    return whatsappService.sendTextMessage(customer.phone, 'This package is no longer available. Send Hi to browse latest packages.', ctx);
  }

  await trackCampaignClick(campaignId, customer, agency, {
    clickedAction: 'SEND_ITINERARY',
    selectedItemType: 'PACKAGE',
    selectedItemId: pkg.id,
  });

  const itinerary = await findPackageItineraryPdf(pkg, agency);
  const packageBrochureUrl = String(pkg.brochureUrl || '').trim();
  const generatedItineraryUrl = String(itinerary?.pdfUrl || '').trim();
  const documentUrl = packageBrochureUrl || generatedItineraryUrl;

  if (documentUrl) {
    const canFetchDocument = await isPublicPdfUrl(documentUrl);
    if (!canFetchDocument) {
      return whatsappService.sendTextMessage(
        customer.phone,
        `The itinerary PDF for ${escapeMarkdown(pkg.name)} is being prepared. Please try again shortly, or tap See Other to browse more options.`,
        ctx
      );
    }

    await updateSession(session, {
      currentStep: 'PACKAGE_DETAIL',
      collectedData: {
        selectedPackageId: pkg.id,
        selectedPackageName: pkg.name,
        packageResults: Array.from(new Set([...(session.collectedData?.packageResults || []), pkg.id])),
        campaignId,
        campaignName: campaign?.name || null,
      },
    });

    const documentResult = await whatsappService.sendDocumentMessage(
      customer.phone,
      documentUrl,
      packageBrochureUrl ? safeCampaignPdfName(pkg) : safeItineraryPdfName(itinerary, pkg),
      buildCampaignItineraryDescription(pkg),
      ctx
    );

    if (documentResult?.status === 'FAILED') {
      return showCampaignPackageDetail(session, campaignId, packageId, customer, agency, 'SEND_ITINERARY');
    }

    return whatsappService.sendButtonsMessage(
      customer.phone,
      `I sent the itinerary PDF for ${escapeMarkdown(pkg.name)}. Would you like to see other options?`,
      [{ id: 'menu_packages', title: 'See Other' }],
      ctx,
      { footerText: 'Tap See Other to browse more trip options.' }
    );
  }

  return showCampaignPackageDetail(session, campaignId, packageId, customer, agency, 'SEND_ITINERARY');
}

async function openCampaignAvailabilityFlow(session, campaign, packageId, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const pkg = await Package.findOne({ where: { id: packageId, agencyId: agency.id, isActive: true } });

  if (!pkg) {
    return whatsappService.sendTextMessage(customer.phone, 'This package is no longer available. Send Hi to browse latest packages.', ctx);
  }

  await trackCampaignClick(campaign.id, customer, agency, {
    clickedAction: 'CHECK_AVAILABILITY',
    selectedItemType: 'PACKAGE',
    selectedItemId: pkg.id,
  });

  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey: 'packages',
    packageId: pkg.id,
    itemType: 'PACKAGE',
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'CHECK_AVAILABILITY',
    destination: pkg.destinations?.[0] || null,
    status: 'ENQUIRY',
    notes: `Availability/readiness questionnaire opened from campaign: ${pkg.name}`,
  });
  await attachLeadToRecipient(campaign.id, customer, lead, {
    selectedItemType: 'PACKAGE',
    selectedItemId: pkg.id,
  });

  await updateSession(session, {
    currentStep: 'COMPLETE',
    collectedData: {
      activeLeadId: lead.id,
      selectedPackageId: pkg.id,
      selectedPackageIds: Array.from(new Set([...(session.collectedData?.selectedPackageIds || []), pkg.id].filter(Boolean))),
      selectedPackageName: pkg.name,
      packageResults: Array.from(new Set([...(session.collectedData?.packageResults || []), pkg.id].filter(Boolean))),
      campaignId: campaign.id,
      campaignName: campaign.name,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  const readinessFlow = await getTravelReadinessFlowConfig(agency);
  if (!readinessFlow?.flowId) {
    console.error('[CampaignAction] travel_readiness_flow_missing', {
      agencyId: agency.id,
      flowName: TRAVEL_READINESS_FLOW_NAME,
    });
    return showCampaignPackageDetail(session, campaign.id, pkg.id, customer, agency, 'CHECK_AVAILABILITY');
  }

  return whatsappService.sendFlowMessage(
    customer.phone,
    `Check availability for ${escapeMarkdown(pkg.name)} below.`,
    {
      flowId: readinessFlow.flowId,
      firstScreenId: readinessFlow.firstScreenId,
      flowCta: 'Check Availability',
      flowToken: `campaign-readiness|${agency.id}|${campaign.id}|${pkg.id}|${customer.id}|${Date.now()}`,
      data: {
        package_id: pkg.id,
        package_name: escapeMarkdown(pkg.name),
        package_summary: packageSummaryLine(pkg, ' / ').slice(0, 80),
        campaign_id: campaign.id,
        campaign_name: escapeMarkdown(campaign.name).slice(0, 60),
        customer_name: String(customer.name || '').trim(),
      },
    },
    ctx,
    {
      headerText: 'Travel Readiness',
      footerText: 'Submit the form and our team will confirm availability.',
    }
  );
}

async function resolveCampaignActionPackage(campaign, actionEntry, agency) {
  if (actionEntry?.itemId && String(actionEntry.itemType || '').toUpperCase() === 'PACKAGE') {
    const pkg = await Package.findOne({ where: { id: actionEntry.itemId, agencyId: agency.id, isActive: true } });
    if (pkg) return { package: pkg, section: null, candidates: [pkg] };
  }

  const groups = await resolveAllCampaignItems(campaign, agency);
  const packageGroup = groups.find(({ section }) => String(section?.itemType || '').toUpperCase() === 'PACKAGE');
  const candidates = packageGroup?.items || [];
  return {
    package: candidates.length === 1 ? candidates[0] : null,
    section: packageGroup?.section || null,
    candidates,
  };
}

async function routeTalkToAgentForCampaignPackage(session, campaign, actionEntry, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const resolved = await resolveCampaignActionPackage(campaign, actionEntry, agency);

  if (!resolved.package && resolved.candidates.length > 1 && resolved.section) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'Please choose the package you want to discuss, then tap Enquiry or Call Now.',
      ctx
    );
    await showCampaignItems(session, campaign, resolved.section, resolved.candidates, customer, agency);
    return true;
  }

  const pkg = resolved.package;
  const lead = await ensureLead(session, customer, agency, {
    routingIntentKey: 'packages',
    packageId: pkg?.id || null,
    itemType: pkg ? 'PACKAGE' : null,
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'TALK_TO_AGENT',
    destination: pkg?.destinations?.[0] || null,
    status: 'ENQUIRY',
    notes: `Talk-to-agent clicked from campaign${pkg ? ` for package: ${pkg.name}` : ''}`,
  });

  await trackCampaignClick(campaign.id, customer, agency, {
    clickedAction: 'TALK_TO_AGENT',
    selectedItemType: pkg ? 'PACKAGE' : null,
    selectedItemId: pkg?.id || null,
  });
  await attachLeadToRecipient(campaign.id, customer, lead, {
    selectedItemType: pkg ? 'PACKAGE' : null,
    selectedItemId: pkg?.id || null,
  });

  const assignedAgent = lead?.assignedAgentId
    ? await Agent.findOne({ where: { id: lead.assignedAgentId, agencyId: agency.id } })
    : null;
  const routedPhone = assignedAgent?.phone || agency.phone || agency.whatsappNumber;
  const routedName = assignedAgent?.name || agency.name || 'our travel expert';
  const chatLink = buildWhatsAppChatLink(
    routedPhone,
    buildSpecialistPrefill({ customer, pkg, campaign, lead })
  );

  await updateSession(session, {
    currentStep: 'COMPLETE',
    collectedData: {
      activeLeadId: lead?.id || null,
      selectedPackageId: pkg?.id || session.collectedData?.selectedPackageId || null,
      selectedPackageIds: pkg
        ? Array.from(new Set([...(session.collectedData?.selectedPackageIds || []), pkg.id].filter(Boolean)))
        : session.collectedData?.selectedPackageIds || [],
      selectedPackageName: pkg?.name || session.collectedData?.selectedPackageName || null,
      campaignId: campaign.id,
      campaignName: campaign.name,
    },
  });

  if (routedPhone && chatLink) {
    await whatsappService.sendUrlButtonMessage(
      customer.phone,
      `Message or call ${escapeMarkdown(routedName)} for ${pkg ? escapeMarkdown(pkg.name) : 'this campaign'}: ${routedPhone}`,
      'Chat on WhatsApp',
      chatLink,
      ctx
    );
  } else {
    await whatsappService.sendTextMessage(
      customer.phone,
      routedPhone
        ? `Message or call ${escapeMarkdown(routedName)} for ${pkg ? escapeMarkdown(pkg.name) : 'this campaign'}: ${routedPhone}`
        : 'Our travel expert will contact you shortly.',
      ctx
    );
  }

  if (assignedAgent?.phone && lead?.id) {
    await sendAgentTalkToAgentIntent(assignedAgent.phone, agency.id, {
      customerName: customer.name,
      phone: customer.phone,
      packageName: pkg?.name,
    }, ctx).catch((err) => {
      console.warn('[CampaignAction] Could not notify routed package agent:', err.message);
    });
  }

  return true;
}

async function showConfiguredActionItems(session, campaign, actionEntry, itemType, customer, agency) {
  const groups = await resolveAllCampaignItems(campaign, agency);
  const matchingGroups = groups.filter(({ section }) => String(section?.itemType || '').toUpperCase() === itemType);
  const preferredGroup = matchingGroups[0] || groups[0];
  if (!preferredGroup) return false;

  if (actionEntry.action === 'VIEW_DETAILS' && preferredGroup.items.length === 1) {
    const item = preferredGroup.items[0];
    if (itemType === 'PROPERTY') {
      await showCampaignPropertyDetail(session, campaign.id, item.id, customer, agency, 'VIEW_DETAILS');
      return true;
    }
    await showCampaignPackageDetail(session, campaign.id, item.id, customer, agency, 'VIEW_DETAILS');
    return true;
  }

  await showCampaignItems(session, campaign, preferredGroup.section, preferredGroup.items, customer, agency);
  return true;
}

async function getConfiguredFlowById(agency, flowId) {
  if (!agency?.id || !flowId) return null;
  return WhatsAppFlow.findOne({
    where: {
      id: flowId,
      agencyId: agency.id,
      status: 'PUBLISHED',
      metaFlowId: { [Op.ne]: null },
    },
  });
}

// Industry-agnostic: open whichever published WhatsApp flow the agency bound to
// this campaign button. Works for any vertical (travel, resort, ayurveda, …) —
// the behaviour is whatever flow the agency built, not a hardcoded travel flow.
// Launch the agency's bot conversational flow graph (whatsappFlowConfig.flows[]),
// seeding {campaign_keyword} so MESSAGE/CONDITION nodes can render/branch on the
// keyword tied to the tapped carousel image or CTA button.
async function openCampaignConfiguredGraphFlow(session, campaign, actionEntry, customer, agency) {
  const buttonLabel = String(actionEntry.buttonText || 'Continue').trim();
  const keyword = String(actionEntry.keyword || '').trim();
  const targetFlowId = actionEntry.flowId || null;

  const lead = await ensureLead(session, customer, agency, {
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'OPEN_FLOW',
    interest: keyword ? `Campaign: ${campaign.name} — ${keyword}` : `Campaign: ${campaign.name}`,
    status: 'ENQUIRY',
    preserveExistingStatus: true,
    notes: `Opened flow from campaign: ${campaign.name} (button: ${buttonLabel}${keyword ? `, keyword: ${keyword}` : ''})`,
    ...(keyword ? { customTripDetails: { campaignKeyword: keyword } } : {}),
  });

  await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'OPEN_FLOW' });
  await attachLeadToRecipient(campaign.id, customer, lead, {});

  // The tapped catalog item (carousel card / CTA target) becomes the flow's
  // selected item, so a SEND_ITEM_DOCUMENT node sends that record's PDF.
  const seedItemId = actionEntry.selectedItemId || actionEntry.itemId || null;
  const seedItemType = String(actionEntry.itemType || '').toUpperCase() || (seedItemId ? 'PACKAGE' : null);

  return startFlowGraph(session, customer, agency, targetFlowId, {
    seedFields: {
      campaign_keyword: keyword,
      campaign_name: String(campaign.name || '').trim(),
      customer_name: String(customer.name || '').trim(),
    },
    ...(seedItemId ? { seedSelectedItem: { itemType: seedItemType, itemId: seedItemId } } : {}),
    // Multi-entry campaign flow: start at this button's own node when set.
    ...(actionEntry.entryNodeId ? { startNodeId: actionEntry.entryNodeId } : {}),
  });
}

async function openCampaignConfiguredFlow(session, campaign, actionEntry, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };

  // GRAPH = bot conversational flow graph; META (default) = published Meta form flow.
  if (String(actionEntry.flowKind || '').toUpperCase() === 'GRAPH') {
    return openCampaignConfiguredGraphFlow(session, campaign, actionEntry, customer, agency);
  }

  const flow = await getConfiguredFlowById(agency, actionEntry.flowId);
  const buttonLabel = String(actionEntry.buttonText || 'Continue').trim();
  const keyword = String(actionEntry.keyword || '').trim();

  if (!flow?.metaFlowId) {
    await whatsappService.sendTextMessage(
      customer.phone,
      'This option is being set up. Our team will reach out to you shortly.',
      ctx
    );
    return true;
  }

  const lead = await ensureLead(session, customer, agency, {
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'OPEN_FLOW',
    interest: `Campaign: ${campaign.name}`,
    status: 'ENQUIRY',
    preserveExistingStatus: true,
    notes: `Opened flow "${flow.name}" from campaign: ${campaign.name} (button: ${buttonLabel}${keyword ? `, keyword: ${keyword}` : ''})`,
    ...(keyword ? { customTripDetails: { campaignKeyword: keyword } } : {}),
  });

  await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'OPEN_FLOW' });

  await updateSession(session, {
    currentStep: 'COMPLETE',
    collectedData: {
      activeLeadId: lead?.id || null,
      campaignId: campaign.id,
      campaignName: campaign.name,
      enquiryDraft: customer.name ? { name: customer.name } : {},
    },
  });

  const flowResponse = await whatsappService.sendFlowMessage(
    customer.phone,
    buttonLabel,
    {
      flowId: flow.metaFlowId,
      firstScreenId: flow.firstScreenId || undefined,
      flowCta: buttonLabel.slice(0, 30),
      flowToken: `campaign-flow|${agency.id}|${campaign.id}|${flow.id}|${customer.id}|${Date.now()}`,
      data: {
        campaign_name: escapeMarkdown(campaign.name).slice(0, 60),
        customer_name: String(customer.name || '').trim(),
        ...(keyword ? { campaign_keyword: keyword.slice(0, 60) } : {}),
      },
    },
    ctx,
    {
      headerText: buttonLabel.slice(0, 60),
      footerText: 'Reply LIST if the flow does not open.',
    }
  );

  await attachLeadToRecipient(campaign.id, customer, lead, { flowSubmittedAt: new Date() });

  if (flowResponse?.status === 'FAILED') {
    await whatsappService.sendTextMessage(
      customer.phone,
      'Thanks for your interest. Our team will contact you shortly to continue.',
      ctx
    );
  }
  return true;
}

async function openCampaignConfiguredUrl(session, campaign, actionEntry, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const url = String(actionEntry.url || '').trim();
  const buttonLabel = String(actionEntry.buttonText || 'Open Link').trim();

  if (!/^https?:\/\//i.test(url)) {
    await whatsappService.sendTextMessage(customer.phone, 'This link is being set up. Please try again shortly.', ctx);
    return true;
  }

  await ensureLead(session, customer, agency, {
    source: 'whatsapp_campaign',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignAction: 'OPEN_URL',
    interest: `Campaign: ${campaign.name}`,
    preserveExistingStatus: true,
    notes: `Opened link from campaign: ${campaign.name} (button: ${buttonLabel})`,
  });
  await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'OPEN_URL' });

  await whatsappService.sendUrlButtonMessage(
    customer.phone,
    buttonLabel,
    (buttonLabel.slice(0, 20) || 'Open'),
    url,
    ctx
  );
  return true;
}

async function handleConfiguredCampaignButtonAction(session, campaign, actionEntry, customer, agency) {
  if (!actionEntry?.action) return false;

  const action = String(actionEntry.action || '').toUpperCase();
  const itemType = String(actionEntry.itemType || '').toUpperCase();
  const itemId = actionEntry.itemId || null;
  const ctx = { customerId: customer.id, agencyId: agency.id };

  if (action === 'OPEN_FLOW') {
    return openCampaignConfiguredFlow(session, campaign, actionEntry, customer, agency);
  }

  if (action === 'OPEN_URL') {
    return openCampaignConfiguredUrl(session, campaign, actionEntry, customer, agency);
  }

  if (action === 'TALK_TO_AGENT') {
    return routeTalkToAgentForCampaignPackage(session, campaign, actionEntry, customer, agency);
  }

  if (action === 'CUSTOM_TRIP') {
    await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'CUSTOM_TRIP', selectedItemType: 'CUSTOM_TRIP' });
    await startCustomTripLead(session, campaign, customer, agency);
    return true;
  }

  if (action === 'VIEW_DETAILS' && itemId && itemType === 'PROPERTY') {
    await showCampaignPropertyDetail(session, campaign.id, itemId, customer, agency, 'VIEW_DETAILS');
    return true;
  }

  if (action === 'VIEW_DETAILS' && itemId && itemType === 'PACKAGE') {
    await showCampaignPackageDetail(session, campaign.id, itemId, customer, agency, 'VIEW_DETAILS');
    return true;
  }

  if (action === 'SEND_ITINERARY' && itemId && itemType === 'PACKAGE') {
    await sendCampaignPackageItinerary(session, campaign.id, itemId, customer, agency);
    return true;
  }

  if (action === 'CHECK_AVAILABILITY' && itemId && itemType === 'PACKAGE') {
    await openCampaignAvailabilityFlow(session, campaign, itemId, customer, agency);
    return true;
  }

  if (action === 'VIEW_PACKAGES') {
    return showConfiguredActionItems(session, campaign, actionEntry, 'PACKAGE', customer, agency);
  }

  if (action === 'VIEW_PROPERTIES') {
    return showConfiguredActionItems(session, campaign, actionEntry, 'PROPERTY', customer, agency);
  }

  if (action === 'VIEW_DETAILS') {
    const preferredType = itemType === 'PROPERTY' ? 'PROPERTY' : itemType === 'PACKAGE' ? 'PACKAGE' : 'PACKAGE';
    return showConfiguredActionItems(session, campaign, actionEntry, preferredType, customer, agency);
  }

  if (action === 'SEND_ITINERARY') {
    const groups = await resolveAllCampaignItems(campaign, agency);
    const packageGroup = groups.find(({ section }) => String(section?.itemType || '').toUpperCase() === 'PACKAGE');
    if (!packageGroup?.items?.length) return false;
    if (packageGroup.items.length === 1) {
      await sendCampaignPackageItinerary(session, campaign.id, packageGroup.items[0].id, customer, agency);
      return true;
    }
    await showCampaignItems(session, campaign, packageGroup.section, packageGroup.items, customer, agency);
    return true;
  }

  if (action === 'CHECK_AVAILABILITY') {
    const groups = await resolveAllCampaignItems(campaign, agency);
    const packageGroup = groups.find(({ section }) => String(section?.itemType || '').toUpperCase() === 'PACKAGE');
    if (!packageGroup?.items?.length) return false;
    if (packageGroup.items.length === 1) {
      await openCampaignAvailabilityFlow(session, campaign, packageGroup.items[0].id, customer, agency);
      return true;
    }
    await showCampaignItems(session, campaign, packageGroup.section, packageGroup.items, customer, agency);
    return true;
  }

  return false;
}

async function handleCampaignAction(session, actionId, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const parts = parseAction(actionId);
  const autoCampaignId = actionId.startsWith('campaign_pkg_pick:')
    ? session.collectedData?.campaignId || null
    : parts[1] || null;
  const autoPackageId = actionId.startsWith('campaign_pkg_pick:')
    ? parts[1]
    : (actionId.startsWith('campaign_item_pick:') || actionId.startsWith('campaign_carousel_enquire:'))
      && parts[2] === 'PACKAGE'
      ? parts[3]
      : null;
  if (autoCampaignId) {
    await autoAssignStayrouteCampaignInteraction(session, autoCampaignId, customer, agency, actionId, {
      packageId: autoPackageId,
      selectedItemType: parts[2] || null,
      selectedItemId: parts[3] || null,
    });
  }

  if (actionId.startsWith('campaign_call_now:')) {
    const campaignId = parts[1];
    await trackCampaignClick(campaignId, customer, agency, { clickedAction: 'CALL_NOW' });
    const phone = agency.phone || agency.whatsappNumber;
    return whatsappService.sendTextMessage(customer.phone, `Call us anytime: ${phone}`, ctx);
  }

  if (actionId.startsWith('campaign_view_packages:')) {
    const campaignId = parts[1];
    return showCampaignOverview(session, campaignId, customer, agency);
  }

  if (actionId.startsWith('campaign_pkg_pick:')) {
    const packageId = parts[1];
    const campaignId = session.collectedData?.campaignId || null;
    return showCampaignPackageDetail(session, campaignId, packageId, customer, agency, 'PACKAGE_SELECTED');
  }

  if (actionId.startsWith('campaign_section:')) {
    const [, campaignId, sectionKey] = parts;
    return showCampaignSection(session, campaignId, sectionKey, customer, agency);
  }

  if (actionId.startsWith('campaign_custom_trip:')) {
    const campaignId = parts[1];
    const campaign = await getCampaign(campaignId, agency);
    if (!campaign) return whatsappService.sendTextMessage(customer.phone, 'This campaign is no longer available.', ctx);
    await trackCampaignClick(campaignId, customer, agency, { clickedAction: 'CUSTOM_TRIP', selectedItemType: 'CUSTOM_TRIP' });
    return startCustomTripLead(session, campaign, customer, agency);
  }

  if (actionId.startsWith('campaign_item_pick:')) {
    const [, campaignId, itemType, itemId] = parts;
    if (itemType === 'PROPERTY') return showCampaignPropertyDetail(session, campaignId, itemId, customer, agency, 'ITEM_SELECTED');
    return showCampaignPackageDetail(session, campaignId, itemId, customer, agency, 'ITEM_SELECTED');
  }

  if (actionId.startsWith('campaign_carousel_enquire:')) {
    const [, campaignId, itemType, itemId] = parts;
    if (itemType === 'PROPERTY') return showCampaignPropertyDetail(session, campaignId, itemId, customer, agency, 'CAROUSEL_DETAILS');
    const campaign = await getCampaign(campaignId, agency);
    await trackCampaignClick(campaignId, customer, agency, {
      clickedAction: 'CAROUSEL_ENQUIRY',
      selectedItemType: 'PACKAGE',
      selectedItemId: itemId,
    });
    const lead = await quickPackageEnquiry(session, customer, agency, itemId, {
      source: 'whatsapp_campaign',
      campaignId,
      campaignName: campaign?.name || null,
      campaignAction: 'CAROUSEL_ENQUIRY',
      notes: 'Customer tapped Enquiry on campaign package card',
    });
    if (campaignId && customer?.id && itemId) {
      const activeLeadId = session.collectedData?.activeLeadId || null;
      if (activeLeadId) {
        await CampaignRecipient.update(
          {
            leadId: activeLeadId,
            selectedItemType: 'PACKAGE',
            selectedItemId: itemId,
            clickedAt: new Date(),
            clickedAction: 'CAROUSEL_ENQUIRY',
          },
          { where: { campaignId, customerId: customer.id } }
        );
      }
    }
    return lead;
  }

  if (actionId.startsWith('campaign_carousel_others:')) {
    const campaignId = parts[1];
    const itemType = parts[2];
    if (itemType) {
      return showCampaignCarouselOthers(session, campaignId, itemType, customer, agency);
    }
    return showCampaignOverview(session, campaignId, customer, agency);
  }

  if (actionId.startsWith('campaign_property_enquire:')) {
    const [, campaignId, propertyId] = parts;
    return startPropertyLead(session, campaignId, propertyId, customer, agency);
  }

  // A tap on a per-card button the agency configured in the carousel builder.
  // Payload: campaign_card_btn:{campaignId}:{itemId}:{buttonKey}
  if (actionId.startsWith('campaign_card_btn:')) {
    const [, campaignId, itemId, buttonKey] = parts;
    const campaign = await getCampaign(campaignId, agency);
    if (!campaign) return whatsappService.sendTextMessage(customer.phone, 'This campaign is no longer available.', ctx);
    const cards = Array.isArray(campaign.carouselConfig?.cards) ? campaign.carouselConfig.cards : [];
    const card = cards.find((entry) => String(entry?.itemId || entry?.id || '') === String(itemId));
    const button = Array.isArray(card?.buttons)
      ? card.buttons.find((entry) => String(entry?.buttonKey || '') === String(buttonKey))
      : null;
    if (!button?.action) {
      return whatsappService.sendTextMessage(customer.phone, 'This option is no longer available.', ctx);
    }
    // UPLOAD-mode cards have no catalog item behind them — only seed a selected item
    // for catalog cards, so SEND_ITEM_DOCUMENT etc. don't chase a non-existent record.
    const isUploadCarousel = String(campaign.carouselConfig?.mode || 'CATALOG').toUpperCase() === 'UPLOAD';
    // Card-level keyword wins, falling back to a button-specific keyword.
    const actionEntry = {
      ...button,
      keyword: card?.keyword || button.keyword || null,
      ...(isUploadCarousel ? {} : { selectedItemId: itemId, itemType: card?.itemType || button.itemType || 'PACKAGE' }),
    };
    return handleConfiguredCampaignButtonAction(session, campaign, actionEntry, customer, agency);
  }
}

async function tryHandleCampaignTextAction(session, text, customer, agency) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const recipient = await getLatestCampaignRecipient(customer, agency);
  const campaign = recipient?.campaign;
  if (!campaign) return false;

  const sections = getSections(campaign);
  const configuredButtonAction = getCampaignButtonAction(campaign, text);
  if (configuredButtonAction) {
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, configuredButtonAction.buttonText || text);
    const handled = await handleConfiguredCampaignButtonAction(session, campaign, configuredButtonAction, customer, agency);
    if (handled) return true;
  }

  const buttonRoute = getTemplateButtonRoute(campaign, text, sections);
  if (buttonRoute) {
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text);
    const handled = await handleConfiguredCampaignButtonAction(session, campaign, {
      action: buttonRoute,
      buttonText: text,
    }, customer, agency);
    if (handled) return true;
  }

  const wantsPackages = textIncludesAny(normalized, ['view packages', 'packages', 'show packages', 'see others']);
  const wantsProperties = textIncludesAny(normalized, ['view properties', 'properties', 'show properties']);
  const wantsEnquiry = textIncludesAny(normalized, ['enquiry', 'enquire', 'enquire now']);

  if (wantsEnquiry) {
    const selectedPackageId = session.collectedData?.selectedPackageId || null;
    if (selectedPackageId) {
      await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { packageId: selectedPackageId });
      await quickPackageEnquiry(session, customer, agency, selectedPackageId, {
        source: 'whatsapp_campaign',
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignAction: 'ENQUIRY_CLICKED',
        notes: 'Customer tapped Enquiry from campaign package detail',
      });
      return true;
    }

    const resolved = await resolveCampaignActionPackage(campaign, {}, agency);
    if (resolved.package) {
      await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { packageId: resolved.package.id });
      await quickPackageEnquiry(session, customer, agency, resolved.package.id, {
        source: 'whatsapp_campaign',
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignAction: 'ENQUIRY_CLICKED',
        notes: 'Customer tapped Enquiry from campaign',
      });
      return true;
    }

    if (resolved.candidates.length > 1 && resolved.section) {
      await whatsappService.sendTextMessage(
        customer.phone,
        'Please choose the package you want to enquire about.',
        { customerId: customer.id, agencyId: agency.id }
      );
      await showCampaignItems(session, campaign, resolved.section, resolved.candidates, customer, agency);
      return true;
    }
  }

  if (buttonRoute === 'CUSTOM_TRIP') {
    const customTripSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'CUSTOM_TRIP');
    if (!customTripSection && sections.length) return false;
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: 'CUSTOM_TRIP' });
    await trackCampaignClick(campaign.id, customer, agency, { clickedAction: 'CUSTOM_TRIP', selectedItemType: 'CUSTOM_TRIP' });
    await startCustomTripLead(session, campaign, customer, agency);
    return true;
  }

  if (!sections.length) {
    if (wantsPackages || wantsProperties || buttonRoute === 'VIEW_PACKAGES' || buttonRoute === 'VIEW_PROPERTIES') {
      const groups = await resolveAllCampaignItems(campaign, agency);
      const desiredType = wantsProperties || buttonRoute === 'VIEW_PROPERTIES' ? 'PROPERTY' : 'PACKAGE';
      const matchingGroup = groups.find(({ section }) => String(section?.itemType || '').toUpperCase() === desiredType)
        || groups[0];
      if (!matchingGroup) return false;

      await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: desiredType });
      await showCampaignSection(session, campaign.id, matchingGroup.section.key, customer, agency);
      return true;
    }

    return false;
  }

  if (wantsPackages || buttonRoute === 'VIEW_PACKAGES') {
    const packageSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PACKAGE')
      || sections[0];
    if (!packageSection) return false;
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: 'PACKAGE' });
    await showCampaignSection(session, campaign.id, packageSection.key, customer, agency);
    return true;
  }

  if (wantsProperties || buttonRoute === 'VIEW_PROPERTIES') {
    const propertySection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PROPERTY');
    if (!propertySection) return false;
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: 'PROPERTY' });
    await showCampaignSection(session, campaign.id, propertySection.key, customer, agency);
    return true;
  }

  if (textIncludesAny(normalized, ['custom trip', 'plan trip', 'customize trip'])) {
    const customTripSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'CUSTOM_TRIP');
    if (!customTripSection) return false;
    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: 'CUSTOM_TRIP' });
    await startCustomTripLead(session, campaign, customer, agency);
    return true;
  }

  const matchingSection = sections.find((section) => {
    const sectionLabel = String(section.label || section.key || '').trim();
    if (!sectionLabel) return false;
    return textIncludesAny(normalized, [sectionLabel, section.key]);
  });

  if (matchingSection) {
    if (String(matchingSection.itemType || '').toUpperCase() === 'CUSTOM_TRIP') {
      await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: 'CUSTOM_TRIP' });
      await startCustomTripLead(session, campaign, customer, agency);
      return true;
    }

    await autoAssignStayrouteCampaignInteraction(session, campaign, customer, agency, text, { selectedItemType: String(matchingSection.itemType || '').toUpperCase() });
    await showCampaignSection(session, campaign.id, matchingSection.key, customer, agency);
    return true;
  }

  return false;
}

function formatItemRow(item, itemType) {
  if (itemType === 'PROPERTY') {
    return `${item.propertyType || 'Property'} - ${item.location || 'Location'} - ${item.pricePerNight ? `${money(item.pricePerNight)}/night` : 'Price on request'}`;
  }
  return packageSummaryLine(item);
}

function formatItemListText(items, itemType) {
  const lines = items.map((item, index) => {
    if (itemType === 'PROPERTY') {
      return `${index + 1}. *${escapeMarkdown(item.name)}*\n   ${formatItemRow(item, itemType)}`;
    }
    const destinations = item.destinations?.slice(0, 2).join(', ') || 'Multiple destinations';
    return `${index + 1}. *${escapeMarkdown(item.name)}*\n   ${[escapeMarkdown(item.duration || 'Custom'), destinations, packagePriceLabel(item.basePrice)].filter(Boolean).join(' - ')}`;
  });

  return [`*Campaign Deals*`, '', ...lines].join('\n');
}

function buildPackageHighlights(pkg) {
  const items = Array.isArray(pkg.inclusions) && pkg.inclusions.length
    ? pkg.inclusions.slice(0, 4)
    : Array.isArray(pkg.itinerary) && pkg.itinerary.length
      ? pkg.itinerary.slice(0, 4).map((day) => day.title || day.description).filter(Boolean)
      : Array.isArray(pkg.destinations) && pkg.destinations.length
        ? pkg.destinations.slice(0, 4)
        : ['Hotel stay', 'Sightseeing', 'Curated support'];

  return items.map((item) => `* ${packageDescriptionText(item)}`).join('\n');
}

module.exports = {
  isCampaignAction,
  handleCampaignAction,
  tryHandleCampaignTextAction,
  getLatestCampaignRecipient,
  showCampaignPackages: (session, campaignId, customer, agency) => showCampaignOverview(session, campaignId, customer, agency),
  showCampaignPropertyDetail,
  showCampaignPackageDetail,
};
