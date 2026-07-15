// Shared amenity/feature icon registry for the brochure builder.
//
// Each entry is { label, body } where `body` is the raw inner SVG markup —
// a string of <path>/<rect>/<circle> elements drawn on a 24x24 grid,
// stroke-based (no fill) and carrying NO stroke / stroke-width attributes on
// the inner elements. Stroke color and width are inherited from a parent
// <svg stroke=... stroke-width=...> at render time, so each icon recolors to
// its surrounding element's color.
//
// This file is a byte-for-byte content mirror of
// frontend/src/utils/brochureIcons.js — only the module syntax differs. The
// ICONS object contents MUST stay identical between the two files. The markup
// is developer-authored and never user input; it is consumed by the backend
// document renderer (emits `<svg ...>${ICONS[key].body}</svg>`) and the React
// editor canvas (dangerouslySetInnerHTML).

const ICONS = Object.freeze({
  pool: {
    label: 'Pool',
    body: "<path d='M2 16.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2'/><path d='M2 12.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2'/><path d='M8 12V6.2A2.2 2.2 0 0 1 12.4 6M15.6 12V6.2A2.2 2.2 0 0 1 20 6'/>",
  },
  kids: {
    label: 'Kids park',
    body: "<path d='M12 3.5 18 9l-6 5.5L6 9z'/><path d='M12 9.2v0'/><path d='M12 14.5v3l-2.2 3M12 17.5l2.2 3'/>",
  },
  games: {
    label: 'Indoor games',
    body: "<rect x='4' y='4' width='16' height='16' rx='3.4'/><circle cx='8.5' cy='8.5' r='1.1'/><circle cx='15.5' cy='8.5' r='1.1'/><circle cx='12' cy='12' r='1.1'/><circle cx='8.5' cy='15.5' r='1.1'/><circle cx='15.5' cy='15.5' r='1.1'/>",
  },
  dining: {
    label: 'Dining area',
    body: "<path d='M7 3v6.5a2 2 0 0 1-4 0V3M5 9.5V21'/><path d='M17.5 3c-1.4 0-2.4 2.2-2.4 5.2 0 2.2 1.3 3 2.4 3.2V21'/>",
  },
  parking: {
    label: 'Parking',
    body: "<rect x='4' y='4' width='16' height='16' rx='3.4'/><path d='M10 16.5V8h3.2a2.6 2.6 0 0 1 0 5.2H10'/>",
  },
  grill: {
    label: 'Grilling',
    body: "<path d='M5 9.5h14M6.5 9.5a5.5 5.5 0 0 0 11 0'/><path d='M9.5 15l-1.3 4M14.5 15l1.3 4M12 16v3'/><path d='M9 6c0-1.2 1-1.4 1-2.4M12 6c0-1.2 1-1.4 1-2.4M15 6c0-1.2 1-1.4 1-2.4'/>",
  },
  outdoor: {
    label: 'Outdoor games',
    body: "<circle cx='12' cy='12' r='8.5'/><path d='M3.6 12h16.8M12 3.5a8.5 8.5 0 0 0 0 17M6 6c3.4 2 8.6 2 12 0M6 18c3.4-2 8.6-2 12 0'/>",
  },
  party: {
    label: 'Party hall',
    body: "<path d='M12 2.6l1.9 5.4 5.5.2-4.4 3.4L16.6 17 12 13.9 7.4 17l1.6-5.4L4.6 8.2l5.5-.2z'/>",
  },
  ac: {
    label: 'AC rooms',
    body: "<path d='M12 2.5v19M12 2.5 9.7 4.8M12 2.5l2.3 2.3M12 21.5l-2.3-2.3M12 21.5l2.3-2.3M3.3 7.2 19.8 16.8M3.3 7.2l3.1.2M3.3 7.2l.2 3.1M20.7 16.8l-3.1-.2M20.7 16.8l-.2-3.1M20.7 7.2 4.2 16.8M20.7 7.2l-3.1.2M20.7 7.2l-.2 3.1M3.3 16.8l3.1-.2M3.3 16.8l.2-3.1'/>",
  },
  wifi: {
    label: 'Wi-Fi',
    body: "<path d='M4.5 9.5a11 11 0 0 1 15 0M7.2 12.6a7 7 0 0 1 9.6 0M9.9 15.7a3 3 0 0 1 4.2 0'/><circle cx='12' cy='19' r='0.6'/>",
  },
  bed: {
    label: 'Bedrooms',
    body: "<path d='M3 6v12M3 17h18v-4a3 3 0 0 0-3-3H3M3 10h6'/><path d='M6.5 10V8.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V10'/>",
  },
  bath: {
    label: 'Bathrooms',
    body: "<path d='M4 12V6.5A2.5 2.5 0 0 1 8.4 4.9M8 7.5h2.5'/><path d='M3 12h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z'/><path d='M6.5 18.5 5.5 21M17.5 18.5l1 2.5'/>",
  },
  spa: {
    label: 'Spa',
    body: "<path d='M12 21c0-4 0-8 3-11 2-2 5-2.5 6-2.5.5 3-.5 6-2.5 8C15.5 18 12 18 12 21z'/><path d='M12 21c0-4 0-8-3-11C7 8 4 7.5 3 7.5c-.5 3 .5 6 2.5 8C8.5 18 12 18 12 21z'/>",
  },
  gym: {
    label: 'Gym',
    body: "<path d='M3 8v8M6 6v12M18 6v12M21 8v8M6 12h12'/>",
  },
  view: {
    label: 'Scenic view',
    body: "<rect x='3' y='5' width='18' height='14' rx='2.4'/><path d='M3 16l4.5-4.5 3.5 3.5 4-4L21 15'/><circle cx='8.5' cy='9' r='1.4'/>",
  },
  pet: {
    label: 'Pet friendly',
    body: "<circle cx='7' cy='9' r='1.6'/><circle cx='12' cy='7' r='1.6'/><circle cx='17' cy='9' r='1.6'/><circle cx='19' cy='13.5' r='1.4'/><path d='M12 12c-2.4 0-4.4 1.8-4.9 4-.3 1.5.9 2.6 2.4 2.3l2.5-.5 2.5.5c1.5.3 2.7-.8 2.4-2.3-.5-2.2-2.5-4-4.9-4z'/>",
  },
  coffee: {
    label: 'Coffee',
    body: "<path d='M5 8h12v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z'/><path d='M17 9.5h1.8a2.2 2.2 0 0 1 0 4.4H17'/><path d='M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5'/>",
  },
  star: {
    label: 'Featured',
    body: "<path d='M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z'/>",
  },
});

const ICON_KEYS = Object.freeze(Object.keys(ICONS));
const DEFAULT_ICON = 'star';

module.exports = { ICONS, ICON_KEYS, DEFAULT_ICON };
