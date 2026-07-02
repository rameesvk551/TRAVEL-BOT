const PERMISSIONS = {
  USERS_MANAGE: 'users.manage',
  LEADS_VIEW: 'leads.view',
  LEADS_MANAGE: 'leads.manage',
  BOOKINGS_VIEW: 'bookings.view',
  BOOKINGS_MANAGE: 'bookings.manage',
  MESSAGES_VIEW: 'messages.view',
  MESSAGES_SEND: 'messages.send',
  PACKAGES_VIEW: 'packages.view',
  PACKAGES_MANAGE: 'packages.manage',
  SERVICES_VIEW: 'services.view',
  SERVICES_MANAGE: 'services.manage',
  PROPERTIES_VIEW: 'properties.view',
  PROPERTIES_MANAGE: 'properties.manage',
  CRUISES_VIEW: 'cruises.view',
  CRUISES_MANAGE: 'cruises.manage',
  VISAS_VIEW: 'visas.view',
  VISAS_MANAGE: 'visas.manage',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_MANAGE: 'payments.manage',
  ACCOUNTS_VIEW: 'accounts.view',
  ACCOUNTS_MANAGE: 'accounts.manage',
  ACCOUNTS_REPORTS: 'accounts.reports',
  ACCOUNTS_RECONCILE: 'accounts.reconcile',
  ANALYTICS_VIEW: 'analytics.view',
  AGENCY_VIEW: 'agency.view',
  AGENCY_MANAGE: 'agency.manage',
  HRM_VIEW: 'hrm.view',
  HRM_MANAGE: 'hrm.manage',
};

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const DEFAULT_AGENT_PERMISSIONS = Object.freeze([
  PERMISSIONS.LEADS_VIEW,
  PERMISSIONS.LEADS_MANAGE,
  PERMISSIONS.BOOKINGS_VIEW,
  PERMISSIONS.MESSAGES_VIEW,
  PERMISSIONS.MESSAGES_SEND,
  PERMISSIONS.PACKAGES_VIEW,
  PERMISSIONS.SERVICES_VIEW,
  PERMISSIONS.PROPERTIES_VIEW,
  PERMISSIONS.CRUISES_VIEW,
  PERMISSIONS.VISAS_VIEW,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.AGENCY_VIEW,
  PERMISSIONS.HRM_VIEW,
]);

function normalizePermissions(input, fallback = []) {
  if (!Array.isArray(input)) {
    return [...fallback];
  }

  const unique = [...new Set(input.map((value) => String(value).trim()).filter(Boolean))];
  return unique.filter((permission) => ALL_PERMISSIONS.includes(permission));
}

module.exports = {
  PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_AGENT_PERMISSIONS,
  normalizePermissions,
};
