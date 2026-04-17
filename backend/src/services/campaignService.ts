// FILE: /backend/src/services/campaignService.ts

const { Op, fn, col } = require('sequelize');
const { Campaign, CampaignRecipient, Customer, Lead, Booking, MessageTemplate } = require('../models');

/**
 * Build audience from filter criteria.
 */
async function buildAudience(agencyId, filter = {}) {
  const where = { agencyId };
  const { statuses, destinations, budgetMin, budgetMax, lastActiveBefore, customerType, source } = filter;

  if (customerType === 'past_travelers') {
    const bookedCustomerIds = await Booking.findAll({
      where: { agencyId, status: { [Op.in]: ['CONFIRMED', 'COMPLETED'] } },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = bookedCustomerIds.map((b) => b.customerId);
    if (ids.length === 0) return [];
    where.id = { [Op.in]: ids };
  }

  if (customerType === 'leads_only') {
    const leadCustomerIds = await Lead.findAll({
      where: { agencyId, ...(statuses ? { status: { [Op.in]: statuses } } : {}) },
      attributes: ['customerId'],
      group: ['customerId'],
      raw: true,
    });
    const ids = leadCustomerIds.map((l) => l.customerId);
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
 * Create campaign.
 */
async function createCampaign(agencyId, data) {
  return Campaign.create({ ...data, agencyId, status: 'DRAFT' });
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

module.exports = {
  buildAudience,
  previewAudienceCount,
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  sendCampaign,
  cancelCampaign,
};
