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
  const doc = brochureDoc.normalizeDoc({});
  ok('defaults to a landscape page', doc.pageW === 1122 && doc.pageH === 794);
  ok('always yields at least one page', doc.pages.length === 1);

  const parsed = brochureDoc.normalizeDoc(JSON.stringify({ size: 'portrait', pages: [] }));
  ok('accepts a JSON string payload', parsed.pageW === 794);

  const bogus = brochureDoc.normalizeDoc({ size: 'hexagon' });
  ok('falls back on an unknown page size', bogus.size === 'landscape');

  // Every property the editor writes must survive a round-trip. If you add one to
  // BrochureInspector, add it here — that is the whole point of this test.
  const text = {
    id: 't1', type: 'text', text: 'Hello', field: 'property_name',
    x: 10, y: 20, w: 300, h: 80, rotate: 15, z: 4, opacity: 0.9, locked: false,
    font: 'Anton', size: 42, weight: 700, lineHeight: 1.4, letterSpacing: 2,
    color: '#ff0000', align: 'center', valign: 'center', uppercase: true,
  };
  const image = {
    id: 'i1', type: 'image', url: 'https://x/a.jpg', slot: 'photo_1',
    x: 1, y: 2, w: 3, h: 4, rotate: 0, z: 1, opacity: 1, locked: false,
    fit: 'contain', radius: 12,
  };
  const shape = {
    id: 's1', type: 'shape', shape: 'ellipse',
    x: 0, y: 0, w: 50, h: 50, rotate: 0, z: 2, opacity: 1, locked: false,
    fill: '#000000', stroke: '#fff', strokeWidth: 3, radius: 0,
  };

  const roundTrip = brochureDoc.normalizeDoc({
    pages: [{ id: 'p1', bg: { type: 'color', color: '#fff' }, elements: [text, image, shape] }],
  });

  equalDeep('text element survives a round-trip', roundTrip.pages[0].elements[0], text);
  equalDeep('image element survives a round-trip', roundTrip.pages[0].elements[1], image);
  equalDeep('shape element survives a round-trip', roundTrip.pages[0].elements[2], shape);

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

  const back = brochureDoc.toTemplateDoc(filled);
  ok('toTemplateDoc empties slotted images', back.pages[1].elements[0].url === '');
  ok('toTemplateDoc empties the slotted background', back.pages[0].bg.url === '');
  ok('but keeps the layout', back.pages[1].elements.length === 2);

  // A photo placed by hand (no slot) is the designer's choice, not a refill target.
  const manual = brochureDoc.toTemplateDoc({
    pages: [{ elements: [{ type: 'image', url: 'logo.png', slot: '' }] }],
  });
  ok('toTemplateDoc keeps un-slotted photos', manual.pages[0].elements[0].url === 'logo.png');
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
    { pages: [{ elements: [{ type: 'text', text: 'Hi', x: 5, y: 6 }] }] },
    [], {},
  );
  const html = brochureDoc.renderDocHtml(doc);

  ok('sets the page box to the doc size', html.includes('@page { size: 1122px 794px; margin: 0; }'));
  ok('positions elements absolutely', html.includes('left:5px') && html.includes('top:6px'));
  ok('loads the brochure fonts', html.includes('fonts.googleapis.com'));

  // The doc is user-authored and rendered server-side. Text must never become markup.
  const nasty = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
    pages: [{ elements: [{ type: 'text', text: '<script>alert(1)</script>' }] }],
  }));
  ok('escapes text content', !nasty.includes('<script>alert(1)</script>'));
  ok('and encodes it instead', nasty.includes('&lt;script&gt;'));
});

describe('brochureThemes.buildDeck', () => {
  const deck = brochureThemes.buildDeck('beach', 24);
  const slots = brochureDoc.countSlots(deck);

  ok('builds a multi-page deck', deck.pages.length > 6);
  ok('opens on a cover with a photo background', deck.pages[0].bg.type === 'image');
  ok('never asks for more photos than were uploaded', slots <= 24);

  const tiny = brochureThemes.buildDeck('luxury', 3);
  ok('still produces a deck from only 3 photos', tiny.pages.length >= 1);
  ok('and does not over-ask', brochureDoc.countSlots(tiny) <= 3);

  const big = brochureThemes.buildDeck('minimal', 40);
  ok('scales up to a large photo set', big.pages.length > brochureThemes.buildDeck('minimal', 10).pages.length);

  ok('every theme builds', ['beach', 'luxury', 'minimal'].every((t) => brochureThemes.buildDeck(t, 12).pages.length > 1));
  ok('an unknown theme falls back rather than throwing', brochureThemes.buildDeck('nope', 12).pages.length > 1);

  const blank = brochureThemes.blankDeck();
  ok('blankDeck is a single empty page', blank.pages.length === 1 && blank.pages[0].elements.length === 0);
});
