// FILE: /backend/src/services/campaignService.ts

const { Op, fn, col, literal } = require('sequelize');
const { Campaign, CampaignRecipient, Customer, Lead, Booking, MessageTemplate, Package, Property } = require('../models');

const CAMPAIGN_FORMATS = new Set(['STANDARD', 'SECTION_CTA', 'ITEM_CAROUSEL']);
const ITEM_TYPES = new Set(['PACKAGE', 'PROPERTY', 'CUSTOM_TRIP']);
const CTA_BUTTON_ACTIONS = new Set([
  'VIEW_PACKAGES',
  'VIEW_PROPERTIES',
  'CUSTOM_TRIP',
  'VIEW_DETAILS',
  'SEND_ITINERARY',
  'CHECK_AVAILABILITY',
  'TALK_TO_AGENT',
  // Industry-agnostic actions: bind a template button to any of the agency's own
  // published WhatsApp flows, or to an external link. These carry their target in
  // `flowId` / `url` instead of a travel catalog item.
  'OPEN_FLOW',
  'OPEN_URL',
]);

// A campaign button that opens a flow can target either of the two flow engines:
//  - GRAPH: the agency's bot conversational flow graph (whatsappFlowConfig.flows[])
//           — supports Send-PDF, branching, catalog lists, sub-flows, etc.
//  - META : a published Meta native WhatsApp form flow (WhatsAppFlow.metaFlowId)
// Default is META for backward-compatibility with existing OPEN_FLOW bindings.
const FLOW_KINDS = new Set(['GRAPH', 'META']);

function normalizeFlowKind(value: string): string {
  const kind = String(value || '').toUpperCase();
  return FLOW_KINDS.has(kind) ? kind : 'META';
}

// Shared normalizer for a single button that may carry a flow/url binding plus an
// optional keyword passed into the launched flow as the {campaign_keyword} variable.
function normalizeFlowButton(value: any = {}, index = 0): any {
  const action = String(value.action || '').toUpperCase();
  const keyword = String(value.keyword || '').trim().slice(0, 60) || null;
  return {
    ...value,
    buttonKey: String(value.buttonKey || `btn_${index + 1}`),
    buttonText: String(value.buttonText || value.text || '').trim(),
    buttonIndex: Number.isFinite(Number(value.buttonIndex)) ? Number(value.buttonIndex) : index,
    action: CTA_BUTTON_ACTIONS.has(action) ? action : null,
    flowKind: action === 'OPEN_FLOW' ? normalizeFlowKind(value.flowKind) : null,
    flowId: action === 'OPEN_FLOW' ? (value.flowId || null) : null,
    // The node the flow graph should start at for this button (multi-entry campaign
    // flow: each template button enters the shared graph at its own starter node).
    entryNodeId: action === 'OPEN_FLOW' ? (value.entryNodeId || null) : null,
    url: action === 'OPEN_URL' ? String(value.url || '').trim() || null : null,
    keyword,
  };
}

const RECIPIENT_REPORT_STATUSES = ['SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED'];
const RECIPIENT_LIFECYCLE_STATUS_MAP = {
  SENT: ['SENT', 'DELIVERED', 'READ', 'REPLIED'],
  DELIVERED: ['DELIVERED', 'READ', 'REPLIED'],
  READ: ['READ', 'REPLIED'],
  REPLIED: ['REPLIED'],
  FAILED: ['FAILED'],
};

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeCampaignSections(data = {}) {
  const explicitSections = normalizeArray(data.campaignSections);
  if (explicitSections.length > 0) {
    return explicitSections
      .map((section, index) => ({
        key: String(section.key || `section_${index + 1}`).trim(),
        label: String(section.label || section.key || `Section ${index + 1}`).trim(),
        itemType: ITEM_TYPES.has(String(section.itemType || '').toUpperCase())
          ? String(section.itemType).toUpperCase()
          : 'PACKAGE',
        filter: section.filter && typeof section.filter === 'object' ? section.filter : {},
        selectedItemIds: normalizeArray(section.selectedItemIds),
        selectionMode: String(section.selectionMode || (normalizeArray(section.selectedItemIds).length ? 'MANUAL' : 'AUTO')).toUpperCase(),
        enabled: section.enabled !== false,
        sortOrder: Number.isFinite(Number(section.sortOrder)) ? Number(section.sortOrder) : index + 1,
      }))
      .filter((section) => section.key && section.enabled);
  }

  const linkedPackageIds = normalizeArray(data.linkedPackageIds);
  if (linkedPackageIds.length > 0) {
    return [{
      key: 'packages',
      label: 'View Packages',
      itemType: 'PACKAGE',
      filter: {},
      selectedItemIds: linkedPackageIds,
      selectionMode: 'MANUAL',
      enabled: true,
      sortOrder: 1,
    }];
  }

  return [];
}

function normalizeCarouselConfig(data = {}) {
  const config = data.carouselConfig && typeof data.carouselConfig === 'object' ? data.carouselConfig : {};
  // CATALOG = cards derived from selected packages/properties (default).
  // UPLOAD  = free-form cards the agency built by uploading their own media, with
  //           no catalog item behind them (for agencies without a package catalog).
  const mode = String(config.mode || 'CATALOG').toUpperCase() === 'UPLOAD' ? 'UPLOAD' : 'CATALOG';
  const rawItems = normalizeArray(config.items || data.carouselItems);
  // Each carousel card may carry an optional `keyword` (passed into a launched flow
  // as {campaign_keyword}) and its own buttons that can open a flow / url per image.
  // UPLOAD cards additionally carry their own mediaUrl/title/body and a stable id.
  const cards = normalizeArray(config.cards || data.carouselCards).map((card: any, index: number) => ({
    ...card,
    id: card?.id || card?.itemId || `card_${index + 1}`,
    mediaUrl: String(card?.mediaUrl || '').trim() || null,
    mediaType: String(card?.mediaType || '').toUpperCase() === 'VIDEO' ? 'VIDEO' : (card?.mediaUrl ? 'IMAGE' : null),
    title: String(card?.title || '').trim().slice(0, 120) || null,
    body: String(card?.body || '').trim().slice(0, 1024) || null,
    keyword: String(card?.keyword || '').trim().slice(0, 60) || null,
    buttons: normalizeArray(card?.buttons).map((btn: any, i: number) => normalizeFlowButton(btn, i)),
  }));
  const mediaMode = ['IMAGE', 'VIDEO', 'MIXED'].includes(String(config.mediaMode || data.mediaType || 'IMAGE').toUpperCase())
    ? String(config.mediaMode || data.mediaType || 'IMAGE').toUpperCase()
    : 'IMAGE';

  return {
    mode,
    contentType: String(config.contentType || 'MIXED').toUpperCase(),
    mediaMode,
    flowGraphId: config.flowGraphId || null,
    items: rawItems.map((item) => ({
      itemType: ITEM_TYPES.has(String(item.itemType || '').toUpperCase()) ? String(item.itemType).toUpperCase() : 'PACKAGE',
      itemId: item.itemId || item.id,
    })).filter((item) => item.itemId && item.itemType !== 'CUSTOM_TRIP'),
    cards,
  };
}

function normalizeCtaConfig(data = {}) {
  const source = data.ctaConfig && typeof data.ctaConfig === 'object' ? data.ctaConfig : {};
  const featuredItemType = ITEM_TYPES.has(String(source.featuredItemType || '').toUpperCase())
    ? String(source.featuredItemType).toUpperCase()
    : null;
  const buttonActions = source.buttonActions && typeof source.buttonActions === 'object' && !Array.isArray(source.buttonActions)
    ? Object.entries(source.buttonActions).reduce((acc, [key, value = {}]) => {
      const action = String(value.action || '').toUpperCase();
      if (!CTA_BUTTON_ACTIONS.has(action)) return acc;
      const itemType = ITEM_TYPES.has(String(value.itemType || '').toUpperCase())
        ? String(value.itemType).toUpperCase()
        : null;
      acc[String(key)] = {
        ...value,
        buttonKey: String(value.buttonKey || key),
        buttonText: String(value.buttonText || '').trim(),
        buttonIndex: Number.isFinite(Number(value.buttonIndex)) ? Number(value.buttonIndex) : null,
        action,
        itemType,
        itemId: value.itemId || null,
        // Targets for the industry-agnostic actions.
        flowKind: action === 'OPEN_FLOW' ? normalizeFlowKind(value.flowKind) : null,
        flowId: action === 'OPEN_FLOW' ? (value.flowId || null) : null,
        entryNodeId: action === 'OPEN_FLOW' ? (value.entryNodeId || null) : null,
        url: action === 'OPEN_URL' ? String(value.url || '').trim() || null : null,
        keyword: String(value.keyword || '').trim().slice(0, 60) || null,
      };
      return acc;
    }, {})
    : {};

  // Named template variable values filled at campaign time (keyed by variable name).
  const variableValues = source.variableValues && typeof source.variableValues === 'object' && !Array.isArray(source.variableValues)
    ? Object.entries(source.variableValues).reduce((acc, [key, value]) => {
      const name = String(key || '').trim().toLowerCase();
      if (name) acc[name] = String(value ?? '');
      return acc;
    }, {})
    : {};

  return {
    ...source,
    featuredItemType,
    featuredItemId: source.featuredItemId || null,
    buttonActions,
    variableValues,
  };
}

function validateCampaignPayload(payload = {}) {
  const format = String(payload.format || 'STANDARD').toUpperCase();

  if (String(payload.type || '').toUpperCase() === 'REVIEW_COLLECTION') {
    return payload;
  }

  if (format === 'SECTION_CTA') {
    const sections = normalizeArray(payload.campaignSections).filter((section) => section.enabled !== false);
    const buttonActions = Object.values(payload.ctaConfig?.buttonActions || {});
    const hasButtonActions = buttonActions.length > 0;
    const sectionCanResolveItems = (section) => {
      if (!section) return false;
      const selectedIds = normalizeArray(section.selectedItemIds);
      if (selectedIds.length > 0) return true;
      return String(section.selectionMode || '').toUpperCase() !== 'MANUAL';
    };

    if (hasButtonActions) {
      const packageSection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PACKAGE');
      const propertySection = sections.find((section) => String(section.itemType || '').toUpperCase() === 'PROPERTY');

      const missingAction = buttonActions.find((entry) => !CTA_BUTTON_ACTIONS.has(String(entry.action || '').toUpperCase()));
      if (missingAction) {
        throw new Error(`${missingAction.buttonText || 'CTA button'} needs a valid action`);
      }

      const missingSelection = buttonActions.find((entry) => {
        const action = String(entry.action || '').toUpperCase();
        const itemType = String(entry.itemType || '').toUpperCase();
        if (action === 'VIEW_PACKAGES') return !sectionCanResolveItems(packageSection);
        if (action === 'VIEW_PROPERTIES') return !sectionCanResolveItems(propertySection);
        if (action === 'VIEW_DETAILS') return !entry.itemId && !sectionCanResolveItems(packageSection) && !sectionCanResolveItems(propertySection);
        if (action === 'SEND_ITINERARY') return !(itemType === 'PACKAGE' && entry.itemId) && !sectionCanResolveItems(packageSection);
        if (action === 'CHECK_AVAILABILITY') return !(itemType === 'PACKAGE' && entry.itemId) && !sectionCanResolveItems(packageSection);
        if (action === 'OPEN_FLOW') return !entry.flowId;
        if (action === 'OPEN_URL') return !/^https?:\/\//i.test(String(entry.url || '').trim());
        return false;
      });

      if (missingSelection) {
        const label = missingSelection.buttonText || 'CTA button';
        const action = String(missingSelection.action || '').toUpperCase();
        if (action === 'OPEN_FLOW') throw new Error(`${label} needs a WhatsApp flow selected`);
        if (action === 'OPEN_URL') throw new Error(`${label} needs a valid https link`);
        throw new Error(`${label} needs selected campaign items`);
      }
    } else {
      const catalogSections = sections.filter((section) => ['PACKAGE', 'PROPERTY'].includes(String(section.itemType || '').toUpperCase()));
      const missingSelection = catalogSections.find((section) => !sectionCanResolveItems(section));
      if (missingSelection) {
        throw new Error(`${missingSelection.label || 'CTA action'} needs at least one selected item`);
      }
    }
  }

  if (format === 'ITEM_CAROUSEL') {
    const carouselMode = String(payload.carouselConfig?.mode || 'CATALOG').toUpperCase();
    const cards = normalizeArray(payload.carouselConfig?.cards);
    if (carouselMode === 'UPLOAD') {
      // Free-form upload carousel: cards carry their own media, no catalog needed.
      const mediaCards = cards.filter((card: any) => String(card?.mediaUrl || '').trim());
      if (mediaCards.length < 2 || mediaCards.length > 10) {
        throw new Error('Upload carousels must have between 2 and 10 cards, each with an image or video');
      }
    } else {
      const items = normalizeArray(payload.carouselConfig?.items);
      if (items.length < 2 || items.length > 10) {
        throw new Error('Carousel campaigns must select between 2 and 10 packages or properties');
      }
    }
    // Validate any per-card flow/url buttons the agency bound to carousel images.
    cards.forEach((card: any, index: number) => {
      normalizeArray(card?.buttons).forEach((btn: any) => {
        const action = String(btn?.action || '').toUpperCase();
        const label = String(btn?.buttonText || `Card ${index + 1} button`).trim();
        if (action === 'OPEN_FLOW' && !btn?.flowId) {
          throw new Error(`${label} needs a flow selected`);
        }
        if (action === 'OPEN_URL' && !/^https?:\/\//i.test(String(btn?.url || '').trim())) {
          throw new Error(`${label} needs a valid https link`);
        }
      });
    });
  }

  return payload;
}

function normalizeCampaignPayload(data = {}) {
  const campaignType = String(data.type || '').toUpperCase();
  const format = campaignType === 'REVIEW_COLLECTION'
    ? 'STANDARD'
    : CAMPAIGN_FORMATS.has(String(data.format || '').toUpperCase())
    ? String(data.format).toUpperCase()
    : 'STANDARD';

  return {
    ...data,
    format,
    mediaType: ['IMAGE', 'VIDEO', 'NONE'].includes(String(data.mediaType || '').toUpperCase())
      ? String(data.mediaType).toUpperCase()
      : 'NONE',
    mediaUrl: data.mediaUrl || null,
    campaignSections: normalizeCampaignSections(data),
    carouselConfig: normalizeCarouselConfig(data),
    ctaConfig: normalizeCtaConfig(data),
    linkedPackageIds: normalizeArray(data.linkedPackageIds),
  };
}

/**
 * Build audience from filter criteria.
 */
async function buildAudience(agencyId, filter = {}) {
  const where = { agencyId };
  const {
    statuses, destinations, budgetMin, budgetMax,
    lastActiveBefore, customerType, source,
    tags, createdAfter, createdBefore,
    minBookingValue, maxBookingValue,
    excludeCampaignDays,
    packageId, bookingStatus, leadStatus,
    manualCustomerIds,
    bookedAfter, bookedBefore,
  } = filter;

  // Manual selection mode — specific customer IDs provided (e.g. from import)
  if (manualCustomerIds && manualCustomerIds.length > 0) {
    return Customer.findAll({
      where: { agencyId, id: { [Op.in]: manualCustomerIds } },
      attributes: ['id', 'name', 'phone'],
    });
  }

  if (customerType === 'past_travelers') {
    const bookingWhere = { agencyId, status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] } };
    if (packageId) bookingWhere.packageId = packageId;

    const bookedCustomerIds = await Booking.findAll({
      where: bookingWhere,
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = bookedCustomerIds.map((b) => b.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  // Package bookers — customers who booked a specific package
  if (customerType === 'package_bookers' && packageId) {
    const pkgCustomerIds = await Booking.findAll({
      where: { agencyId, packageId, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = pkgCustomerIds.map((b) => b.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  // Booking status filter (any booking matching the given status)
  if (customerType === 'by_booking_status' && bookingStatus) {
    const statusCustomerIds = await Booking.findAll({
      where: { agencyId, status: bookingStatus },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = statusCustomerIds.map((b) => b.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  if (customerType === 'leads_only') {
    const leadWhere = { agencyId };
    if (statuses && statuses.length) leadWhere.status = { [Op.in]: statuses };
    if (leadStatus) leadWhere.status = leadStatus;
    if (packageId) leadWhere.packageId = packageId;

    const leadCustomerIds = await Lead.findAll({
      where: leadWhere,
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = leadCustomerIds.map((l) => l.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  // Leads interested in a package (enquired but not booked)
  if (customerType === 'package_enquirers' && packageId) {
    const enquirerIds = await Lead.findAll({
      where: { agencyId, packageId, status: { [Op.notIn]: ['BOOKED', 'LOST', 'CANCELLED'] } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = enquirerIds.map((l) => l.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  if (source) {
    const srcLeadIds = await Lead.findAll({
      where: { agencyId, source },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = srcLeadIds.map((l) => l.customerId);
    if (ids.length === 0) return [];
    where.id = where.id ? { [Op.and]: [where.id, { [Op.in]: ids }] } : { [Op.in]: ids };
  }

  if (destinations && destinations.length > 0) {
    const destLeadIds = await Lead.findAll({
      where: { agencyId, destination: { [Op.iLike]: { [Op.any]: destinations.map((d) => `%${d}%`) } } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = destLeadIds.map((l) => l.customerId);
    if (ids.length === 0) return [];
    where.id = where.id ? { [Op.and]: [where.id, { [Op.in]: ids }] } : { [Op.in]: ids };
  }

  if (lastActiveBefore) {
    where.updatedAt = { [Op.lt]: new Date(lastActiveBefore) };
  }

  // Advanced filters
  if (createdAfter) {
    where.createdAt = { ...where.createdAt, [Op.gte]: new Date(createdAfter) };
  }
  if (createdBefore) {
    where.createdAt = { ...where.createdAt, [Op.lte]: new Date(createdBefore) };
  }

  // Filter by booking value range
  if (minBookingValue || maxBookingValue) {
    const bookingWhere = { agencyId, status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] } };

    const valueCustomers = await Booking.findAll({
      where: bookingWhere,
      attributes: ['customerId', [fn('SUM', col('total_amount')), 'totalValue']],
      group: ['customerId'],
      having: literal(`SUM(total_amount) ${minBookingValue ? `>= ${parseInt(minBookingValue, 10)}` : ''} ${minBookingValue && maxBookingValue ? 'AND' : ''} ${maxBookingValue ? `SUM(total_amount) <= ${parseInt(maxBookingValue, 10)}` : ''}`),
      raw: true,
    });
    const ids = valueCustomers.map((c) => c.customerId);
    if (ids.length === 0) return [];
    where.id = where.id ? { [Op.and]: [where.id, { [Op.in]: ids }] } : { [Op.in]: ids };
  }

  // Filter by booking date (when the booking was made)
  if (bookedAfter || bookedBefore) {
    const bDateWhere = { agencyId, status: { [Op.notIn]: ['CANCELLED'] } };
    if (bookedAfter) bDateWhere.createdAt = { ...bDateWhere.createdAt, [Op.gte]: new Date(bookedAfter) };
    if (bookedBefore) bDateWhere.createdAt = { ...bDateWhere.createdAt, [Op.lte]: new Date(bookedBefore) };

    const datedCustomerIds = await Booking.findAll({
      where: bDateWhere,
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = datedCustomerIds.map((b) => b.customerId);
    if (ids.length === 0) return [];
    where.id = where.id ? { [Op.and]: [where.id, { [Op.in]: ids }] } : { [Op.in]: ids };
  }

  // Exclude customers who received a campaign within X days
  if (excludeCampaignDays && excludeCampaignDays > 0) {
    const cutoff = new Date(Date.now() - excludeCampaignDays * 86400000);
    const recentRecipients = await CampaignRecipient.findAll({
      where: { status: { [Op.in]: ['SENT', 'DELIVERED', 'READ'] }, sentAt: { [Op.gte]: cutoff } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const excludeIds = recentRecipients.map((r) => r.customerId);
    if (excludeIds.length > 0) {
      where.id = where.id
        ? { [Op.and]: [where.id, { [Op.notIn]: excludeIds }] }
        : { [Op.notIn]: excludeIds };
    }
  }

  // Tags filter
  if (tags && tags.length > 0) {
    where.tags = { [Op.overlap]: tags };
  }

  return Customer.findAll({ where, attributes: ['id', 'name', 'phone'] });
}

/**
 * Preview audience count.
 */
async function previewAudienceCount(agencyId, filter) {
  const audience = await buildAudience(agencyId, filter);
  return audience.length;
}

/**
 * Import contacts from an uploaded list and return customer IDs.
 * Creates new Customer records for phones that don't exist yet.
 */
async function importContacts(agencyId, contacts) {
  const customerIds = [];

  for (const contact of contacts) {
    const phone = (contact.phone || '').trim();
    if (!phone) continue;

    const [customer] = await Customer.findOrCreate({
      where: { agencyId, phone },
      defaults: {
        agencyId,
        phone,
        name: contact.name || null,
        source: 'manual_import',
      },
    });

    customerIds.push(customer.id);
  }

  return customerIds;
}

/**
 * Create campaign.
 */
async function createCampaign(agencyId, data) {
  const payload = validateCampaignPayload(normalizeCampaignPayload(data));

  if (payload.type === 'REVIEW_COLLECTION' && !payload.templateId && !payload.messageBody) {
    const reviewTemplate = await MessageTemplate.findOne({
      where: {
        agencyId,
        status: 'APPROVED',
        [Op.or]: [
          { name: 'review_request' },
          { name: 'review_collection_campaign' },
          { displayName: 'Review Request' },
          { displayName: 'Automated Review Collection' },
        ],
      },
      order: [['updatedAt', 'DESC']],
    });

    if (reviewTemplate) {
      payload.templateId = reviewTemplate.id;
    }
  }

  return Campaign.create({ ...payload, agencyId, status: 'DRAFT' });
}

/**
 * Update draft campaign.
 */
async function updateCampaign(id, agencyId, data) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');
  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    throw new Error('Can only edit draft or scheduled campaigns');
  }
  return campaign.update(validateCampaignPayload(normalizeCampaignPayload(data)));
}

/**
 * List campaigns for an agency.
 */
function buildCampaignReportWhere(agencyId, { status, type, from, to, q } = {}) {
  const where = { agencyId };
  if (status) where.status = status;
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }
  if (q) {
    where.name = { [Op.iLike]: `%${String(q).trim()}%` };
  }

  return where;
}

async function getCampaignSummary(where) {
  const campaigns = await Campaign.findAll({ where, raw: true });
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => ['SENDING', 'SCHEDULED'].includes(c.status)).length;
  const sentCampaigns = campaigns.filter((c) => ['SENT', 'SENDING'].includes(c.status)).length;
  const totalRecipients = campaigns.reduce((sum, c) => sum + (c.totalRecipients || 0), 0);
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + (c.delivered || 0), 0);
  const totalRead = campaigns.reduce((sum, c) => sum + (c.read || 0), 0);
  const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
  const totalFailed = campaigns.reduce((sum, c) => sum + (c.failed || 0), 0);
  const percentageOfRecipients = (value) => {
    if (!totalRecipients) return 0;
    return Math.min(100, Math.round(((value || 0) / totalRecipients) * 100));
  };

  return {
    totalCampaigns,
    activeCampaigns,
    sentCampaigns,
    totalRecipients,
    totalSent,
    totalDelivered,
    totalRead,
    totalReplied,
    totalFailed,
    deliveryRate: percentageOfRecipients(Math.max(totalDelivered, totalRead, totalReplied)),
    readRate: percentageOfRecipients(Math.max(totalRead, totalReplied)),
    failureRate: totalRecipients > 0 ? Math.round((totalFailed / totalRecipients) * 100) : 0,
  };
}

async function listCampaigns(agencyId, { status, type, from, to, q, page = 1, pageSize = 20 } = {}) {
  const where = buildCampaignReportWhere(agencyId, { status, type, from, to, q });

  const { count, rows } = await Campaign.findAndCountAll({
    where,
    include: [{ model: MessageTemplate, as: 'template', attributes: ['displayName', 'icon', 'category'] }],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const summary = await getCampaignSummary(where);

  return { total: count, data: rows, page, pageSize, summary };
}

/**
 * Get campaign detail with recipient stats.
 */
async function getCampaign(id, agencyId) {
  const campaign = await Campaign.findOne({
    where: { id, agencyId },
    include: [
      { model: MessageTemplate, as: 'template' },
      {
        model: CampaignRecipient,
        as: 'recipients',
        include: [
          { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
          { model: Lead, as: 'lead', attributes: ['id', 'status', 'itemType', 'packageId', 'propertyId'] },
        ],
        limit: 100,
        order: [['sentAt', 'DESC']],
      },
    ],
  });

  if (!campaign) throw new Error('Campaign not found');
  return campaign;
}

/**
 * Get campaign delivery stats breakdown.
 */
async function getCampaignStats(id, agencyId) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');

  // Aggregate recipient stats
  const statusCounts = await CampaignRecipient.findAll({
    where: { campaignId: id },
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });

  // Delivery timeline (hourly buckets)
  const timeline = await CampaignRecipient.findAll({
    where: { campaignId: id, sentAt: { [Op.ne]: null } },
    attributes: [
      [fn('date_trunc', 'hour', col('sent_at')), 'hour'],
      [fn('COUNT', col('id')), 'sent'],
      [fn('SUM', literal("CASE WHEN status IN ('DELIVERED','READ','REPLIED') THEN 1 ELSE 0 END")), 'delivered'],
      [fn('SUM', literal("CASE WHEN status IN ('READ','REPLIED') THEN 1 ELSE 0 END")), 'readCount'],
    ],
    group: [fn('date_trunc', 'hour', col('sent_at'))],
    order: [[fn('date_trunc', 'hour', col('sent_at')), 'ASC']],
    raw: true,
  });

  const stats = {};
  (statusCounts || []).forEach((s) => { stats[s.status] = parseInt(s.count, 10); });
  const sentCount = (stats.SENT || 0) + (stats.DELIVERED || 0) + (stats.READ || 0) + (stats.REPLIED || 0);
  const deliveredCount = (stats.DELIVERED || 0) + (stats.READ || 0) + (stats.REPLIED || 0);
  const readCount = (stats.READ || 0) + (stats.REPLIED || 0);

  const [clicked, leads, bookings, revenue] = await Promise.all([
    CampaignRecipient.count({ where: { campaignId: id, clickedAt: { [Op.ne]: null } } }),
    Lead.count({ where: { agencyId, campaignId: id } }),
    Booking.count({
      where: { agencyId, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      include: [{ model: Lead, as: 'lead', where: { campaignId: id }, required: true, attributes: [] }],
    }),
    Booking.sum('totalAmount', {
      where: { agencyId, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      include: [{ model: Lead, as: 'lead', where: { campaignId: id }, required: true, attributes: [] }],
    }),
  ]);

  return {
    campaign,
    stats: {
      total: campaign.totalRecipients,
      pending: stats.PENDING || 0,
      sent: sentCount,
      delivered: deliveredCount,
      read: readCount,
      replied: stats.REPLIED || 0,
      failed: stats.FAILED || 0,
      clicked,
      leads,
      bookings,
      revenue: revenue || 0,
    },
    timeline: (timeline || []).map((t) => ({
      hour: t.hour,
      sent: parseInt(t.sent, 10),
      delivered: parseInt(t.delivered, 10),
      read: parseInt(t.readCount, 10),
    })),
  };
}

/**
 * Send campaign immediately (queues bulk send).
 */
async function sendCampaign(id, agencyId) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');
  if (!['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    throw new Error('Campaign already sent or cancelled');
  }

  validateCampaignPayload({
    format: campaign.format,
    campaignSections: campaign.campaignSections,
    carouselConfig: campaign.carouselConfig,
    ctaConfig: campaign.ctaConfig,
  });

  const audience = await buildAudience(agencyId, campaign.audienceFilter);
  if (audience.length === 0) throw new Error('No recipients match the audience filter');

  // Create recipient records
  const recipientData = audience.map((customer) => ({
    campaignId: id,
    customerId: customer.id,
    status: 'PENDING',
  }));

  await CampaignRecipient.bulkCreate(recipientData, { ignoreDuplicates: true });

  await campaign.update({
    status: 'SENDING',
    sentAt: new Date(),
    audienceCount: audience.length,
    totalRecipients: audience.length,
  });

  // Queue the broadcast job
  try {
    const { campaignQueue, processCampaignBroadcast } = require('./marketingSchedulerService');
    if (!campaignQueue) {
      console.warn('[CampaignService] Campaign queue unavailable, starting inline fallback broadcast');
      setImmediate(() => {
        processCampaignBroadcast(id, agencyId).catch((err) => {
          console.error('[CampaignService] Inline fallback broadcast failed:', err.message);
        });
      });
      return campaign;
    }
    await campaignQueue.add('broadcast', { campaignId: id, agencyId }, { attempts: 3 });
  } catch (err) {
    console.error('[CampaignService] Failed to queue broadcast job:', err.message);
  }

  return campaign;
}

/**
 * Cancel a scheduled/sending campaign.
 */
async function cancelCampaign(id, agencyId) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');
  if (['SENT', 'CANCELLED'].includes(campaign.status)) {
    throw new Error('Campaign already completed or cancelled');
  }

  await CampaignRecipient.update(
    { status: 'FAILED', errorMessage: 'Campaign cancelled' },
    { where: { campaignId: id, status: 'PENDING' } }
  );

  return campaign.update({ status: 'CANCELLED' });
}

/**
 * Delete a draft campaign.
 */
async function deleteCampaign(id, agencyId) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'DRAFT') {
    throw new Error('Can only delete draft campaigns');
  }

  await CampaignRecipient.destroy({ where: { campaignId: id } });
  await campaign.destroy();
  return { deleted: true };
}

/**
 * Duplicate a campaign as a new DRAFT.
 */
async function duplicateCampaign(id, agencyId) {
  const original = await Campaign.findOne({ where: { id, agencyId } });
  if (!original) throw new Error('Campaign not found');

  const clone = await Campaign.create({
    agencyId,
    name: `${original.name} (Copy)`,
    type: original.type,
    templateId: original.templateId,
    messageBody: original.messageBody,
    audienceFilter: original.audienceFilter,
    linkedPackageIds: original.linkedPackageIds || [],
    format: original.format || 'STANDARD',
    mediaType: original.mediaType || 'NONE',
    mediaUrl: original.mediaUrl || null,
    campaignSections: original.campaignSections || [],
    carouselConfig: original.carouselConfig || {},
    ctaConfig: original.ctaConfig || {},
    status: 'DRAFT',
    totalRecipients: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    replied: 0,
    failed: 0,
  });

  return clone;
}

async function getCampaignReport(id, agencyId) {
  const campaign = await Campaign.findOne({ where: { id, agencyId } });
  if (!campaign) throw new Error('Campaign not found');

  const [recipients, leads, bookings] = await Promise.all([
    CampaignRecipient.findAll({
      where: { campaignId: id },
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
      order: [['updatedAt', 'DESC']],
      limit: 500,
    }),
    Lead.findAll({ where: { agencyId, campaignId: id }, raw: true }),
    Booking.findAll({
      where: { agencyId, status: { [Op.in]: ['PENDING', 'CONFIRMED', 'COMPLETED'] } },
      include: [{ model: Lead, as: 'lead', where: { campaignId: id }, required: true }],
    }),
  ]);

  const itemIds = new Set();
  recipients.forEach((recipient) => {
    if (recipient.selectedItemId) itemIds.add(recipient.selectedItemId);
  });
  leads.forEach((lead) => {
    if (lead.packageId) itemIds.add(lead.packageId);
    if (lead.propertyId) itemIds.add(lead.propertyId);
  });

  const [packages, properties] = await Promise.all([
    Package.findAll({ where: { agencyId, id: { [Op.in]: Array.from(itemIds) } }, attributes: ['id', 'name', 'category'], raw: true }),
    Property.findAll({ where: { agencyId, id: { [Op.in]: Array.from(itemIds) } }, attributes: ['id', 'name', 'propertyType', 'location'], raw: true }),
  ]);

  const names = new Map();
  packages.forEach((pkg) => names.set(`PACKAGE:${pkg.id}`, pkg.name));
  properties.forEach((property) => names.set(`PROPERTY:${property.id}`, property.name));

  const itemMap = new Map();
  const ensureItem = (itemType, itemId) => {
    if (!itemType || !itemId) return null;
    const key = `${itemType}:${itemId}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, {
        itemType,
        itemId,
        name: names.get(key) || 'Unknown item',
        clicks: 0,
        leads: 0,
        bookings: 0,
        revenue: 0,
      });
    }
    return itemMap.get(key);
  };

  recipients.forEach((recipient) => {
    const item = ensureItem(recipient.selectedItemType, recipient.selectedItemId);
    if (item && recipient.clickedAt) item.clicks += 1;
  });

  leads.forEach((lead) => {
    const itemType = lead.itemType || (lead.propertyId ? 'PROPERTY' : lead.packageId ? 'PACKAGE' : 'CUSTOM_TRIP');
    const itemId = lead.propertyId || lead.packageId || lead.id;
    const item = ensureItem(itemType, itemId);
    if (item) item.leads += 1;
  });

  bookings.forEach((booking) => {
    const lead = booking.lead;
    const itemType = lead?.itemType || (lead?.propertyId ? 'PROPERTY' : lead?.packageId ? 'PACKAGE' : 'CUSTOM_TRIP');
    const itemId = lead?.propertyId || lead?.packageId || lead?.id;
    const item = ensureItem(itemType, itemId);
    if (item) {
      item.bookings += 1;
      item.revenue += booking.totalAmount || 0;
    }
  });

  const clickedRecipients = recipients.filter((recipient) => !!recipient.clickedAt);
  const actionCounts = clickedRecipients.reduce((acc, recipient) => {
    const action = recipient.clickedAction || 'UNKNOWN';
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});

  return {
    campaign,
    summary: {
      recipients: recipients.length,
      clicked: clickedRecipients.length,
      leads: leads.length,
      bookings: bookings.length,
      revenue: bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0),
    },
    actionPerformance: Object.entries(actionCounts).map(([action, count]) => ({ action, count })),
    itemPerformance: Array.from(itemMap.values()).sort((a, b) => b.leads - a.leads || b.clicks - a.clicks),
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      customer: recipient.customer,
      status: recipient.status,
      sentAt: recipient.sentAt,
      deliveredAt: recipient.deliveredAt,
      readAt: recipient.readAt,
      repliedAt: recipient.repliedAt,
      clickedAt: recipient.clickedAt,
      clickedAction: recipient.clickedAction,
      selectedItemType: recipient.selectedItemType,
      selectedItemId: recipient.selectedItemId,
      selectedItemName: names.get(`${recipient.selectedItemType}:${recipient.selectedItemId}`) || null,
      leadId: recipient.leadId,
    })),
  };
}

async function getCampaignRecipientReports(agencyId, {
  from, to, status, type, q, campaignId, recipientStatus, page = 1, pageSize, limit,
} = {}) {
  const campaignWhere = buildCampaignReportWhere(agencyId, { from, to, status, type, q });
  if (campaignId) campaignWhere.id = campaignId;

  const normalizedRecipientStatus = String(recipientStatus || '').toUpperCase();
  const recipientWhere = {};
  if (RECIPIENT_LIFECYCLE_STATUS_MAP[normalizedRecipientStatus]) {
    recipientWhere.status = { [Op.in]: RECIPIENT_LIFECYCLE_STATUS_MAP[normalizedRecipientStatus] };
  } else {
    recipientWhere.status = { [Op.in]: RECIPIENT_REPORT_STATUSES };
  }

  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const requestedPageSize = pageSize ?? limit ?? 50;
  const safePageSize = Math.min(Math.max(parseInt(requestedPageSize, 10) || 50, 1), 50000);
  const offset = (safePage - 1) * safePageSize;

  const [campaigns, statusRows, campaignRows, totalRecipientRows, recipients] = await Promise.all([
    Campaign.findAll({
      where: campaignWhere,
      attributes: ['id', 'name', 'type', 'status', 'totalRecipients', 'sent', 'delivered', 'read', 'replied', 'failed', 'createdAt', 'sentAt'],
      order: [['createdAt', 'DESC']],
      raw: true,
    }),
    CampaignRecipient.findAll({
      where: recipientWhere,
      attributes: ['status', [fn('COUNT', col('CampaignRecipient.id')), 'count']],
      include: [{ model: Campaign, as: 'campaign', attributes: [], where: campaignWhere, required: true }],
      group: ['CampaignRecipient.status'],
      raw: true,
    }),
    CampaignRecipient.findAll({
      where: recipientWhere,
      attributes: [
        'campaignId',
        [fn('COUNT', col('CampaignRecipient.id')), 'total'],
        [fn('SUM', literal("CASE WHEN \"CampaignRecipient\".\"status\" = 'SENT' THEN 1 ELSE 0 END")), 'sent'],
        [fn('SUM', literal("CASE WHEN \"CampaignRecipient\".\"status\" = 'DELIVERED' THEN 1 ELSE 0 END")), 'delivered'],
        [fn('SUM', literal("CASE WHEN \"CampaignRecipient\".\"status\" = 'READ' THEN 1 ELSE 0 END")), 'read'],
        [fn('SUM', literal("CASE WHEN \"CampaignRecipient\".\"status\" = 'REPLIED' THEN 1 ELSE 0 END")), 'replied'],
        [fn('SUM', literal("CASE WHEN \"CampaignRecipient\".\"status\" = 'FAILED' THEN 1 ELSE 0 END")), 'failed'],
      ],
      include: [{ model: Campaign, as: 'campaign', attributes: ['id', 'name', 'type', 'status', 'createdAt', 'sentAt'], where: campaignWhere, required: true }],
      group: [col('CampaignRecipient.campaign_id'), col('campaign.id')],
      order: [[{ model: Campaign, as: 'campaign' }, 'createdAt', 'DESC']],
      raw: true,
      nest: true,
    }),
    CampaignRecipient.count({
      where: recipientWhere,
      include: [{ model: Campaign, as: 'campaign', attributes: [], where: campaignWhere, required: true }],
    }),
    CampaignRecipient.findAll({
      where: recipientWhere,
      include: [
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'type', 'status', 'createdAt', 'sentAt'],
          where: campaignWhere,
          required: true,
        },
        { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
      ],
      order: [
        [{ model: Campaign, as: 'campaign' }, 'createdAt', 'DESC'],
        ['updatedAt', 'DESC'],
      ],
      limit: safePageSize,
      offset,
    }),
  ]);

  const statusBreakdown = RECIPIENT_REPORT_STATUSES.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  statusRows.forEach((row) => {
    statusBreakdown[row.status] = parseInt(row.count, 10) || 0;
  });

  const lifecycleSummary = {
    sent: statusBreakdown.SENT + statusBreakdown.DELIVERED + statusBreakdown.READ + statusBreakdown.REPLIED,
    delivered: statusBreakdown.DELIVERED + statusBreakdown.READ + statusBreakdown.REPLIED,
    read: statusBreakdown.READ + statusBreakdown.REPLIED,
    replied: statusBreakdown.REPLIED,
    failed: statusBreakdown.FAILED,
  };

  return {
    filters: {
      campaignId: campaignId || null,
      recipientStatus: RECIPIENT_LIFECYCLE_STATUS_MAP[normalizedRecipientStatus] ? normalizedRecipientStatus : 'ALL',
      page: safePage,
      pageSize: safePageSize,
    },
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total: totalRecipientRows,
      totalPages: Math.max(1, Math.ceil(totalRecipientRows / safePageSize)),
    },
    summary: {
      campaigns: campaigns.length,
      recipientRows: totalRecipientRows,
      ...lifecycleSummary,
      statusBreakdown,
    },
    campaigns: campaignRows.map((row) => ({
      id: row.campaign?.id || row.campaignId,
      name: row.campaign?.name || 'Untitled campaign',
      type: row.campaign?.type || '',
      status: row.campaign?.status || '',
      createdAt: row.campaign?.createdAt || null,
      sentAt: row.campaign?.sentAt || null,
      total: parseInt(row.total, 10) || 0,
      sent: parseInt(row.sent, 10) || 0,
      delivered: parseInt(row.delivered, 10) || 0,
      read: parseInt(row.read, 10) || 0,
      replied: parseInt(row.replied, 10) || 0,
      failed: parseInt(row.failed, 10) || 0,
    })),
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      campaignId: recipient.campaignId,
      campaignName: recipient.campaign?.name || '',
      campaignType: recipient.campaign?.type || '',
      campaignStatus: recipient.campaign?.status || '',
      customerName: recipient.customer?.name || '',
      phone: recipient.customer?.phone || '',
      status: recipient.status,
      waMessageId: recipient.waMessageId,
      sentAt: recipient.sentAt,
      deliveredAt: recipient.deliveredAt,
      readAt: recipient.readAt,
      repliedAt: recipient.repliedAt,
      clickedAt: recipient.clickedAt,
      errorMessage: recipient.errorMessage,
    })),
  };
}

/**
 * Get aggregate campaign analytics for an agency.
 */
async function getCampaignAnalytics(agencyId, { from, to, status, type, q } = {}) {
  const where = buildCampaignReportWhere(agencyId, { from, to, status, type, q });

  // Overall stats
  const campaigns = await Campaign.findAll({ where, raw: true });
  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => ['SENT', 'SENDING'].includes(c.status)).length;
  const activeCampaigns = campaigns.filter((c) => ['SENDING', 'SCHEDULED'].includes(c.status)).length;
  const totalRecipients = campaigns.reduce((s, c) => s + (c.totalRecipients || 0), 0);
  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.read || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.replied || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failed || 0), 0);
  const percentageOfRecipients = (value) => {
    if (!totalRecipients) return 0;
    return Math.min(100, Math.round(((value || 0) / totalRecipients) * 100));
  };

  const deliveryRate = percentageOfRecipients(Math.max(totalDelivered, totalRead, totalReplied));
  const readRate = percentageOfRecipients(Math.max(totalRead, totalReplied));
  const replyRate = percentageOfRecipients(totalReplied);
  const failureRate = totalRecipients > 0 ? Math.round((totalFailed / totalRecipients) * 100) : 0;

  // Campaigns over time
  const campaignsByDay = await Campaign.findAll({
    where: { ...where, sentAt: { [Op.ne]: null } },
    attributes: [
      [fn('date_trunc', 'day', col('sent_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('total_recipients')), 'recipients'],
    ],
    group: [fn('date_trunc', 'day', col('sent_at'))],
    order: [[fn('date_trunc', 'day', col('sent_at')), 'ASC']],
    raw: true,
  });

  // Best performing campaigns
  const topCampaigns = await Campaign.findAll({
    where: status ? where : { ...where, status: { [Op.in]: ['SENT', 'SENDING'] } },
    order: [['read', 'DESC']],
    limit: 5,
    include: [{ model: MessageTemplate, as: 'template', attributes: ['displayName', 'icon'] }],
  });

  // Template performance
  const templateStats = await Campaign.findAll({
    where: status ? { ...where, templateId: { [Op.ne]: null } } : { ...where, templateId: { [Op.ne]: null }, status: { [Op.in]: ['SENT', 'SENDING'] } },
    attributes: [
      'templateId',
      [fn('COUNT', col('Campaign.id')), 'campaignCount'],
      [fn('SUM', col('total_recipients')), 'totalSent'],
      [fn('SUM', col('delivered')), 'totalDelivered'],
      [fn('SUM', col('read')), 'totalRead'],
    ],
    include: [{ model: MessageTemplate, as: 'template', attributes: ['displayName', 'icon', 'category'] }],
    group: ['templateId', 'template.id'],
    raw: true,
    nest: true,
  });

  return {
    totalCampaigns,
    sentCampaigns,
    activeCampaigns,
    totalRecipients,
    totalSent,
    totalDelivered,
    totalRead,
    totalReplied,
    totalFailed,
    deliveryRate,
    readRate,
    replyRate,
    failureRate,
    campaignsByDay: (campaignsByDay || []).map((d) => ({
      date: d.date,
      count: parseInt(d.count, 10),
      recipients: parseInt(d.recipients, 10),
    })),
    topCampaigns,
    templateStats: (templateStats || []).map((t) => ({
      templateId: t.templateId,
      template: t.template,
      campaignCount: parseInt(t.campaignCount, 10),
      totalSent: parseInt(t.totalSent, 10),
      totalDelivered: parseInt(t.totalDelivered, 10),
      totalRead: parseInt(t.totalRead, 10),
      readRate: parseInt(t.totalDelivered, 10) > 0
        ? Math.round((parseInt(t.totalRead, 10) / parseInt(t.totalDelivered, 10)) * 100) : 0,
    })),
  };
}

module.exports = {
  buildAudience,
  previewAudienceCount,
  importContacts,
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  getCampaignStats,
  sendCampaign,
  cancelCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignReport,
  getCampaignRecipientReports,
  getCampaignAnalytics,
};
