const { Op } = require('sequelize');
const { Partner } = require('../models');
const websiteBuilderService = require('./websiteBuilderService');

/**
 * Default (platform-owned) branding shown on the admin host, localhost, and any
 * agency not assigned to a white-label partner.
 */
const DEFAULT_BRANDING = Object.freeze({
  partnerId: null,
  brandName: 'Wayon',
  logoUrl: null,
  faviconUrl: '/wayon-logo.svg?v=20260506',
  primaryColor: '#00A884',
  accentColor: '#141414',
  loginTagline: 'Access your premium travel concierge dashboard.',
  loginImageUrl: '/login-hero.jpg',
  supportEmail: null,
  supportUrl: null,
  isWhiteLabel: false,
});

/**
 * Maps a Partner row to the safe, public-facing branding payload. Never exposes
 * commercial or credential fields.
 */
function toBrandingPayload(partner) {
  if (!partner) return { ...DEFAULT_BRANDING };
  return {
    partnerId: partner.id,
    brandName: partner.brandName || partner.name,
    logoUrl: partner.logoUrl || null,
    faviconUrl: partner.faviconUrl || null,
    primaryColor: partner.primaryColor || DEFAULT_BRANDING.primaryColor,
    accentColor: partner.accentColor || DEFAULT_BRANDING.accentColor,
    loginTagline: partner.loginTagline || DEFAULT_BRANDING.loginTagline,
    loginImageUrl: partner.loginImageUrl || DEFAULT_BRANDING.loginImageUrl,
    supportEmail: partner.supportEmail || null,
    supportUrl: partner.supportUrl || null,
    isWhiteLabel: true,
  };
}

/**
 * Resolves the active Partner for a request host (custom domain or
 * slug.<rootDomain> subdomain). Returns null for the admin host / localhost /
 * unmatched hosts.
 */
async function resolvePartnerByHost(rawHost) {
  const host = websiteBuilderService.normalizeHost(rawHost);
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  if (host === websiteBuilderService.adminHost()) return null;

  const or = [{ customDomain: host }];
  const rootDomain = websiteBuilderService.publicRootDomain();
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const slug = host.slice(0, -(rootDomain.length + 1));
    if (slug && !slug.includes('.')) or.push({ slug });
  }

  return Partner.findOne({ where: { isActive: true, [Op.or]: or } });
}

/**
 * Resolves the branding payload for a request host. Falls back to the default
 * Wayon branding when no partner matches.
 */
async function resolveBrandingByHost(rawHost) {
  const partner = await resolvePartnerByHost(rawHost);
  return toBrandingPayload(partner);
}

/**
 * Branding payload for a specific agency (used to brand the authenticated shell
 * and outbound emails). Falls back to default when the agency has no partner.
 */
async function brandingForAgency(agency) {
  if (!agency || !agency.partnerId) return { ...DEFAULT_BRANDING };
  const partner = await Partner.findByPk(agency.partnerId);
  if (!partner || !partner.isActive) return { ...DEFAULT_BRANDING };
  return toBrandingPayload(partner);
}

module.exports = {
  DEFAULT_BRANDING,
  toBrandingPayload,
  resolvePartnerByHost,
  resolveBrandingByHost,
  brandingForAgency,
};
