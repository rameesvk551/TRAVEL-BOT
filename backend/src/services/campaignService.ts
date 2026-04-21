// FILE: /backend/src/services/campaignService.ts

const { Op, fn, col, literal } = require('sequelize');
const { Campaign, CampaignRecipient, Customer, Lead, Booking, MessageTemplate, Package } = require('../models');

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
  const payload = { ...data };

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
  return campaign.update(data);
}

/**
 * List campaigns for an agency.
 */
async function listCampaigns(agencyId, { status, page = 1, pageSize = 20 } = {}) {
  const where = { agencyId };
  if (status) where.status = status;

  const { count, rows } = await Campaign.findAndCountAll({
    where,
    include: [{ model: MessageTemplate, as: 'template', attributes: ['displayName', 'icon', 'category'] }],
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { total: count, data: rows, page, pageSize };
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
        include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
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

  return {
    campaign,
    stats: {
      total: campaign.totalRecipients,
      pending: stats.PENDING || 0,
      sent: stats.SENT || 0,
      delivered: stats.DELIVERED || 0,
      read: stats.READ || 0,
      replied: stats.REPLIED || 0,
      failed: stats.FAILED || 0,
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
    const { campaignQueue } = require('./marketingSchedulerService');
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

/**
 * Get aggregate campaign analytics for an agency.
 */
async function getCampaignAnalytics(agencyId, { from, to } = {}) {
  const where = { agencyId };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(to);
  }

  // Overall stats
  const campaigns = await Campaign.findAll({ where, raw: true });
  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => ['SENT', 'SENDING'].includes(c.status)).length;
  const totalRecipients = campaigns.reduce((s, c) => s + (c.totalRecipients || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered || 0), 0);
  const totalRead = campaigns.reduce((s, c) => s + (c.read || 0), 0);
  const totalReplied = campaigns.reduce((s, c) => s + (c.replied || 0), 0);
  const totalFailed = campaigns.reduce((s, c) => s + (c.failed || 0), 0);

  const deliveryRate = totalRecipients > 0 ? Math.round((totalDelivered / totalRecipients) * 100) : 0;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0;
  const replyRate = totalRead > 0 ? Math.round((totalReplied / totalRead) * 100) : 0;

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
    where: { agencyId, status: { [Op.in]: ['SENT', 'SENDING'] } },
    order: [['read', 'DESC']],
    limit: 5,
    include: [{ model: MessageTemplate, as: 'template', attributes: ['displayName', 'icon'] }],
  });

  // Template performance
  const templateStats = await Campaign.findAll({
    where: { agencyId, templateId: { [Op.ne]: null }, status: { [Op.in]: ['SENT', 'SENDING'] } },
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
    totalRecipients,
    totalDelivered,
    totalRead,
    totalReplied,
    totalFailed,
    deliveryRate,
    readRate,
    replyRate,
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
  getCampaignAnalytics,
};
