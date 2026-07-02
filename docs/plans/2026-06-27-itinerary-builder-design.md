# Itinerary Builder — Design

Date: 2026-06-27
Status: Approved for implementation

## Goal

Produce a professional, multi-section travel-itinerary PDF (matching the SAIA
"Shimla & Manali 4N/5D" sample) using the **same themed-template engine** that
already powers quotations / invoices / receipts. Per-agency reusable themes,
server-side Puppeteer PDF, and per-agency WhatsApp auto-send.

The existing `ItineraryBuilder.jsx` wizard stays as the content editor, but its
low-fidelity client-side `html2canvas` PDF is replaced by the server-rendered
themed PDF.

## Decisions (locked)

- **Full-fidelity data** — capture every PDF section.
- **Content entry** — structured form builder **+** generate-from-Package.
- **Pricing** — customer-facing price only (no cost/margin in the document).
- **Pattern** — mirror the document-builder triplet: `ItineraryTemplate` +
  themed layouts in `documentTemplates.ts` + delivery via
  `documentDeliveryService`.

## Data model

`Itinerary` (extend, non-destructive — keep legacy `totalCost`/`totalPrice`):

- `templateId` UUID nullable → `ItineraryTemplate`
- `productCode` STRING — header band code (e.g. `TS0170-RGPJS`)
- `summary` STRING — route line (e.g. `Shimla 2N · Manali 2N`)
- `days` JSONB `[{ id, title, description, date }]`
- `hotels` JSONB `[{ name, category, city, nights, roomType, mealPlan, imageUrl }]`
- `vehicle` JSONB `{ type, features: [string] }`
- `priceRooms` JSONB `[{ label, rate, pax, amount }]`
- `pricing` JSONB `{ currency, packageTotal, gstPercent, gstAmount, grossTotal }`
- `inclusions` JSONB `[string]`, `exclusions` JSONB `[string]`

Money in these JSONB blocks is in **major units (rupees)** to match the
template `money` helper. `totalPrice` mirrors `pricing.grossTotal` for existing
list/report screens.

`ItineraryTemplate` — clone of `QuotationTemplate`
(`id, agencyId, name, htmlContent, config JSONB, isDefault`,
table `itinerary_templates`).

## Backend

1. `models/ItineraryTemplate.ts`; register + associate in `models/index.ts`
   (`Agency.hasMany`, `Itinerary.belongsTo(... as 'template')`).
2. `services/documentTemplates.ts`: add `'itinerary'` to `DOC_TYPES`, `DOC_META`
   (orange accent), an itinerary `defaultConfig` branch (section toggles:
   showDayPlan/showVehicle/showHotels/showPriceBreakup/showInclusions/
   showExclusions), and **itinerary-specific layout builders** that render the
   six sections (header band, day plan, vehicle checklist grid, hotel cards,
   price details two-column, inclusions/exclusions) instead of the generic
   items table. Extend `flagsFromConfig` for the itinerary flags.
3. `controllers/itineraryTemplateController.ts` — `createController` factory.
4. `routes/itineraryTemplates.ts` + register `/api/itinerary-templates`.
5. `services/documentPdfService.ts` — `generateItineraryPdf(itineraryId, agencyId)`:
   load itinerary + agency + customer + template, build `data`, render, PDF.
6. `services/documentDeliveryService.ts` — `sendItinerary` + caption default.
7. `controllers/itineraryController.ts` — `downloadPdf` (GET `/:id/pdf`),
   `sendWhatsApp` (POST `/:id/send-whatsapp`), and auto-send when status flips
   to `SENT` and the agency toggle is on. Extend the route zod schema and
   `itineraryService` to persist the new fields and set `totalPrice` from
   `pricing.grossTotal`.

## Frontend

8. `utils/documentBuilder.js` — `sampleDataFor('itinerary')` + itinerary flags so
   the live preview matches the PDF.
9. `components/DocumentTemplateBuilder.jsx` — make the "Sections" toggle panel
   `docType`-aware (itinerary section toggles); reuse layout/brand/header/content.
10. `api/itineraryTemplatesApi.js`; `pages/settings/SettingsItineraryTemplates.jsx`
    (`<DocumentTemplateBuilder docType="itinerary" apiBase="/itinerary-templates" />`);
    register in settings layout + sidebar.
11. `api/itinerariesApi.js` — `downloadPdf`, `sendWhatsApp`.
12. `pages/ItineraryBuilder.jsx` — add editors for hotels / vehicle features /
    price rooms+GST / inclusions / exclusions / product code + template picker.
    Replace client PDF with **Download PDF** (server) and **Send via WhatsApp**.

## Verification

- `npm run build`/typecheck backend + frontend.
- Generate a PDF from the sample data and confirm the six sections render like
  the SAIA reference.
