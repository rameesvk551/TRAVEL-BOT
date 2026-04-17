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
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_MANAGE: 'payments.manage',
  ANALYTICS_VIEW: 'analytics.view',
  AGENCY_VIEW: 'agency.view',
  AGENCY_MANAGE: 'agency.manage',
};

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const DEFAULT_AGENT_PERMISSIONS = Object.freeze([
  PERMISSIONS.LEADS_VIEW,
  PERMISSIONS.LEADS_MANAGE,
  PERMISSIONS.BOOKINGS_VIEW,
  PERMISSIONS.MESSAGES_VIEW,
  PERMISSIONS.MESSAGES_SEND,
  PERMISSIONS.PACKAGES_VIEW,
  PERMISSIONS.PAYMENTS_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.AGENCY_VIEW,
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
