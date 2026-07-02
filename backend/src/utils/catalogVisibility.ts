// FILE: /backend/src/utils/catalogVisibility.js
// DEPS: -

// Mirrors the frontend sidebar visibility model (Sidebar.jsx + industryProfiles.js)
// so the public catalog API exposes exactly the resource types an agency shows in
// its own sidebar. Precedence: an explicit per-tenant `sidebarPreferences` wins;
// otherwise the industry default decides.

// Public catalog resource -> its sidebar route path.
const RESOURCE_PATH = {
  packages: '/packages',
  properties: '/properties',
  services: '/services',
  visas: '/visas',
  cruises: '/cruises',
};

// Industry defaults for catalog paths. `null` = show everything (TRAVEL baseline).
// Kept in sync with frontend/src/config/industryProfiles.js.
const INDUSTRY_CATALOG_DEFAULTS = {
  TRAVEL: null,
  RESORT: ['/properties', '/packages', '/services'],
  CLEANING: ['/packages', '/services'],
  LAUNDRY: ['/packages', '/services'],
};

/**
 * Whether a single catalog resource is publicly visible for an agency.
 * @param {object} agency - Agency instance ({ sidebarPreferences, industry })
 * @param {string} resource - one of: packages|properties|services|visas|cruises
 * @returns {boolean}
 */
function isCatalogResourceEnabled(agency, resource) {
  const path = RESOURCE_PATH[resource];
  if (!path) return false;

  const prefs = Array.isArray(agency?.sidebarPreferences) ? agency.sidebarPreferences : [];
  if (prefs.length) return prefs.includes(path);

  const defaults = INDUSTRY_CATALOG_DEFAULTS[agency?.industry];
  if (!Array.isArray(defaults)) return true; // null/unknown industry => all visible
  return defaults.includes(path);
}

/**
 * The list of catalog resources this agency exposes, in stable order.
 * @param {object} agency
 * @returns {string[]}
 */
function enabledCatalogResources(agency) {
  return Object.keys(RESOURCE_PATH).filter((resource) => isCatalogResourceEnabled(agency, resource));
}

module.exports = {
  RESOURCE_PATH,
  isCatalogResourceEnabled,
  enabledCatalogResources,
};
