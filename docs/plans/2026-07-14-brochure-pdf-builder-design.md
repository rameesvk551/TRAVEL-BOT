# Brochure PDF Builder — Design

**Date:** 2026-07-14
**Status:** Approved, implementing

## Problem

Agencies receive 10–30+ photos of a resort and need a branded, multi-page PDF brochure
(see reference: a 16-page landscape Canva deck). Today they build these in Canva, outside
the CRM, so the brochure never reaches a lead automatically and nothing is reusable.

## Approach

A freeform page designer whose **editor DOM and print DOM are the same thing**.

Elements are absolutely-positioned HTML inside a fixed-size page div. The editor drags real
DOM nodes; the server hands the same markup to Puppeteer. No canvas library (fabric/konva),
no separate print path, and therefore no WYSIWYG drift.

Freeform alone is a bad first experience — nobody hand-places 30 photos. So freeform is
paired with autopilot: pick a theme, drop 30 images, get a finished deck instantly, then drag
whatever you want.

## Document model

One JSON shape (`doc`) is used by a brochure, a saved template, and the renderer:

```json
{ "pageW": 1122, "pageH": 794,
  "theme": { "fontHeading": "Anton", "fontBody": "Inter", "primary": "#0e7490" },
  "pages": [
    { "id": "p1", "bg": { "type": "image", "slot": "cover" },
      "elements": [
        { "id":"e1","type":"image","slot":"gallery_1",
          "x":64,"y":80,"w":420,"h":280,"rotate":0,"z":1,"fit":"cover","radius":12 },
        { "id":"e2","type":"text","field":"property_name",
          "x":64,"y":390,"w":600,"h":90,"rotate":0,"z":2,
          "text":"DUNECASTLE VILLAS","font":"Anton","size":54,"color":"#fff","align":"left" }
      ] } ] }
```

Two attributes carry the whole reuse story:

- **`slot`** on an image — "the Nth uploaded photo lands here". Refilling a template with 30
  new photos walks the slots in order.
- **`field`** on a text — a merge field (`property_name`, `location`, `price`, `about`,
  `contact`). Repopulates from the linked Property or a short form.

An element with neither is fixed decoration the designer placed. Because a brochure and a
template share this shape, "Save as template" is a copy, not a conversion.

## Schema

Three tables, following the `itinerary_templates` pattern. All registered in
`schemaBootstrap.ts` — production skips `sequelize.sync`, so a table missing from bootstrap
silently does not exist in prod.

| Table | Purpose |
|---|---|
| `brochures` | `agency_id, title, status, property_id?, doc JSONB, pdf_url` |
| `brochure_templates` | `agency_id?` (NULL = platform preset), `name, thumbnail_url, doc JSONB` |
| `brochure_assets` | `agency_id, brochure_id?, url, public_id, width, height, sort_order` |

`brochure_assets` is the agency's image library, so one 30-photo upload is reusable across decks.

## Access control

The builder is a **paid add-on**, off unless the platform admin enables it per agency.

It deliberately does *not* use `sidebarPreferences`. That field means "no explicit list = full
access" (`modules.ts:64`), so adding `/api/brochures` to `MODULE_API_GRANTS` would hand the
builder free to every agency that has no explicit module list — the opposite of the requirement.

Instead: a JSONB `Agency.features` column (same pattern as the existing `documentSettings`),
gated by a `requireFeature('brochureBuilder')` middleware that denies by default. This gives
deny-by-default, zero blast radius on an agency's other modules, and a natural home for
billing/plan data later.

### Pre-existing bug found while designing this

`PlatformDashboard.jsx:217` initialises the module checkboxes to `[]` when an agency has no
`sidebarPreferences`, but the backend reads an empty list as *unrestricted*. So a full-access
agency renders with nothing ticked; ticking one module and saving writes `['/that-module']`
and strips every other module from that agency. Empty means "all" to the backend and "none"
to the UI. Not introduced by this feature, and fixed separately — but it is the reason the
brochure gate does not live in that field.

## Rendering

`doc` → HTML (absolute-positioned divs) → Puppeteer `page.pdf({ width, height })` → Cloudinary/
public asset → WhatsApp document, download, or share link. Reuses `documentPdfService`'s
browser launch and `documentDeliveryService`'s Meta-template document send.

**30 images is the performance risk.** Raw phone photos at 5 MB each would stall
`waitUntil: 'networkidle0'`. Cloudinary already returns a `secure_url`; the renderer rewrites
it with `f_auto,q_auto,w_1600` for print and `w_400` for editor thumbnails, from the same
upload. Same trick keeps the editor snappy with a 30-image tray.

## Delivery

- Standalone **Brochures** page (list + editor).
- Optional link to a Property/Package — pre-fills photos, name, price.
- **Send on WhatsApp** to a lead as a PDF document.
- **Download** + public share URL via the existing `/api/public-assets/...` path.

## Out of scope (phase 2)

- Platform-wide template marketplace / agency-published templates.
- Video, animation, multi-column text reflow.
- Per-element locking, grouping, alignment guides beyond snap-to-grid.
