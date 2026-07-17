// FILE: /frontend/src/utils/brochureDoc.js
//
// Front-end mirror of the pure parts of backend/src/services/brochureDoc.ts.
//
// These functions produce the style objects React renders each element with. The backend
// produces the SAME styles as inline CSS when it renders the page for Puppeteer, so the
// editor is a true WYSIWYG of the printed PDF. If you change a style rule here, change
// it there — the two files are the contract, and a divergence shows up as "the preview
// looked right but the PDF is wrong", which is the worst class of bug in this feature.

// Millimetres to CSS px at 96dpi. The designs are authored in mm on A4.
export const MM = 96 / 25.4;
export const mm = (n) => Math.round(n * MM);
export const pxToMm = (n) => Math.round((n / MM) * 10) / 10;

export const PAGE_SIZES = {
  portrait: { w: mm(210), h: mm(297), label: 'A4 Portrait (210×297mm)' },
  landscape: { w: mm(297), h: mm(210), label: 'A4 Landscape (297×210mm)' },
  square: { w: 1000, h: 1000, label: 'Square (1000×1000)' },
  custom: { w: mm(210), h: mm(297), label: 'Custom…' },
};

export const FONTS = [
  { key: 'Cormorant Garamond', stack: "'Cormorant Garamond', Garamond, serif", label: 'Cormorant Garamond' },
  { key: 'Fraunces', stack: "'Fraunces', Georgia, serif", label: 'Fraunces' },
  { key: 'Marcellus', stack: "'Marcellus', Georgia, serif", label: 'Marcellus' },
  { key: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", label: 'Playfair Display' },
  { key: 'Lora', stack: "'Lora', Georgia, serif", label: 'Lora' },
  { key: 'Anton', stack: "'Anton', Impact, sans-serif", label: 'Anton' },
  { key: 'Bebas Neue', stack: "'Bebas Neue', Impact, sans-serif", label: 'Bebas Neue' },
  { key: 'Jost', stack: "'Jost', Helvetica, sans-serif", label: 'Jost' },
  { key: 'Mulish', stack: "'Mulish', Helvetica, sans-serif", label: 'Mulish' },
  { key: 'Karla', stack: "'Karla', Helvetica, sans-serif", label: 'Karla' },
  { key: 'Inter', stack: "'Inter', Helvetica, Arial, sans-serif", label: 'Inter' },
  { key: 'Montserrat', stack: "'Montserrat', Helvetica, sans-serif", label: 'Montserrat' },
  { key: 'Sora', stack: "'Sora', Helvetica, sans-serif", label: 'Sora' },
  { key: 'Archivo', stack: "'Archivo', Helvetica, sans-serif", label: 'Archivo' },
  { key: 'Bricolage Grotesque', stack: "'Bricolage Grotesque', Impact, sans-serif", label: 'Bricolage Grotesque' },
  { key: 'Cinzel', stack: "'Cinzel', Georgia, serif", label: 'Cinzel' },
  { key: 'Yellowtail', stack: "'Yellowtail', cursive", label: 'Yellowtail (script)' },
];

const ALIGNMENTS = ['left', 'center', 'right'];
const FIT_MODES = ['cover', 'contain', 'fill'];
const SHAPE_KINDS = ['rect', 'ellipse', 'line'];

export const PRINT_IMAGE_WIDTH = 1600;
export const THUMB_IMAGE_WIDTH = 400;

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce a padding box, accepting a bare number as "all four sides". */
export function normalizeBox(value, fallback = 0) {
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

/**
 * Cloudinary derivative URL. The tray and canvas render w_400/w_1600 versions rather
 * than the 5 MB originals — without this, a 30-photo deck makes the editor crawl.
 */
export function cdnUrl(url, width) {
  if (!url || typeof url !== 'string') return '';
  const marker = '/upload/';
  const at = url.indexOf(marker);
  if (at === -1 || !url.includes('res.cloudinary.com')) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  if (/^[a-z]{1,3}_[^/]+\//.test(tail)) return url;
  return `${head}f_auto,q_auto,c_limit,w_${Math.round(width)}/${tail}`;
}

export function fontStack(key) {
  const found = FONTS.find((f) => f.key === key);
  return found ? found.stack : "'Inter', Helvetica, Arial, sans-serif";
}

function paddingCss(box) {
  const p = normalizeBox(box);
  return `${p.top}px ${p.right}px ${p.bottom}px ${p.left}px`;
}

function borderCss(el) {
  const width = num(el.borderWidth, 0);
  if (!width) return 'none';
  return `${width}px solid ${el.borderColor || '#000000'}`;
}

export function elementStyle(el) {
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

/**
 * A text element's height is a MINIMUM, not a cap — mirrors the backend rule exactly.
 *
 * The design sizes these boxes for placeholder copy ('Room type'); users retype them with
 * longer real names. A fixed height plus overflow:hidden silently cut the extra words off,
 * in the editor and in the PDF. The box grows downward instead.
 */
export function textStyle(el) {
  const { height, ...box } = elementStyle(el);
  return {
    ...box,
    height: 'auto',
    minHeight: height,
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
  };
}

export function imageStyle(el) {
  return {
    ...elementStyle(el),
    objectFit: FIT_MODES.includes(el.fit) ? el.fit : 'cover',
    borderRadius: `${num(el.radius, 0)}px`,
    border: borderCss(el),
    overflow: 'hidden',
    backgroundColor: el.background || '#e5e7eb',
  };
}

/**
 * Padding on an <img> grows the box instead of insetting the pixels, so a padded image
 * has to be wrapped. The backend renderer does the same — keep the two in step.
 */
export function imageNeedsWrapper(el) {
  const p = normalizeBox(el.padding);
  return !!(p.top || p.right || p.bottom || p.left);
}

export function imageWrapperStyle(el) {
  return {
    ...elementStyle(el),
    padding: paddingCss(el.padding),
    backgroundColor: el.background || 'transparent',
    border: borderCss(el),
    borderRadius: `${num(el.radius, 0)}px`,
    overflow: 'hidden',
  };
}

export function imageInnerStyle(el) {
  return {
    width: '100%',
    height: '100%',
    objectFit: FIT_MODES.includes(el.fit) ? el.fit : 'cover',
    borderRadius: `${Math.max(0, num(el.radius, 0) - num(el.borderWidth, 0))}px`,
    display: 'block',
  };
}

export function shapeStyle(el) {
  const kind = SHAPE_KINDS.includes(el.shape) ? el.shape : 'rect';
  return {
    ...elementStyle(el),
    // `background`, not `backgroundColor` — the caption plates and veils are gradients.
    background: el.fill || 'rgba(0,0,0,0.35)',
    borderRadius: kind === 'ellipse' ? '50%' : `${num(el.radius, 0)}px`,
    border: el.strokeWidth ? `${num(el.strokeWidth, 0)}px solid ${el.stroke || '#000'}` : 'none',
  };
}

// --- editor-only helpers ---------------------------------------------------

const EMPTY_BOX = { top: 0, right: 0, bottom: 0, left: 0 };

let idCounter = 0;
export function newId(prefix = 'e') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter}`;
}

export function newTextElement(pageW, pageH) {
  return {
    id: newId('t'), type: 'text', text: 'Your text', field: '',
    x: Math.round(pageW / 2 - 200), y: Math.round(pageH / 2 - 30), w: 400, h: 60,
    rotate: 0, z: 10, opacity: 1,
    font: 'Jost', size: 32, weight: 600, lineHeight: 1.25, letterSpacing: 0,
    color: '#111827', align: 'left', valign: 'top', uppercase: false, italic: false,
    padding: { ...EMPTY_BOX }, borderWidth: 0, borderColor: '#000000', background: '', radius: 0,
  };
}

export function newImageElement(pageW, pageH, url = '') {
  return {
    id: newId('i'), type: 'image', url, slot: '', field: '',
    x: Math.round(pageW / 2 - 200), y: Math.round(pageH / 2 - 140), w: 400, h: 280,
    rotate: 0, z: 10, opacity: 1, fit: 'cover', radius: 8,
    padding: { ...EMPTY_BOX }, borderWidth: 0, borderColor: '#000000', background: '',
  };
}

export function newShapeElement(pageW, pageH) {
  return {
    id: newId('s'), type: 'shape', shape: 'rect',
    x: Math.round(pageW / 2 - 150), y: Math.round(pageH / 2 - 75), w: 300, h: 150,
    rotate: 0, z: 10, opacity: 1,
    fill: 'rgba(15,23,42,0.45)', stroke: '', strokeWidth: 0, radius: 8,
  };
}

export function newIconElement(pageW, pageH) {
  return {
    id: newId('ic'), type: 'icon', icon: 'star',
    x: Math.round(pageW / 2 - 24), y: Math.round(pageH / 2 - 24), w: 48, h: 48,
    rotate: 0, z: 10, opacity: 1, color: '#111827', strokeWidth: 1.5,
  };
}

export function newPage(bgColor = '#ffffff') {
  return { id: newId('p'), bg: { type: 'color', color: bgColor }, elements: [] };
}

// --- alignment (editor-only) -----------------------------------------------
//
// A design ships its rows perfectly uniform; the moment a user drags one by hand it lands
// on the 8px grid instead of the original coordinate, and the column stops lining up. These
// put a selection back onto exact shared edges and sizes, which is not something you can do
// by eye or by typing numbers into twelve elements.

export const ALIGN_MODES = ['left', 'centerH', 'right', 'top', 'middleV', 'bottom', 'sameWidth', 'sameHeight', 'sameSize'];

/**
 * Align/size a selection.
 *
 * Edges align to the selection's bounding box (what every design tool does). Size-matching
 * copies the FIRST element in `elements` — the one clicked first — so "click the card you
 * like, then shift-click the rest" makes them all match the good one, rather than matching
 * whichever happens to be biggest.
 *
 * @param {Array} elements - in SELECTION order; [0] is the size reference
 * @param {string} mode - one of ALIGN_MODES
 */
export function alignElements(elements, mode) {
  if (!Array.isArray(elements) || elements.length < 2) return elements;

  const left = Math.min(...elements.map((e) => e.x));
  const right = Math.max(...elements.map((e) => e.x + e.w));
  const top = Math.min(...elements.map((e) => e.y));
  const bottom = Math.max(...elements.map((e) => e.y + e.h));
  const ref = elements[0];

  const move = {
    left: () => ({ x: left }),
    centerH: (e) => ({ x: Math.round((left + right) / 2 - e.w / 2) }),
    right: (e) => ({ x: right - e.w }),
    top: () => ({ y: top }),
    middleV: (e) => ({ y: Math.round((top + bottom) / 2 - e.h / 2) }),
    bottom: (e) => ({ y: bottom - e.h }),
    sameWidth: () => ({ w: ref.w }),
    sameHeight: () => ({ h: ref.h }),
    sameSize: () => ({ w: ref.w, h: ref.h }),
  }[mode];

  return move ? elements.map((e) => ({ ...e, ...move(e) })) : elements;
}

/**
 * Even the gaps between elements along one axis.
 *
 * The two outermost elements stay exactly where they are — distributing is about the space
 * between things, so shifting the anchors would move the whole block and surprise the user.
 * Needs three: with two there is no gap to even out.
 *
 * @param {Array} elements
 * @param {'x'|'y'} axis
 */
export function distributeElements(elements, axis) {
  if (!Array.isArray(elements) || elements.length < 3) return elements;

  const pos = axis === 'y' ? 'y' : 'x';
  const size = axis === 'y' ? 'h' : 'w';
  const sorted = [...elements].sort((a, b) => a[pos] - b[pos]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const span = (last[pos] + last[size]) - first[pos];
  const filled = sorted.reduce((sum, e) => sum + e[size], 0);
  const gap = (span - filled) / (sorted.length - 1);

  const moved = new Map();
  let cursor = first[pos];
  sorted.forEach((e) => {
    moved.set(e.id, Math.round(cursor));
    cursor += e[size] + gap;
  });

  return elements.map((e) => (moved.has(e.id) ? { ...e, [pos]: moved.get(e.id) } : e));
}
