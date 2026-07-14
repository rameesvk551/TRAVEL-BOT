// FILE: /backend/src/services/brochureThemes.ts
//
// Built-in brochure decks and the auto-compose algorithm.
//
// A preset is just a template doc — pages of absolutely-positioned elements whose
// image elements carry a `slot` and whose text elements carry a `field`. Dropping
// photos onto it is `brochureDoc.fillDoc()`; there is no separate "preset" concept
// in the renderer. That means an agency's own saved design and a shipped theme are
// the same kind of object, which is what makes "Save as template" a copy.
//
// Auto-compose picks a page sequence sized to the number of photos uploaded, so 12
// images produce a tight deck and 30 produce a longer one, without empty slots.

const { PAGE_SIZES } = require('./brochureDoc');

const THEMES = Object.freeze({
  beach: {
    key: 'beach',
    name: 'Beach',
    heading: 'Anton',
    script: 'Yellowtail',
    body: 'Inter',
    primary: '#0e7490',
    ink: '#0f172a',
    paper: '#f8fafc',
    onDark: '#ffffff',
    coverOverlay: 'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.65) 100%)',
  },
  luxury: {
    key: 'luxury',
    name: 'Luxury',
    heading: 'Playfair Display',
    script: 'Yellowtail',
    body: 'Lora',
    primary: '#a16207',
    ink: '#1c1917',
    paper: '#fffbeb',
    onDark: '#ffffff',
    coverOverlay: 'linear-gradient(180deg, rgba(28,25,23,0.15) 0%, rgba(28,25,23,0.72) 100%)',
  },
  minimal: {
    key: 'minimal',
    name: 'Minimal',
    heading: 'Bebas Neue',
    script: 'Inter',
    body: 'Inter',
    primary: '#111827',
    ink: '#111827',
    paper: '#ffffff',
    onDark: '#ffffff',
    coverOverlay: 'linear-gradient(180deg, rgba(17,24,39,0.05) 0%, rgba(17,24,39,0.60) 100%)',
  },
});

let seq = 0;
const uid = (p) => `${p}${++seq}`;

// --- element factories -----------------------------------------------------

function img(slot, x, y, w, h, extra = {}) {
  return { id: uid('i'), type: 'image', slot, url: '', x, y, w, h, rotate: 0, z: 1, fit: 'cover', radius: 0, ...extra };
}

function txt(text, x, y, w, h, extra = {}) {
  return {
    id: uid('t'), type: 'text', text, field: '', x, y, w, h, rotate: 0, z: 5,
    font: 'Inter', size: 20, weight: 400, lineHeight: 1.35, letterSpacing: 0,
    color: '#111827', align: 'left', valign: 'top', uppercase: false, ...extra,
  };
}

function shape(x, y, w, h, extra = {}) {
  return { id: uid('s'), type: 'shape', shape: 'rect', x, y, w, h, rotate: 0, z: 2, fill: '#000', radius: 0, ...extra };
}

// --- page factories --------------------------------------------------------
// Each takes the theme, the page box, and an allocator that hands out slot names.

function coverPage(t, W, H, slot) {
  return {
    id: uid('p'),
    bg: { type: 'image', slot: slot(), url: '', overlay: t.coverOverlay, fit: 'cover' },
    elements: [
      shape(72, H - 300, 72, 6, { fill: t.onDark, z: 4 }),
      txt('PROPERTY NAME', 72, H - 264, W - 144, 110, {
        field: 'property_name', font: t.heading, size: 68, color: t.onDark,
        uppercase: true, letterSpacing: 1, lineHeight: 1.05, z: 5,
      }),
      txt('Your tagline here', 72, H - 148, W - 144, 60, {
        field: 'tagline', font: t.script, size: 36, color: t.onDark, z: 5,
      }),
    ],
  };
}

function aboutPage(t, W, H, slot) {
  const imgW = Math.round(W * 0.46);
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.paper },
    elements: [
      img(slot(), 0, 0, imgW, H),
      txt('ABOUT', imgW + 64, 96, 240, 44, {
        font: t.heading, size: 30, color: t.primary, uppercase: true, letterSpacing: 3, z: 5,
      }),
      txt('Location', imgW + 64, 146, W - imgW - 128, 40, {
        field: 'location', font: t.body, size: 18, color: t.primary, letterSpacing: 1, uppercase: true, z: 5,
      }),
      txt('Describe the property here.', imgW + 64, 208, W - imgW - 128, H - 340, {
        field: 'about', font: t.body, size: 19, color: t.ink, lineHeight: 1.75, z: 5,
      }),
    ],
  };
}

/** Two photos side by side. */
function duoPage(t, W, H, slot) {
  const pad = 48;
  const gap = 24;
  const w = (W - pad * 2 - gap) / 2;
  const h = H - pad * 2;
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.paper },
    elements: [
      img(slot(), pad, pad, w, h, { radius: 8 }),
      img(slot(), pad + w + gap, pad, w, h, { radius: 8 }),
    ],
  };
}

/** One hero photo left, two stacked right. */
function trioPage(t, W, H, slot) {
  const pad = 48;
  const gap = 24;
  const bigW = (W - pad * 2) * 0.58;
  const smallW = W - pad * 2 - bigW - gap;
  const h = H - pad * 2;
  const smallH = (h - gap) / 2;
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.paper },
    elements: [
      img(slot(), pad, pad, bigW, h, { radius: 8 }),
      img(slot(), pad + bigW + gap, pad, smallW, smallH, { radius: 8 }),
      img(slot(), pad + bigW + gap, pad + smallH + gap, smallW, smallH, { radius: 8 }),
    ],
  };
}

/** Four-photo grid. */
function quadPage(t, W, H, slot) {
  const pad = 48;
  const gap = 20;
  const w = (W - pad * 2 - gap) / 2;
  const h = (H - pad * 2 - gap) / 2;
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.paper },
    elements: [
      img(slot(), pad, pad, w, h, { radius: 8 }),
      img(slot(), pad + w + gap, pad, w, h, { radius: 8 }),
      img(slot(), pad, pad + h + gap, w, h, { radius: 8 }),
      img(slot(), pad + w + gap, pad + h + gap, w, h, { radius: 8 }),
    ],
  };
}

/** Single full-bleed photo with a caption plate. */
function heroPage(t, W, H, slot) {
  return {
    id: uid('p'),
    bg: { type: 'image', slot: slot(), url: '', overlay: '', fit: 'cover' },
    elements: [
      shape(0, H - 132, W, 132, { fill: 'rgba(0,0,0,0.45)', z: 2 }),
      txt('', 64, H - 104, W - 128, 60, {
        font: t.heading, size: 30, color: t.onDark, uppercase: true, letterSpacing: 2, valign: 'center', z: 5,
      }),
    ],
  };
}

function amenitiesPage(t, W, H, slot) {
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.paper },
    elements: [
      txt('AMENITIES', 72, 80, W - 144, 50, {
        font: t.heading, size: 34, color: t.primary, uppercase: true, letterSpacing: 3, z: 5,
      }),
      txt('Pool · Sea view · Breakfast included · Free Wi-Fi', 72, 148, (W - 176) / 2, H - 280, {
        field: 'amenities', font: t.body, size: 19, color: t.ink, lineHeight: 2, z: 5,
      }),
      // Right column runs to the same 72px margin as the left text column.
      img(slot(), W / 2 + 16, 148, W / 2 - 88, H - 220, { radius: 8 }),
      txt('From ₹0 / night', 72, H - 120, (W - 176) / 2, 56, {
        field: 'price', font: t.heading, size: 30, color: t.primary, z: 5,
      }),
    ],
  };
}

function contactPage(t, W, H, slot) {
  return {
    id: uid('p'),
    bg: {
      type: 'image', slot: slot(), url: '',
      overlay: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)', fit: 'cover',
    },
    elements: [
      txt('BOOK YOUR STAY', 72, H / 2 - 150, W - 144, 70, {
        font: t.heading, size: 46, color: t.onDark, uppercase: true, letterSpacing: 2, align: 'center', z: 5,
      }),
      txt('+91 00000 00000', 72, H / 2 - 60, W - 144, 44, {
        field: 'contact_phone', font: t.body, size: 24, color: t.onDark, align: 'center', z: 5,
      }),
      txt('hello@example.com', 72, H / 2 - 12, W - 144, 44, {
        field: 'contact_email', font: t.body, size: 24, color: t.onDark, align: 'center', z: 5,
      }),
      txt('www.example.com', 72, H / 2 + 36, W - 144, 44, {
        field: 'website', font: t.body, size: 20, color: t.onDark, align: 'center', z: 5,
      }),
      txt('', 72, H - 96, W - 144, 40, {
        field: 'agency_name', font: t.body, size: 15, color: t.onDark,
        align: 'center', uppercase: true, letterSpacing: 3, opacity: 0.85, z: 5,
      }),
    ],
  };
}

// --- auto-compose ----------------------------------------------------------

// Gallery pages, richest first. Auto-compose walks this cycle so a deck alternates
// rhythm (hero, trio, duo, quad) instead of repeating one grid.
const GALLERY_CYCLE = [
  { build: trioPage, cost: 3 },
  { build: duoPage, cost: 2 },
  { build: heroPage, cost: 1 },
  { build: quadPage, cost: 4 },
];

/**
 * Build a full deck sized to the photo count.
 *
 * Fixed pages (cover, about, amenities, contact) consume 4 photos; the rest flow
 * into gallery pages chosen from GALLERY_CYCLE, and the last page is trimmed to
 * whatever is left so the deck never ends with empty slots.
 *
 * @param {string} themeKey
 * @param {number} imageCount
 * @param {string} [sizeKey='landscape']
 * @returns {object} an unfilled template doc
 */
function buildDeck(themeKey, imageCount, sizeKey = 'landscape') {
  const t = THEMES[themeKey] || THEMES.beach;
  const size = PAGE_SIZES[sizeKey] || PAGE_SIZES.landscape;
  const { w: W, h: H } = size;

  let n = 0;
  const slot = () => `photo_${++n}`;

  const count = Math.max(1, Number(imageCount) || 1);
  const pages = [coverPage(t, W, H, slot)];

  // Reserve one photo each for about, amenities and contact when we have enough.
  const reserved = count >= 6 ? 3 : 0;
  let budget = Math.max(0, count - 1 - reserved);

  if (reserved) pages.push(aboutPage(t, W, H, slot));

  let i = 0;
  while (budget > 0) {
    const candidates = GALLERY_CYCLE.filter((c) => c.cost <= budget);
    if (!candidates.length) break;
    const pick = candidates[i % candidates.length];
    pages.push(pick.build(t, W, H, slot));
    budget -= pick.cost;
    i++;
  }

  if (reserved) {
    pages.push(amenitiesPage(t, W, H, slot));
    pages.push(contactPage(t, W, H, slot));
  }

  return {
    size: sizeKey,
    pageW: W,
    pageH: H,
    theme: { primary: t.primary, fontHeading: t.heading, fontBody: t.body },
    pages,
  };
}

/** A single blank page, for "start from scratch". */
function blankDeck(sizeKey = 'landscape') {
  const size = PAGE_SIZES[sizeKey] || PAGE_SIZES.landscape;
  return {
    size: sizeKey,
    pageW: size.w,
    pageH: size.h,
    theme: { primary: '#0e7490', fontHeading: 'Anton', fontBody: 'Inter' },
    pages: [{ id: uid('p'), bg: { type: 'color', color: '#ffffff' }, elements: [] }],
  };
}

/** Theme list for the "new brochure" picker. */
function listThemes() {
  return Object.values(THEMES).map((t) => ({ key: t.key, name: t.name, primary: t.primary }));
}

module.exports = { THEMES, buildDeck, blankDeck, listThemes };
