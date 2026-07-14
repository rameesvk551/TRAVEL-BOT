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

const PAGE_SIZES = Object.freeze({
  // A4 at 96dpi. Landscape matches the reference Canva decks agencies use today.
  landscape: { w: 1122, h: 794, label: 'Landscape (A4)' },
  portrait: { w: 794, h: 1122, label: 'Portrait (A4)' },
  square: { w: 1000, h: 1000, label: 'Square' },
});

const FONTS = Object.freeze([
  { key: 'Anton', stack: "'Anton', Impact, sans-serif", label: 'Anton (display)' },
  { key: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", label: 'Playfair (serif)' },
  { key: 'Yellowtail', stack: "'Yellowtail', cursive", label: 'Yellowtail (script)' },
  { key: 'Bebas Neue', stack: "'Bebas Neue', Impact, sans-serif", label: 'Bebas Neue' },
  { key: 'Inter', stack: "'Inter', Helvetica, Arial, sans-serif", label: 'Inter (body)' },
  { key: 'Lora', stack: "'Lora', Georgia, serif", label: 'Lora (body serif)' },
  { key: 'Montserrat', stack: "'Montserrat', Helvetica, sans-serif", label: 'Montserrat' },
]);

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2'
  + '?family=Anton'
  + '&family=Bebas+Neue'
  + '&family=Inter:wght@300;400;600;700'
  + '&family=Lora:wght@400;600'
  + '&family=Montserrat:wght@300;400;600;700'
  + '&family=Playfair+Display:wght@400;600;700'
  + '&family=Yellowtail'
  + '&display=swap';

const ELEMENT_TYPES = Object.freeze(['image', 'text', 'shape']);
const FIT_MODES = Object.freeze(['cover', 'contain', 'fill']);
const ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
const SHAPE_KINDS = Object.freeze(['rect', 'ellipse', 'line']);

/** Merge fields a text element can bind to. Refilled from the linked Property/form. */
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

const MERGE_FIELD_KEYS = new Set(MERGE_FIELDS.map((f) => f.key));

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
    display: 'flex',
    flexDirection: 'column',
    justifyContent: el.valign === 'center' ? 'center' : (el.valign === 'bottom' ? 'flex-end' : 'flex-start'),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflow: 'hidden',
  };
}

function imageStyle(el) {
  return {
    ...elementStyle(el),
    objectFit: FIT_MODES.includes(el.fit) ? el.fit : 'cover',
    borderRadius: `${num(el.radius, 0)}px`,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  };
}

function shapeStyle(el) {
  const kind = SHAPE_KINDS.includes(el.shape) ? el.shape : 'rect';
  return {
    ...elementStyle(el),
    backgroundColor: el.fill || 'rgba(0,0,0,0.35)',
    borderRadius: kind === 'ellipse' ? '50%' : `${num(el.radius, 0)}px`,
    border: el.strokeWidth ? `${num(el.strokeWidth, 0)}px solid ${el.stroke || '#000'}` : 'none',
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
  const sizeKey = PAGE_SIZES[raw.size] ? raw.size : 'landscape';
  const size = PAGE_SIZES[sizeKey];

  const pages = asArray(raw.pages).slice(0, MAX_PAGES).map((page, i) => normalizePage(page, i));

  return {
    size: sizeKey,
    pageW: num(raw.pageW, size.w),
    pageH: num(raw.pageH, size.h),
    theme: {
      primary: str(raw.theme?.primary, '#0e7490'),
      fontHeading: str(raw.theme?.fontHeading, 'Anton'),
      fontBody: str(raw.theme?.fontBody, 'Inter'),
    },
    pages: pages.length ? pages : [normalizePage({}, 0)],
  };
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
    return {
      ...base,
      url: str(raw.url, ''),
      slot: str(raw.slot, ''),
      fit: FIT_MODES.includes(raw.fit) ? raw.fit : 'cover',
      radius: Math.max(0, num(raw.radius, 0)),
    };
  }

  if (raw.type === 'text') {
    const field = str(raw.field, '');
    return {
      ...base,
      text: str(raw.text, ''),
      field: MERGE_FIELD_KEYS.has(field) ? field : '',
      font: str(raw.font, 'Inter'),
      size: clamp(num(raw.size, 24), 6, 400),
      weight: clamp(num(raw.weight, 400), 100, 900),
      lineHeight: clamp(num(raw.lineHeight, 1.2), 0.6, 4),
      letterSpacing: clamp(num(raw.letterSpacing, 0), -20, 40),
      color: str(raw.color, '#111111'),
      align: ALIGNMENTS.includes(raw.align) ? raw.align : 'left',
      valign: ['top', 'center', 'bottom'].includes(raw.valign) ? raw.valign : 'top',
      uppercase: !!raw.uppercase,
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
      if (el.type === 'image' && el.slot) return { ...el, url: '' };
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
    if (!el.url) {
      return `<div style="${styleToCss({ ...imageStyle(el), backgroundColor: '#e5e7eb' })}"></div>`;
    }
    return `<img src="${esc(cdnUrl(el.url, imageWidth))}" style="${styleToCss(imageStyle(el))}" />`;
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
  ELEMENT_TYPES,
  MAX_PAGES,
  MAX_ELEMENTS_PER_PAGE,
  PRINT_IMAGE_WIDTH,
  THUMB_IMAGE_WIDTH,
  cdnUrl,
  elementStyle,
  textStyle,
  imageStyle,
  shapeStyle,
  fontStack,
  normalizeDoc,
  fillDoc,
  countSlots,
  toTemplateDoc,
  renderDocHtml,
};
