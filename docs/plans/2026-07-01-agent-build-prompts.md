# Build Prompts for Your Coding Agent

> Copy these prompts, one at a time, into your coding agent (Cursor, Claude Code,
> Windsurf, etc.). **Do not paste all phases at once** — build phase by phase, review
> the output, then move on. Each prompt assumes the agent can read the three design
> docs in `docs/plans/`.
>
> Order: **Setup → Phase 0 (foundation) → Phase 1 → … → Phase 5.** Don't skip Phase 0.

---

## 0. One-time setup prompt (paste first, once)

```
You are building a new React Native (Expo + TypeScript) mobile app that replaces an
existing web CRM. The complete design is specified in three documents — READ ALL THREE
before writing any code:

- docs/plans/2026-07-01-mobile-app-design-system.md      (tokens, components, motion, a11y)
- docs/plans/2026-07-01-mobile-app-page-specs.md         (every screen, spec by spec)
- docs/plans/2026-07-01-mobile-app-adaptive-navigation.md (multi-tenant manifest model)

Also read the backend contract this app depends on:
- GET /api/me/app-manifest  → implemented in backend/src/services/appManifestService.ts
  and backend/src/controllers/authController.ts. This returns the per-tenant navigation
  manifest (tabs, modules, labels, branding, home widgets). The app is a RENDERER over
  this manifest — never hardcode tabs, module lists, or business nouns.

Hard rules for the whole project:
1. Token-first: every color/size/radius/duration comes from the theme token file
   (design-system §3). No raw hex or pixel literals in screens.
2. Components before screens: build the shared UI library (design-system §5) first;
   screens compose it and never restyle it.
3. Manifest-driven shell: tabs and the "More" hub are built from the login manifest
   (adaptive-navigation §2, §5). Home + More are fixed; middle tabs come from the manifest.
4. Every business noun renders through a label resolver t(key) (adaptive-navigation §6).
5. Every screen ships its four states: loading (skeleton), empty, error, success
   (design-system §5.11), plus dark mode and accessibility (§7).
6. Reuse from the existing web app where possible: API client patterns, React Query
   hooks, and zod schemas. Do NOT port web JSX/Tailwind — rebuild native.

Stack (locked): Expo + TypeScript, @react-navigation/native (bottom tabs + native stack),
NativeWind or Restyle over the token file, @shopify/flash-list, @gorhom/bottom-sheet,
react-native-reanimated + gesture-handler, @tanstack/react-query, react-hook-form + zod,
react-native-mmkv, lucide-react-native, victory-native for charts.

Acknowledge you have read all three docs and the endpoint, then WAIT. I will give you one
phase at a time. Do not start coding until I send the Phase 0 prompt.
```

---

## 1. Phase 0 — Foundation (paste after setup is acknowledged)

```
Build PHASE 0 (Foundation) only — no feature screens yet. Deliver:

A. Theme layer (design-system §3):
   - theme.ts with the full light + dark token sets (semantic color, typography scale,
     spacing, radius, elevation, blur) exactly as specified.
   - ThemeProvider that follows system appearance with a manual override, exposing
     useTheme(). Wire the tenant accent + logo from the manifest into the theme (§8).

B. UI component library (design-system §5), each token-driven, theme-aware, with the
   four states where relevant:
   Button (primary/secondary/tinted/plain/destructive/icon/FAB), Card, MetricCard,
   ListRow (with swipe actions), Segmented, Chip + filter row, FilterSheet, Badge,
   Avatar, Input/Field/Stepper/CurrencyField/SearchBar, Switch, Toast, Banner,
   Skeleton, EmptyState, ErrorState, SectionHeader, and a Chart wrapper.
   Include a component gallery screen that renders every component in light + dark.

C. Navigation shell + manifest (adaptive-navigation §2–§6, §8):
   - Fetch GET /api/me/app-manifest at login; cache in MMKV; render from cache first
     then revalidate. Apply accent/logo to the theme.
   - A MODULES registry (adaptive-navigation §3) mapping every module key to an icon,
     hub group, and a placeholder stack.
   - buildTabs() and the "More" ModuleHub (searchable, grouped, respects manifest.modules).
   - useLabel()/t(key) resolving manifest.labels over MODULES defaultLabel.
   - A widget→module map so Home widgets whose module isn't enabled are skipped.

D. Auth screens (page-specs → AUTH): Login, Signup, ForgotPassword, ResetPassword,
   using the components above. Biometric unlock after first login if trivial.

E. App plumbing: API client (bearer + refresh, mirroring the web auth flow),
   React Query client, MMKV storage, haptics helper, money/date formatters, safe-area.

Acceptance criteria:
- I can log in and see the tab bar + hub assembled ENTIRELY from a manifest.
- Switching the manifest's industry/modules changes the tabs and hub with no code change.
- Light/dark both look correct; the component gallery proves every component.
- No raw hex/px in any screen; everything references tokens.

Show me the folder structure first, then implement. Stop after Phase 0 for review.
```

---

## 2. Phase 1 — Daily driver (paste after Phase 0 is reviewed)

```
Build PHASE 1 (the daily-driver screens) per docs/plans/2026-07-01-mobile-app-page-specs.md.
Implement these stacks, each composing the Phase 0 components and rendering nouns via t(key):

- Home / Dashboard        (TAB 1 spec)
- Inbox list + Thread     (TAB 2 spec — this is the flagship; iMessage-grade)
- Leads list + detail sheet + FollowUps  (TAB 4 spec)
- Bookings list + Booking detail sheet + BookingForm (TAB 3 spec)
- Payments               (record-payment sheet)

For each screen implement all four states, dark mode, swipe actions, and the exact
mobile adaptations noted in the spec (filters as bottom sheets, forms as modal steppers,
tables as card lists). Wire real data via React Query against the existing backend
endpoints. Remember bookings/leads/customers are ENGINES relabeled per industry.

Acceptance: an agent can run their day — read chats, work leads, create a booking,
collect a payment — entirely on the phone. Stop after Phase 1 for review.
```

---

## 3. Phases 2–5 — reuse this template

For each remaining phase, paste this, filling in the phase name + screen list from the
Roadmap in page-specs.md (§ "Roadmap — build order"):

```
Build PHASE <N> (<name>) per docs/plans/2026-07-01-mobile-app-page-specs.md.
Screens: <list from the roadmap>.
Rules unchanged: Phase 0 components only, t(key) for every noun, four states + dark mode,
filters/menus as bottom sheets, multi-step creates as modal steppers, tables as card
lists, charts via the Chart wrapper. Wire real data with React Query.
Acceptance: <the phase's "Exit" line from the roadmap>. Stop after this phase for review.
```

- **Phase 2 — Catalog & quoting:** Packages/Cruises/Visas/Services/Properties (list+form+
  detail), Customers (list+detail), Quotations, ItineraryBuilder.
- **Phase 3 — Marketing:** Campaigns (+detail+CreateCampaign), Templates, Reviews, Social,
  Ads, Referrals, Automations, Flows.
- **Phase 4 — Finance & insights:** Accounting hub (+Chart/Journals/Invoices/Reports),
  Vendors, PackageFinance, Analytics, CRM/Calling reports.
- **Phase 5 — Team & config:** HRM (all), Agents & routing, Settings (all editors),
  WebsiteBuilder, Brochure, Platform/Partners.

---

## 4. Tips for driving the agent

- **One phase per session.** Long single prompts drift; review between phases.
- **Point, don't paste.** Tell the agent to *read* the docs (they're in the repo) rather
  than pasting them — keeps context clean and authoritative.
- **Hold the line on rules.** If output has raw colors, restyled components, or hardcoded
  tabs, reject it and cite the rule number. Consistency is the product.
- **Verify each phase** against its acceptance criteria on a real device/simulator before
  moving on.
- **Feed one screen at a time** if the agent struggles with a whole phase — the page-specs
  are self-contained per screen.
```
