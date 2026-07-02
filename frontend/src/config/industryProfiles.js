// FILE: /frontend/src/config/industryProfiles.js
//
// Industry profiles drive ONLY the frontend presentation — labels, menu wording,
// and which modules are shown by default. The backend stays industry-agnostic:
// the same Booking / Customer / Lead / Service / Campaign engine serves every
// vertical. A tenant's `agency.industry` (default 'TRAVEL') selects a profile.
//
// To add a new industry: add one entry here. No backend changes required.
//
// `nav`    — overrides for sidebar item labels, keyed by route path.
// `terms`  — overrides for words used inside pages (singular/plural), keyed by
//            a semantic key. Pages read these via the useIndustry() `t()` helper.
// `modules`— route paths shown by default for this industry. `null` means "show
//            everything" (the travel baseline). This is only a default; an
//            explicit per-tenant `sidebarPreferences` still wins.

export const TRAVEL_INDUSTRY = 'TRAVEL';

export const INDUSTRY_PROFILES = {
  TRAVEL: {
    key: 'TRAVEL',
    label: 'Travel Company',
    tagline: 'Start managing your travel agency with WayOn.',
    // Baseline — no overrides, every module visible. Existing behaviour, untouched.
    nav: {},
    terms: {},
    modules: null,
  },

  RESORT: {
    key: 'RESORT',
    label: 'Resort / Hotel',
    tagline: 'Start managing your resort with WayOn.',
    nav: {
      '/bookings': 'Reservations',
      '/properties': 'Rooms',
      '/packages': 'Packages',
      '/itineraries': 'Stay Plans',
    },
    terms: {
      booking: 'Reservation',
      bookings: 'Reservations',
      property: 'Room',
      properties: 'Rooms',
      package: 'Package',
      packages: 'Packages',
      itinerary: 'Stay Plan',
      itineraries: 'Stay Plans',
    },
    modules: [
      '/', '/leads', '/follow-ups', '/bookings', '/customers', '/whatsapp',
      '/agents', '/settings',
      '/properties', '/packages', '/services', '/vendors', '/vendor-payments',
      '/accounts', '/website-builder', '/hrm', '/analytics', '/activity', '/revenue',
      '/templates', '/flows', '/campaigns', '/ads', '/social', '/reviews',
    ],
  },

  CLEANING: {
    key: 'CLEANING',
    label: 'Cleaning Company',
    tagline: 'Start managing your cleaning business with WayOn.',
    nav: {
      '/bookings': 'Jobs',
      '/leads': 'Enquiries',
      '/packages': 'Service Plans',
      '/services': 'Services',
    },
    terms: {
      booking: 'Job',
      bookings: 'Jobs',
      lead: 'Enquiry',
      leads: 'Enquiries',
      package: 'Service Plan',
      packages: 'Service Plans',
    },
    modules: [
      '/', '/leads', '/follow-ups', '/bookings', '/customers', '/whatsapp',
      '/agents', '/settings',
      '/packages', '/services', '/vendors', '/vendor-payments',
      '/accounts', '/website-builder', '/hrm', '/analytics', '/activity', '/revenue',
      '/templates', '/flows', '/campaigns', '/ads', '/social', '/reviews',
    ],
  },

  LAUNDRY: {
    key: 'LAUNDRY',
    label: 'Laundry Company',
    tagline: 'Start managing your laundry business with WayOn.',
    nav: {
      '/bookings': 'Orders',
      '/leads': 'Enquiries',
      '/packages': 'Plans',
      '/services': 'Services',
    },
    terms: {
      booking: 'Order',
      bookings: 'Orders',
      lead: 'Enquiry',
      leads: 'Enquiries',
      package: 'Plan',
      packages: 'Plans',
    },
    modules: [
      '/', '/leads', '/follow-ups', '/bookings', '/customers', '/whatsapp',
      '/agents', '/settings',
      '/packages', '/services', '/vendors', '/vendor-payments',
      '/accounts', '/website-builder', '/hrm', '/analytics', '/activity', '/revenue',
      '/templates', '/flows', '/campaigns', '/ads', '/social', '/reviews',
    ],
  },
};

// List used by the signup dropdown, in display order.
export const INDUSTRY_OPTIONS = Object.values(INDUSTRY_PROFILES).map((p) => ({
  value: p.key,
  label: p.label,
}));

/** Resolve an industry key to its profile, falling back to the travel baseline. */
export function getIndustryProfile(industry) {
  return INDUSTRY_PROFILES[industry] || INDUSTRY_PROFILES[TRAVEL_INDUSTRY];
}

/** Sidebar label for a route path under the given industry (falls back to default). */
export function navLabel(industry, path, fallback) {
  const profile = getIndustryProfile(industry);
  return profile.nav[path] || fallback;
}

/** Body term for a semantic key under the given industry (falls back to provided default). */
export function term(industry, key, fallback) {
  const profile = getIndustryProfile(industry);
  return profile.terms[key] || fallback;
}

/**
 * Whether a module path is shown by default for an industry.
 * `modules: null` (travel baseline) means everything is visible.
 */
export function industryModuleVisible(industry, path) {
  const profile = getIndustryProfile(industry);
  if (!Array.isArray(profile.modules)) return true;
  return profile.modules.includes(path);
}
