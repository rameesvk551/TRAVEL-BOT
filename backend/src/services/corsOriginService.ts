// FILE: /backend/src/services/corsOriginService.ts
// Decides which browser origins may make credentialed (cookie-bearing) requests
// to the authenticated dashboard API. The old policy allowed a single BASE_URL,
// which locked out every white-label partner host and broke their sessions.

const websiteBuilderService = require('./websiteBuilderService');

// Active partner custom domains are cached briefly so we don't hit the DB on
// every request / preflight. New partner domains become live within the TTL.
const CACHE_TTL_MS = 60 * 1000;
let cache = { hosts: new Set(), expires: 0 };

async function activePartnerHosts() {
  const now = Date.now();
  if (now < cache.expires) return cache.hosts;

  const hosts = new Set();
  try {
    const { Partner } = require('../models');
    const partners = await Partner.findAll({
      where: { isActive: true },
      attributes: ['customDomain'],
    });
    for (const p of partners) {
      const h = websiteBuilderService.normalizeHost(p.customDomain || '');
      if (h) hosts.add(h);
    }
    cache = { hosts, expires: now + CACHE_TTL_MS };
  } catch (_err) {
    // On a transient DB error, don't cache the empty set — fall back to the
    // static hosts only for this request and retry next time.
    return hosts;
  }
  return hosts;
}

function staticAllowedHosts() {
  const hosts = new Set();
  const admin = websiteBuilderService.adminHost();
  if (admin) hosts.add(admin);
  const base = websiteBuilderService.normalizeHost(process.env.BASE_URL || '');
  if (base) hosts.add(base);
  return hosts;
}

/**
 * True when `origin` (an Origin header value) may send credentialed requests.
 * A missing origin (same-origin navigations, server-to-server, curl) is allowed.
 */
async function isAllowedOrigin(origin) {
  if (!origin) return true;

  const host = websiteBuilderService.normalizeHost(origin);
  if (!host) return false;

  // Local dev hosts.
  if (process.env.NODE_ENV !== 'production' && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }

  // Platform admin host / BASE_URL.
  if (staticAllowedHosts().has(host)) return true;

  // Any subdomain of the public root domain (partner slug.<root> dashboards).
  const root = websiteBuilderService.publicRootDomain();
  if (root && (host === root || host.endsWith(`.${root}`))) return true;

  // Registered white-label partner custom domains.
  const partnerHosts = await activePartnerHosts();
  if (partnerHosts.has(host)) return true;

  return false;
}

module.exports = {
  isAllowedOrigin,
  // Test / admin hook to force a fresh partner-host lookup.
  _clearCache: () => {
    cache = { hosts: new Set(), expires: 0 };
  },
};
