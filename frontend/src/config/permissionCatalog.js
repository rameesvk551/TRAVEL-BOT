// FILE: /frontend/src/config/permissionCatalog.js
//
// Display metadata + role presets for the staff permission editor.
// The raw permission KEYS are the source of truth on the backend
// (see backend/src/constants/permissions.ts). This file only adds the
// human-facing grouping/labels and the preset bundles the API doesn't express.

/**
 * Grouped permission catalog. Each group renders as a labelled block of
 * checkboxes in the Add/Edit User modal.
 */
export const PERMISSION_GROUPS = [
  {
    key: 'leads',
    title: 'Leads',
    description: 'Enquiries and the sales pipeline.',
    items: [
      { key: 'leads.view', label: 'View' },
      { key: 'leads.manage', label: 'Manage' },
    ],
  },
  {
    key: 'bookings',
    title: 'Bookings',
    description: 'Confirmed trips and reservations.',
    items: [
      { key: 'bookings.view', label: 'View' },
      { key: 'bookings.manage', label: 'Manage' },
    ],
  },
  {
    key: 'messages',
    title: 'Messages',
    description: 'WhatsApp and other conversations.',
    items: [
      { key: 'messages.view', label: 'View' },
      { key: 'messages.send', label: 'Send' },
    ],
  },
  {
    key: 'packages',
    title: 'Packages',
    description: 'Tour packages catalog.',
    items: [
      { key: 'packages.view', label: 'View' },
      { key: 'packages.manage', label: 'Manage' },
    ],
  },
  {
    key: 'services',
    title: 'Services',
    description: 'Add-on and custom services.',
    items: [
      { key: 'services.view', label: 'View' },
      { key: 'services.manage', label: 'Manage' },
    ],
  },
  {
    key: 'properties',
    title: 'Properties',
    description: 'Hotels and staycation inventory.',
    items: [
      { key: 'properties.view', label: 'View' },
      { key: 'properties.manage', label: 'Manage' },
    ],
  },
  {
    key: 'cruises',
    title: 'Cruises',
    description: 'Cruise inventory.',
    items: [
      { key: 'cruises.view', label: 'View' },
      { key: 'cruises.manage', label: 'Manage' },
    ],
  },
  {
    key: 'visas',
    title: 'Visas',
    description: 'Visa services.',
    items: [
      { key: 'visas.view', label: 'View' },
      { key: 'visas.manage', label: 'Manage' },
    ],
  },
  {
    key: 'payments',
    title: 'Payments',
    description: 'Customer payments and collections.',
    items: [
      { key: 'payments.view', label: 'View' },
      { key: 'payments.manage', label: 'Manage' },
    ],
  },
  {
    key: 'accounts',
    title: 'Accounting',
    description: 'Ledgers, reports and reconciliation.',
    items: [
      { key: 'accounts.view', label: 'View' },
      { key: 'accounts.manage', label: 'Manage' },
      { key: 'accounts.reports', label: 'Reports' },
      { key: 'accounts.reconcile', label: 'Reconcile' },
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics',
    description: 'Dashboards and insights.',
    items: [
      { key: 'analytics.view', label: 'View' },
    ],
  },
  {
    key: 'hrm',
    title: 'HR / Team',
    description: 'Attendance and HR module.',
    items: [
      { key: 'hrm.view', label: 'View' },
      { key: 'hrm.manage', label: 'Manage' },
    ],
  },
  {
    key: 'agency',
    title: 'Agency Settings',
    description: 'Branding and agency configuration.',
    items: [
      { key: 'agency.view', label: 'View' },
      { key: 'agency.manage', label: 'Manage' },
    ],
  },
  {
    key: 'users',
    title: 'Staff & Permissions',
    description: 'Create staff and assign permissions. Grant with care.',
    items: [
      { key: 'users.manage', label: 'Manage' },
    ],
  },
];

/** Flat list of every known permission key, in catalog order. */
export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) =>
  group.items.map((item) => item.key),
);

const keysExcept = (excluded) => ALL_PERMISSION_KEYS.filter((key) => !excluded.includes(key));

/**
 * Named preset bundles. Selecting a preset fills the checkboxes; the admin
 * can then tweak any box, which flips the selection to "Custom".
 * Order matters — the first exact match wins when detecting the active preset.
 */
export const PERMISSION_PRESETS = [
  {
    key: 'sales_rep',
    label: 'Sales Rep',
    description: 'Works leads and quotes; read-only inventory.',
    permissions: [
      'leads.view', 'leads.manage',
      'bookings.view',
      'messages.view', 'messages.send',
      'packages.view', 'services.view', 'properties.view', 'cruises.view', 'visas.view',
      'analytics.view',
    ],
  },
  {
    key: 'reservations',
    label: 'Reservations',
    description: 'Closes bookings and takes payments.',
    permissions: [
      'leads.view', 'leads.manage',
      'bookings.view', 'bookings.manage',
      'messages.view', 'messages.send',
      'packages.view', 'services.view', 'properties.view', 'cruises.view', 'visas.view',
      'payments.view',
      'analytics.view',
    ],
  },
  {
    key: 'accountant',
    label: 'Accountant',
    description: 'Full finance access, no sales editing.',
    permissions: [
      'bookings.view',
      'payments.view', 'payments.manage',
      'accounts.view', 'accounts.manage', 'accounts.reports', 'accounts.reconcile',
      'analytics.view',
    ],
  },
  {
    key: 'manager',
    label: 'Manager',
    description: 'Everything except managing staff & permissions.',
    permissions: keysExcept(['users.manage']),
  },
];

/**
 * Given a set of permission keys, return the matching preset key, or 'custom'.
 * @param {string[]} permissions
 * @returns {string}
 */
export function detectPreset(permissions) {
  const set = new Set(permissions);
  const match = PERMISSION_PRESETS.find(
    (preset) =>
      preset.permissions.length === set.size &&
      preset.permissions.every((key) => set.has(key)),
  );
  return match ? match.key : 'custom';
}
