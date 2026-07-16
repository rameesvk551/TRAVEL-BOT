# Editorial Brochure Decks (Coastal Teal / Noir / Deco) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship three faithful, fully-editable, one-tap-recolorable brochure presets (Coastal Teal, Noir Editorial, Deco Midnight) that reproduce the client's Dunecastle reference decks, plus a new `icon` element and an "add page by layout" menu.

**Architecture:** Presets are template docs of absolutely-positioned elements (image/text/shape/**icon**); the editor drags the same DOM the Puppeteer renderer prints, so there is one render path and no WYSIWYG drift. `backend/src/services/brochureDoc.ts` (the spec) is hand-mirrored by `frontend/src/utils/brochureDoc.js`; `brochureThemes.ts` (backend-only) holds palettes + page factories. Recolor is the existing `retheme` string-swap — an icon whose `color` is a palette value recolors for free.

**Tech Stack:** Node/TS backend, dependency-free custom test harness (`backend/tests/_harness`, run with `npm test` in `backend/`), React + Vite frontend, Tailwind, Cloudinary derivatives, Puppeteer PDF.

**Design doc:** `docs/plans/2026-07-15-brochure-editorial-decks-design.md`

**Reference source files (read-only):** `C:\Users\ACER\www\Dunecastle\Dunecastle-Brochure-04-Noir-Editorial.html`, `...-05-Deco-Midnight.html`, `...-06-Coastal-Teal.html`.

**Global rules:** DRY, YAGNI, TDD where the code is pure (all backend logic), frequent commits. Every property the editor can write MUST be added to `normalizeElement` AND covered in `brochureDoc.test.ts` — the normalizer is a whitelist and silently drops unknown fields (see [[flow-builder-silent-drops]]). Backend `brochureDoc.ts` and frontend `brochureDoc.js` are a contract: change one, change the other.

---

## Task 1: Icon registry (shared, mirrored)

**Files:**
- Create: `backend/src/services/brochureIcons.ts`
- Create: `frontend/src/utils/brochureIcons.js`

**Step 1: Author the registry.** Each entry is `{ label, body }` where `body` is the **raw inner SVG markup** (a string of `<path>`/`<rect>`/`<circle>` elements) drawn on a 24×24 grid, stroke-based (no fill), with NO `stroke`/`stroke-width` attributes on the inner elements — those are inherited from the parent `<svg>` so the icon recolors from `el.color`. A `body` string (not a `paths` array) is required because the reference icons use `<rect>` and `<circle>`, not only `<path>` (e.g. "Indoor Games" is a rect + five circles). Lift the 9 amenity bodies **verbatim** from `Dunecastle-Brochure-06-Coastal-Teal.html` line 370 (`pool, kids, games, dining, parking, grill, outdoor, party, ac`), then add: `wifi, bed, bath, spa, gym, view, pet, coffee, star`. Structure:

```js
// backend/src/services/brochureIcons.ts  (CommonJS to match this repo's services)
const ICONS = Object.freeze({
  pool: { label: 'Pool', body: "<path d='M2 16.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2'/><path d='M2 12.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2'/><path d='M8 12V6.2A2.2 2.2 0 0 1 12.4 6M15.6 12V6.2A2.2 2.2 0 0 1 20 6'/>" },
  games: { label: 'Indoor games', body: "<rect x='4' y='4' width='16' height='16' rx='3.4'/><circle cx='8.5' cy='8.5' r='1.1'/><circle cx='15.5' cy='8.5' r='1.1'/><circle cx='12' cy='12' r='1.1'/><circle cx='8.5' cy='15.5' r='1.1'/><circle cx='15.5' cy='15.5' r='1.1'/>" },
  // …kids, dining, parking, grill, outdoor, party, ac lifted from the reference file; wifi/bed/bath/spa/gym/view/pet/coffee/star authored to match…
});
const ICON_KEYS = Object.freeze(Object.keys(ICONS));
const DEFAULT_ICON = 'star';
module.exports = { ICONS, ICON_KEYS, DEFAULT_ICON };
```

The frontend file is byte-identical except `export const ICONS = …; export const ICON_KEYS = …; export const DEFAULT_ICON = …;`. The inner markup is developer-authored (never user input), so injecting it raw is safe (`dangerouslySetInnerHTML` on the frontend `<svg>`, raw string on the backend).

**Step 2: Verify both parse.** Run: `node -e "console.log(require('./backend/src/services/brochureIcons').ICON_KEYS.length)"` — Expected: `17` (or your final count). Frontend is checked by the Vite build in Task 7.

**Step 3: Commit.**
```bash
git add backend/src/services/brochureIcons.ts frontend/src/utils/brochureIcons.js
git commit -m "feat(brochure): shared icon registry for the editorial decks"
```

---

## Task 2: The `icon` element in the spec (backend)

**Files:**
- Modify: `backend/src/services/brochureDoc.ts` — `ELEMENT_TYPES` (line 68), `normalizeElement` (line 416), `renderElement` (line 604), imports.
- Test: `backend/tests/brochureDoc.test.ts`.

**Step 1: Write the failing test.** In `brochureDoc.test.ts`, inside `describe('brochureDoc.normalizeDoc', …)`, add an icon fixture next to the others and a round-trip assertion:
```js
const icon = {
  id: 'ic1', type: 'icon', icon: 'pool',
  x: 5, y: 6, w: 40, h: 40, rotate: 0, z: 5, opacity: 1, locked: false,
  color: '#0e9aa7', strokeWidth: 1.5,
};
// add `icon` to the elements array of the roundTrip doc, then:
equalDeep('icon element survives a round-trip', roundTrip.pages[0].elements[4], icon);
const badIcon = brochureDoc.normalizeDoc({ pages: [{ elements: [{ type: 'icon', icon: 'nope' }] }] });
ok('unknown icon key falls back', badIcon.pages[0].elements[0].icon === require('../src/services/brochureIcons').DEFAULT_ICON);
```
Add to `describe('brochureDoc.renderDocHtml', …)`:
```js
const svg = brochureDoc.renderDocHtml(brochureDoc.normalizeDoc({
  pages: [{ elements: [{ type: 'icon', icon: 'pool', color: '#0e9aa7' }] }],
}));
ok('renders an icon as inline svg', svg.includes('<svg') && svg.includes('stroke:#0e9aa7') === false && svg.includes('stroke="#0e9aa7"'));
```
(Use whichever stroke form you implement — assert the one you emit.)

**Step 2: Run to verify it fails.** Run: `cd backend && npm test` — Expected: FAIL (`icon` type dropped as unknown; no `<svg>` in output).

**Step 3: Implement.**
- Top of file, near the other requires: `const { ICON_KEYS, DEFAULT_ICON, ICONS } = require('./brochureIcons');` and `const ICON_KEY_SET = new Set(ICON_KEYS);`
- `ELEMENT_TYPES` → `Object.freeze(['image', 'text', 'shape', 'icon']);`
- In `normalizeElement`, before the final shape return, add:
```js
if (raw.type === 'icon') {
  return {
    ...base,
    icon: ICON_KEY_SET.has(raw.icon) ? raw.icon : DEFAULT_ICON,
    color: str(raw.color, '#111111'),
    strokeWidth: clamp(num(raw.strokeWidth, 1.5), 0.2, 8),
  };
}
```
- In `renderElement`, before the shape fallback (`body` is trusted registry markup, injected raw — not `esc`'d):
```js
if (el.type === 'icon') {
  const body = (ICONS[el.icon] || ICONS[DEFAULT_ICON]).body;
  const box = styleToCss({ ...elementStyle(el), overflow: 'visible' });
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${esc(el.color || '#111')}" `
    + `stroke-width="${num(el.strokeWidth, 1.5)}" stroke-linecap="round" stroke-linejoin="round" `
    + `style="${box}">${body}</svg>`;
}
```

**Step 4: Run to verify it passes.** Run: `cd backend && npm test` — Expected: PASS (icon round-trip + svg render green).

**Step 4b: Add a mirror-drift guard.** The backend and frontend icon registries must stay content-identical; nothing enforces it yet. Add a small test (new `describe('brochureIcons mirror', …)` in `brochureDoc.test.ts`) that reads the frontend file from disk, strips the `export ` prefixes so it can be evaluated as CommonJS, and asserts the two `ICONS` objects are `JSON.stringify`-equal and `DEFAULT_ICON` matches:
```js
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
```
Run: `cd backend && npm test` — Expected: PASS. (If it can't resolve the relative path from the compiled/run location, adjust the path but keep the assertion.)

**Step 5: Commit.**
```bash
git add backend/src/services/brochureDoc.ts backend/tests/brochureDoc.test.ts
git commit -m "feat(brochure): icon element type in the document spec + render"
```

---

## Task 3: Fonts (Sora / Archivo / Bricolage Grotesque / Cinzel)

**Files:**
- Modify: `backend/src/services/brochureDoc.ts` — `FONTS` (line 31), `GOOGLE_FONTS_HREF` (line 51).
- Modify: `frontend/src/utils/brochureDoc.js` — `FONTS` (line 23).
- Modify: `frontend/index.html` — brochure font `<link>` (line 26).

**Step 1: Add four font entries** to `FONTS` in **both** brochureDoc files (identical):
```js
{ key: 'Sora', stack: "'Sora', Helvetica, sans-serif", label: 'Sora' },
{ key: 'Archivo', stack: "'Archivo', Helvetica, sans-serif", label: 'Archivo' },
{ key: 'Bricolage Grotesque', stack: "'Bricolage Grotesque', Impact, sans-serif", label: 'Bricolage Grotesque' },
{ key: 'Cinzel', stack: "'Cinzel', Georgia, serif", label: 'Cinzel' },
```

**Step 2: Add the families to the backend `GOOGLE_FONTS_HREF`:**
```
+ '&family=Sora:wght@300;400;500;600;700'
+ '&family=Archivo:wght@400;500;600;700'
+ '&family=Bricolage+Grotesque:wght@400;700;800'
+ '&family=Cinzel:wght@400;500;600'
```

**Step 3: Sync `frontend/index.html`'s brochure link.** Add the same four families to the `css2?family=…` URL on line 26 (append `&family=Sora:wght@300;400;500;600;700&family=Archivo:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;700;800&family=Cinzel:wght@400;500;600`). Also add `&family=Jost:wght@300;400;500;600` (Deco's body — present in the backend href but missing here).

**Step 4: Verify.** Run: `cd backend && npm test` — Expected: PASS (existing `loads the brochure fonts` assertion still green). Frontend link verified visually in Task 10.

**Step 5: Commit.**
```bash
git add backend/src/services/brochureDoc.ts frontend/src/utils/brochureDoc.js frontend/index.html
git commit -m "feat(brochure): add Sora/Archivo/Bricolage/Cinzel to the font set"
```

---

## Task 4: The three palettes + style knobs

**Files:**
- Modify: `backend/src/services/brochureThemes.ts` — `THEMES` (line 23).

**Step 1: Add three theme entries** to `THEMES`. Colours from each reference file's `:root`; the two accent slots collapse the extra shades (design decision #6). Each also carries a `style` knob block consumed by the factories in Task 5.

```js
coastalTeal: {
  key: 'coastalTeal', name: 'Coastal Teal',
  bg: '#f1faf9', panel: '#ffffff', ink: '#123a3a', inkSoft: '#3e6360', inkMute: '#7fa19d',
  accent: '#0e9aa7', accent2: '#f0784b', display: 'Sora', body: 'Sora',
  radius: 18, tileBorder: 0, tileBorderColor: 'transparent', logoRing: 0, onImage: '#ffffff',
  coverVeil: 'linear-gradient(180deg, rgba(8,40,44,0.42) 0%, rgba(8,40,44,0.08) 45%, rgba(8,40,44,0.66) 100%)',
  contactVeil: 'linear-gradient(120deg, rgba(8,58,64,0.90) 0%, rgba(8,58,64,0.55) 60%, rgba(8,58,64,0.32) 100%)',
  italicNumerals: false,
  style: { numeral: 'badge-filled', headingUpper: false, tag: 'pill', coverMeta: true, iconAmenities: true },
},
noir: {
  key: 'noir', name: 'Noir Editorial',
  bg: '#f4f2ec', panel: '#ffffff', ink: '#151515', inkSoft: '#4a4a46', inkMute: '#8a887f',
  accent: '#127069', accent2: '#199085', display: 'Bricolage Grotesque', body: 'Archivo',
  radius: 2, tileBorder: 0, tileBorderColor: 'transparent', logoRing: 0, onImage: '#ffffff',
  coverVeil: 'linear-gradient(180deg, rgba(10,12,12,0.55) 0%, rgba(10,12,12,0.12) 42%, rgba(10,12,12,0.72) 100%)',
  contactVeil: 'linear-gradient(120deg, rgba(10,12,12,0.90) 0%, rgba(10,12,12,0.55) 60%, rgba(10,12,12,0.32) 100%)',
  italicNumerals: false,
  style: { numeral: 'outline', headingUpper: true, tag: 'square', coverMeta: true, iconAmenities: true },
},
deco: {
  key: 'deco', name: 'Deco Midnight',
  bg: '#0e1a3a', panel: '#132248', ink: '#f2ecdd', inkSoft: '#c6c0ac', inkMute: '#8f8a76',
  accent: '#c9a24b', accent2: '#e2c47e', display: 'Cinzel', body: 'Jost',
  radius: 4, tileBorder: 1, tileBorderColor: 'rgba(201,162,75,0.30)', logoRing: 1, onImage: '#f2ecdd',
  coverVeil: 'linear-gradient(180deg, rgba(6,12,28,0.55) 0%, rgba(6,12,28,0.15) 42%, rgba(6,12,28,0.75) 100%)',
  contactVeil: 'linear-gradient(120deg, rgba(6,12,28,0.90) 0%, rgba(6,12,28,0.55) 60%, rgba(6,12,28,0.35) 100%)',
  italicNumerals: false,
  style: { numeral: 'framed-circle', headingUpper: true, tag: 'square', coverMeta: true, iconAmenities: true },
},
```
Existing themes have no `style` block — default it in Task 5 with `const S = t.style || {};`.

**Step 2: Commit** (tested via Task 6).
```bash
git add backend/src/services/brochureThemes.ts
git commit -m "feat(brochure): coastalTeal / noir / deco palettes + style knobs"
```

---

## Task 5: Faithful page factories

**Files:**
- Modify: `backend/src/services/brochureThemes.ts` — `sectionHead`, `roomsPage`, `amenitiesPage`, `coverPage`, `introPage`; add an `iconEl` factory.

**Step 1: Add the `iconEl` factory** next to `img`/`txt`/`shape`:
```js
function iconEl(t, name, x, y, size) {
  return { id: uid('ic'), type: 'icon', icon: name, x, y, w: size, h: size,
    rotate: 0, z: 5, opacity: 1, locked: false, color: t.accent, strokeWidth: 1.5 };
}
```

**Step 2: `sectionHead` — numeral by style knob.** Replace the plain numeral `txt(...)` with a switch on `(t.style||{}).numeral`:
- `'badge-filled'` (Coastal): a filled accent circle `shape(...)` (`radius: 9999`, `fill: t.accent`) + a centred white numeral `txt` on top.
- `'outline'` (Noir): a large numeral `txt` with `color: 'transparent'` is not supported by the text renderer, so approximate with `color: t.accent` at low opacity + heavy weight (document the compromise inline).
- `'framed-circle'` (Deco): a ringed circle `shape(fill:'transparent', stroke:t.accent, strokeWidth:1)` top-right + numeral `txt`.
- default `'text'`: the current right-aligned accent `txt`.

**Step 3: `roomsPage` — pill/square tags.** After the room name, emit two tag elements per room from a `['2 villas','Up to 5 guests']`-style default. Each tag = a `shape` (rounded when `style.tag==='pill'`: `radius: mm(3)`, `fill: 'rgba(14,154,167,0.10)'`; square when `'square'`: `radius: 0`, `fill:'transparent'`, `strokeWidth: 1`, `stroke: t.accent`) + a `txt` label on top (`color: t.accent`, `size: pt(7.5)`, uppercase).

**Step 4: `amenitiesPage` — icon list.** When `(t.style||{}).iconAmenities`, replace the two plain text columns with a 2-column list of rows; each row = `iconEl(t, key, x, y, mm(6))` + a `txt` label beside it. Use a fixed list of 8–10 `{ icon, label }` (pool/kids/games/dining/parking/grill/outdoor/party/ac/wifi). Keep the bottom tile strip.

**Step 5: `coverPage` — meta row.** When `(t.style||{}).coverMeta`, keep the existing bottom `amenities`-field text but format as the `Infinity Pool ◆ Stone Suites ◆ Up to 50 Guests` row (already a centred `txt`; just ensure the field default reads well). No structural change required beyond confirming it renders.

**Step 6: `introPage` — accent2 pop.** The 4-stat strip already colours numbers `t.accent2`; confirm one stat uses the pop colour as in the reference. No new element types.

**Step 7: Run the suite** (green once Task 6 wires the presets). Run: `cd backend && npm test`.

**Step 8: Commit.**
```bash
git add backend/src/services/brochureThemes.ts
git commit -m "feat(brochure): faithful numerals, room tags, icon amenities in factories"
```

---

## Task 6: Register the three presets + guard the count

**Files:**
- Modify: `backend/src/services/brochureThemes.ts` — `PRESETS` (line 703).
- Test: `backend/tests/brochureDoc.test.ts` — `ships ten designs` (line 225).

**Step 1: Update the failing count test** to the new total:
```js
ok('ships thirteen designs', KEYS.length === 13);
```
Run: `cd backend && npm test` — Expected: FAIL (still 10 presets).

**Step 2: Add three PRESETS entries:**
```js
{ key: 'coastal-teal-editorial', name: 'Coastal Teal', description: 'Teal & coral on near-white, Sora. Beach and resort stays.', kind: 'editorial', theme: 'coastalTeal', size: 'portrait' },
{ key: 'noir-editorial', name: 'Noir Editorial', description: 'Ink on warm paper, Bricolage + Archivo, outline numerals.', kind: 'editorial', theme: 'noir', size: 'portrait' },
{ key: 'deco-midnight-editorial', name: 'Deco Midnight', description: 'Navy & brass, Cinzel, framed numerals. Formal and rich.', kind: 'editorial', theme: 'deco', size: 'portrait' },
```

**Step 3: Run.** Run: `cd backend && npm test` — Expected: PASS. The existing `KEYS.forEach` loop now also asserts each new deck **builds a multi-page deck, opens on a photo cover, and leaves no empty photo boxes** at 24 photos. If "no empty photo boxes" fails, an added element/page consumed a slot without the `take()` budget — fix the page's photo budget, not the test.

**Step 4: Commit.**
```bash
git add backend/src/services/brochureThemes.ts backend/tests/brochureDoc.test.ts
git commit -m "feat(brochure): ship Coastal Teal / Noir / Deco presets"
```

---

## Task 7: Frontend render of the icon element

**Files:**
- Modify: `frontend/src/utils/brochureDoc.js` — add `newIconElement`.
- Modify: `frontend/src/components/brochure/BrochureCanvas.jsx` — `renderElement` (before the shape fallback, line 242).
- Modify: `frontend/src/components/brochure/BrochurePagePreview.jsx` — element map (before the shape fallback, line 55).
- Modify: `frontend/src/components/brochure/BrochureInspector.jsx` — icon panel + gate "Spacing & border".

**Step 1: `newIconElement`** in `brochureDoc.js` (alongside `newShapeElement`):
```js
export function newIconElement(pageW, pageH) {
  return { id: newId('ic'), type: 'icon', icon: 'star',
    x: Math.round(pageW / 2 - 24), y: Math.round(pageH / 2 - 24), w: 48, h: 48,
    rotate: 0, z: 10, opacity: 1, color: '#111827', strokeWidth: 1.5 };
}
```

**Step 2: A shared React icon renderer.** In both `BrochureCanvas.jsx` and `BrochurePagePreview.jsx`, import `{ ICONS, DEFAULT_ICON }` from `../../utils/brochureIcons` and `elementStyle` from `../../utils/brochureDoc`, then render an icon element:
```jsx
// canvas (interactive): spread {...common} for drag/select
const def = ICONS[el.icon] || ICONS[DEFAULT_ICON];
return (
  <svg {...common} key={el.id} viewBox="0 0 24 24" fill="none"
    stroke={el.color || '#111'} strokeWidth={el.strokeWidth || 1.5}
    strokeLinecap="round" strokeLinejoin="round"
    style={{ ...elementStyle(el), overflow: 'visible', cursor: 'move' }}
    dangerouslySetInnerHTML={{ __html: def.body }} />
);
```
In `BrochurePagePreview.jsx` use the same JSX without `{...common}`/`cursor`. (`def.body` is trusted registry markup, never user input.)

**Step 3: Inspector — icon panel.** In `BrochureInspector.jsx`:
- Import `{ ICONS, ICON_KEYS }` from `../../utils/brochureIcons`.
- Change the spacing/border gate from `element.type !== 'shape'` to `(element.type === 'text' || element.type === 'image')` so icons (like shapes) skip padding/border.
- Add, next to the `shape` panel:
```jsx
{element.type === 'icon' && (
  <Section title="Icon">
    <Field label="Icon">
      <select className={input} value={element.icon} onChange={(e) => onPatchElement({ icon: e.target.value })}>
        {ICON_KEYS.map((k) => <option key={k} value={k}>{ICONS[k].label}</option>)}
      </select>
    </Field>
    <Color label="Colour" value={element.color} onChange={(color) => onPatchElement({ color })} />
    <Num label="Line weight" value={element.strokeWidth} min={0.2} max={8} step={0.1} onChange={(strokeWidth) => onPatchElement({ strokeWidth })} />
  </Section>
)}
```

**Step 4: (Optional, same task) veil presets.** In the Page tab Overlay `<select>` (line 382), add the deck veils as options (Coastal `rgba(8,40,44,…)`, Deco `rgba(6,12,28,…)`) so recoloring a cover stays on-theme.

**Step 5: Verify the build.** Run: `cd frontend && npm run build` — Expected: builds with no errors. Then `npm run dev`, open a brochure, add an icon, confirm it renders, recolors from the Brand tab, and survives a reload (round-trips through the backend normalizer from Task 2).

**Step 6: Commit.**
```bash
git add frontend/src/utils/brochureDoc.js frontend/src/components/brochure/BrochureCanvas.jsx frontend/src/components/brochure/BrochurePagePreview.jsx frontend/src/components/brochure/BrochureInspector.jsx
git commit -m "feat(brochure): render + inspect the icon element in the editor"
```

---

## Task 8: "Add icon" toolbar button

**Files:**
- Modify: `frontend/src/pages/BrochureEditor.jsx` — import (line 15), toolbar (line 383).

**Step 1:** Add `newIconElement` to the `brochureDoc` import on line 15.

**Step 2:** After the "Add shape" button (line 385), add:
```jsx
<button onClick={() => addElement(newIconElement)} className="rounded-md p-2 hover:bg-slate-100" title="Add icon">
  <SparklesIcon className="h-5 w-5" />
</button>
```
Import `SparklesIcon` from `@heroicons/react/24/outline` with the other icons.

**Step 3: Verify.** Run: `cd frontend && npm run build` — Expected: no errors. In `npm run dev`, click the new button → an icon element appears and is selected.

**Step 4: Commit.**
```bash
git add frontend/src/pages/BrochureEditor.jsx
git commit -m "feat(brochure): add-icon button in the editor toolbar"
```

---

## Task 9: "+ Page → pick a layout" menu

**Files:**
- Modify: `backend/src/services/brochureThemes.ts` — export `buildPage`; deck builders set `styleKey`.
- Modify: `backend/src/services/brochureDoc.ts` — whitelist `styleKey` in `normalizeDoc` (line 302 block).
- Modify: `backend/src/controllers/brochureController.ts` + `backend/src/routes/brochures.ts` — `POST /brochures/pages/build`.
- Modify: `frontend/src/api/*` (brochures API) + `frontend/src/pages/BrochureEditor.jsx` — replace the plain "+ Page" with a layout menu.
- Test: `backend/tests/brochureDoc.test.ts`.

**Step 1: Write the failing test.**
```js
const page = brochureThemes.buildPage('coastalTeal', 'rooms', 'portrait');
ok('buildPage returns one themed page', page && Array.isArray(page.elements) && page.elements.length > 0);
const deck = brochureThemes.buildDeck('coastal-teal-editorial', 24);
ok('a built deck records its styleKey', deck.styleKey === 'coastalTeal');
```
Run: `cd backend && npm test` — Expected: FAIL (`buildPage` undefined; `styleKey` undefined).

**Step 2: Implement `buildPage(styleKey, layoutKey, sizeKey, palette)`** in `brochureThemes.ts`: resolve `t = THEMES[styleKey] || THEMES.luxury`, optionally shallow-merge `palette` (the doc's current `theme`) over the colour keys so an added page matches a recolored deck, then `switch (layoutKey)` over `cover|intro|pool|rooms|interiors|amenities|grounds|gallery|contact` calling the matching factory with a fresh `slot()` counter. Return the single page object. Set `styleKey: t.key` on the object returned by `editorialDeck`/`galleryDeck` (and add `styleKey` to `blankDeck`). Export `buildPage`.

**Step 3: Whitelist `styleKey`** in `brochureDoc.normalizeDoc` — add `styleKey: str(raw.styleKey, '')` to the returned doc object, mirror in `frontend/src/utils/brochureDoc.js` if it reconstructs docs (it does not normalize, so no change there).

**Step 4: Endpoint.** `POST /brochures/pages/build` → body `{ styleKey, layout, size, theme }` → `res.json({ data: brochureThemes.buildPage(styleKey, layout, size, theme) })`. Guard with the same auth/feature middleware as the other brochure routes.

**Step 5: Frontend menu.** Replace the "+ Page" button (BrochureEditor.jsx line 448) with a small dropdown of layouts (`Cover, Intro, Rooms, Gallery (2-up)`… map to layout keys). On pick: call the API with `{ styleKey: doc.styleKey, layout, size: doc.size, theme: doc.theme }`, then `commit` the returned page into `pages` after the current index and select it. Keep the existing blank "+ Page" as a "Blank" entry.

**Step 6: Run + verify.** Run: `cd backend && npm test` (green) and `cd frontend && npm run build` (no errors). In `npm run dev`, add a Rooms page to a Coastal Teal deck → it appears themed, recolor-aware, with empty photo boxes ready to fill.

**Step 7: Commit.**
```bash
git add backend/src/services/brochureThemes.ts backend/src/services/brochureDoc.ts backend/src/controllers/brochureController.ts backend/src/routes/brochures.ts backend/tests/brochureDoc.test.ts frontend/src/api frontend/src/pages/BrochureEditor.jsx
git commit -m "feat(brochure): add-page-by-layout menu backed by buildPage"
```

---

## Task 10: End-to-end verification

**Step 1:** Run the full backend suite. Run: `cd backend && npm test` — Expected: all green, `13 designs`, every deck leaves no empty photo boxes.

**Step 2:** Run the frontend build. Run: `cd frontend && npm run build` — Expected: no errors.

**Step 3:** Render each new preset to a real PDF and eyeball it against the reference. Use the preview/export path (the `GET /brochures/presets/preview` endpoint or a small script that calls `fillDoc(buildDeck(key, 24), dunecastlePhotos, fields)` then `renderDocHtml` → Puppeteer). Screenshot each deck's Cover, Rooms (tags), Amenities (icons), and a numeral page; compare page-for-page to `Dunecastle-Brochure-04/05/06`. Screenshotting is how the original build caught the gradient + padded-image bugs — do not skip it.

**Step 4:** Manually drive the editor once per deck: create from the preset, edit a text, swap a photo, add + recolor an icon, one-tap recolor from the Brand tab, add a page via the layout menu, download the PDF. Confirm the recolor leaves no orphan shades.

**Step 5: Final commit / branch is ready for review.** Use superpowers:requesting-code-review before merging.

---

## Non-goals (do not build)
- No PDF/HTML import path — presets are authored, not parsed from the reference files.
- No third accent slot — the 2-accent model is deliberate for clean recolor.
- Not re-porting the 1/2/3-per-page galleries — already shipped.
