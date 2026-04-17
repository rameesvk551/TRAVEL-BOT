// FILE: /backend/src/services/referralService.ts

const { Op, fn, col } = require('sequelize');
const { ReferralCode, Customer, Lead } = require('../models');

function generateUniqueCode(name) {
  const base = (name || 'REF').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

async function createReferralCode(agencyId, customerId, options = {}) {
  const customer = await Customer.findOne({ where: { id: customerId, agencyId } });
  if (!customer) throw new Error('Customer not found');

  let code = options.code || generateUniqueCode(customer.name);
  const existing = await ReferralCode.findOne({ where: { code } });
  if (existing) code = generateUniqueCode(customer.name);

  return ReferralCode.create({
    agencyId,
    customerId,
    code,
    discountType: options.discountType || 'FLAT',
    discountValue: options.discountValue || 200000,
    maxUses: options.maxUses || 10,
  });
}

async function applyReferralCode(code, leadId, agencyId) {
  const referral = await ReferralCode.findOne({
    where: { code: code.toUpperCase(), agencyId, isActive: true },
  });

  if (!referral) return null;
  if (referral.usedCount >= referral.maxUses) return null;

  await Lead.update({ referralCodeId: referral.id, source: 'referral' }, { where: { id: leadId } });
  await referral.increment('usedCount');

  return referral;
}

async function listReferralCodes(agencyId) {
  return ReferralCode.findAll({
    where: { agencyId },
    include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
    order: [['usedCount', 'DESC'], ['createdAt', 'DESC']],
  });
}

async function getReferralStats(agencyId) {
  const codes = await ReferralCode.findAll({ where: { agencyId } });
  const totalCodes = codes.length;
  const activeCodes = codes.filter((c) => c.isActive).length;
  const totalUses = codes.reduce((sum, c) => sum + c.usedCount, 0);
  const totalRevenue = codes.reduce((sum, c) => sum + c.revenueGenerated, 0);

  const topReferrers = await ReferralCode.findAll({
    where: { agencyId, usedCount: { [Op.gt]: 0 } },
    include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone'] }],
    order: [['usedCount', 'DESC']],
    limit: 10,
  });

  return { totalCodes, activeCodes, totalUses, totalRevenue, topReferrers };
}

async function toggleReferralCode(id, agencyId) {
  const code = await ReferralCode.findOne({ where: { id, agencyId } });
  if (!code) throw new Error('Referral code not found');
  return code.update({ isActive: !code.isActive });
}

module.exports = {
  createReferralCode,
  applyReferralCode,
  listReferralCodes,
  getReferralStats,
  toggleReferralCode,
};
