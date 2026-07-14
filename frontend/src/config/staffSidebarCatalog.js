const STAFF_SIDEBAR_GROUPS = [
  {
    key: 'core',
    title: 'Core',
    items: [
      { path: '/leads', label: 'Leads', permissionsAny: ['leads.view', 'leads.manage'] },
      { path: '/follow-ups', label: 'Follow-ups', permissionsAny: ['leads.view', 'leads.manage'] },
      { path: '/bookings', label: 'Bookings', permissionsAny: ['bookings.view', 'bookings.manage'] },
      { path: '/customers', label: 'Customers', permissionsAny: ['leads.view', 'leads.manage', 'bookings.view'] },
      { path: '/whatsapp', label: 'WhatsApp', permissionsAny: ['messages.view', 'messages.send'] },
      { path: '/missed-calls', label: 'Missed Calls', permissionsAny: ['leads.view', 'leads.manage'] },
      { path: '/agents', label: 'Users', permissionsAny: ['users.manage'] },
      { path: '/settings', label: 'Settings', permissionsAny: ['agency.view', 'agency.manage'] },
    ],
  },
  {
    key: 'workspace',
    title: 'Workspace',
    items: [
      { path: '/properties', label: 'Properties', permissionsAny: ['properties.view', 'properties.manage'] },
      { path: '/itineraries', label: 'Itineraries' },
      { path: '/packages', label: 'Packages', permissionsAny: ['packages.view', 'packages.manage'] },
      { path: '/cruises', label: 'Cruises', permissionsAny: ['cruises.view', 'cruises.manage'] },
      { path: '/visas', label: 'Visas', permissionsAny: ['visas.view', 'visas.manage'] },
      { path: '/services', label: 'Services', permissionsAny: ['services.view', 'services.manage'] },
      { path: '/vendors', label: 'Vendors', permissionsAny: ['accounts.view', 'accounts.manage', 'accounts.reports', 'accounts.reconcile'] },
      { path: '/vendor-payments', label: 'Vendor Payments', permissionsAny: ['accounts.view', 'accounts.manage', 'accounts.reports', 'accounts.reconcile'] },
      { path: '/accounts', label: 'Accounts', permissionsAny: ['accounts.view', 'accounts.manage', 'accounts.reports', 'accounts.reconcile'] },
      { path: '/website-builder', label: 'Website', permissionsAny: ['agency.view', 'agency.manage'] },
      { path: '/hrm', label: 'HR & Payroll', permissionsAny: ['hrm.view', 'hrm.manage'] },
      { path: '/analytics', label: 'Reports', permissionsAny: ['analytics.view'] },
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
];

export const STAFF_SIDEBAR_ITEMS = STAFF_SIDEBAR_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupKey: group.key, groupTitle: group.title })),
);

const STAFF_SIDEBAR_ITEM_MAP = new Map(
  STAFF_SIDEBAR_ITEMS.map((item) => [item.path, item]),
);

function hasAnyPermission(agent, permissionsAny = []) {
  if (!permissionsAny.length) return true;
  if (agent?.role === 'ADMIN') return true;
  const assigned = Array.isArray(agent?.permissions) ? agent.permissions : [];
  return permissionsAny.some((permission) => assigned.includes(permission));
}

export function canAgentAccessSidebarModule(agent, modulePath, options = {}) {
  const { ignoreExplicitPreferences = false } = options;
  if (!agent) return false;
  if (agent.role === 'ADMIN') return true;

  const item = STAFF_SIDEBAR_ITEM_MAP.get(modulePath);
  if (!item) return true;
  if (!hasAnyPermission(agent, item.permissionsAny)) return false;

  if (ignoreExplicitPreferences) return true;

  const explicitPrefs = Array.isArray(agent.sidebarPreferences) ? agent.sidebarPreferences : null;
  if (explicitPrefs === null) return true;
  return explicitPrefs.includes(modulePath);
}

export function defaultSidebarPreferencesForAgent(agent) {
  return STAFF_SIDEBAR_ITEMS
    .filter((item) => canAgentAccessSidebarModule(agent, item.path, { ignoreExplicitPreferences: true }))
    .map((item) => item.path);
}

export { STAFF_SIDEBAR_GROUPS };
