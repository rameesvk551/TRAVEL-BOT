# Document Builders & WhatsApp Auto-Send — Design

Date: 2026-06-23
Branch: feature/white-label-partners

## Goal

A polished, no-code "themed customizer" for the three customer-facing documents —
**quotation**, **invoice**, **receipt** — plus per-agency settings to auto-send
each as a branded PDF to the customer over WhatsApp.

## Decisions (from brainstorming)

- **Builder type:** themed customizer (pick a layout, then tune colours/logo/
  fonts/fields) — not a freeform drag-and-drop canvas.
- **Brand scope:** each document type has its own independent branding (seeded
  from agency defaults, then freely edited).
- **Send trigger:** quotation/invoice send on an explicit action; receipts are
  fully automatic on payment. Manual "Send to WhatsApp" always available.

## Architecture

One engine, three document types.

- `services/documentTemplates.ts` — single source of truth. Holds the layout
  presets (Modern / Classic / Minimal) as Handlebars HTML built from shared
  fragments, plus `defaultConfig(type)` and `flagsFromConfig()`. Config drives
  CSS variables so colour/font changes reflect everywhere. Money values are
  passed in **major units**; the `money` helper only formats.
- Templates are stored per agency as `htmlContent` + `config` JSONB on
  `quotation_templates`, `invoice_templates`, `receipt_templates`
  (ReceiptTemplate is new; InvoiceTemplate gained a `config` column).
- `controllers/documentTemplateController.ts` — shared CRUD factory used by all
  three template controllers; seeds new templates from a themed preset and
  exposes `GET /presets`.
- `services/documentPdfService.ts` — builds the unified data shape for quotation
  and receipt, compiles the template, renders to PDF via Puppeteer (mirrors the
  existing `invoicePdfService`). Invoices keep their existing service.
- `services/documentDeliveryService.ts` — generate → upload (Cloudinary
  `uploadDocumentPdf`) → `whatsappService.sendDocumentMessage`. Centralises the
  per-agency auto-send flag + caption (`Agency.documentSettings`).

### Endpoints

- `GET /api/{quotation,invoice,receipt}-templates/presets` — layout catalogue + default config
- CRUD on each `*-templates` collection
- `GET  /api/quotations/:id/pdf`, `POST /api/quotations/:id/send-whatsapp`
- `GET  /api/payments/:id/receipt`, `POST /api/payments/:id/receipt/send-whatsapp`
- `POST /api/agencies/me/upload-asset` — generic branding image upload (returns URL only)

### Auto-send triggers

- Quotation → first transition to `SENT` (controller).
- Receipt → Razorpay `payment_link.paid` webhook (paymentService).
- Invoice → after invoice PDF generated/uploaded (accountingService).

All three are best-effort and gated on `Agency.documentSettings.autoSend.<type>`.

### Frontend

- `utils/documentBuilder.js` — mirrors the backend helpers/flags so the live
  preview matches the PDF exactly.
- `components/DocumentTemplateBuilder.jsx` — reusable builder (template list,
  layout picker, colour pickers, logo upload, font, header, section toggles,
  bank details, terms/notes/footer, live iframe preview, advanced HTML tab).
- Settings pages: Invoice / Quotation / Receipt Templates (thin wrappers) +
  **Document Sending** (the three auto-send toggles + captions).
- Manual PDF / Send actions on the Quotations list.

## Schema

`schemaBootstrap.ensureProductionSchema()` (runs every boot) now ensures:
`agencies.document_settings`, `invoice_templates.config`,
`quotation_templates` (+config), `receipt_templates`, `quotations`.

## Deferred (phase 2)

- Manual "Send receipt" / "Download receipt" button on the booking detail view
  (the Payments list is keyed by booking, not individual payment ids).
- Per-layout thumbnails in the layout picker.
- `amountInWords` auto-generation for receipts.
