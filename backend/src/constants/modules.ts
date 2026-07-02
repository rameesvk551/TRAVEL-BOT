// FILE: /backend/src/constants/modules.ts
//
// Backend counterpart to the frontend module gating. The platform admin portal
// stores a per-agency list of enabled sidebar module paths in
// `agency.sidebarPreferences` (see platformAdminService.MODULE_CATALOG). The
// frontend already hides nav items and guards routes for disabled modules; this
// file lets the BACKEND enforce the same restriction so disabled modules are
// truly inaccessible, not just hidden.
//
// MODULE_API_GRANTS maps an API route prefix to the sidebar module path(s) that
// grant access to it. A request to a guarded prefix is allowed when the agency
// has ANY of the granting modules enabled. Some APIs are shared by several
// modules (e.g. /api/messages backs both the WhatsApp inbox and campaign sends),
// so a prefix can be granted by more than one module — enabling any one of them
// is enough.
//
// IMPORTANT — backward compatibility: enforcement only applies when an agency has
// an EXPLICIT, non-empty `sidebarPreferences` list (the white-label / restricted
// case set from the admin portal). Agencies with no explicit preference keep full
// access, so every existing tenant is unaffected. Prefixes absent from this map
// (auth, agencies, agents, platform, branding, settings helpers, calls, public…)
// are always allowed.

const MODULE_API_GRANTS = Object.freeze({
  '/api/leads': ['/leads', '/follow-ups'],
  '/api/customers': ['/customers'],
  '/api/crm': ['/leads', '/follow-ups', '/customers'],
  '/api/bookings': ['/bookings'],
  '/api/quotations': ['/quotations'],
  '/api/packages': ['/packages'],
  '/api/payments': ['/bookings', '/accounts'],
  '/api/analytics': ['/analytics'],
  '/api/whatsapp': ['/whatsapp'],
  '/api/messages': ['/whatsapp', '/campaigns'],
  '/api/instagram': ['/social', '/flows'],
  '/api/ads': ['/ads'],
  '/api/properties': ['/properties'],
  '/api/cruises': ['/cruises'],
  '/api/visas': ['/visas'],
  '/api/services': ['/services'],
  '/api/itineraries': ['/itineraries', '/packages'],
  '/api/accounts': ['/accounts'],
  '/api/item-finance': ['/accounts', '/packages'],
  '/api/vendors': ['/vendors', '/vendor-payments'],
  '/api/hrm': ['/hrm'],
  '/api/templates': ['/templates', '/campaigns'],
  '/api/campaigns': ['/campaigns'],
  '/api/drips': ['/campaigns'],
  '/api/referrals': ['/campaigns', '/reviews'],
  '/api/reviews': ['/reviews'],
  '/api/flows': ['/flows'],
});

/**
 * Decide whether an agency may access a guarded API prefix.
 *
 * @param {unknown} sidebarPreferences - the agency's enabled module paths
 * @param {string} apiPrefix - one of the keys in MODULE_API_GRANTS
 * @returns {boolean} true if access is allowed
 */
function isApiPrefixAllowed(sidebarPreferences, apiPrefix) {
  // No explicit restriction => full access (default tenants unaffected).
  if (!Array.isArray(sidebarPreferences) || sidebarPreferences.length === 0) {
    return true;
  }

  const granting = MODULE_API_GRANTS[apiPrefix];
  // Unmapped prefix (core/settings/etc.) => always allowed.
  if (!granting) return true;

  return granting.some((modulePath) => sidebarPreferences.includes(modulePath));
}

module.exports = {
  MODULE_API_GRANTS,
  isApiPrefixAllowed,
};
