// FILE: /backend/src/services/brochureDoc.ts
//
// The brochure document spec: page sizes, element styling, and doc -> HTML.
//
// A brochure page is absolutely-positioned HTML inside a fixed-size page div.
// The React editor renders elements with the SAME styles this file produces, so
// what the designer drags is exactly what Puppeteer prints — there is no separate
// print path and therefore no WYSIWYG drift.
//
// `frontend/src/utils/brochureDoc.js` is a literal mirror of the pure parts of
// this file (PAGE_SIZES, FONTS, cdnUrl, elementStyle, textStyle, imageStyle).
// Keep them in step; `npm test` guards the doc normalizer against silent drops.

// Millimetres to CSS px at 96dpi. The hand-built reference brochures are authored in
// mm (A4 = 210x297mm, 18mm gutters), so the layout kit and the page-size UI both need
// to speak mm even though the document itself stores px.
const MM = 96 / 25.4;
const mm = (n) => Math.round(n * MM);
const pxToMm = (n) => Math.round((n / MM) * 10) / 10;

// Points to px, for type sizes lifted from the reference CSS (9.6pt body, 66pt cover).
const pt = (n) => Math.round((n * 96) / 72);

const PAGE_SIZES = Object.freeze({
  portrait: { w: mm(210), h: mm(297), label: 'A4 Portrait (210×297mm)' },
  landscape: { w: mm(297), h: mm(210), label: 'A4 Landscape (297×210mm)' },
  square: { w: 1000, h: 1000, label: 'Square (1000×1000)' },
  custom: { w: mm(210), h: mm(297), label: 'Custom…' },
});

const FONTS = Object.freeze([
  // Display / serif
  { key: 'Cormorant Garamond', stack: "'Cormorant Garamond', Garamond, serif", label: 'Cormorant Garamond' },
  { key: 'Fraunces', stack: "'Fraunces', Georgia, serif", label: 'Fraunces' },
  { key: 'Marcellus', stack: "'Marcellus', Georgia, serif", label: 'Marcellus' },
  { key: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { key: 'Lora', stack: "'Lora', Georgia, serif", label: 'Lora' },
  // Display / sans
  { key: 'Anton', stack: "'Anton', Impact, sans-serif", label: 'Anton' },
  { key: 'Bebas Neue', stack: "'Bebas Neue', Impact, sans-serif", label: 'Bebas Neue' },
  // Body / sans
  { key: 'Jost', stack: "'Jost', Helvetica, sans-serif", label: 'Jost' },
  { key: 'Mulish', stack: "'Mulish', Helvetica, sans-serif", label: 'Mulish' },
  { key: 'Karla', stack: "'Karla', Helvetica, sans-serif", label: 'Karla' },
  { key: 'Inter', stack: "'Inter', Helvetica, Arial, sans-serif", label: 'Inter' },
  { key: 'Montserrat', stack: "'Montserrat', Helvetica, sans-serif", label: 'Montserrat' },
  // Script
  { key: 'Yellowtail', stack: "'Yellowtail', cursive", label: 'Yellowtail (script)' },
]);

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2'
  + '?family=Anton'
  + '&family=Bebas+Neue'
  + '&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400'
  + '&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700'
  + '&family=Inter:wght@300;400;600;700'
  + '&family=Jost:wght@300;400;500;600'
  + '&family=Karla:wght@300;400;600;700'
  + '&family=Lora:wght@400;600'
  + '&family=Marcellus'
  + '&family=Montserrat:wght@300;400;600;700'
  + '&family=Mulish:wght@300;400;600;700'
  + '&family=Playfair+Display:wght@400;600;700'
  + '&family=Yellowtail'
  + '&display=swap';

const ELEMENT_TYPES = Object.freeze(['image', 'text', 'shape']);
const FIT_MODES = Object.freeze(['cover', 'contain', 'fill']);
const ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
const SHAPE_KINDS = Object.freeze(['rect', 'ellipse', 'line']);

/** Merge fields a TEXT element can bind to. Refilled from the linked Property/form. */
const MERGE_FIELDS = Object.freeze([
  { key: 'property_name', label: 'Property name' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'location', label: 'Location' },
  { key: 'about', label: 'About / description' },
  { key: 'price', label: 'Price' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'contact_phone', label: 'Contact phone' },
  { key: 'contact_email', label: 'Contact email' },
  { key: 'website', label: 'Website' },
  { key: 'agency_name', label: 'Agency name' },
]);

/**
 * Merge fields an IMAGE element can bind to. The logo is uploaded once per brochure and
 * every logo-bound image on every page picks it up, so re-branding a whole deck is one
 * upload rather than an edit per page. Unlike a photo `slot`, a field is not consumed
 * from the photo pool — the same URL fills every element bound to it.
 */
const IMAGE_FIELDS = Object.freeze([
  { key: 'logo', label: 'Logo' },
]);

const MERGE_FIELD_KEYS = new Set(MERGE_FIELDS.map((f) => f.key));
const IMAGE_FIELD_KEYS = new Set(IMAGE_FIELDS.map((f) => f.key));

const MAX_PAGES = 60;
const MAX_ELEMENTS_PER_PAGE = 80;

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Rewrite a Cloudinary URL to a derived, size-capped, auto-format version.
 *
 * This is what makes a 30-photo brochure viable: the raw uploads are 4-6 MB phone
 * photos, and asking Puppeteer to wait on 30 of those (networkidle0) would stall or
 * time out. We render from ~200 KB derivatives instead, and the editor tray uses
 * w_400 thumbnails so scrolling stays smooth. Non-Cloudinary URLs pass through.
 *
 * @param {string} url
 * @param {number} width - target max width in px
 * @returns {string}
 */
function cdnUrl(url, width) {
  if (!url || typeof url !== 'string') return '';
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1 || !url.includes('res.cloudinary.com')) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  // Skip if a transformation is already applied (tail starts with e.g. "f_auto,").
  if (/^[a-z]{1,3}_[^/]+\//.test(tail)) return url;
  return `${head}f_auto,q_auto,c_limit,w_${Math.round(width)}/${tail}`;
}

const PRINT_IMAGE_WIDTH = 1600;
const THUMB_IMAGE_WIDTH = 400;

// ---------------------------------------------------------------------------
// Styling — shared by the editor (as React style objects) and the PDF renderer
// ---------------------------------------------------------------------------

/** Box geometry common to every element type. */
function elementStyle(el) {
  const style = {
    position: 'absolute',
    left: `${num(el.x, 0)}px`,
    top: `${num(el.y, 0)}px`,
    width: `${num(el.w, 100)}px`,
    height: `${num(el.h, 100)}px`,
    zIndex: num(el.z, 1),
  };
  const rotate = num(el.rotate, 0);
  if (rotate) style.transform = `rotate(${rotate}deg)`;
  const opacity = num(el.opacity, 1);
  if (opacity !== 1) style.opacity = String(opacity);
  return style;
}

/** CSS padding shorthand from a {top,right,bottom,left} box. */
function paddingCss(box) {
  const p = normalizeBox(box);
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

function borderCss(el) {
  const width = num(el.borderWidth, 0);
  if (!width) return 'none';
  return `${width}px solid ${el.borderColor || '#000000'}`;
}

function textStyle(el) {
  return {
    ...elementStyle(el),
    fontFamily: fontStack(el.font),
    fontSize: `${num(el.size, 24)}px`,
    fontWeight: String(num(el.weight, 400)),
    lineHeight: String(num(el.lineHeight, 1.2)),
    letterSpacing: `${num(el.letterSpacing, 0)}px`,
    color: el.color || '#111111',
    textAlign: ALIGNMENTS.includes(el.align) ? el.align : 'left',
    textTransform: el.uppercase ? 'uppercase' : 'none',
    fontStyle: el.italic ? 'italic' : 'normal',
    backgroundColor: el.background || 'transparent',
    padding: paddingCss(el.padding),
    border: borderCss(el),
    borderRadius: `${num(el.radius, 0)}px`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: el.valign === 'center' ? 'center' : (el.valign === 'bottom' ? 'flex-end' : 'flex-start'),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
  };
}

/**
 * Images carry their padding on a wrapper, not on the <img> itself: padding on a
 * replaced element does not inset the pixels, it just grows the box. renderElement and
 * the React canvas both wrap a padded image accordingly — see `imageNeedsWrapper`.
 */
function imageStyle(el) {
  return {
    ...elementStyle(el),
    objectFit: FIT_MODES.includes(el.fit) ? el.fit : 'cover',
    borderRadius: `${num(el.radius, 0)}px`,
    border: borderCss(el),
    overflow: 'hidden',
    backgroundColor: el.background || '#e5e7eb',
  };
}

function imageNeedsWrapper(el) {
  const p = normalizeBox(el.padding);
  return !!(p.top || p.right || p.bottom || p.left);
}

/** Outer box for a padded image; the <img> then fills the padded area. */
function imageWrapperStyle(el) {
  return {
    ...elementStyle(el),
    padding: paddingCss(el.padding),
    backgroundColor: el.background || 'transparent',
    border: borderCss(el),
    borderRadius: `${num(el.radius, 0)}px`,
    overflow: 'hidden',
  };
}

/** The <img> inside a padded wrapper: fills it, no absolute positioning of its own. */
function imageInnerStyle(el) {
  return {
    width: '100%',
    height: '100%',
    objectFit: FIT_MODES.includes(el.fit) ? el.fit : 'cover',
    borderRadius: `${Math.max(0, num(el.radius, 0) - num(el.borderWidth, 0))}px`,
    display: 'block',
  };
}

function shapeStyle(el) {
  const kind = SHAPE_KINDS.includes(el.shape) ? el.shape : 'rect';
  return {
    ...elementStyle(el),
    // `background`, not `backgroundColor`: the caption plates and veils are gradients,
    // and backgroundColor silently rejects a linear-gradient() — the plate just vanishes.
    background: el.fill || 'rgba(0,0,0,0.35)',
    borderRadius: kind === 'ellipse' ? '50%' : `${num(el.radius, 0)}px`,
    border: el.strokeWidth ? `${num(el.strokeWidth, 0)}px solid ${el.stroke || '#000'}` : 'none',
  };
}

/** Coerce a padding/margin box, accepting a bare number as "all four sides". */
function normalizeBox(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { top: value, right: value, bottom: value, left: value };
  }
  const raw = (value && typeof value === 'object') ? value : {};
  return {
    top: Math.max(0, num(raw.top, fallback)),
    right: Math.max(0, num(raw.right, fallback)),
    bottom: Math.max(0, num(raw.bottom, fallback)),
    left: Math.max(0, num(raw.left, fallback)),
  };
}

function fontStack(key) {
  const found = FONTS.find((f) => f.key === key);
  return found ? found.stack : FONTS[FONTS.length - 3].stack;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Coerce an untrusted `doc` payload into a safe, well-formed document.
 *
 * NOTE: this is a whitelist. The flow-builder normalizer in this repo once silently
 * discarded 17 unknown node fields (including an entire Send-PDF config) because a
 * field was added to the UI but not to the whitelist. If you add an element property
 * in the editor, add it here too, and cover it in brochureDoc.test.js — otherwise it
 * will save fine and vanish on reload.
 */
function normalizeDoc(input) {
  const raw = coerceObject(input);
  const sizeKey = PAGE_SIZES[raw.size] ? raw.size : 'portrait';
  const size = PAGE_SIZES[sizeKey];

  const pages = asArray(raw.pages).slice(0, MAX_PAGES).map((page, i) => normalizePage(page, i));

  return {
    size: sizeKey,
    // Clamped rather than fixed to the preset, so a user can dial in any page box.
    pageW: clamp(num(raw.pageW, size.w), 200, 5000),
    pageH: clamp(num(raw.pageH, size.h), 200, 5000),
    // The page gutter. Drawn as a guide in the editor and used by the layout kit to
    // place content; it does not clip, so an element may deliberately bleed past it.
    margin: normalizeBox(raw.margin, 0),
    // The palette the deck was built from. Kept whole (not just an accent) so `retheme`
    // can recolour every page by swapping old values for new — see below.
    theme: {
      bg: str(raw.theme?.bg, '#ffffff'),
      panel: str(raw.theme?.panel, '#f5f5f5'),
      ink: str(raw.theme?.ink, '#111111'),
      inkSoft: str(raw.theme?.inkSoft, '#404040'),
      inkMute: str(raw.theme?.inkMute, '#8a8a8a'),
      accent: str(raw.theme?.accent, '#c9a86a'),
      accent2: str(raw.theme?.accent2, '#e2cf9f'),
      fontHeading: str(raw.theme?.fontHeading, 'Cormorant Garamond'),
      fontBody: str(raw.theme?.fontBody, 'Jost'),
    },
    pages: pages.length ? pages : [normalizePage({}, 0)],
  };
}

const THEME_COLOR_KEYS = ['bg', 'panel', 'ink', 'inkSoft', 'inkMute', 'accent', 'accent2'];

/** How many times an exact colour string appears across a deck (backgrounds + elements). */
function countColor(doc, color) {
  if (!color) return 0;
  const target = color.toLowerCase();
  const normalized = normalizeDoc(doc);
  let count = 0;
  const hit = (v) => { if (typeof v === 'string' && v.toLowerCase() === target) count += 1; };
  normalized.pages.forEach((page) => {
    if (page.bg.type === 'color') hit(page.bg.color);
    page.elements.forEach((el) => {
      ['color', 'background', 'borderColor', 'fill', 'stroke'].forEach((k) => hit(el[k]));
    });
  });
  return count;
}

/**
 * Recolour / re-typeset an entire deck from a palette change.
 *
 * Presets emit their colours straight from the palette, so every gold rule, numeral and
 * eyebrow on every page literally holds the same accent string. Swapping old values for
 * new therefore restyles the whole document in one pass — while anything the designer
 * hand-picked (a colour that matches no palette entry) is left alone, which is exactly
 * the behaviour you want: global theming that does not stomp on manual overrides.
 *
 * @param {object} doc
 * @param {object} patch - partial palette, e.g. { accent: '#b0592f', fontHeading: 'Lora' }
 */
function retheme(doc, patch = {}) {
  const current = normalizeDoc(doc);
  const next = { ...current.theme, ...patch };

  const colorMap = new Map();
  THEME_COLOR_KEYS.forEach((key) => {
    const from = current.theme[key];
    const to = next[key];
    if (from && to && from !== to) colorMap.set(from.toLowerCase(), to);
  });

  const fontMap = new Map();
  if (patch.fontHeading && patch.fontHeading !== current.theme.fontHeading) {
    fontMap.set(current.theme.fontHeading, patch.fontHeading);
  }
  if (patch.fontBody && patch.fontBody !== current.theme.fontBody) {
    fontMap.set(current.theme.fontBody, patch.fontBody);
  }

  const swapColor = (value) => {
    if (typeof value !== 'string' || !value) return value;
    return colorMap.get(value.toLowerCase()) || value;
  };
  const swapFont = (value) => fontMap.get(value) || value;

  const pages = current.pages.map((page) => ({
    ...page,
    bg: page.bg.type === 'color' ? { ...page.bg, color: swapColor(page.bg.color) } : page.bg,
    elements: page.elements.map((el) => {
      const patched = { ...el };
      ['color', 'background', 'borderColor', 'fill', 'stroke'].forEach((key) => {
        if (patched[key]) patched[key] = swapColor(patched[key]);
      });
      if (patched.font) patched.font = swapFont(patched.font);
      return patched;
    }),
  }));

  return { ...current, theme: next, pages };
}

function normalizePage(page, index) {
  const raw = coerceObject(page);
  const elements = asArray(raw.elements)
    .slice(0, MAX_ELEMENTS_PER_PAGE)
    .map(normalizeElement)
    .filter(Boolean);

  return {
    id: str(raw.id, `p${index + 1}`),
    bg: normalizeBackground(raw.bg),
    elements,
  };
}

function normalizeBackground(bg) {
  const raw = coerceObject(bg);
  if (raw.type === 'image') {
    return {
      type: 'image',
      url: str(raw.url, ''),
      slot: str(raw.slot, ''),
      overlay: str(raw.overlay, ''),
      fit: FIT_MODES.includes(raw.fit) ? raw.fit : 'cover',
    };
  }
  return { type: 'color', color: str(raw.color, '#ffffff') };
}

function normalizeElement(el) {
  const raw = coerceObject(el);
  if (!ELEMENT_TYPES.includes(raw.type)) return null;

  const base = {
    id: str(raw.id, `e${Math.abs(hash(JSON.stringify(raw)))}`),
    type: raw.type,
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(1, num(raw.w, 100)),
    h: Math.max(1, num(raw.h, 100)),
    rotate: clamp(num(raw.rotate, 0), -360, 360),
    z: clamp(num(raw.z, 1), 0, 999),
    opacity: clamp(num(raw.opacity, 1), 0, 1),
    locked: !!raw.locked,
  };

  if (raw.type === 'image') {
    const field = str(raw.field, '');
    return {
      ...base,
      url: str(raw.url, ''),
      slot: str(raw.slot, ''),
      // e.g. 'logo' — bound to an uploaded asset rather than consumed from the photo pool.
      field: IMAGE_FIELD_KEYS.has(field) ? field : '',
      fit: FIT_MODES.includes(raw.fit) ? raw.fit : 'cover',
      radius: Math.max(0, num(raw.radius, 0)),
      padding: normalizeBox(raw.padding, 0),
      borderWidth: clamp(num(raw.borderWidth, 0), 0, 40),
      borderColor: str(raw.borderColor, '#000000'),
      background: str(raw.background, ''),
    };
  }

  if (raw.type === 'text') {
    const field = str(raw.field, '');
    return {
      ...base,
      text: str(raw.text, ''),
      field: MERGE_FIELD_KEYS.has(field) ? field : '',
      font: str(raw.font, 'Jost'),
      size: clamp(num(raw.size, 24), 6, 400),
      weight: clamp(num(raw.weight, 400), 100, 900),
      lineHeight: clamp(num(raw.lineHeight, 1.2), 0.6, 4),
      letterSpacing: clamp(num(raw.letterSpacing, 0), -20, 40),
      color: str(raw.color, '#111111'),
      align: ALIGNMENTS.includes(raw.align) ? raw.align : 'left',
      valign: ['top', 'center', 'bottom'].includes(raw.valign) ? raw.valign : 'top',
      uppercase: !!raw.uppercase,
      italic: !!raw.italic,
      padding: normalizeBox(raw.padding, 0),
      borderWidth: clamp(num(raw.borderWidth, 0), 0, 40),
      borderColor: str(raw.borderColor, '#000000'),
      background: str(raw.background, ''),
      radius: Math.max(0, num(raw.radius, 0)),
    };
  }

  return {
    ...base,
    shape: SHAPE_KINDS.includes(raw.shape) ? raw.shape : 'rect',
    fill: str(raw.fill, 'rgba(0,0,0,0.35)'),
    stroke: str(raw.stroke, ''),
    strokeWidth: Math.max(0, num(raw.strokeWidth, 0)),
    radius: Math.max(0, num(raw.radius, 0)),
  };
}

function coerceObject(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function str(value, fallback) {
  return typeof value === 'string' ? value : fallback;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// ---------------------------------------------------------------------------
// Filling — slots and merge fields
// ---------------------------------------------------------------------------

/**
 * Fill a doc's image slots from an ordered image list and its text merge fields
 * from `fields`. This is what "drop 30 photos into a saved template" does, and it
 * is also what the auto-compose path uses.
 *
 * Slots are filled in document order (page 1 top-left first), so an agency's photo
 * ordering in the tray is the ordering in the brochure.
 *
 * @param {object} doc - a normalized doc, possibly with empty slots
 * @param {Array<{url:string}>} images
 * @param {Record<string,string>} fields
 * @returns {object} a new doc with slots resolved
 */
function fillDoc(doc, images = [], fields = {}) {
  const normalized = normalizeDoc(doc);
  const pool = asArray(images).map((img) => (typeof img === 'string' ? img : img?.url)).filter(Boolean);
  let cursor = 0;
  const next = () => (pool.length ? pool[cursor++ % pool.length] : '');

  const pages = normalized.pages.map((page) => {
    const bg = (page.bg.type === 'image' && page.bg.slot && !page.bg.url)
      ? { ...page.bg, url: next() }
      : page.bg;

    const elements = page.elements.map((el) => {
      if (el.type === 'image' && el.field) {
        // A field-bound image (the logo) is NOT drawn from the photo pool: the same
        // upload fills every element bound to it, on every page.
        const value = fields[el.field];
        return typeof value === 'string' && value.trim() ? { ...el, url: value } : el;
      }
      if (el.type === 'image' && el.slot && !el.url) {
        return { ...el, url: next() };
      }
      if (el.type === 'text' && el.field) {
        const value = fields[el.field];
        return typeof value === 'string' && value.trim() ? { ...el, text: value } : el;
      }
      return el;
    });

    return { ...page, bg, elements };
  });

  return { ...normalized, pages };
}

/** How many photos a design expects — shown in the template picker ("needs 18 photos"). */
function countSlots(doc) {
  const normalized = normalizeDoc(doc);
  return normalized.pages.reduce((total, page) => {
    const bg = page.bg.type === 'image' && page.bg.slot ? 1 : 0;
    return total + bg + page.elements.filter((el) => el.type === 'image' && el.slot).length;
  }, 0);
}

/** Strip resolved urls/text back out, turning a designed brochure into a reusable template. */
function toTemplateDoc(doc) {
  const normalized = normalizeDoc(doc);
  const pages = normalized.pages.map((page) => ({
    ...page,
    bg: page.bg.type === 'image' && page.bg.slot ? { ...page.bg, url: '' } : page.bg,
    elements: page.elements.map((el) => {
      // Release both slotted photos and field-bound images (the logo), so reusing the
      // design for another property re-brands it instead of carrying the old logo over.
      if (el.type === 'image' && (el.slot || el.field)) return { ...el, url: '' };
      return el;
    }),
  }));
  return { ...normalized, pages };
}

// ---------------------------------------------------------------------------
// Rendering — doc -> HTML (the exact markup Puppeteer prints)
// ---------------------------------------------------------------------------

function styleToCss(style) {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${v}`)
    .join(';');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderElement(el, imageWidth) {
  if (el.type === 'image') {
    // A logo is usually a transparent PNG that must sit whole inside its badge, so it
    // is served un-cropped at its natural aspect; photos get the size-capped derivative.
    const width = el.field === 'logo' ? 600 : imageWidth;

    if (!el.url) {
      return `<div style="${styleToCss({ ...imageStyle(el), backgroundColor: el.background || '#e5e7eb' })}"></div>`;
    }

    if (imageNeedsWrapper(el)) {
      return `<div style="${styleToCss(imageWrapperStyle(el))}">`
        + `<img src="${esc(cdnUrl(el.url, width))}" style="${styleToCss(imageInnerStyle(el))}" />`
        + '</div>';
    }

    return `<img src="${esc(cdnUrl(el.url, width))}" style="${styleToCss(imageStyle(el))}" />`;
  }
  if (el.type === 'text') {
    return `<div style="${styleToCss(textStyle(el))}">${esc(el.text)}</div>`;
  }
  return `<div style="${styleToCss(shapeStyle(el))}"></div>`;
}

function renderPage(page, doc, imageWidth) {
  const pageStyle = {
    position: 'relative',
    width: `${doc.pageW}px`,
    height: `${doc.pageH}px`,
    overflow: 'hidden',
    backgroundColor: page.bg.type === 'color' ? page.bg.color : '#ffffff',
    pageBreakAfter: 'always',
    breakAfter: 'page',
  };

  const layers = [];

  if (page.bg.type === 'image' && page.bg.url) {
    layers.push(
      `<img src="${esc(cdnUrl(page.bg.url, imageWidth))}" style="${styleToCss({
        position: 'absolute', left: 0, top: 0,
        width: `${doc.pageW}px`, height: `${doc.pageH}px`,
        objectFit: page.bg.fit, zIndex: 0,
      })}" />`
    );
    if (page.bg.overlay) {
      layers.push(`<div style="${styleToCss({
        position: 'absolute', left: 0, top: 0,
        width: `${doc.pageW}px`, height: `${doc.pageH}px`,
        background: page.bg.overlay, zIndex: 0,
      })}"></div>`);
    }
  }

  const sorted = [...page.elements].sort((a, b) => a.z - b.z);
  sorted.forEach((el) => layers.push(renderElement(el, imageWidth)));

  return `<section style="${styleToCss(pageStyle)}">${layers.join('')}</section>`;
}

/**
 * Render a filled doc to a standalone HTML document.
 * @param {object} doc - normalized + filled
 * @param {{imageWidth?: number}} [opts]
 */
function renderDocHtml(doc, opts = {}) {
  const normalized = normalizeDoc(doc);
  const imageWidth = opts.imageWidth || PRINT_IMAGE_WIDTH;
  const body = normalized.pages.map((p) => renderPage(p, normalized, imageWidth)).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: ${normalized.pageW}px ${normalized.pageH}px; margin: 0; }
  section:last-child { page-break-after: auto; break-after: auto; }
  img { display: block; }
</style></head>
<body>${body}</body></html>`;
}

module.exports = {
  PAGE_SIZES,
  FONTS,
  MERGE_FIELDS,
  IMAGE_FIELDS,
  ELEMENT_TYPES,
  MAX_PAGES,
  MAX_ELEMENTS_PER_PAGE,
  PRINT_IMAGE_WIDTH,
  THUMB_IMAGE_WIDTH,
  MM,
  mm,
  pxToMm,
  pt,
  cdnUrl,
  elementStyle,
  textStyle,
  imageStyle,
  imageNeedsWrapper,
  imageWrapperStyle,
  imageInnerStyle,
  shapeStyle,
  fontStack,
  normalizeBox,
  normalizeDoc,
  fillDoc,
  countSlots,
  countColor,
  retheme,
  toTemplateDoc,
  renderDocHtml,
};
