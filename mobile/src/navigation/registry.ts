// FILE: mobile/src/navigation/registry.ts
// Module registry (Doc 3 §3). Maps every module key the app can render to its
// icon, default label, and hub group. The manifest decides which are active,
// and AppNavigator maps each key to its stack.
//
// One engine, many schemas: a resort does NOT get a separate `reservations`
// module — it gets `bookings` relabelled to "Reservations" by the vocabulary
// layer (see appManifestService INDUSTRY_PROFILES.labels + useLabel). So the
// keys here must be exactly the keys the manifest can emit. Adding a key the
// backend never sends is worse than useless: it can only ever resolve to a
// placeholder.

import {
  Home, MessageCircle, CalendarCheck, Users,
  Package, Building2, Ship, FileCheck, Wrench,
  Map, Megaphone, FileText, Share2, BarChart3,
  Globe, Star, Workflow, Zap, Gift,
  DollarSign, Receipt, Calculator, Store,
  PieChart, LineChart, Phone,
  UserCog, Building, Settings,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModuleGroup = 'core' | 'catalog' | 'marketing' | 'finance' | 'insights' | 'team' | 'settings';
export type EngineType = 'list' | 'chat' | 'dashboard' | 'form' | 'builder';

export interface ModuleDef {
  key: string;
  defaultLabel: string;
  icon: LucideIcon;
  group: ModuleGroup;
  engine?: EngineType;
}

// ---------------------------------------------------------------------------
// Registry — one entry per module the app knows how to render
// ---------------------------------------------------------------------------

export const MODULES: Record<string, ModuleDef> = {
  // Core (always or near-always present)
  home:          { key: 'home',          defaultLabel: 'Home',           icon: Home,           group: 'core',      engine: 'dashboard' },
  inbox:         { key: 'inbox',         defaultLabel: 'Inbox',          icon: MessageCircle,  group: 'core',      engine: 'chat' },
  // Renders as "Reservations" (resort), "Jobs" (cleaning), "Orders" (laundry)
  // via the manifest's label overrides — same engine, different vocabulary.
  bookings:      { key: 'bookings',      defaultLabel: 'Bookings',       icon: CalendarCheck,  group: 'core',      engine: 'list' },
  leads:         { key: 'leads',         defaultLabel: 'Leads',          icon: Users,          group: 'core',      engine: 'list' },
  followUps:     { key: 'followUps',     defaultLabel: 'Follow-ups',     icon: CalendarCheck,  group: 'core',      engine: 'list' },
  customers:     { key: 'customers',     defaultLabel: 'Customers',      icon: Users,          group: 'core',      engine: 'list' },

  // Catalog
  packages:      { key: 'packages',      defaultLabel: 'Packages',       icon: Package,        group: 'catalog',   engine: 'list' },
  properties:    { key: 'properties',    defaultLabel: 'Properties',     icon: Building2,      group: 'catalog',   engine: 'list' },
  cruises:       { key: 'cruises',       defaultLabel: 'Cruises',        icon: Ship,           group: 'catalog',   engine: 'list' },
  visas:         { key: 'visas',         defaultLabel: 'Visas',          icon: FileCheck,      group: 'catalog',   engine: 'list' },
  services:      { key: 'services',      defaultLabel: 'Services',       icon: Wrench,         group: 'catalog',   engine: 'list' },
  itineraries:   { key: 'itineraries',   defaultLabel: 'Itineraries',    icon: Map,            group: 'catalog',   engine: 'builder' },

  // Marketing
  campaigns:     { key: 'campaigns',     defaultLabel: 'Campaigns',      icon: Megaphone,      group: 'marketing', engine: 'list' },
  templates:     { key: 'templates',     defaultLabel: 'Templates',      icon: FileText,       group: 'marketing', engine: 'list' },
  social:        { key: 'social',        defaultLabel: 'Social',         icon: Share2,         group: 'marketing', engine: 'chat' },
  ads:           { key: 'ads',           defaultLabel: 'Ads',            icon: BarChart3,      group: 'marketing', engine: 'dashboard' },
  reviews:       { key: 'reviews',       defaultLabel: 'Reviews',        icon: Star,           group: 'marketing', engine: 'list' },
  flows:         { key: 'flows',         defaultLabel: 'Flows',          icon: Workflow,        group: 'marketing', engine: 'builder' },
  automations:   { key: 'automations',   defaultLabel: 'Automations',    icon: Zap,            group: 'marketing', engine: 'list' },
  referrals:     { key: 'referrals',     defaultLabel: 'Referrals',      icon: Gift,           group: 'marketing', engine: 'list' },
  website:       { key: 'website',       defaultLabel: 'Website',        icon: Globe,          group: 'marketing', engine: 'form' },

  // Finance
  payments:      { key: 'payments',      defaultLabel: 'Payments',       icon: DollarSign,     group: 'finance',   engine: 'list' },
  quotations:    { key: 'quotations',    defaultLabel: 'Quotations',     icon: Receipt,        group: 'finance',   engine: 'list' },
  accounting:    { key: 'accounting',    defaultLabel: 'Accounting',     icon: Calculator,     group: 'finance',   engine: 'dashboard' },
  vendors:       { key: 'vendors',       defaultLabel: 'Vendors',        icon: Store,          group: 'finance',   engine: 'list' },
  vendorPayments:{ key: 'vendorPayments',defaultLabel: 'Vendor Payments',icon: DollarSign,     group: 'finance',   engine: 'list' },

  // Insights
  analytics:     { key: 'analytics',     defaultLabel: 'Analytics',      icon: PieChart,       group: 'insights',  engine: 'dashboard' },
  revenue:       { key: 'revenue',       defaultLabel: 'Revenue',        icon: LineChart,       group: 'insights',  engine: 'dashboard' },
  crmReport:     { key: 'crmReport',     defaultLabel: 'CRM Report',     icon: BarChart3,      group: 'insights',  engine: 'dashboard' },
  callingReport: { key: 'callingReport', defaultLabel: 'Calling Report', icon: Phone,          group: 'insights',  engine: 'dashboard' },

  // Team
  hrm:           { key: 'hrm',           defaultLabel: 'HR & Payroll',   icon: UserCog,        group: 'team',      engine: 'dashboard' },
  agents:        { key: 'agents',        defaultLabel: 'Users',          icon: Building,       group: 'team',      engine: 'list' },

  // Settings
  settings:      { key: 'settings',      defaultLabel: 'Settings',       icon: Settings,       group: 'settings',  engine: 'form' },

  // Special — More hub itself is not in the registry (it's a fixed tab)
};

// ---------------------------------------------------------------------------
// Hub group display order and labels
// ---------------------------------------------------------------------------

export const HUB_GROUP_ORDER: ModuleGroup[] = [
  'catalog', 'marketing', 'finance', 'insights', 'team', 'settings',
];

export const HUB_GROUP_LABELS: Record<ModuleGroup, string> = {
  core: 'Core',
  catalog: 'Catalog',
  marketing: 'Marketing',
  finance: 'Finance',
  insights: 'Insights',
  team: 'Team',
  settings: 'Settings',
};
