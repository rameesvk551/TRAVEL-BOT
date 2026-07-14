# Mobile ↔ Web Parity Gaps

Audit date: 2026-07-14, against `mobile/src` and `frontend/src` on `feature/white-label-partners`.

The data layer is **real and wired** — 75 GET, 36 POST, 17 PATCH, 10 DELETE across the 25 feature
`api.ts` files, with no mock fallbacks or stubbed mutations left. The remaining gaps are specific
screens, specific write paths, and a handful of modules that were never built.

Legend: **Read** = list/detail loads from the API. **Write** = create/edit/delete reaches the API.
**Form** = inputs are controlled and submit.

---

## P0 — Broken: screen exists, but the user cannot complete the task

These are worse than a missing module, because the app shows a form that silently does nothing.

- [ ] **Itinerary builder does not save.** `features/itineraries/screens/ItineraryBuilderScreen.tsx`
      has 8 inputs hardcoded to `value="" onChangeText={() => {}}` and calls no mutation. The hooks
      already exist and are unused: `useCreateItinerary`, `useUpdateItinerary`, `useDeleteItinerary`,
      `useSendItineraryWhatsApp`. Make the inputs controlled and wire them up.
- [ ] **Service form does not save.** `features/services/screens/ServiceFormScreen.tsx` — same
      pattern, 6 dead inputs, no mutation. `useCreateService` / `useUpdateService` exist and are unused.
- [ ] **Typecheck is red — 7 errors** (`npx tsc --noEmit`):
      - `ItinerariesScreen.tsx` ×6 — the screen reads `client`, `date`, `price`, `margin` off
        `Itinerary`, none of which exist on the type; plus a `string` → `'ALL' | ItineraryStatus`
        mismatch and a `null` → `undefined`. The screen and the API type disagree about the model.
      - `SocialScreen.tsx:20` — imports `Instagram` from `lucide-react-native`, which does not export it.

## P1 — Read-only modules: you can look, but not act

Each of these has working reads and **zero mutations**, while the web can create/edit.

- [ ] **Customers** — Read ✓ / Write ✗. No create or edit customer. (`features/customers/api.ts`,
      0 mutations. Web: `pages/Customers.jsx`.)
- [ ] **Vendors** — Read ✓ / Write ✗. Lists vendors, types, bills and payments; cannot add or edit a
      vendor, record a bill, or record a vendor payment. (Web: `pages/Vendors/VendorForm.jsx`,
      `VendorPayments.jsx`.)
- [ ] **Accounting** — Read ✓ / Write ✗, and partial. Mobile covers invoices, P&L, and
      payables/receivables only. Web also has **Chart of Accounts** and **Journals**, neither of which
      exists on mobile, and no invoice can be created from the phone. (Web: `pages/Accounts/*`.)
- [ ] **Automations / Flows** — Read ✓ / Toggle ✓ / Edit ✗. `FlowBuilderScreen` can only flip a flow
      on and off; it cannot create or edit one. Decide whether flow *authoring* is web-only (see P3).

## P2 — Missing modules that are genuinely useful on a phone

No registry entry, no screens. Ordered by how much they matter in the field.

- [ ] **Missed Calls** — web `/missed-calls` (`pages/MissedCalls.jsx`, `missedCallsApi.js`). This is a
      react-to-it-now module; it belongs on the phone more than on the desktop.
- [ ] **HRM admin side** — mobile has the employee half only (punch with GPS, timesheet, my leaves,
      request leave, and team leave approvals). Web adds **attendance board / register / editor,
      payroll, people, HRM reports, HRM settings**. Attendance approvals and people are plausible
      phone tasks; payroll is not.
- [ ] **Activity Log** — web `/activity` (`pages/ActivityLog.jsx`, `activityApi.js`).
- [ ] **Campaign Reports** — web `/campaigns/reports`. Mobile has per-campaign stats
      (`useCampaignStats`) but no cross-campaign report.
- [ ] **Settings essentials.** Mobile Settings is identity + theme + business profile + sign-out. Of
      the ~22 web settings pages, these three are the ones an operator actually reaches for away from
      a desk — the rest can stay on web (see P3):
      - [ ] Pipeline statuses (`SettingsPipelineStatuses.jsx`)
      - [ ] Lead sources (`SettingsLeadSources.jsx`)
      - [ ] Staff WhatsApp (`SettingsStaffWhatsApp.jsx`)

## P3 — Deliberately web-only (decide, then close out)

These are canvas/config tools with no good phone form. The app already has an honest pattern for
this: `navigation/PlaceholderStack.tsx` renders *"<Module> is on the web — open the dashboard in a
browser"*, and **Website Builder** is already routed to it. That is the right call and should be the
template for the rest.

- [x] **Website Builder** — already routed to `PlaceholderStack`. Nothing to do.
- [ ] **Brochure** (`pages/Brochure.jsx`) — no registry entry at all. Either register it as a
      web-only placeholder or consciously drop it.
- [ ] **Instagram Flow Builder** (`SettingsInstagramFlowBuilder.jsx`) and **Flow Builder authoring**
      (`SettingsFlowBuilder.jsx`) — graph editors. Recommend: web-only placeholder.
- [ ] **Document template builders** — invoice / quotation / receipt / itinerary template builders.
      Recommend: web-only placeholder.
- [ ] **Remaining settings pages** — API keys, integrations, documents, lead form, sidebar modules,
      vendor types, welcome menu, automations settings, accounts settings. Recommend: web-only.
- [ ] **Platform admin / white-label Partners** (`pages/platform/*`) — this is the *platform owner's*
      console, not a tenant's. Recommend: explicitly out of scope for the tenant mobile app.

> Any module left with no registry entry currently falls through to `PlaceholderStack` by default
> (`AppNavigator.tsx`), so it degrades gracefully — but registering it makes the intent explicit
> rather than accidental.

---

## Module-by-module matrix

| Module | Read | Write | Form | Notes |
|---|---|---|---|---|
| Home / Dashboard | ✓ | n/a | n/a | Real chart via `ChartWrapper` |
| Leads | ✓ | ✓ | ✓ | update, move stage |
| Follow-ups | ✓ | ✓ | ✓ | complete, snooze |
| Inbox (WhatsApp) | ✓ | ✓ | ✓ | send, takeover |
| Bookings | ✓ | ✓ | ✓ | create |
| Customers | ✓ | **✗** | — | **P1** |
| Packages | ✓ | ✓ | ✓ | + vendor costs, image upload |
| Quotations | ✓ | ✓ | ✓ | + send via WhatsApp |
| Itineraries | ✓ | ✓ (hooks) | **✗** | **P0 — builder doesn't save** |
| Properties | ✓ | ✓ | ✓ | |
| Cruises | ✓ | ✓ | ✓ | |
| Services | ✓ | ✓ (hooks) | **✗** | **P0 — form doesn't save** |
| Visas | ✓ | ✓ | ✓ | |
| Vendors | ✓ | **✗** | — | **P1** |
| Agents | ✓ | ✓ | ✓ | + permissions |
| Payments | ✓ | ✓ | ✓ | request link, send receipt |
| Accounting | ✓ | **✗** | — | **P1** — no CoA, no journals |
| Campaigns | ✓ | ✓ | ✓ | send, cancel, duplicate, delete |
| Ads | ✓ | ✓ | ✓ | |
| Templates | ✓ | ✓ | ✓ | submit, sync, duplicate |
| Automations | ✓ | toggle only | **✗** | **P1/P3** — no authoring |
| Reviews | ✓ | ✓ | ✓ | toggle published |
| Referrals | ✓ | ✓ | ✓ | |
| Social (Instagram) | ✓ | ✓ | ✓ | typecheck error, see P0 |
| Insights (analytics, CRM, calling) | ✓ | n/a | n/a | |
| HRM | ✓ | ✓ | ✓ | employee side only — **P2** |
| Settings | ✓ | ✓ | ✓ | profile only — **P2** |
| Missed Calls | **✗** | **✗** | **✗** | **P2 — module absent** |
| Activity Log | **✗** | **✗** | **✗** | **P2 — module absent** |
| Website Builder | — | — | — | web-only by design ✓ |
| Platform / Partners | — | — | — | out of scope (P3) |

## Suggested order

1. P0 — two dead forms + get `tsc` green. Small, and it stops the app lying to the user.
2. P1 — customer/vendor/accounting writes. This is what makes the app usable rather than a viewer.
3. P2 — Missed Calls first (highest phone value), then HRM admin, then the three settings pages.
4. P3 — one pass registering the web-only modules against `PlaceholderStack` so every module resolves
   deliberately.
