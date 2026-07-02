// FILE: /backend/src/services/appManifestService.ts
//
// Builds the per-tenant NAVIGATION MANIFEST consumed by the React Native mobile
// app (see docs/plans/2026-07-01-mobile-app-adaptive-navigation.md). The mobile
// shell is a *renderer* over this manifest: which tabs exist, which modules
// appear, what they are called, and which Home widgets show are all decided here
// from the agency's industry + enabled modules + the agent's role.
//
// This module is PURE (no DB, no req/res) so it is trivially unit-testable. The
// controller passes in plain objects resolved from `req.agency`, `req.agent`, and
// brandingService. It reuses the SAME module gating source of truth as the
// backend enforcement: `agency.sidebarPreferences` (see constants/modules.ts) and
// platformAdminService.MODULE_CATALOG.

const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Module registry: maps a sidebar module PATH (the gating unit stored in
// agency.sidebarPreferences / MODULE_CATALOG) to a mobile module KEY + hub group.
// The KEY is what the mobile registry (Doc 3 §3) renders. Some paths collapse to
// one mobile experience (e.g. /whatsapp -> the "inbox" engine).
// ---------------------------------------------------------------------------
const PATH_TO_MODULE = Object.freeze({
  '/leads': { key: 'leads', group: 'core' },
  '/follow-ups': { key: 'followUps', group: 'core' },
  '/bookings': { key: 'bookings', group: 'core' },
  '/quotations': { key: 'quotations', group: 'finance' },
  '/customers': { key: 'customers', group: 'core' },
  '/whatsapp': { key: 'inbox', group: 'core' },
  '/agents': { key: 'agents', group: 'team' },
  '/settings': { key: 'settings', group: 'settings' },
  '/properties': { key: 'properties', group: 'catalog' },
  '/itineraries': { key: 'itineraries', group: 'catalog' },
  '/packages': { key: 'packages', group: 'catalog' },
  '/cruises': { key: 'cruises', group: 'catalog' },
  '/visas': { key: 'visas', group: 'catalog' },
  '/services': { key: 'services', group: 'catalog' },
  '/vendors': { key: 'vendors', group: 'finance' },
  '/vendor-payments': { key: 'vendorPayments', group: 'finance' },
  '/accounts': { key: 'accounting', group: 'finance' },
  '/website-builder': { key: 'website', group: 'marketing' },
  '/hrm': { key: 'hrm', group: 'team' },
  '/analytics': { key: 'analytics', group: 'insights' },
  '/revenue': { key: 'revenue', group: 'insights' },
  '/templates': { key: 'templates', group: 'marketing' },
  '/flows': { key: 'flows', group: 'marketing' },
  '/campaigns': { key: 'campaigns', group: 'marketing' },
  '/ads': { key: 'ads', group: 'marketing' },
  '/social': { key: 'social', group: 'marketing' },
  '/reviews': { key: 'reviews', group: 'marketing' },
  // Settings sub-paths that may appear in sidebarPreferences roll up into settings.
  '/settings/vendor-types': { key: 'settings', group: 'settings' },
});

// The full set of module KEYS a fully-enabled tenant can have (derived once).
const ALL_MODULE_KEYS = Object.freeze(
  Array.from(new Set(Object.values(PATH_TO_MODULE).map((m) => m.key)))
);

// Default English label per module key. Industry profiles override a subset of
// these via `labels` (the vocabulary layer, Doc 3 §6).
const DEFAULT_LABELS = Object.freeze({
  home: 'Home',
  inbox: 'Inbox',
  bookings: 'Bookings',
  leads: 'Leads',
  followUps: 'Follow-ups',
  customers: 'Customers',
  quotations: 'Quotations',
  packages: 'Packages',
  itineraries: 'Itineraries',
  properties: 'Properties',
  cruises: 'Cruises',
  visas: 'Visas',
  services: 'Services',
  vendors: 'Vendors',
  vendorPayments: 'Vendor Payments',
  accounting: 'Accounting',
  payments: 'Payments',
  website: 'Website',
  hrm: 'HR & Payroll',
  agents: 'Users',
  analytics: 'Analytics',
  revenue: 'Revenue',
  templates: 'Templates',
  flows: 'Flows',
  campaigns: 'Campaigns',
  ads: 'Ads',
  social: 'Social',
  reviews: 'Reviews',
  settings: 'Settings',
  more: 'More',
});

// Modules an AGENT (non-admin) role does not see by default. ADMIN sees all
// enabled modules. This is a coarse default; finer control can later be derived
// from agent.permissions (already returned in the manifest for action-gating).
const OWNER_ONLY_KEYS = Object.freeze([
  'accounting', 'vendors', 'vendorPayments', 'hrm', 'agents',
  'analytics', 'revenue', 'website', 'settings',
]);

// Backfill order used only when a profile's default tabs don't yield 3 middle
// tabs (Doc 3 §5). First eligible + enabled keys win.
const TAB_BACKFILL_PRIORITY = Object.freeze([
  'inbox', 'bookings', 'leads', 'campaigns', 'customers',
  'payments', 'packages', 'analytics', 'accounting',
]);

// ---------------------------------------------------------------------------
// Industry profiles (Doc 3 §4). Keyed by the Agency.industry enum
// (TRAVEL | RESORT | CLEANING | LAUNDRY). `defaultTabs` are the DESIRED middle
// tabs (home/more are added automatically). `labels` are vocabulary overrides.
// `home.widgets` picks the dashboard composition. Everything here is data — add a
// vertical by adding an entry, no code change.
// ---------------------------------------------------------------------------
const INDUSTRY_PROFILES = Object.freeze({
  TRAVEL: {
    defaultTabs: ['inbox', 'bookings', 'leads'],
    labels: {},
    home: { widgets: ['newLeads', 'conversion', 'bookings', 'revenue', 'departures', 'attention'] },
  },
  RESORT: {
    defaultTabs: ['inbox', 'bookings', 'customers'],
    labels: { bookings: 'Reservations', customers: 'Guests', leads: 'Enquiries', followUps: 'Follow-ups' },
    home: { widgets: ['occupancy', 'revenue', 'todaysCheckins', 'attention'] },
  },
  CLEANING: {
    defaultTabs: ['inbox', 'bookings', 'agents'],
    labels: { bookings: 'Jobs', leads: 'Requests', customers: 'Clients', agents: 'Crew', followUps: 'Visits' },
    home: { widgets: ['todaysJobs', 'crewStatus', 'revenue', 'attention'] },
  },
  LAUNDRY: {
    defaultTabs: ['inbox', 'bookings', 'customers'],
    labels: { bookings: 'Orders', leads: 'Requests', customers: 'Clients', followUps: 'Pickups' },
    home: { widgets: ['todaysOrders', 'readyForDelivery', 'revenue', 'attention'] },
  },
});

const FALLBACK_INDUSTRY = 'TRAVEL';

function profileFor(industry) {
  const key = String(industry || FALLBACK_INDUSTRY).toUpperCase();
  return INDUSTRY_PROFILES[key] || INDUSTRY_PROFILES[FALLBACK_INDUSTRY];
}

/**
 * Resolve the set of enabled mobile module keys for an agency.
 *
 * Mirrors the gating rule in constants/modules.ts: an empty / missing
 * `sidebarPreferences` means NO restriction (full access), preserving backward
 * compatibility for existing tenants. An explicit list restricts to those paths.
 *
 * @param {unknown} sidebarPreferences - agency.sidebarPreferences (array of paths)
 * @returns {string[]} enabled module keys (deduped)
 */
function enabledModuleKeys(sidebarPreferences) {
  const noRestriction = !Array.isArray(sidebarPreferences) || sidebarPreferences.length === 0;
  if (noRestriction) return [...ALL_MODULE_KEYS];

  const keys = new Set();
  for (const path of sidebarPreferences) {
    const entry = PATH_TO_MODULE[path];
    if (entry) keys.add(entry.key);
  }
  // /whatsapp isn't always in an explicit list but the inbox is core to every
  // vertical; only include it when the tenant actually has messaging enabled.
  return Array.from(keys);
}

/**
 * Remove owner-only modules for AGENT role. ADMIN keeps everything.
 * @param {string[]} keys
 * @param {string} role - 'ADMIN' | 'AGENT'
 */
function applyRoleFilter(keys, role) {
  if (String(role || '').toUpperCase() === 'ADMIN') return keys;
  return keys.filter((k) => !OWNER_ONLY_KEYS.includes(k));
}

/**
 * Deterministic tab builder (Doc 3 §5): Home first, More last, up to 3 manifest
 * middle tabs, revoked/absent modules dropped, backfilled by priority.
 *
 * @param {object} profile - industry profile
 * @param {Set<string>} enabled - enabled module keys (post role filter)
 * @returns {string[]} ordered tab keys, length 3–5
 */
function buildTabs(profile, enabled) {
  const middle = [];
  const push = (k) => {
    if (k !== 'home' && k !== 'more' && enabled.has(k) && !middle.includes(k)) middle.push(k);
  };
  profile.defaultTabs.forEach(push);
  if (middle.length < 3) TAB_BACKFILL_PRIORITY.forEach(push);
  return ['home', ...middle.slice(0, 3), 'more'];
}

/**
 * Build the sparse label overrides for the enabled modules of this industry.
 * Only diffs from DEFAULT_LABELS are emitted (keeps the payload small).
 */
function buildLabels(profile, enabledSet) {
  const out = {};
  for (const [key, val] of Object.entries(profile.labels || {})) {
    if (enabledSet.has(key) && val && val !== DEFAULT_LABELS[key]) out[key] = val;
  }
  return out;
}

/**
 * Build the hub grouping: module keys grouped by their registry group, filtered
 * to the enabled set and excluding anything already shown as a tab.
 */
function buildHubGroups(enabledSet, tabKeys) {
  const groupsOrder = ['catalog', 'marketing', 'finance', 'insights', 'team', 'settings'];
  const grouped = {};
  for (const { key, group } of Object.values(PATH_TO_MODULE)) {
    if (!enabledSet.has(key)) continue;
    if (tabKeys.includes(key)) continue;
    if (!grouped[group]) grouped[group] = new Set();
    grouped[group].add(key);
  }
  return groupsOrder
    .filter((g) => grouped[g] && grouped[g].size)
    .map((g) => ({ group: g, modules: Array.from(grouped[g]) }));
}

/**
 * Build the full navigation manifest.
 *
 * @param {object} args
 * @param {object} args.agency - Sequelize Agency (plain or instance)
 * @param {object} args.agent  - Sequelize Agent  (plain or instance); the caller
 *                               excludes passwordHash
 * @param {object} args.branding - brandingService.brandingForAgency(agency) result
 * @returns {object} manifest matching Doc 3 §2
 */
function buildManifest({ agency, agent, branding }) {
  const a = typeof agency.get === 'function' ? agency.get({ plain: true }) : agency;
  const u = typeof agent.get === 'function' ? agent.get({ plain: true }) : agent;
  const b = branding || {};

  const industry = String(a.industry || FALLBACK_INDUSTRY).toUpperCase();
  const profile = profileFor(industry);
  const role = String(u.role || 'AGENT').toUpperCase();

  const tenantKeys = enabledModuleKeys(a.sidebarPreferences);
  const visibleKeys = applyRoleFilter(tenantKeys, role);
  // 'home' is always present; it is not a gated module.
  const modules = Array.from(new Set(['home', ...visibleKeys]));
  const enabledSet = new Set(modules);

  const tabs = buildTabs(profile, enabledSet);
  const labels = buildLabels(profile, enabledSet);
  const hubGroups = buildHubGroups(enabledSet, tabs);

  return {
    schemaVersion: SCHEMA_VERSION,
    tenant: {
      id: a.id,
      name: a.name || null,
      industry,
      plan: a.plan || null,
      currency: 'INR',
      logo: b.logoUrl || a.companyLogoUrl || null,
      accent: b.primaryColor || null,
      accentSecondary: b.accentColor || null,
      isWhiteLabel: Boolean(b.isWhiteLabel),
      partnerId: a.partnerId || null,
      brandName: b.brandName || a.name || null,
    },
    user: {
      id: u.id,
      name: u.name || null,
      email: u.email || null,
      role,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
    },
    modules,
    tabs,
    labels,
    hubGroups,
    home: { widgets: profile.home.widgets },
    flags: {
      canManageUsers: role === 'ADMIN',
    },
  };
}

module.exports = {
  SCHEMA_VERSION,
  PATH_TO_MODULE,
  ALL_MODULE_KEYS,
  DEFAULT_LABELS,
  INDUSTRY_PROFILES,
  OWNER_ONLY_KEYS,
  // exported for unit tests:
  enabledModuleKeys,
  applyRoleFilter,
  buildTabs,
  profileFor,
  buildManifest,
};
