// FILE: /backend/src/services/websiteBuilderService.ts
//
// Domain + publish plumbing for an agency's public presence. The old
// generate-to-HTML static site is gone — the public surface is now the live
// React catalog mini-site (see catalogService + /public/:agencyKey/catalog).
// What remains here is what that still needs: host/subdomain/domain
// normalization, uniqueness enforcement, the branding payload, and the
// publish/unpublish flag on the agency.

const { Op } = require('sequelize');
const { Agency } = require('../models');

const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'admin', 'www', 'mail', 'ftp', 'localhost', 'travelbot']);

// Curated catalog theme presets the public page renders with. Anything else
// (including legacy static-site template ids) falls back to the default.
const CATALOG_THEMES = ['aurora', 'midnight', 'coast', 'terra'];
function normalizeTheme(value) {
  const key = String(value || '').trim().toLowerCase();
  return CATALOG_THEMES.includes(key) ? key : 'aurora';
}

function normalizeHost(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return parsed.hostname.replace(/\.$/, '');
  } catch (_err) {
    return raw.split('/')[0].split(':')[0].replace(/\.$/, '');
  }
}

function normalizeSubdomain(value = '') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  if (slug.length < 3 || RESERVED_SUBDOMAINS.has(slug)) return '';
  return slug;
}

function normalizeDomain(value = '') {
  const host = normalizeHost(value);
  if (!host || host.length > 253) return '';
  if (host === 'localhost' || host.endsWith('.localhost')) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
  if (!/^[a-z0-9.-]+$/.test(host)) return '';
  if (!host.includes('.') || host.includes('..')) return '';
  return host;
}

function publicRootDomain() {
  return normalizeDomain(process.env.PUBLIC_SITE_ROOT_DOMAIN || '');
}

function adminHost() {
  return normalizeHost(process.env.ADMIN_APP_HOST || process.env.BASE_URL || '');
}

// The public catalog URL for an agency: its custom domain, else its platform
// subdomain, else the path-based catalog on the app host.
function publicUrlForAgency(agency) {
  if (agency.customDomain) return `https://${agency.customDomain}`;
  const root = publicRootDomain();
  if (agency.subdomain && root) return `https://${agency.subdomain}.${root}`;
  return `/s/${agency.subdomain || agency.id}`;
}

function publicAgencyPayload(agency) {
  return {
    id: agency.id,
    name: agency.name,
    subdomain: agency.subdomain || null,
    customDomain: agency.customDomain || null,
    websiteEnabled: Boolean(agency.websiteEnabled),
    catalogEnabled: Boolean(agency.features && agency.features.catalogSite === true),
    websiteTheme: normalizeTheme(agency.websiteTheme),
    websiteTitle: agency.websiteTitle || agency.name,
    websiteDescription: agency.websiteDescription || '',
    websiteLogoUrl: agency.websiteLogoUrl || '',
    websitePrimaryColor: agency.websitePrimaryColor || '#00A884',
    websiteHeroImageUrl: agency.websiteHeroImageUrl || '',
    websiteContactPhone: agency.websiteContactPhone || agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || agency.phone || '',
    websiteContactEmail: agency.websiteContactEmail || agency.email || '',
    websiteSocialLinks: agency.websiteSocialLinks || {},
    websiteSeoMeta: agency.websiteSeoMeta || {},
    websiteCustomCss: agency.websiteCustomCss || '',
    websitePublishedAt: agency.websitePublishedAt || null,
    publicUrl: publicUrlForAgency(agency),
  };
}

async function assertUniqueDomains(agencyId, values = {}) {
  const or = [];
  if (values.subdomain) or.push({ subdomain: values.subdomain });
  if (values.customDomain) or.push({ customDomain: values.customDomain });
  if (!or.length) return;

  const existing = await Agency.findOne({
    where: {
      id: { [Op.ne]: agencyId },
      [Op.or]: or,
    },
  });

  if (existing) {
    throw Object.assign(new Error('Website domain is already used by another agency'), {
      statusCode: 409,
      code: 'WEBSITE_DOMAIN_TAKEN',
    });
  }
}

async function updateWebsiteSettings(agencyId, updates = {}) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });

  const payload = {};
  if (updates.subdomain !== undefined) payload.subdomain = normalizeSubdomain(updates.subdomain) || null;
  if (updates.customDomain !== undefined) payload.customDomain = normalizeDomain(updates.customDomain) || null;

  const stringFields = [
    'websiteTheme',
    'websiteTitle',
    'websiteDescription',
    'websiteLogoUrl',
    'websitePrimaryColor',
    'websiteHeroImageUrl',
    'websiteContactPhone',
    'websiteContactEmail',
    'websiteCustomCss',
  ];

  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      const value = String(updates[field] || '').trim();
      payload[field] = value || null;
    }
  }

  // Keep the stored theme to the known preset set.
  if (payload.websiteTheme !== undefined) {
    payload.websiteTheme = normalizeTheme(payload.websiteTheme);
  }

  if (payload.websitePrimaryColor && !/^#[0-9a-f]{6}$/i.test(payload.websitePrimaryColor)) {
    payload.websitePrimaryColor = agency.websitePrimaryColor || '#00A884';
  }

  if (updates.websiteSocialLinks && typeof updates.websiteSocialLinks === 'object') {
    payload.websiteSocialLinks = updates.websiteSocialLinks;
  }
  if (updates.websiteSeoMeta && typeof updates.websiteSeoMeta === 'object') {
    payload.websiteSeoMeta = updates.websiteSeoMeta;
  }

  await assertUniqueDomains(agencyId, {
    subdomain: payload.subdomain,
    customDomain: payload.customDomain,
  });

  await agency.update(payload);
  return getWebsiteStatus(agencyId);
}

// Publish = flip the catalog live. No files are generated; the mini-site is live
// React reading the catalog API, reachable at /s/:agencyKey immediately and on
// the agency's own domain once DNS points at us.
async function generateWebsite(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  await agency.update({ websiteEnabled: true, websitePublishedAt: new Date() });
  return getWebsiteStatus(agencyId);
}

async function unpublishWebsite(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  await agency.update({ websiteEnabled: false });
  return getWebsiteStatus(agencyId);
}

async function getWebsiteStatus(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const data = publicAgencyPayload(agency);
  return {
    ...data,
    publicRootDomain: publicRootDomain() || null,
    adminHost: adminHost() || null,
    previewPath: publicUrlForAgency(agency),
  };
}

module.exports = {
  CATALOG_THEMES,
  normalizeTheme,
  normalizeHost,
  normalizeSubdomain,
  normalizeDomain,
  publicRootDomain,
  adminHost,
  publicUrlForAgency,
  publicAgencyPayload,
  updateWebsiteSettings,
  generateWebsite,
  unpublishWebsite,
  getWebsiteStatus,
};
