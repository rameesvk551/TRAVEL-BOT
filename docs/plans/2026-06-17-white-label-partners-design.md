# White-Label Partner (Reseller) Tier — Design

Date: 2026-06-17
Status: Approved, implementing v1

## Goal

Let dedicated partners resell the whole platform under **their own brand**. A
partner's customers (agencies) and the agencies' end-customers never see
"TravelBot/Wayon". Partners own no code — they sell access to the software.

## Hierarchy

```
PlatformAdmin (you)        -> only level that sees "Wayon" branding
  └── Partner (reseller)   -> own brand: logo, name, colors, domain, emails  [NEW]
        └── Agency          -> logs into the partner-branded dashboard
              └── End-customers -> see the agency's own WhatsApp/website brand
```

## Decisions (from brainstorming)

- Partner = reseller of many agencies under the partner's own brand.
- Partners are onboarded **manually** by the platform admin (no self-service in v1).
- Access: **subdomain now** (`slug.app.<root>`), **custom domain later** (CNAME + auto-SSL).
- Brand surfaces v1: dashboard UI, login/auth pages, transactional emails, invoices/PDFs.
- Billing: **full revenue-share / plans** between platform and partner.

## Data model

New table `partners`:
- identity: `id`, `name`, `slug` (unique), `customDomain` (unique, nullable), `isActive`
- branding: `brandName`, `logoUrl`, `faviconUrl`, `primaryColor`, `accentColor`,
  `loginTagline`, `loginImageUrl`, `supportEmail`, `supportUrl`
- email identity: `emailFromName`, `emailReplyTo`, `emailFooterText`
- commercial: `billingModel` (REV_SHARE|MARKUP|FLAT), `revenueSharePercent`,
  `perAgencyFee`, `currency`, `billingStatus` (ACTIVE|PAST_DUE|SUSPENDED)
- audit: `createdByAdminId`

`agencies.partner_id` (UUID, nullable FK). Null = direct agency you own
(unchanged behaviour). Non-null = belongs to a partner. Backward compatible.

New table `partner_invoices` (revenue-share billing):
- `id`, `partnerId`, `periodStart`, `periodEnd`, `agencyCount`, `currency`,
  `subtotal`, `revenueShareAmount`, `amountDue`, `status`
  (DRAFT|ISSUED|PAID|VOID), `lineItems` (JSONB), `issuedAt`, `paidAt`, `notes`

## Branding resolution

Public, unauthenticated endpoint `GET /api/branding` resolves the partner from
the request Host header (subdomain or custom domain) and returns safe branding
fields. The platform's own admin host / localhost returns the default Wayon
branding. The frontend fetches this on boot, applies CSS variables + logo +
`<title>` + favicon before rendering, and the login/auth pages consume it.

The JWT login response also embeds the resolved partner branding so the
authenticated shell stays branded without an extra round-trip.

## Backend surface

- `models/Partner.ts`, `models/PartnerInvoice.ts`; associations in `models/index.ts`.
- `schemaBootstrap.ts`: `ensurePartnersSchema()` + `agencies.partner_id` column
  (production parity with dev `sequelize.sync()`).
- `services/brandingService.ts`: resolve partner by host, default branding,
  safe public payload.
- `services/partnerService.ts`: CRUD, agency assignment, billing invoice gen.
- `controllers/partnerController.ts` + platform routes
  `/api/platform/partners*` (admin-only).
- Public `GET /api/branding` (controller + route).
- `emailService.ts`: accept optional `branding` arg; fall back to Wayon.

## Frontend surface

- `api/brandingApi.js` + `store/brandingStore.js` (zustand).
- `hooks/useBranding.js` applies theme to `:root`, title, favicon.
- `Login.jsx` / `ForgotPassword.jsx` / `ResetPassword.jsx` consume branding.
- Replace hardcoded "Wayon" in `App.jsx` loader, `AppTopbar.jsx`.
- Platform admin: `pages/platform/Partners.jsx` (list + create + edit + assign).

## Out of scope (later phases)

- Partner self-service portal + partner login.
- Automated custom-domain SSL provisioning.
- Automated charging (Razorpay) of partner invoices — v1 generates invoices,
  payment is recorded manually.

## Security / isolation

- All agency-scoped queries already filter by `agencyId` from JWT — unchanged.
- Partner branding endpoint exposes only display fields, never secrets.
- Platform admin endpoints stay behind `authenticatePlatformAdmin`.
- A partner being `SUSPENDED` cascades: its agencies are treated as inactive at login.
</content>
</invoke>
