# Catalog Mini-Site — design

A public, per-agency "mini website" that showcases an agency's full catalog
(services, packages, properties, visas, cruises) with a premium, mobile-first
design. It replaces the old static website generator. Platform admin decides
who gets it (paid entitlement); the agency configures theme + branding and
publishes.

## Goals

- One shareable link per agency (`/s/:agencyKey`) that looks like a real brand
  site, not a CRM export. "Wow" on first open.
- Every catalog item gets its own URL + detail page, so an agent can WhatsApp a
  single package and it renders with a gallery + sticky Enquire bar.
- Digital-card actions from the reference: Enquire → lead form, Call, WhatsApp,
  Save Contact (vCard), Share.
- Always-live data (no regenerate step). Custom domains keep working.

## Decisions (from brainstorming)

- **New live React mini-site**, not an upgrade of the static generator. The
  static generator is removed; its domain-resolution helpers are kept.
- **Curated theme presets** (4 moods), each tinted by the agency's brand color.
  Agencies can't make it ugly; it still feels like theirs.
- **Per-item URLs + detail pages** (shareable, indexable).
- **Entitlement-gated**: `agency.features.catalogSite`, toggled by platform
  admin (same mechanism as `brochureBuilder`). The agency's `websiteEnabled`
  flag is the publish switch.

## Routes

| URL | Page |
|---|---|
| `/s/:agencyKey` | Catalog home — hero, filter rail, item cards, action dock |
| `/s/:agencyKey/:type/:slug` | Item detail — gallery, full info, sticky Enquire |

`:type` ∈ `service | package | property | visa | cruise`. `:agencyKey` resolves
by subdomain → custom domain → UUID (reusing the lead-form resolver logic),
plus the entitlement check. Custom domains render the same React page via a
host-detection branch in the SPA.

## Backend

- `catalogService.ts` (new): slug helpers (`catalogSlug`), per-type public
  payloads, `getCatalog(agency)` (branding + theme + all five types that have
  active items), `getCatalogItem(agency, type, slug)`.
- `publicController.getCatalog` / `getCatalogItem`, gated on
  `isActive && websiteEnabled && features.catalogSite`.
- Routes: `GET /public/:agencyKey/catalog`, `GET /public/:agencyKey/catalog/:type/:slug`.
- Slugs are derived from the item name at request time (`slugify(name)`, deduped
  by order) — no schema change. The same helper backs list + detail so links
  always match.
- `platformAdminService` FEATURE_CATALOG gains a `catalogSite` entry so it shows
  in the platform admin's feature toggles automatically.
- Service image gap closed: `POST /api/services/upload-image` + a field on the
  web and mobile service forms, so services have photos in the catalog.
- `websiteBuilderService`: `renderStaticSite`/`templateCss`/`WEBSITE_TEMPLATES`
  removed; `generateWebsite`/`unpublishWebsite` become pure `websiteEnabled`
  flips (no file writes); domain helpers (`normalizeHost`, `normalizeSubdomain`,
  `normalizeDomain`, `assertUniqueDomains`, `publicUrlForAgency`,
  `updateWebsiteSettings`) stay. `resolveAgencyDomain` stops serving disk HTML.

## Enquiry wiring (reuse, don't rebuild)

Every "Enquire" links to the existing lead form with the item pre-bound:
`/lead/:agencyKey[/:slug]?item=TYPE:ID&source=catalog`. The backend already
verifies the item belongs to the agency and attaches it to the created lead.

## Design language

Concept: **"Field Guide"** — a travel index that reads like a beautifully
printed pocket guide, brought to life. Structure is constant; mood is themed.

- **Hero**: full-bleed hero image, top-down scrim, agency logo as a seal,
  oversized display name, tracked-uppercase tagline. Below it a sticky
  **segmented filter rail** (only the types that have items).
- **Cards**: image-forward, price chip, category eyebrow, dual CTAs
  (More details / Enquire) — echoes the reference screenshot.
- **Action dock**: floating Call · WhatsApp · Save · Share (the digital card).
- **Detail**: swipeable gallery, price + duration/location facts, day-by-day
  itinerary (packages), inclusions/exclusions, amenities, required docs (visas),
  and a sticky Enquire bar.

### Themes (CSS-variable token bags; `--accent` = agency brand color)

1. **Aurora** (default, light) — ivory `#FBFAF7`, white surface, ink `#14181C`,
   radius 20px, display *Fraunces*, body *Manrope*. Airy, premium-approachable.
2. **Midnight** (dark, cinematic) — `#0B0D10`, glass surface `#14181D`,
   ink `#F4F6F8`, radius 16px, *Fraunces* / *Manrope*. Luxury/resort.
3. **Coast** (warm light) — sand `#F5F1E8`, surface `#FFFDF8`, ink `#1C2B2D`,
   radius 24px, *Fraunces* / *Manrope*. Relaxed, coastal.
4. **Terra** (editorial) — warm paper `#F4EEE6`, white surface, ink `#211A14`,
   radius 6px, display *Space Grotesk*, body *Inter*. Adventure/modern.

The accent is always the agency's own brand color, so no two sites read as the
same fixed template. Fonts load via a runtime-injected Google Fonts link with
serif/sans fallbacks.

## Out of scope (phase 2)

- Per-agency section ordering / custom copy blocks.
- OG image generation per item (link previews) — cards already carry an image;
  dynamic OG can follow.
- Mobile app rendering of the catalog (this is a public web surface).
