// FILE: /backend/src/services/brochureThemes.ts
//
// The built-in brochure decks and the auto-compose algorithm.
//
// A preset is just a template doc — pages of absolutely-positioned elements whose image
// elements carry a `slot` (filled from the uploaded photos, in order) or a `field` (the
// logo), and whose text elements carry a `field` (merge fields). Applying a preset is
// brochureDoc.fillDoc(); the renderer knows nothing about "presets". That is why an
// agency's own saved design and a shipped theme are the same kind of object.
//
// The three brochure palettes and the page anatomy are ported from the hand-built
// reference decks in C:\Users\ACER\www\Dunecastle (Dark Luxury / Bright Airy / Warm
// Earthy + the 1/2/3-per-page galleries). Those are authored in mm on A4, so the layout
// kit works in mm and converts once, at the edge — see brochureDoc.mm().
//
// Everything a preset emits is an ordinary element: the user can move, resize, restyle
// or delete any of it. Presets are a starting point, not a constraint.

const { mm, pt, PAGE_SIZES } = require('./brochureDoc');

// --- palettes --------------------------------------------------------------

const THEMES = Object.freeze({
  luxury: {
    key: 'luxury',
    name: 'Dark Luxury',
    bg: '#0e1512',
    panel: '#16241d',
    ink: '#f3eee3',
    inkSoft: '#c3bdae',
    inkMute: '#8f8a7c',
    accent: '#c9a86a',
    accent2: '#e2cf9f',
    display: 'Cormorant Garamond',
    body: 'Jost',
    radius: 2,
    tileBorder: 1,
    tileBorderColor: 'rgba(201,168,106,0.30)',
    logoRing: 1.5,
    onImage: '#ffffff',
    coverVeil: 'linear-gradient(180deg, rgba(8,14,11,0.55) 0%, rgba(8,14,11,0.15) 40%, rgba(8,14,11,0.75) 100%)',
    contactVeil: 'linear-gradient(120deg, rgba(8,14,11,0.90) 0%, rgba(8,14,11,0.55) 60%, rgba(8,14,11,0.35) 100%)',
    italicNumerals: true,
  },
  airy: {
    key: 'airy',
    name: 'Bright & Airy',
    bg: '#f6f2ea',
    panel: '#ffffff',
    ink: '#26302a',
    inkSoft: '#55604f',
    inkMute: '#8b917f',
    accent: '#6f7d5c',
    accent2: '#8a9a72',
    display: 'Fraunces',
    body: 'Mulish',
    radius: 9,
    tileBorder: 0,
    tileBorderColor: 'transparent',
    logoRing: 0,
    onImage: '#ffffff',
    coverVeil: 'linear-gradient(180deg, rgba(20,26,20,0.35) 0%, rgba(20,26,20,0.10) 42%, rgba(20,26,20,0.62) 100%)',
    contactVeil: 'linear-gradient(120deg, rgba(28,36,28,0.82) 0%, rgba(28,36,28,0.45) 60%, rgba(28,36,28,0.30) 100%)',
    italicNumerals: false,
  },
  earthy: {
    key: 'earthy',
    name: 'Warm Earthy',
    bg: '#eee4d1',
    panel: '#f5eede',
    ink: '#34372a',
    inkSoft: '#5d5645',
    inkMute: '#8b8069',
    accent: '#b0592f',
    accent2: '#c47b4e',
    display: 'Marcellus',
    body: 'Karla',
    radius: 14,
    tileBorder: 0,
    tileBorderColor: 'transparent',
    logoRing: 0,
    onImage: '#ffffff',
    coverVeil: 'linear-gradient(180deg, rgba(48,32,18,0.42) 0%, rgba(48,32,18,0.12) 42%, rgba(48,32,18,0.70) 100%)',
    contactVeil: 'linear-gradient(120deg, rgba(48,32,18,0.86) 0%, rgba(48,32,18,0.50) 60%, rgba(48,32,18,0.32) 100%)',
    italicNumerals: false,
  },
  coastal: {
    key: 'coastal',
    name: 'Coastal',
    bg: '#f8fafc',
    panel: '#ffffff',
    ink: '#0f172a',
    inkSoft: '#334155',
    inkMute: '#64748b',
    accent: '#0e7490',
    accent2: '#22a3bd',
    display: 'Playfair Display',
    body: 'Inter',
    radius: 8,
    tileBorder: 0,
    tileBorderColor: 'transparent',
    logoRing: 0,
    onImage: '#ffffff',
    coverVeil: 'linear-gradient(180deg, rgba(2,20,28,0.35) 0%, rgba(2,20,28,0.10) 40%, rgba(2,20,28,0.70) 100%)',
    contactVeil: 'linear-gradient(120deg, rgba(2,20,28,0.85) 0%, rgba(2,20,28,0.50) 60%, rgba(2,20,28,0.30) 100%)',
    italicNumerals: false,
  },
  mono: {
    key: 'mono',
    name: 'Minimal Mono',
    bg: '#ffffff',
    panel: '#f5f5f5',
    ink: '#111111',
    inkSoft: '#404040',
    inkMute: '#8a8a8a',
    accent: '#111111',
    accent2: '#555555',
    display: 'Bebas Neue',
    body: 'Inter',
    radius: 0,
    tileBorder: 0,
    tileBorderColor: 'transparent',
    logoRing: 0,
    onImage: '#ffffff',
    coverVeil: 'linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.62) 100%)',
    contactVeil: 'linear-gradient(120deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.35) 100%)',
    italicNumerals: false,
  },
});

/**
 * The subset of a theme that is stored on the document.
 *
 * It is stored WHOLE rather than as a single accent, because brochureDoc.retheme()
 * recolours a deck by swapping old palette values for new ones across every element.
 * Without the original values on the doc, there would be nothing to swap *from*, and a
 * colour change could only apply to new pages.
 */
function paletteOf(t) {
  return {
    bg: t.bg,
    panel: t.panel,
    ink: t.ink,
    inkSoft: t.inkSoft,
    inkMute: t.inkMute,
    accent: t.accent,
    accent2: t.accent2,
    fontHeading: t.display,
    fontBody: t.body,
  };
}

// --- element factories -----------------------------------------------------

let seq = 0;
const uid = (p) => `${p}${(seq += 1)}`;

function img(slot, x, y, w, h, extra = {}) {
  return {
    id: uid('i'), type: 'image', slot, field: '', url: '',
    x, y, w, h, rotate: 0, z: 2, opacity: 1, locked: false,
    fit: 'cover', radius: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderWidth: 0, borderColor: '#000000', background: '',
    ...extra,
  };
}

function txt(text, x, y, w, h, extra = {}) {
  return {
    id: uid('t'), type: 'text', text, field: '',
    x, y, w, h, rotate: 0, z: 5, opacity: 1, locked: false,
    font: 'Jost', size: 14, weight: 400, lineHeight: 1.4, letterSpacing: 0,
    color: '#111111', align: 'left', valign: 'top', uppercase: false, italic: false,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderWidth: 0, borderColor: '#000000', background: '', radius: 0,
    ...extra,
  };
}

function shape(x, y, w, h, extra = {}) {
  return {
    id: uid('s'), type: 'shape', shape: 'rect',
    x, y, w, h, rotate: 0, z: 3, opacity: 1, locked: false,
    fill: '#000000', stroke: '', strokeWidth: 0, radius: 0,
    ...extra,
  };
}

/** The logo badge: a field-bound image, circular and ringed in the Dark Luxury deck. */
function logo(t, x, y, size) {
  return img('', x, y, size, size, {
    field: 'logo',
    fit: 'contain',
    radius: t.logoRing ? 9999 : 0,
    borderWidth: t.logoRing,
    borderColor: t.accent,
    padding: t.logoRing
      ? { top: size * 0.19, right: size * 0.19, bottom: size * 0.19, left: size * 0.19 }
      : { top: 0, right: 0, bottom: 0, left: 0 },
    z: 6,
  });
}

// --- the A4 layout kit -----------------------------------------------------
// Geometry ported from the reference decks: 18mm side gutters, 19mm top/bottom.

const GUTTER_X = mm(18);
const GUTTER_Y = mm(19);
const GAP = mm(6);

function box(W, H) {
  return {
    x: GUTTER_X,
    y: GUTTER_Y,
    w: W - GUTTER_X * 2,
    h: H - GUTTER_Y * 2,
    right: W - GUTTER_X,
    bottom: H - GUTTER_Y,
  };
}

/** Running header + footer. Present on every interior page of the reference decks. */
function chrome(t, W, H, pageNo, tail) {
  const b = box(W, H);
  return [
    txt('Property', b.x, mm(10), b.w * 0.5, mm(7), {
      field: 'property_name', font: t.display, size: pt(13), color: t.ink,
      letterSpacing: 2, uppercase: true, z: 8,
    }),
    txt('Location', b.x + b.w * 0.5, mm(10.6), b.w * 0.5, mm(6), {
      field: 'location', font: t.body, size: pt(7.5), color: t.inkMute,
      letterSpacing: 4, uppercase: true, align: 'right', z: 8,
    }),
    txt('', b.x, H - mm(15), b.w * 0.5, mm(6), {
      field: 'agency_name', font: t.body, size: pt(7.5), color: t.inkMute,
      letterSpacing: 3, uppercase: true, z: 8,
    }),
    txt(`${String(pageNo).padStart(2, '0')}  /  ${tail}`, b.x + b.w * 0.5, H - mm(15), b.w * 0.5, mm(6), {
      font: t.body, size: pt(7.5), color: t.inkMute,
      letterSpacing: 3, uppercase: true, align: 'right', z: 8,
    }),
  ];
}

/** Eyebrow + big section title + roman numeral, the interior-page masthead. */
function sectionHead(t, W, eyebrow, title, numeral) {
  const b = box(W, 0);
  return [
    txt(eyebrow, b.x, mm(26), b.w * 0.7, mm(6), {
      font: t.body, size: pt(8.5), weight: 500, color: t.accent,
      letterSpacing: 5, uppercase: true, z: 5,
    }),
    txt(title, b.x, mm(33), b.w * 0.7, mm(20), {
      font: t.display, size: pt(34), lineHeight: 1, color: t.ink, letterSpacing: -0.5, z: 5,
    }),
    txt(numeral, b.x + b.w * 0.7, mm(33), b.w * 0.3, mm(12), {
      font: t.display, size: pt(15), color: t.accent, align: 'right',
      italic: !!t.italicNumerals, z: 5,
    }),
  ];
}

function tile(t, slot, x, y, w, h) {
  return img(slot, x, y, w, h, {
    radius: t.radius,
    borderWidth: t.tileBorder,
    borderColor: t.tileBorderColor,
    background: t.panel,
  });
}

/**
 * An n-column grid of tiles, vertically centred in the content area.
 *
 * The reference decks use aspect-ratio 1/1, which only fits because they are portrait
 * A4. Squares are the PREFERENCE, not a rule: on a landscape or square page a square
 * tile is taller than the space left after the header, and the bottom row runs off the
 * page. So the height is capped by what is actually available.
 */
function tileGrid(t, W, H, slot, cols, rows, top) {
  const b = box(W, H);
  const gap = cols >= 3 ? mm(5) : GAP;
  const w = Math.round((b.w - gap * (cols - 1)) / cols);

  const available = b.bottom - top - mm(6);
  const maxH = Math.floor((available - gap * (rows - 1)) / rows);
  const h = Math.max(mm(20), Math.min(w, maxH));

  const gridH = rows * h + (rows - 1) * gap;
  const y0 = top + Math.max(0, Math.round((available - gridH) / 2));

  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      out.push(tile(t, slot(), b.x + c * (w + gap), y0 + r * (h + gap), w, h));
    }
  }
  return out;
}

// --- pages -----------------------------------------------------------------

function coverPage(t, W, H, slot) {
  const cx = W / 2;
  return {
    id: uid('p'),
    bg: { type: 'image', slot: slot(), url: '', overlay: t.coverVeil, fit: 'cover' },
    elements: [
      // Inset hairline frame — the signature of all three reference covers.
      shape(mm(9), mm(9), W - mm(18), H - mm(18), {
        fill: 'transparent', stroke: 'rgba(255,255,255,0.40)', strokeWidth: 1, z: 4,
      }),
      logo(t, cx - mm(11), H * 0.5 - mm(52), mm(22)),
      txt('Location', 0, H * 0.5 - mm(24), W, mm(7), {
        field: 'location', font: t.body, size: pt(9), weight: 500, color: t.onImage,
        letterSpacing: 6, uppercase: true, align: 'center', z: 6,
      }),
      txt('Property Name', 0, H * 0.5 - mm(16), W, mm(28), {
        field: 'property_name', font: t.display, size: pt(60), lineHeight: 0.92,
        color: t.onImage, align: 'center', z: 6,
      }),
      txt('Your tagline', 0, H * 0.5 + mm(14), W, mm(10), {
        field: 'tagline', font: t.display, size: pt(17), italic: true,
        color: 'rgba(255,255,255,0.92)', align: 'center', z: 6,
      }),
      txt('', 0, H - mm(21), W, mm(7), {
        field: 'amenities', font: t.body, size: pt(8), color: 'rgba(255,255,255,0.85)',
        letterSpacing: 4, uppercase: true, align: 'center', lineHeight: 1, z: 6,
      }),
    ],
  };
}

/**
 * Intro: a lead paragraph, two tiles and a four-column stat strip.
 *
 * The whole block is vertically centred in the content area (the reference page uses
 * `justify-content:center`), rather than stacked from the top — laid out top-down it
 * leaves a dead band above the footer that reads as a mistake.
 */
function introPage(t, W, H, slot, pageNo) {
  const b = box(W, H);
  const safeTop = b.y + mm(12); // clear of the running header
  const safeBottom = b.bottom - mm(10); // clear of the running footer

  const leadH = mm(46);
  const tileW = Math.round((b.w - GAP) / 2);
  const statsH = mm(24);

  // The tiles absorb the slack, so the block fits any page shape. Without this the
  // fixed-height version overflows a landscape page by ~200px.
  const chromeH = mm(7) + mm(4) + leadH + mm(14) + mm(11) + mm(9) + statsH;
  const slack = (safeBottom - safeTop) - chromeH;
  const tileH = Math.max(mm(40), Math.min(Math.round(tileW * 0.78), slack));

  const blockH = chromeH + tileH;
  const top = safeTop + Math.max(0, Math.round(((safeBottom - safeTop) - blockH) / 2));

  const eyebrowY = top;
  const leadY = eyebrowY + mm(11);
  const tileY = leadY + leadH + mm(14);
  const ruleY = tileY + tileH + mm(11);
  const statsY = ruleY + mm(9);

  const statW = Math.round(b.w / 4);
  const numbers = ['06', '50', '01', '09'];
  const labels = ['Stay Categories', 'Max Guests', 'Infinity Pool', 'Amenities'];
  const stats = [];
  numbers.forEach((n, i) => {
    stats.push(txt(n, b.x + i * statW, statsY, statW - mm(4), mm(13), {
      font: t.display, size: pt(31), lineHeight: 1, color: t.accent2, z: 5,
    }));
    stats.push(txt(labels[i], b.x + i * statW, statsY + mm(14), statW - mm(4), mm(8), {
      font: t.body, size: pt(7.5), color: t.inkMute, letterSpacing: 3, uppercase: true, z: 5,
    }));
  });

  return {
    id: uid('p'),
    bg: { type: 'color', color: t.bg },
    elements: [
      ...chrome(t, W, H, pageNo, 'The property'),
      // A static eyebrow, NOT the location: the running header already carries the
      // location, and repeating it here reads as a bug rather than a flourish.
      txt('The Property', b.x, eyebrowY, b.w, mm(7), {
        font: t.body, size: pt(8.5), weight: 500, color: t.accent,
        letterSpacing: 5, uppercase: true, z: 5,
      }),
      txt('Describe the property here.', b.x, leadY, b.w - mm(10), leadH, {
        field: 'about', font: t.display, size: pt(19), lineHeight: 1.45, color: t.inkSoft, z: 5,
      }),
      tile(t, slot(), b.x, tileY, tileW, tileH),
      tile(t, slot(), b.x + tileW + GAP, tileY, tileW, tileH),
      shape(b.x, ruleY, b.w, 1, { fill: t.accent, opacity: 0.42, z: 4 }),
      ...stats,
    ],
  };
}

function galleryPage(t, W, H, slot, pageNo, cols, rows, eyebrow, title, numeral) {
  return {
    id: uid('p'),
    bg: { type: 'color', color: t.bg },
    elements: [
      ...chrome(t, W, H, pageNo, title),
      ...sectionHead(t, W, eyebrow, title, numeral),
      ...tileGrid(t, W, H, slot, cols, rows, mm(58)),
    ],
  };
}

/**
 * Rooms. Stacked photo-left / name-right rows on a tall page, as in "Stays & Suites";
 * on a wide page the same rows become columns, because three stacked 52mm rows simply
 * do not fit inside a landscape A4 and would run off the bottom.
 */
function roomsPage(t, W, H, slot, pageNo, count, withHead) {
  const b = box(W, H);
  const top = withHead ? mm(62) : mm(30);
  const avail = b.bottom - top - mm(6);
  const wide = W > H;

  const rows = [];

  if (wide) {
    const gap = GAP;
    const colW = Math.round((b.w - gap * (count - 1)) / count);
    const ph = Math.min(Math.round(colW * 0.72), avail - mm(26));

    for (let i = 0; i < count; i += 1) {
      const x = b.x + i * (colW + gap);
      rows.push(tile(t, slot(), x, top, colW, ph));
      rows.push(txt(String(i + 1).padStart(2, '0'), x, top + ph + mm(4), colW, mm(6), {
        font: t.display, size: pt(12), color: t.accent, italic: !!t.italicNumerals, z: 5,
      }));
      rows.push(txt('Room type', x, top + ph + mm(10), colW, mm(10), {
        font: t.display, size: pt(19), lineHeight: 1.05, color: t.ink, z: 5,
      }));
      rows.push(txt('Sleeps · Ensuite · View', x, top + ph + mm(20), colW, mm(7), {
        font: t.body, size: pt(7.5), color: t.inkMute, letterSpacing: 2, uppercase: true, z: 5,
      }));
    }
  } else {
    const rowGap = mm(10);
    const ph = Math.min(mm(52), Math.floor((avail - rowGap * (count - 1)) / count));

    for (let i = 0; i < count; i += 1) {
      const y = top + i * (ph + rowGap);
      const tx = b.x + ph + mm(11);
      rows.push(tile(t, slot(), b.x, y, ph, ph));
      rows.push(txt(String(i + 1).padStart(2, '0'), tx, y + mm(8), mm(20), mm(7), {
        font: t.display, size: pt(14), color: t.accent, italic: !!t.italicNumerals, z: 5,
      }));
      rows.push(txt('Room type', tx, y + mm(16), b.right - tx, mm(12), {
        font: t.display, size: pt(25), lineHeight: 1.02, color: t.ink, z: 5,
      }));
      rows.push(txt('Sleeps · Ensuite · View', tx, y + mm(30), b.right - tx, mm(8), {
        font: t.body, size: pt(8), color: t.inkMute, letterSpacing: 2, uppercase: true, z: 5,
      }));
    }
  }

  return {
    id: uid('p'),
    bg: { type: 'color', color: t.bg },
    elements: [
      ...chrome(t, W, H, pageNo, 'Stays & suites'),
      ...(withHead ? sectionHead(t, W, 'Where you stay', 'Stays & Suites', 'II') : []),
      ...rows,
    ],
  };
}

/** Amenities: a two-column list, then a three-tile strip along the bottom. */
function amenitiesPage(t, W, H, slot, pageNo) {
  const b = box(W, H);
  const colW = Math.round((b.w - mm(12)) / 2);
  const stripH = mm(46);
  const stripY = b.bottom - stripH - mm(4);

  const tw = Math.round((b.w - mm(10)) / 3);
  const strip = [
    tile(t, slot(), b.x, stripY, tw, stripH),
    tile(t, slot(), b.x + tw + mm(5), stripY, tw, stripH),
    tile(t, slot(), b.x + (tw + mm(5)) * 2, stripY, tw, stripH),
  ];

  return {
    id: uid('p'),
    bg: { type: 'color', color: t.bg },
    elements: [
      ...chrome(t, W, H, pageNo, 'Amenities'),
      ...sectionHead(t, W, 'Everything you need', 'Amenities', 'IV'),
      txt('Infinity pool\nKids park\nIndoor games\nDining area\nParking',
        b.x, mm(62), colW, stripY - mm(70), {
          field: 'amenities', font: t.body, size: pt(11), lineHeight: 2.1, color: t.inkSoft, z: 5,
        }),
      txt('Grilling facility\nOutdoor games\nParty hall\nAir-conditioned rooms\nFree Wi-Fi',
        b.x + colW + mm(12), mm(62), colW, stripY - mm(70), {
          font: t.body, size: pt(11), lineHeight: 2.1, color: t.inkSoft, z: 5,
        }),
      ...strip,
    ],
  };
}

function contactPage(t, W, H, slot) {
  const b = box(W, H);
  return {
    id: uid('p'),
    bg: { type: 'image', slot: slot(), url: '', overlay: t.contactVeil, fit: 'cover' },
    elements: [
      logo(t, b.x, mm(40), mm(20)),
      txt('Reserve your escape', b.x, mm(68), b.w, mm(7), {
        font: t.body, size: pt(8.5), weight: 500, color: t.accent2,
        letterSpacing: 5, uppercase: true, z: 6,
      }),
      txt('Come find the\nquiet in the clouds.', b.x, mm(77), b.w, mm(40), {
        font: t.display, size: pt(44), lineHeight: 0.98, color: t.onImage, z: 6,
      }),
      txt('Call & WhatsApp', b.x, mm(126), mm(70), mm(6), {
        font: t.body, size: pt(8), color: t.accent2, letterSpacing: 4, uppercase: true, z: 6,
      }),
      txt('+91 00000 00000', b.x, mm(133), mm(70), mm(10), {
        field: 'contact_phone', font: t.display, size: pt(19), color: t.onImage, z: 6,
      }),
      txt('Where we are', b.x + mm(80), mm(126), mm(80), mm(6), {
        font: t.body, size: pt(8), color: t.accent2, letterSpacing: 4, uppercase: true, z: 6,
      }),
      txt('Location', b.x + mm(80), mm(133), mm(80), mm(10), {
        field: 'location', font: t.display, size: pt(19), color: t.onImage, z: 6,
      }),
      txt('hello@example.com', b.x, mm(150), b.w, mm(9), {
        field: 'contact_email', font: t.display, size: pt(15), color: 'rgba(255,255,255,0.9)', z: 6,
      }),
      txt('www.example.com', b.x, mm(160), b.w, mm(9), {
        field: 'website', font: t.display, size: pt(15), color: 'rgba(255,255,255,0.9)', z: 6,
      }),
      shape(b.x, H - mm(28), b.w, 1, { fill: 'rgba(255,255,255,0.2)', z: 5 }),
      txt('', b.x, H - mm(24), b.w, mm(7), {
        field: 'agency_name', font: t.body, size: pt(7.5), color: 'rgba(255,255,255,0.55)',
        letterSpacing: 4, uppercase: true, z: 6,
      }),
    ],
  };
}

// --- gallery decks (1 / 2 / 3 photographs per page) -------------------------

/** A framed photo with a caption plate, stacked n-up down the page. */
function photoStackPage(t, W, H, slot, pageNo, perPage) {
  const b = box(W, H);

  if (perPage === 1) {
    // Full-bleed, with a gradient plate carrying the caption.
    return {
      id: uid('p'),
      bg: { type: 'image', slot: slot(), url: '', overlay: '', fit: 'cover' },
      elements: [
        shape(0, 0, W, mm(40), {
          fill: 'linear-gradient(180deg, rgba(6,10,8,0.55), rgba(6,10,8,0))', z: 3,
        }),
        shape(0, H - mm(52), W, mm(52), {
          fill: 'linear-gradient(0deg, rgba(6,10,8,0.82), rgba(6,10,8,0))', z: 3,
        }),
        txt(String(pageNo - 1).padStart(2, '0'), b.x, H - mm(34), mm(16), mm(10), {
          font: t.display, size: pt(15), italic: true, color: t.accent, z: 6,
        }),
        txt('', b.x + mm(18), H - mm(34), b.w - mm(18), mm(10), {
          font: t.display, size: pt(17), color: '#ffffff', z: 6,
        }),
      ],
    };
  }

  // Inset clear of the running header and footer — using the full content box runs the
  // last photograph straight under the footer text.
  const top = b.y + mm(6);
  const bottom = b.bottom - mm(8);
  const gap = perPage === 2 ? mm(8) : mm(6.5);
  const h = Math.round(((bottom - top) - gap * (perPage - 1)) / perPage);

  const frames = [];
  for (let i = 0; i < perPage; i += 1) {
    const y = top + i * (h + gap);
    frames.push(img(slot(), b.x, y, b.w, h, {
      radius: t.radius,
      borderWidth: t.tileBorder,
      borderColor: t.tileBorderColor,
      background: t.panel,
      z: 2,
    }));
    frames.push(shape(b.x, y + h - mm(20), b.w, mm(20), {
      fill: 'linear-gradient(0deg, rgba(6,10,8,0.80), rgba(6,10,8,0))', z: 3,
      radius: t.radius,
    }));
    // Numbered, not a "Caption" placeholder — shipping literal placeholder words in a
    // customer-facing PDF is worse than shipping nothing. Double-click to add a caption.
    frames.push(txt(String(i + 1).padStart(2, '0'), b.x + mm(7), y + h - mm(13), mm(14), mm(8), {
      font: t.display, size: pt(13), italic: !!t.italicNumerals, color: t.accent, z: 5,
    }));
    frames.push(txt('', b.x + mm(22), y + h - mm(13), b.w - mm(29), mm(8), {
      font: t.display, size: pt(13), color: '#ffffff', z: 5,
    }));
  }

  return {
    id: uid('p'),
    bg: { type: 'color', color: t.bg },
    elements: [...chrome(t, W, H, pageNo, 'Gallery'), ...frames],
  };
}

// --- deck builders ---------------------------------------------------------

/**
 * The full editorial brochure: cover, intro+stats, pool, rooms x2, interiors,
 * amenities, grounds, gallery, contact. Pages are dropped when there are not enough
 * photos to fill them, so a 10-photo upload still yields a complete deck.
 */
function editorialDeck(t, sizeKey, photoCount) {
  const size = PAGE_SIZES[sizeKey] || PAGE_SIZES.portrait;
  const { w: W, h: H } = size;

  let n = 0;
  const slot = () => `photo_${(n += 1)}`;

  const budget = { left: Math.max(1, photoCount) };
  const take = (cost) => {
    if (budget.left < cost) return false;
    budget.left -= cost;
    return true;
  };

  const pages = [];
  take(1);
  pages.push(coverPage(t, W, H, slot)); // cover consumes 1

  let no = 2;
  if (take(2)) pages.push(introPage(t, W, H, slot, no++));
  if (take(4)) pages.push(galleryPage(t, W, H, slot, no++, 2, 2, 'The centrepiece', 'The Pool', 'I'));
  if (take(3)) pages.push(roomsPage(t, W, H, slot, no++, 3, true));
  if (take(3)) pages.push(roomsPage(t, W, H, slot, no++, 3, false));
  if (take(6)) pages.push(galleryPage(t, W, H, slot, no++, 3, 2, 'Interiors', 'Inside', 'III'));
  if (take(3)) pages.push(amenitiesPage(t, W, H, slot, no++));
  if (take(6)) pages.push(galleryPage(t, W, H, slot, no++, 3, 2, 'Out in the open', 'The Grounds', 'V'));
  if (take(9)) pages.push(galleryPage(t, W, H, slot, no++, 3, 3, 'A closer look', 'Gallery', 'VI'));

  // The contact page always closes the deck; it reuses the cover photo if the pool is
  // spent, so the last page is never a grey box.
  pages.push(contactPage(t, W, H, () => (budget.left > 0 ? (budget.left--, slot()) : 'photo_1')));

  return {
    size: sizeKey,
    pageW: W,
    pageH: H,
    margin: { top: mm(19), right: mm(18), bottom: mm(19), left: mm(18) },
    theme: paletteOf(t),
    pages,
  };
}

/** A photo book: cover, then every remaining photo laid out n-per-page. */
function galleryDeck(t, sizeKey, photoCount, perPage) {
  const size = PAGE_SIZES[sizeKey] || PAGE_SIZES.portrait;
  const { w: W, h: H } = size;

  let n = 0;
  const slot = () => `photo_${(n += 1)}`;

  const pages = [coverPage(t, W, H, slot)];
  let remaining = Math.max(0, photoCount - 1);
  let no = 2;

  while (remaining >= perPage) {
    pages.push(photoStackPage(t, W, H, slot, no++, perPage));
    remaining -= perPage;
  }
  // Trailing photos that do not fill a page still deserve one.
  if (remaining > 0) pages.push(photoStackPage(t, W, H, slot, no++, remaining));

  pages.push(contactPage(t, W, H, () => 'photo_1'));

  return {
    size: sizeKey,
    pageW: W,
    pageH: H,
    margin: { top: mm(19), right: mm(16), bottom: mm(19), left: mm(16) },
    theme: paletteOf(t),
    pages,
  };
}

// --- the catalogue ---------------------------------------------------------

/**
 * The ten shipped designs. `build(photoCount)` returns an unfilled template doc; the
 * caller runs it through brochureDoc.fillDoc() with the photo list and merge fields.
 */
// `kind` + `theme` + `perPage` are declared as data rather than baked into a closure, so
// buildDeck can honour a page-shape override by REBUILDING the layout at the new size
// instead of squashing a portrait deck into a landscape box.
const PRESETS = Object.freeze([
  {
    key: 'luxury-editorial',
    name: 'Dark Luxury',
    description: 'Deep green and gold, Cormorant display. Cover, stats, rooms, amenities, gallery.',
    kind: 'editorial', theme: 'luxury', size: 'portrait',
  },
  {
    key: 'airy-editorial',
    name: 'Bright & Airy',
    description: 'Warm white and sage, Fraunces display. The same anatomy, light and open.',
    kind: 'editorial', theme: 'airy', size: 'portrait',
  },
  {
    key: 'earthy-editorial',
    name: 'Warm Earthy',
    description: 'Clay and terracotta, Marcellus display. Softer corners, warmer paper.',
    kind: 'editorial', theme: 'earthy', size: 'portrait',
  },
  {
    key: 'coastal-editorial',
    name: 'Coastal',
    description: 'Teal and slate on near-white, Playfair display. Beach and resort stays.',
    kind: 'editorial', theme: 'coastal', size: 'portrait',
  },
  {
    key: 'mono-editorial',
    name: 'Minimal Mono',
    description: 'Black on white, Bebas display, no ornament. Lets the photographs carry it.',
    kind: 'editorial', theme: 'mono', size: 'portrait',
  },
  {
    key: 'coastal-landscape',
    name: 'Coastal — Landscape',
    description: 'The same palette on A4 landscape. Reads like a presentation on a phone.',
    kind: 'editorial', theme: 'coastal', size: 'landscape',
  },
  {
    key: 'gallery-1up',
    name: 'Gallery — One per page',
    description: 'Full-bleed photo book. Every photo gets a whole page with a caption plate.',
    kind: 'gallery', theme: 'luxury', size: 'portrait', perPage: 1,
  },
  {
    key: 'gallery-2up',
    name: 'Gallery — Two per page',
    description: 'Two framed photographs per page, stacked.',
    kind: 'gallery', theme: 'luxury', size: 'portrait', perPage: 2,
  },
  {
    key: 'gallery-3up',
    name: 'Gallery — Three per page',
    description: 'Three framed photographs per page. The most compact photo book.',
    kind: 'gallery', theme: 'luxury', size: 'portrait', perPage: 3,
  },
  {
    key: 'mono-square',
    name: 'Square — Social',
    description: 'Square pages for social carousels and WhatsApp. Two photos per page.',
    kind: 'gallery', theme: 'mono', size: 'square', perPage: 2,
  },
]);

const PRESET_MAP = new Map(PRESETS.map((p) => [p.key, p]));

/**
 * Build a deck sized to the photo count.
 * @param {string} presetKey
 * @param {number} photoCount
 * @param {string} [sizeKey] - overrides the preset's own page shape
 */
function buildDeck(presetKey, photoCount, sizeKey) {
  const preset = PRESET_MAP.get(presetKey) || PRESETS[0];
  const theme = THEMES[preset.theme] || THEMES.luxury;
  const size = (sizeKey && PAGE_SIZES[sizeKey]) ? sizeKey : preset.size;
  const count = Math.max(1, Number(photoCount) || 1);

  return preset.kind === 'gallery'
    ? galleryDeck(theme, size, count, preset.perPage || 2)
    : editorialDeck(theme, size, count);
}

/** A single blank page, for "start from scratch". */
function blankDeck(sizeKey = 'portrait') {
  const size = PAGE_SIZES[sizeKey] || PAGE_SIZES.portrait;
  return {
    size: sizeKey,
    pageW: size.w,
    pageH: size.h,
    margin: { top: mm(19), right: mm(18), bottom: mm(19), left: mm(18) },
    theme: paletteOf(THEMES.luxury),
    pages: [{ id: uid('p'), bg: { type: 'color', color: '#ffffff' }, elements: [] }],
  };
}

/** Catalogue for the "new brochure" picker, with the palette needed to render a swatch. */
function listPresets() {
  return PRESETS.map((p) => {
    const t = THEMES[p.theme] || THEMES.luxury;
    return {
      key: p.key,
      name: p.name,
      description: p.description,
      size: p.size,
      kind: p.kind,
      palette: { bg: t.bg, ink: t.ink, accent: t.accent, panel: t.panel },
      fonts: { display: t.display, body: t.body },
    };
  });
}

module.exports = { THEMES, PRESETS, buildDeck, blankDeck, listPresets };
