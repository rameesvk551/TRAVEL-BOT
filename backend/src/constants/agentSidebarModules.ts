const AGENT_SIDEBAR_GROUPS = Object.freeze([
  {
    key: 'core',
    title: 'Core',
    items: [
      { path: '/leads', label: 'Leads' },
      { path: '/follow-ups', label: 'Follow-ups' },
      { path: '/bookings', label: 'Bookings' },
      { path: '/customers', label: 'Customers' },
      { path: '/whatsapp', label: 'WhatsApp' },
      { path: '/missed-calls', label: 'Missed Calls' },
      { path: '/agents', label: 'Users' },
      { path: '/settings', label: 'Settings' },
    ],
  },
  {
    key: 'workspace',
    title: 'Workspace',
    items: [
      { path: '/properties', label: 'Properties' },
      { path: '/itineraries', label: 'Itineraries' },
      { path: '/packages', label: 'Packages' },
      { path: '/cruises', label: 'Cruises' },
      { path: '/visas', label: 'Visas' },
      { path: '/services', label: 'Services' },
      { path: '/vendors', label: 'Vendors' },
      { path: '/vendor-payments', label: 'Vendor Payments' },
      { path: '/accounts', label: 'Accounts' },
      { path: '/website-builder', label: 'Website' },
      { path: '/hrm', label: 'HR & Payroll' },
      { path: '/analytics', label: 'Reports' },
      { path: '/activity', label: 'Activity Log' },
    ],
  },
  {
    key: 'marketing',
    title: 'Marketing',
    items: [
      { path: '/templates', label: 'Templates' },
      { path: '/flows', label: 'Flows' },
      { path: '/campaigns', label: 'Campaigns' },
      { path: '/ads', label: 'Social Ads' },
      { path: '/social', label: 'Social Media' },
      { path: '/reviews', label: 'Reviews' },
    ],
  },
]);

const AGENT_SIDEBAR_PATHS = Object.freeze(
  AGENT_SIDEBAR_GROUPS.flatMap((group) => group.items.map((item) => item.path))
);

function normalizeAgentSidebarPreferences(input, fallback = null) {
  if (input === undefined) return fallback;
  if (input === null) return null;
  if (!Array.isArray(input)) return fallback;

  const allowed = new Set(AGENT_SIDEBAR_PATHS);
  const seen = new Set();
  return input
    .map((value) => String(value || '').trim())
    .filter((value) => allowed.has(value) && !seen.has(value) && seen.add(value));
}

module.exports = {
  AGENT_SIDEBAR_GROUPS,
  AGENT_SIDEBAR_PATHS,
  normalizeAgentSidebarPreferences,
};
