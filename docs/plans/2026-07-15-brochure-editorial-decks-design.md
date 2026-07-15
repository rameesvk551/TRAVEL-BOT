# Editorial brochure decks: Coastal Teal / Noir / Deco — design

**Date:** 2026-07-15
**Branch context:** `feature/white-label-partners`
**Builds on:** [[brochure-pdf-builder]] — `2026-07-14-brochure-pdf-builder-design.md`

## Goal

Ship three new brochure presets that are faithful, page-for-page reproductions of the
client's hand-built Canva-replacement reference decks in `C:\Users\ACER\www\Dunecastle`:

- **Coastal Teal** (`Dunecastle-Brochure-06-Coastal-Teal`)
- **Noir Editorial** (`Dunecastle-Brochure-04-Noir-Editorial`)
- **Deco Midnight** (`Dunecastle-Brochure-05-Deco-Midnight`)

Each must be **fully editable element-by-element** and **one-tap recolorable**, exactly like
the existing presets. No new render path — every emitted item is an ordinary editable element.

## Decisions (resolved with the user)

1. **Scope:** all three new editorial decks (not just Coastal Teal).
2. **Amenity icons:** add a real, extensible, recolorable `icon` element type (not baked, not text-only).
3. **Color control:** one-tap whole-deck recolor (existing `retheme`) + per-element override.
4. **Editability:** every visual item is a discrete editable element.
5. **Cover/contact background:** photo + veil stay page-level, edited via the **Page** inspector; all content on top is normal editable elements.
6. **Recolor fidelity:** author against the **two accent slots** (clean one-tap recolor, ~99% visual match) rather than preserving every hairline shade.
7. **Add pages:** keep existing **Duplicate page** (deep copy) *and* add a **"+ Page → pick a layout"** menu.

## New capability: the `icon` element

The builder has only `image | text | shape` today ([brochureDoc.ts:68](../../backend/src/services/brochureDoc.ts)). Add a fourth type.

- **Shared icon registry** — new mirrored file `brochureIcons.ts` (backend) / `brochureIcons.js`
  (frontend), a map `key -> { label, svg }` of ~16 line icons drawn on a 24×24 grid, stroke-based:
  `pool, wifi, parking, dining, kids, games, grill, party, ac, bed, bath, spa, gym, view, pet, coffee`.
  Extensible: adding an entry in both files makes a new icon available.
- **Element shape:** `{ type:'icon', icon, x,y,w,h, color, strokeWidth, rotate,z,opacity,locked }`.
- **Render** (`renderElement`): emit inline `<svg viewBox="0 0 24 24">` with `stroke = el.color`,
  `stroke-width = el.strokeWidth`, `fill:none`. Mirror in the frontend canvas as a React `<svg>`.
- **Recolor is free:** `retheme` already sweeps the `color`/`stroke` keys on every element
  ([brochureDoc.ts:377](../../backend/src/services/brochureDoc.ts)), so an icon whose `color` is a palette
  value recolors with the theme automatically. `countColor` also already sweeps `color`, so icons
  show up in the recolor swatch counts.
- **Whitelist:** add the `icon` branch to `normalizeElement` in **both** brochureDoc files and cover
  it in `brochureDoc.test.ts`. (This is the [[flow-builder-silent-drops]] trap — an un-whitelisted
  field saves then vanishes on reload.)
- **Editor UI:**
  - `BrochureEditor.jsx` toolbar: add an "Add icon" button next to text/image/shape (`newIconElement`).
  - `BrochureInspector.jsx`: an icon panel — icon dropdown (from the registry), size, stroke width, color.
  - `BrochureCanvas.jsx` + `BrochurePagePreview.jsx`: render the icon element.

## Fonts

Add to `FONTS` + `GOOGLE_FONTS_HREF` in **both** `brochureDoc.ts` and `brochureDoc.js`, and to the
editor's live font injection:

- Coastal Teal → **Sora** (heading + body)
- Noir → **Bricolage Grotesque** (heading) + **Archivo** (body)
- Deco → **Cinzel** (heading) + **Jost** (body, already present)

## Palettes (2-accent mapping)

Pulled from each reference file's `:root`. Extra shades collapse onto `accent`/`accent2` for clean recolor.

| Theme | bg | panel | ink | inkSoft | inkMute | accent | accent2 | heading | body |
|---|---|---|---|---|---|---|---|---|---|
| coastalTeal | `#f1faf9` | `#ffffff` | `#123a3a` | `#3e6360` | `#7fa19d` | `#0e9aa7` | `#f0784b` | Sora | Sora |
| noir | `#f4f2ec` | `#ffffff` | `#151515` | `#4a4a46` | `#8a887f` | `#127069` | `#199085` | Bricolage Grotesque | Archivo |
| deco | `#0e1a3a` | `#132248` | `#f2ecdd` | `#c6c0ac` | `#8f8a76` | `#c9a24b` | `#e2c47e` | Cinzel | Jost |

## Page factories (faithful reproduction)

Extend `brochureThemes.ts` with a per-theme `style` knob object so one set of editorial factories
reproduces all three treatments (mirrors how the reference CSS uses one stylesheet + `.t-*` overrides):

- `numeralStyle`: `'badge-filled'` (Coastal: teal circle, white numeral) | `'outline'` (Noir:
  stroke-only numeral) | `'framed-circle'` (Deco: ringed circle, top-right) | `'text'`.
- `headingUpper`, `tagStyle` (Coastal: rounded pill w/ tint; Noir: square outline; Deco: square gold),
  `coverMeta` (the `Infinity Pool ◆ Stone Suites ◆ …` row), `logoFilter`.

Page sequence per deck (dropped when too few photos, per the existing `take(cost)` budget):
Cover · Intro+stats · Pool (grid2×4) · Rooms A (3, w/ head) · Rooms B (3) · Interiors (grid2×4) ·
Amenities (icon list + tile strip) · Grounds (grid2×4) · Gallery (grid3×6) · Contact. ~24 photos = full deck.

New/updated factories: faithful `coverPage` (frame + logo + location + title + tagline + meta row),
`introPage` (lead + 2 tiles + rule + 4 stats with `accent2` pop), `roomsPage` (photo-left rows +
number + name + **pill tags**), `amenitiesPage` (2-col **icon+label** list + bottom tile strip),
`sectionHead` (numeral by `numeralStyle`). Add three `PRESETS` entries; `listPresets` +
`GET /brochures/presets/preview` pick them up automatically.

## Add-page-by-layout menu

`BrochureEditor.jsx` "+ Page" becomes a dropdown that inserts a fresh themed page of a chosen type
(Cover / Rooms / Gallery 2-up / Gallery 3-up / Amenities / Contact) by calling the matching factory at
the current deck's size + theme. Duplicate page ([BrochureEditor.jsx:240](../../frontend/src/pages/BrochureEditor.jsx))
stays as the clone-and-edit path.

## Cover / contact via the Page panel

Confirm/extend the Page tab in `BrochureInspector.jsx` to edit page background: swap the bg photo,
toggle the veil, set veil color + opacity. (Background photo + overlay are page-level props today.)

## Files

**Backend**
- `backend/src/services/brochureDoc.ts` — `icon` in `ELEMENT_TYPES`, `normalizeElement`, `renderElement`; FONTS + href.
- `backend/src/services/brochureIcons.ts` — **new** icon registry.
- `backend/src/services/brochureThemes.ts` — 3 palettes, `style` knobs, faithful factories, 3 presets, `newIconElement`.
- `backend/tests/brochureDoc.test.ts` — icon whitelist coverage; themes smoke test (each preset builds, icons survive normalize).

**Frontend (mirror)**
- `frontend/src/utils/brochureDoc.js` — mirror element type, normalize, render, FONTS + href.
- `frontend/src/utils/brochureIcons.js` — **new** mirror of the registry.
- `frontend/src/components/brochure/BrochureCanvas.jsx` — render icon element.
- `frontend/src/components/brochure/BrochureInspector.jsx` — icon panel + Page bg/veil controls.
- `frontend/src/components/brochure/BrochurePagePreview.jsx` — render icon in preset previews.
- `frontend/src/pages/BrochureEditor.jsx` — Add-icon button, Add-page-by-layout menu.

## Render gotchas (from the existing build)

- Shape/veil fills go through CSS `background`, not `backgroundColor` (gradients vanish otherwise).
- A padded image must be **wrapped** (padding grows a bare `<img>` box instead of insetting).
- Images render from Cloudinary derivatives (`cdnUrl`) so Puppeteer `networkidle0` doesn't stall.

## Verification

- `npm test` in `backend/` (brochureDoc whitelist + themes smoke test must pass).
- Build each of the 3 presets against the Dunecastle photos and render to PDF (preview endpoint or a
  small script); screenshot and compare page-for-page to the reference PDFs. Screenshotting is how the
  original build caught the gradient + padded-image bugs.

## Non-goals

- Not porting the 1/2/3-per-page galleries again (already shipped).
- Not adding a third accent slot (2-accent model chosen for clean recolor).
- Not a PDF/HTML *import* path — these are authored as presets, not parsed from the reference files.
