// Guards the brochure document spec: the normalizer, slot/field filling, and the
// HTML the PDF renderer emits.
//
// The normalizer is a WHITELIST, which is the dangerous kind of function in this repo:
// the flow-builder equivalent once silently discarded 17 unknown node fields, including
// an entire Send-PDF config, because the UI grew a property the whitelist did not know.
// The round-trip tests below exist so that adding an element property to the editor
// without adding it here fails loudly instead of vanishing on reload.

const { describe, ok, equal } = require('./_harness');
const brochureDoc = require('../src/services/brochureDoc');
const brochureThemes = require('../src/services/brochureThemes');

/**
 * Deep-equality that ignores key order. The harness's `equal` compares raw
 * JSON.stringify output, but the normalizer rebuilds each element (base geometry
 * first, then type-specific props), so a faithful round-trip still reorders keys.
 * Key order is not part of the contract; the set of surviving properties is.
 */
const sortKeys = (value) => (
  Array.isArray(value)
    ? value.map(sortKeys)
    : (value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]))
      : value)
);

const equalDeep = (name, actual, expected) => equal(name, sortKeys(actual), sortKeys(expected));

describe('brochureDoc.normalizeDoc', () => {
  const A4W = brochureDoc.mm(210);
  const A4H = brochureDoc.mm(297);

  const doc = brochureDoc.normalizeDoc({});
  ok('defaults to an A4 portrait page', doc.pageW === A4W && doc.pageH === A4H);
  ok('always yields at least one page', doc.pages.length === 1);
  ok('carries a full palette on theme', typeof doc.theme.accent === 'string' && typeof doc.theme.bg === 'string');

  const parsed = brochureDoc.normalizeDoc(JSON.stringify({ size: 'landscape', pages: [] }));
  ok('accepts a JSON string payload', parsed.pageW === A4H && parsed.pageH === A4W);

  const bogus = brochureDoc.normalizeDoc({ size: 'hexagon' });
  ok('falls back on an unknown page size', bogus.size === 'portrait');

  const custom = brochureDoc.normalizeDoc({ size: 'custom', pageW: 1400, pageH: 900 });
  ok('honours a custom page size', custom.pageW === 1400 && custom.pageH === 900);
  const clampedPage = brochureDoc.normalizeDoc({ pageW: 99999, pageH: 10 });
  ok('clamps an absurd page size', clampedPage.pageW === 5000 && clampedPage.pageH === 200);

  // Every property the editor writes must survive a round-trip. If you add one to
  // BrochureInspector, add it here — that is the whole point of this test.
  const pad = { top: 4, right: 8, bottom: 4, left: 8 };
  const text = {
    id: 't1', type: 'text', text: 'Hello', field: 'property_name',
    x: 10, y: 20, w: 300, h: 80, rotate: 15, z: 4, opacity: 0.9, locked: false,
    font: 'Anton', size: 42, weight: 700, lineHeight: 1.4, letterSpacing: 2,
    color: '#ff0000', align: 'center', valign: 'center', uppercase: true, italic: true,
    padding: pad, borderWidth: 2, borderColor: '#00ff00', background: '#eeeeee', radius: 6,
  };
  const image = {
    id: 'i1', type: 'image', url: 'https://x/a.jpg', slot: 'photo_1', field: '',
    x: 1, y: 2, w: 3, h: 4, rotate: 0, z: 1, opacity: 1, locked: false,
    fit: 'contain', radius: 12,
    padding: pad, borderWidth: 1, borderColor: '#123456', background: '#abcdef',
  };
  const logo = {
    id: 'i2', type: 'image', url: '', slot: '', field: 'logo',
    x: 0, y: 0, w: 60, h: 60, rotate: 0, z: 6, opacity: 1, locked: false,
    fit: 'contain', radius: 9999,
    padding: { top: 11, right: 11, bottom: 11, left: 11 }, borderWidth: 2, borderColor: '#c9a86a', background: '',
  };
  const shape = {
    id: 's1', type: 'shape', shape: 'ellipse',
    x: 0, y: 0, w: 50, h: 50, rotate: 0, z: 2, opacity: 1, locked: false,
    fill: '#000000', stroke: '#fff', strokeWidth: 3, radius: 0,
  };
  const icon = {
    id: 'ic1', type: 'icon', icon: 'pool',
    x: 5, y: 6, w: 40, h: 40, rotate: 0, z: 5, opacity: 1, locked: false,
    color: '#0e9aa7', strokeWidth: 1.5,
  };

  const roundTrip = brochureDoc.normalizeDoc({
    pages: [{ id: 'p1', bg: { type: 'color', color: '#fff' }, elements: [text, image, logo, shape, icon] }],
  });

  equalDeep('text element survives a round-trip', roundTrip.pages[0].elements[0], text);
  equalDeep('image element survives a round-trip', roundTrip.pages[0].elements[1], image);
  equalDeep('logo (field-bound image) survives a round-trip', roundTrip.pages[0].elements[2], logo);
  equalDeep('shape element survives a round-trip', roundTrip.pages[0].elements[3], shape);
  equalDeep('icon element survives a round-trip', roundTrip.pages[0].elements[4], icon);

  const badIcon = brochureDoc.normalizeDoc({ pages: [{ elements: [{ type: 'icon', icon: 'nope' }] }] });
  ok('unknown icon key falls back', badIcon.pages[0].elements[0].icon === require('../src/services/brochureIcons').DEFAULT_ICON);

  const rejField = brochureDoc.normalizeDoc({ pages: [{ elements: [{ type: 'image', field: 'nope' }] }] });
  ok('rejects an unknown image field', rejField.pages[0].elements[0].field === '');

  const dropped = brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'video', url: 'x' }, { type: 'text', text: 'kept' }] }],
  });
  ok('drops unknown element types', dropped.pages[0].elements.length === 1);
  ok('keeps known ones alongside', dropped.pages[0].elements[0].text === 'kept');

  const clamped = brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'text', size: 9999, opacity: 12, w: -5 }] }],
  });
  const el = clamped.pages[0].elements[0];
  ok('clamps font size', el.size === 400);
  ok('clamps opacity', el.opacity === 1);
  ok('forces a positive width', el.w >= 1);

  const badField = brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'text', field: 'evil_field' }] }],
  });
  ok('rejects an unknown merge field', badField.pages[0].elements[0].field === '');
});

describe('brochureDoc.fillDoc', () => {
  const template = {
    pages: [
      { bg: { type: 'image', slot: 'cover' }, elements: [{ type: 'text', field: 'property_name', text: 'PLACEHOLDER' }] },
      { elements: [{ type: 'image', slot: 'photo_1' }, { type: 'image', slot: 'photo_2' }] },
    ],
  };
  const images = [{ url: 'a.jpg' }, { url: 'b.jpg' }, { url: 'c.jpg' }];
  const filled = brochureDoc.fillDoc(template, images, { property_name: 'Dunecastle Villas' });

  ok('fills the background slot first', filled.pages[0].bg.url === 'a.jpg');
  ok('fills slots in document order', filled.pages[1].elements[0].url === 'b.jpg');
  ok('and keeps going', filled.pages[1].elements[1].url === 'c.jpg');
  ok('resolves merge fields', filled.pages[0].elements[0].text === 'Dunecastle Villas');

  // Fewer photos than slots must not leave holes — the pool wraps.
  const short = brochureDoc.fillDoc(template, [{ url: 'only.jpg' }], {});
  ok('reuses photos when there are fewer than slots', short.pages[1].elements[1].url === 'only.jpg');

  const empty = brochureDoc.fillDoc(template, [], {});
  ok('survives having no photos at all', empty.pages[1].elements[0].url === '');

  // A logo is a field-bound image: filled from `fields.logo`, and NOT drawn from the
  // photo pool, so the same logo lands on every page that references it.
  const withLogo = {
    pages: [
      { elements: [{ type: 'image', field: 'logo' }, { type: 'image', slot: 'photo_1' }] },
      { elements: [{ type: 'image', field: 'logo' }] },
    ],
  };
  const filledLogo = brochureDoc.fillDoc(withLogo, [{ url: 'p1.jpg' }], { logo: 'brand.png' });
  ok('logo fills from the field', filledLogo.pages[0].elements[0].url === 'brand.png');
  ok('logo does not consume a photo slot', filledLogo.pages[0].elements[1].url === 'p1.jpg');
  ok('the same logo lands on every page', filledLogo.pages[1].elements[0].url === 'brand.png');

  const back = brochureDoc.toTemplateDoc(filled);
  ok('toTemplateDoc empties slotted images', back.pages[1].elements[0].url === '');
  ok('toTemplateDoc empties the slotted background', back.pages[0].bg.url === '');
  ok('but keeps the layout', back.pages[1].elements.length === 2);

  const backLogo = brochureDoc.toTemplateDoc(filledLogo);
  ok('toTemplateDoc releases the logo so a reused design re-brands', backLogo.pages[0].elements[0].url === '');

  // A photo placed by hand (no slot, no field) is the designer's choice, not a refill target.
  const manual = brochureDoc.toTemplateDoc({
    pages: [{ elements: [{ type: 'image', url: 'hero.jpg', slot: '' }] }],
  });
  ok('toTemplateDoc keeps un-slotted photos', manual.pages[0].elements[0].url === 'hero.jpg');
});

describe('brochureDoc.retheme', () => {
  // A deck literally holds palette strings on its elements, so swapping old for new
  // restyles the whole document — while a hand-picked colour is left alone.
  const deck = brochureThemes.buildDeck('luxury-editorial', 12);
  const oldAccent = deck.theme.accent;

  // Plant a manual override that matches no palette entry.
  deck.pages[0].elements.push({ type: 'text', text: 'X', color: '#ff00ff', x: 0, y: 0, w: 10, h: 10 });

  const before = brochureDoc.countColor(deck, oldAccent);
  ok('the deck uses its accent in several places', before >= 3);

  const themed = brochureDoc.retheme(deck, { accent: '#123abc' });
  ok('accent is swapped on theme', themed.theme.accent === '#123abc');
  ok('every use of the old accent is recoloured', brochureDoc.countColor(themed, oldAccent) === 0);
  ok('the new accent now appears', brochureDoc.countColor(themed, '#123abc') >= before);
  ok('a hand-picked colour is left alone', brochureDoc.countColor(themed, '#ff00ff') === 1);

  const retyped = brochureDoc.retheme(deck, { fontHeading: 'Lora' });
  const usesLora = retyped.pages.some((p) => p.elements.some((e) => e.font === 'Lora'));
  ok('a font swap propagates', usesLora);
});

describe('brochureDoc.cdnUrl', () => {
  const raw = 'https://res.cloudinary.com/demo/image/upload/v123/travel-bot/brochures/x.jpg';
  ok('injects a derivative transform', brochureDoc.cdnUrl(raw, 1600).includes('/upload/f_auto,q_auto,c_limit,w_1600/'));
  ok('leaves non-Cloudinary URLs alone', brochureDoc.cdnUrl('https://example.com/a.jpg', 800) === 'https://example.com/a.jpg');
  ok('does not double-transform', brochureDoc.cdnUrl(brochureDoc.cdnUrl(raw, 400), 1600).split('f_auto').length === 2);
  ok('handles an empty url', brochureDoc.cdnUrl('', 400) === '');
});

describe('brochureDoc.renderDocHtml', () => {
  const doc = brochureDoc.fillDoc(
    { size: 'portrait', pages: [{ elements: [{ type: 'text', text: 'Hi', x: 5, y: 6 }] }] },
    [], {},
  );
  const html = brochureDoc.renderDocHtml(doc);

  ok('sets the page box to the doc size', html.includes(`@page { size: ${doc.pageW}px ${doc.pageH}px; margin: 0; }`));
  ok('positions elements absolutely', html.includes('left:5px') && html.includes('top:6px'));
  ok('loads the brochure fonts', html.includes('fonts.googleapis.com'));

  // A padded image must be wrapped, or CSS padding grows the box instead of insetting
  // the picture — the editor and the PDF have to agree on this.
  const padded = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'image', url: 'https://x/a.jpg', padding: { top: 10, right: 10, bottom: 10, left: 10 } }] }],
  }));
  ok('wraps a padded image', (padded.match(/<img/g) || []).length === 1 && padded.includes('padding:10px'));

  // A gradient plate must render — it goes through `background`, not `backgroundColor`.
  const plate = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'shape', fill: 'linear-gradient(0deg, #000, #fff)' }] }],
  }));
  ok('renders a gradient shape fill', plate.includes('background:linear-gradient(0deg, #000, #fff)'));

  // The doc is user-authored and rendered server-side. Text must never become markup.
  const nasty = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'text', text: '<script>alert(1)</script>' }] }],
  }));
  ok('escapes text content', !nasty.includes('<script>alert(1)</script>'));
  ok('and encodes it instead', nasty.includes('&lt;script&gt;'));

  const svgOut = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'icon', icon: 'pool', color: '#0e9aa7' }] }],
  }));
  ok('renders an icon as inline svg', svgOut.includes('<svg') && svgOut.includes('stroke="#0e9aa7"'));
});

describe('brochureThemes presets', () => {
  const KEYS = brochureThemes.listPresets().map((p) => p.key);
  ok('ships ten designs', KEYS.length === 10);

  // Count empty image slots left after filling a deck with `count` photos. The real
  // invariant is not "slots <= count" — galleries deliberately reuse a photo on the
  // contact page — but "the finished deck has NO empty photo boxes".
  const emptySlots = (doc, count) => {
    const filled = brochureDoc.fillDoc(
      doc,
      Array.from({ length: count }, (_, i) => ({ url: `p${i}.jpg` })),
      {},
    );
    let empty = 0;
    filled.pages.forEach((p) => {
      if (p.bg.type === 'image' && p.bg.slot && !p.bg.url) empty += 1;
      p.elements.forEach((e) => { if (e.type === 'image' && e.slot && !e.url) empty += 1; });
    });
    return empty;
  };

  KEYS.forEach((key) => {
    const deck = brochureThemes.buildDeck(key, 24);
    ok(`${key}: builds a multi-page deck`, deck.pages.length >= 2);
    ok(`${key}: opens on a photo cover`, deck.pages[0].bg.type === 'image');
    ok(`${key}: leaves no empty photo boxes`, emptySlots(deck, 24) === 0);
  });

  const tiny = brochureThemes.buildDeck('luxury-editorial', 3);
  ok('still produces a deck from only 3 photos', tiny.pages.length >= 1);
  ok('a 3-photo deck has no empty boxes', emptySlots(tiny, 3) === 0);

  const small = brochureThemes.buildDeck('mono-editorial', 8).pages.length;
  const big = brochureThemes.buildDeck('mono-editorial', 40).pages.length;
  ok('a bigger photo set yields more (or equal) pages', big >= small);

  ok('an unknown preset falls back rather than throwing', brochureThemes.buildDeck('nope', 12).pages.length > 1);

  // A page-shape override must REBUILD at that size, not squash the portrait layout.
  const land = brochureThemes.buildDeck('luxury-editorial', 24, 'landscape');
  ok('honours a landscape override', land.pageW > land.pageH);

  const blank = brochureThemes.blankDeck();
  ok('blankDeck is a single empty page', blank.pages.length === 1 && blank.pages[0].elements.length === 0);

  // listPresets must be serialisable — no functions leak to the client.
  const serialisable = brochureThemes.listPresets().every((p) => typeof p.build === 'undefined');
  ok('listPresets carries no build fn', serialisable);
});

describe('brochureIcons mirror', () => {
  // The backend registry (brochureIcons.ts) and its frontend ESM twin
  // (brochureIcons.js) must stay content-identical. Evaluate the frontend module
  // as CommonJS-free source and compare the ICONS/DEFAULT they expose.
  const fs = require('fs');
  const path = require('path');
  const backendIcons = require('../src/services/brochureIcons');
  const frontendSrc = fs.readFileSync(
    path.join(__dirname, '../../frontend/src/utils/brochureIcons.js'), 'utf8'
  ).replace(/export const /g, 'const ');
  // eslint-disable-next-line no-new-func
  const frontendIcons = new Function(`${frontendSrc}; return { ICONS, ICON_KEYS, DEFAULT_ICON };`)();
  ok('icon registries are a content-identical mirror',
    JSON.stringify(backendIcons.ICONS) === JSON.stringify(frontendIcons.ICONS));
  ok('icon DEFAULT matches across the mirror', backendIcons.DEFAULT_ICON === frontendIcons.DEFAULT_ICON);
});
