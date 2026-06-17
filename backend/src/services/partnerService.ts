const { Op, fn, col } = require('sequelize');
const { Partner, PartnerInvoice, Agency, Payment } = require('../models');
const { logPlatformAction } = require('./platformAuditService');

function httpError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const BRANDING_FIELDS = [
  'name', 'customDomain', 'isActive',
  'brandName', 'logoUrl', 'faviconUrl', 'primaryColor', 'accentColor',
  'loginTagline', 'loginImageUrl', 'supportEmail', 'supportUrl',
  'emailFromName', 'emailReplyTo', 'emailFooterText',
  'billingModel', 'revenueSharePercent', 'perAgencyFee', 'currency', 'billingStatus',
];

function pickFields(input, fields) {
  const out = {};
  for (const key of fields) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

async function listPartners() {
  const partners = await Partner.findAll({ order: [['createdAt', 'DESC']] });
  // Agency counts per partner in one grouped query.
  const counts = await Agency.findAll({
    attributes: ['partnerId', [fn('COUNT', col('id')), 'count']],
    where: { partnerId: { [Op.ne]: null } },
    group: ['partnerId'],
    raw: true,
  });
  const countByPartner = new Map(counts.map((r) => [r.partnerId, Number(r.count)]));
  return partners.map((p) => ({
    ...p.toJSON(),
    agencyCount: countByPartner.get(p.id) || 0,
  }));
}

async function getPartner(partnerId) {
  const partner = await Partner.findByPk(partnerId, {
    include: [
      { model: Agency, as: 'agencies', attributes: ['id', 'name', 'email', 'plan', 'isActive', 'createdAt'] },
      { model: PartnerInvoice, as: 'invoices', separate: true, order: [['periodStart', 'DESC']] },
    ],
  });
  if (!partner) throw httpError('Partner not found', 404, 'PARTNER_NOT_FOUND');
  return partner.toJSON();
}

async function createPartner(data, platformAdminId, req) {
  const name = String(data.name || '').trim();
  if (!name) throw httpError('Partner name is required', 400, 'PARTNER_NAME_REQUIRED');

  const slug = normalizeSlug(data.slug || name);
  if (!slug) throw httpError('A valid slug is required', 400, 'PARTNER_SLUG_REQUIRED');

  const existing = await Partner.findOne({ where: { slug } });
  if (existing) throw httpError(`Slug "${slug}" is already taken`, 409, 'PARTNER_SLUG_TAKEN');

  const payload = { ...pickFields(data, BRANDING_FIELDS), name, slug, createdByAdminId: platformAdminId };
  const partner = await Partner.create(payload);

  await logPlatformAction(platformAdminId, 'PARTNER_CREATE', {
    targetType: 'Partner', targetId: partner.id, metadata: { name, slug }, req,
  });
  return partner.toJSON();
}

async function updatePartner(partnerId, data, platformAdminId, req) {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) throw httpError('Partner not found', 404, 'PARTNER_NOT_FOUND');

  const updates = pickFields(data, BRANDING_FIELDS);
  if (data.slug !== undefined) {
    const slug = normalizeSlug(data.slug);
    if (!slug) throw httpError('A valid slug is required', 400, 'PARTNER_SLUG_REQUIRED');
    if (slug !== partner.slug) {
      const taken = await Partner.findOne({ where: { slug, id: { [Op.ne]: partnerId } } });
      if (taken) throw httpError(`Slug "${slug}" is already taken`, 409, 'PARTNER_SLUG_TAKEN');
      updates.slug = slug;
    }
  }

  await partner.update(updates);
  await logPlatformAction(platformAdminId, 'PARTNER_UPDATE', {
    targetType: 'Partner', targetId: partner.id, metadata: { fields: Object.keys(updates) }, req,
  });
  return partner.toJSON();
}

async function assignAgency(partnerId, agencyId, platformAdminId, req) {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) throw httpError('Partner not found', 404, 'PARTNER_NOT_FOUND');
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw httpError('Agency not found', 404, 'PLATFORM_AGENCY_NOT_FOUND');

  await agency.update({ partnerId });
  await logPlatformAction(platformAdminId, 'PARTNER_AGENCY_ASSIGN', {
    targetType: 'Agency', targetId: agency.id, metadata: { partnerId, agencyName: agency.name }, req,
  });
  return agency.toJSON();
}

async function unassignAgency(agencyId, platformAdminId, req) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw httpError('Agency not found', 404, 'PLATFORM_AGENCY_NOT_FOUND');
  const previousPartnerId = agency.partnerId;
  await agency.update({ partnerId: null });
  await logPlatformAction(platformAdminId, 'PARTNER_AGENCY_UNASSIGN', {
    targetType: 'Agency', targetId: agency.id, metadata: { previousPartnerId, agencyName: agency.name }, req,
  });
  return agency.toJSON();
}

/**
 * Generates a DRAFT revenue-share invoice for a partner over [periodStart,
 * periodEnd]. Sums PAID payments across the partner's agencies and applies the
 * partner's revenue-share percent plus any per-agency fee.
 */
async function generateInvoice(partnerId, { periodStart, periodEnd }, platformAdminId, req) {
  const partner = await Partner.findByPk(partnerId);
  if (!partner) throw httpError('Partner not found', 404, 'PARTNER_NOT_FOUND');
  if (!periodStart || !periodEnd) throw httpError('periodStart and periodEnd are required', 400, 'PARTNER_INVOICE_PERIOD_REQUIRED');

  const agencies = await Agency.findAll({ where: { partnerId }, attributes: ['id', 'name'] });
  const agencyIds = agencies.map((a) => a.id);
  const nameById = new Map(agencies.map((a) => [a.id, a.name]));

  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T23:59:59.999Z`);

  let perAgencyRevenue = [];
  if (agencyIds.length > 0) {
    perAgencyRevenue = await Payment.findAll({
      attributes: ['agencyId', [fn('COALESCE', fn('SUM', col('amount')), 0), 'total']],
      where: {
        agencyId: { [Op.in]: agencyIds },
        status: 'PAID',
        [Op.or]: [
          { paidAt: { [Op.between]: [start, end] } },
          { paidAt: null, createdAt: { [Op.between]: [start, end] } },
        ],
      },
      group: ['agencyId'],
      raw: true,
    });
  }

  const sharePct = Number(partner.revenueSharePercent) || 0;
  const perAgencyFee = Number(partner.perAgencyFee) || 0;

  const lineItems = perAgencyRevenue.map((row) => {
    const revenue = Number(row.total) || 0;
    const share = Math.round(revenue * sharePct / 100);
    return {
      agencyId: row.agencyId,
      agencyName: nameById.get(row.agencyId) || 'Agency',
      revenue,
      revenueSharePercent: sharePct,
      revenueShareAmount: share,
    };
  });

  // All monetary amounts are in paise (matching Payment.amount). perAgencyFee is
  // entered by the admin in major units (rupees), so convert it to paise here.
  const subtotal = lineItems.reduce((sum, li) => sum + li.revenue, 0);
  const revenueShareAmount = Math.round(lineItems.reduce((sum, li) => sum + li.revenueShareAmount, 0));
  const feesTotal = Math.round(perAgencyFee * 100 * agencyIds.length);
  const amountDue = revenueShareAmount + feesTotal;

  const invoice = await PartnerInvoice.create({
    partnerId,
    periodStart,
    periodEnd,
    agencyCount: agencyIds.length,
    currency: partner.currency,
    subtotal,
    revenueShareAmount,
    amountDue,
    status: 'DRAFT',
    lineItems: feesTotal > 0
      ? [...lineItems, { agencyName: `Per-agency fee × ${agencyIds.length}`, revenueShareAmount: feesTotal }]
      : lineItems,
  });

  await logPlatformAction(platformAdminId, 'PARTNER_INVOICE_GENERATE', {
    targetType: 'Partner', targetId: partnerId, metadata: { invoiceId: invoice.id, amountDue }, req,
  });
  return invoice.toJSON();
}

async function updateInvoiceStatus(invoiceId, status, platformAdminId, req) {
  const allowed = ['DRAFT', 'ISSUED', 'PAID', 'VOID'];
  if (!allowed.includes(status)) throw httpError('Invalid invoice status', 400, 'PARTNER_INVOICE_STATUS_INVALID');

  const invoice = await PartnerInvoice.findByPk(invoiceId);
  if (!invoice) throw httpError('Invoice not found', 404, 'PARTNER_INVOICE_NOT_FOUND');

  const updates = { status };
  if (status === 'ISSUED' && !invoice.issuedAt) updates.issuedAt = new Date();
  if (status === 'PAID' && !invoice.paidAt) updates.paidAt = new Date();
  await invoice.update(updates);

  await logPlatformAction(platformAdminId, 'PARTNER_INVOICE_STATUS', {
    targetType: 'Partner', targetId: invoice.partnerId, metadata: { invoiceId, status }, req,
  });
  return invoice.toJSON();
}

module.exports = {
  listPartners,
  getPartner,
  createPartner,
  updatePartner,
  assignAgency,
  unassignAgency,
  generateInvoice,
  updateInvoiceStatus,
};
