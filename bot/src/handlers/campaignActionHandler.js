// FILE: /bot/src/handlers/campaignActionHandler.js
// Handles campaign CTA, carousel, package, property, and custom-trip actions.

const path = require('path');
const { Op } = require('sequelize');
const {
  Campaign,
  CampaignRecipient,
  MessageTemplate,
  Package,
  Property,
  WhatsAppFlow,
} = require(path.resolve(__dirname, '../../../backend/src/models/index.ts'));
const whatsappService = require(path.resolve(__dirname, '../../../backend/src/services/whatsappService.ts'));
const { updateSession } = require('../utils/sessionManager');
const {
  ensureLead,
  getFlowBase64Image,
  buildFlowPackageOptions,
  buildFlowPropertyOptions,
  buildFlowPropertyLocationOptions,
  getAgencyTripFlowId,
  isMetaTripFlowConfigured,
  PROPERTY_FLOW_FIRST_SCREEN_ID,
  CUSTOM_TRIP_FLOW_FIRST_SCREEN_ID,
} = require('./travelFlowHandler');

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
];

function isCampaignAction(actionId = '') {
  return CAMPAIGN_PREFIXES.some((prefix) => String(actionId).startsWith(prefix));
}

function escapeMarkdown(text = '') {
  return String(text || '').replace(/\*/g, '').trim();
}

function money(amountPaise = 0) {
  return `INR ${Math.round(Number(amountPaise || 0) / 100).toLocaleString('en-IN')}`;
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
  if (['VIEW_PACKAGES', 'VIEW_PROPERTIES', 'CUSTOM_TRIP'].includes(route)) return route;

  return getRouteForSection(sections[matchingIndex]);
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
    `${money(pkg.basePrice)}/person`,
    `${escapeMarkdown(pkg.duration || 'Custom itinerary')}`,
    '',
    escapeMarkdown(pkg.summary || 'Curated holiday package with handpicked stays.').slice(0, 180),
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

async function handleCampaignAction(session, actionId, customer, agency) {
  const ctx = { customerId: customer.id, agencyId: agency.id };
  const parts = parseAction(actionId);

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
    return showCampaignPackageDetail(session, campaignId, itemId, customer, agency, 'CAROUSEL_ENQUIRY');
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
}

async function tryHandleCampaignTextAction(session, text, customer, agency) {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  const recipient = await getLatestCampaignRecipient(customer, agency);
  const campaign = recipient?.campaign;
  if (!campaign) return false;

  const sections = getSections(campaign);
  const buttonRoute = getTemplateButtonRoute(campaign, text, sections);
  const wantsPackages = textIncludesAny(normalized, ['view packages', 'packages', 'show packages', 'see others']);
  const wantsProperties = textIncludesAny(normalized, ['view properties', 'properties', 'show properties']);

  if (buttonRoute === 'CUSTOM_TRIP') {
    const customTripSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'CUSTOM_TRIP');
    if (!customTripSection && sections.length) return false;
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

      await showCampaignSection(session, campaign.id, matchingGroup.section.key, customer, agency);
      return true;
    }

    return false;
  }

  if (wantsPackages || buttonRoute === 'VIEW_PACKAGES') {
    const packageSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PACKAGE')
      || sections[0];
    if (!packageSection) return false;
    await showCampaignSection(session, campaign.id, packageSection.key, customer, agency);
    return true;
  }

  if (wantsProperties || buttonRoute === 'VIEW_PROPERTIES') {
    const propertySection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PROPERTY');
    if (!propertySection) return false;
    await showCampaignSection(session, campaign.id, propertySection.key, customer, agency);
    return true;
  }

  if (textIncludesAny(normalized, ['custom trip', 'plan trip', 'customize trip'])) {
    const customTripSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'CUSTOM_TRIP');
    if (!customTripSection) return false;
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
      await startCustomTripLead(session, campaign, customer, agency);
      return true;
    }

    await showCampaignSection(session, campaign.id, matchingSection.key, customer, agency);
    return true;
  }

  return false;
}

function formatItemRow(item, itemType) {
  if (itemType === 'PROPERTY') {
    return `${item.propertyType || 'Property'} - ${item.location || 'Location'} - ${item.pricePerNight ? `${money(item.pricePerNight)}/night` : 'Price on request'}`;
  }
  return `${money(item.basePrice)}/person - ${escapeMarkdown(item.duration || 'Custom itinerary')}`;
}

function formatItemListText(items, itemType) {
  const lines = items.map((item, index) => {
    if (itemType === 'PROPERTY') {
      return `${index + 1}. *${escapeMarkdown(item.name)}*\n   ${formatItemRow(item, itemType)}`;
    }
    const destinations = item.destinations?.slice(0, 2).join(', ') || 'Multiple destinations';
    return `${index + 1}. *${escapeMarkdown(item.name)}*\n   ${escapeMarkdown(item.duration || 'Custom')} - ${destinations} - ${money(item.basePrice)}`;
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

  return items.map((item) => `- ${escapeMarkdown(item)}`).join('\n');
}

module.exports = {
  isCampaignAction,
  handleCampaignAction,
  tryHandleCampaignTextAction,
  showCampaignPackages: (session, campaignId, customer, agency) => showCampaignOverview(session, campaignId, customer, agency),
  showCampaignPropertyDetail,
  showCampaignPackageDetail,
};
