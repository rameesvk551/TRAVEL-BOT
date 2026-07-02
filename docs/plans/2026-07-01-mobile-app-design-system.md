# Travel Bot — Mobile App Design System (React Native)

> **Document 1 of 2.** This is the foundation: philosophy, design tokens, component
> library, navigation, motion, and global patterns. Document 2
> (`2026-07-01-mobile-app-page-specs.md`) specs every screen and *depends on the
> tokens and components defined here.*
>
> **Audience:** an AI coding tool (or engineer) building a from-scratch **React
> Native** app that replaces the current web CRM. Everything is concrete enough to
> implement without further design decisions.
>
> **Design bar:** Apple-grade. Simple, fast, quiet, confident. If a screen feels
> busy, it is wrong — remove, don't add.

---

## 0. How to use this document

1. Build the **token layer first** (§3). Every color, size, radius, and duration in
   the app references a token — never a raw hex or pixel value in a screen file.
2. Build the **component library** (§5) against those tokens. Screens compose
   components; they do not restyle them.
3. Build the **navigation shell** (§4).
4. Then implement screens from Document 2, one tab at a time, in the priority order
   given there (§ Roadmap).
5. **Rule of thumb for every screen:** one primary action, one screen-title, content
   in cards, secondary actions behind a sheet. When unsure, look at how Apple's
   Health, Wallet, App Store, or Fitness apps solve the same problem.

---

## 1. Design philosophy — the seven laws

These are non-negotiable and adapted from Apple's Human Interface Guidelines for a
data-dense business tool.

1. **Clarity over decoration.** Content is the interface. Chrome (bars, dividers,
   borders) recedes; data and the primary action stand out. No gradients-for-
   decoration, no drop shadows used as ornament, no more than one accent color on a
   screen.
2. **Deference.** The UI serves the content. Use translucency and generous negative
   space so the user's data — a lead, a chat, a booking — is the hero. Large,
   confident titles; small, quiet metadata.
3. **Depth through layering, not skeuomorphism.** Hierarchy is communicated by
   elevation and blur (sheets slide over content; a translucent tab bar floats over
   scrolling lists), not by heavy borders or drop shadows.
4. **One primary action per screen.** Everything else is secondary. The primary
   action is the only filled-accent element visible at rest.
5. **Progressive disclosure.** A phone shows the 3 things that matter now; the other
   17 live one tap deeper (a row → detail, a "More" → sheet, a section → expand).
   This is the core survival strategy for this app's very dense screens.
6. **Instant & forgiving.** Optimistic UI, skeletons not spinners, undo instead of
   confirm dialogs where safe, 60fps scroll always. Perceived speed is a feature.
7. **Consistency is invisible quality.** The same gesture does the same thing
   everywhere. A list row always taps to detail and swipes for actions. A filter is
   always a bottom sheet. Learn once, use everywhere.

---

## 2. Platform & stack decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Framework | **React Native** (Expo-managed recommended) | True native feel, gestures, performance |
| Language | TypeScript | Token/prop safety across a big app |
| Navigation | `@react-navigation/native` — bottom tabs + native stack per tab | Native transitions, deep-link ready |
| Styling | Restyle *or* NativeWind (Tailwind-for-RN) on top of the token file | Token-driven, theme-aware |
| Lists | `@shopify/flash-list` | 60fps on long lead/chat/booking lists |
| Sheets | `@gorhom/bottom-sheet` | The app's primary secondary-surface |
| Gestures/anim | `react-native-reanimated` + `react-native-gesture-handler` | Spring motion, swipe rows |
| Charts | `victory-native` (Skia) or `react-native-svg` | Dashboard/analytics/reports |
| Forms | `react-hook-form` + `zod` (already the web stack) | Reuse validation schemas |
| Server state | `@tanstack/react-query` (already the web stack) | Cache, optimistic, offline retry |
| Storage | `react-native-mmkv` | Fast token/session cache |
| Icons | `lucide-react-native` (already the web icon set) | Continuity, stroke icons suit the style |

**Reuse from web:** API client, React Query hooks, zod schemas, business logic in
`utils/`. **Do not reuse:** any JSX/Tailwind layout — screens are rebuilt native.

---

## 3. Design tokens

Ship as one `theme.ts`. Two palettes (light/dark) from **one semantic token set** so
every screen is theme-agnostic. Default to **system appearance**, with a manual
override in Settings.

### 3.1 Color — semantic tokens

The palette is deliberately Apple-minimal: **true neutrals + one accent**. Status
colors come straight from Apple's system palette (familiar, accessible, calm).

**Accent (brand):** a single confident azure. `#0A84FF` (dark) / `#007AFF` (light).
It is the *only* saturated color at rest — used for the primary action, active tab,
links, and selection. Everything else is neutral or a status color.

```
SEMANTIC TOKEN        LIGHT          DARK           USAGE
--------------------  -------------  -------------  ------------------------------------
bg/canvas             #F2F2F7        #000000        app background (grouped-list style)
bg/surface            #FFFFFF        #1C1C1E        cards, rows, sheets
bg/surfaceRaised      #FFFFFF        #2C2C2E        nested cards, sheet handles
bg/fill               #EFEFF4        #2C2C2E        input fields, chips, segmented bg
bg/scrim              rgba(0,0,0,.4) rgba(0,0,0,.6) modal/sheet backdrop

text/primary          #1C1C1E        #FFFFFF        titles, values
text/secondary        #3C3C4399 (60%)#EBEBF599(60%) labels, metadata
text/tertiary         #3C3C4360 (30%)#EBEBF54D(30%) placeholders, disabled
text/onAccent         #FFFFFF        #FFFFFF        text on filled accent

accent                #007AFF        #0A84FF        primary action, links, active state
accent/pressed        #0060DF        #3D9BFF        pressed state
accent/tint           #007AFF14      #0A84FF24      selected-row / accent chip bg

border/hairline       #3C3C431F      #54545899      1px separators (use sparingly)

status/success        #34C759        #30D158        paid, confirmed, delivered, online
status/warning        #FF9F0A        #FF9F0A        pending, overdue-soon, draft
status/danger         #FF3B30        #FF453A        failed, overdue, delete, balance-due
status/info           #5E5CE6        #5E5CE6        neutral tags, "sent", info banners
status/neutral        #8E8E93        #8E8E93        inactive, cancelled, unknown
```

**Status usage is a fixed language** across the whole app (badges, dots, amounts):

| Meaning | Token | Applies to |
|---|---|---|
| Good / done / money-in | success | Confirmed booking, paid, delivered/read msg, online agent, active listing |
| Attention / in-progress | warning | Draft, scheduled, pending approval, follow-up due today |
| Bad / money-out / destructive | danger | Failed campaign, overdue follow-up, balance due, delete |
| Informational | info | Sent (not yet delivered), tags, neutral counts |
| Off | neutral | Inactive/hidden listing, cancelled, no-data |

Never invent new hues on a screen. A "revenue up 12%" delta uses `success`; a
"balance due" uses `danger`. That is the entire color story.

### 3.2 Typography

One family: **SF Pro** via the RN system font (`System`). Fallback Inter on Android
if you want cross-platform identical metrics; otherwise use Roboto and accept
platform-native. Dynamic Type supported — sizes below are the default (Large) tier.

```
STYLE        SIZE/LINE   WEIGHT      TRACKING  USE
-----------  ----------  ----------  --------  -----------------------------------
largeTitle   34 / 41     Bold        +0.4      screen title at rest (scrolls to nav)
title1       28 / 34     Bold        +0.3      section hero numbers (KPI value)
title2       22 / 28     Bold        0         card group headers
title3       20 / 25     Semibold    0         modal titles, sheet titles
headline     17 / 22     Semibold    -0.4      list row primary text, buttons
body         17 / 22     Regular     -0.4      body copy, input text
callout      16 / 21     Regular     -0.3      dense row primary text
subhead      15 / 20     Regular     -0.2      secondary row text
footnote     13 / 18     Regular     -0.1      metadata, timestamps, captions
caption      12 / 16     Regular     0         badges, tab labels, tiny labels
caption2     11 / 13     Semibold    +0.5      ALL-CAPS section eyebrows
```

Rules: **max two type sizes visible in any single component.** Numbers that matter
(money, counts) use `title1`/`title2` tabular figures. Never center long text; center
only single-line titles and empty states.

### 3.3 Spacing & layout

4-pt base grid. Tokens: `space.1=4, .2=8, .3=12, .4=16, .5=20, .6=24, .8=32, .10=40, .12=48`.

- **Screen gutter:** 16pt left/right (`space.4`). Never let content touch the edge.
- **Card padding:** 16pt. **Card-to-card gap:** 12pt. **Section gap:** 24–32pt.
- **Min tap target:** 44×44pt (Apple minimum) — enforce on every interactive element.
- **Content max line length:** naturally constrained by phone width; no action needed.
- **Safe areas:** always respect top notch and bottom home indicator via
  `react-native-safe-area-context`. Tab bar and sheets sit above the home indicator.

### 3.4 Radius, elevation, blur

```
radius:  sm 8 · md 12 · lg 16 · xl 20 · full 999   (cards use lg; sheets use xl top-only; pills use full)
elevation (dark-friendly, subtle):
  e0  flat (default surface, no shadow — use hairline if separation needed)
  e1  card:   y2  blur8  rgba(0,0,0,.06 light / .30 dark)
  e2  sheet/menu: y8 blur24 rgba(0,0,0,.12 light / .44 dark)
  e3  FAB/toast: y6 blur16 rgba(0,0,0,.16 light / .50 dark)
blur (translucency): tab bar, nav bar on scroll, and sheet backdrops use a system
  blur (BlurView, ~20 intensity). This is the "depth" cue — content scrolls under a
  frosted bar rather than a solid one.
```

Shadows are whisper-quiet. If a card needs a heavy shadow to be visible, the
background contrast is wrong — fix that instead.

### 3.5 Iconography

- **lucide-react-native**, stroke width 2, size 24 default (20 in dense rows, 28 in
  tab bar). Single-color, inherits `text/secondary` at rest, `accent` when active.
- Icons *support* labels; they rarely replace them. Every tab-bar and toolbar icon
  has a text label. No icon-only mystery buttons except universally understood ones
  (back chevron, close ×, search 🔍, more ⋯).

---

## 4. Navigation architecture

The app has ~60 destinations. The structure that scales (Apple's own answer for deep
apps — see Health, Settings) is **Home + up to 3 tabs + a searchable hub**.

> **IMPORTANT — the tabs are NOT hardcoded.** This app is multi-tenant and
> multi-industry (travel agency, resort, cleaning company, CRM/marketing-only…). The
> tab bar and hub are rendered from a per-tenant **navigation manifest** at login.
> `Home` and `More` are always present; the middle tabs come from the manifest. Read
> **Document 3 (`2026-07-01-mobile-app-adaptive-navigation.md`)** for the manifest
> contract, module registry, industry profiles, and label system. The layout below is
> the **travel-agency default** — treat every business noun (Bookings, Leads,
> Customers) as an engine that other industries relabel (Reservations/Guests,
> Jobs/Clients) via the manifest.

### 4.1 The tab bar (bottom, translucent, 5 items)

```
┌───────────────────────────────────────────────┐
│                                                 │
│                  (content)                      │
│                                                 │
├─────────────────────────────────────────────── │  ← frosted BlurView, hairline top
│  🏠        💬        📅        👥        ⋯      │
│  Home      Inbox    Bookings   Leads     More   │
└───────────────────────────────────────────────┘
```

| Tab | Icon | Home screen of the tab | Why it earns a tab |
|---|---|---|---|
| **Home** | `home` | Dashboard | The daily pulse: KPIs, today's departures, attention items |
| **Inbox** | `message-circle` | WhatsApp/IG unified inbox | Highest-frequency task; real-time; badge = unread |
| **Bookings** | `calendar-check` | Bookings list | Core revenue object; leads to payments, invoices |
| **Leads** | `users` | Leads pipeline | The sales engine; badge = leads needing attention |
| **More** | `grid` / `ellipsis` | **Module hub** (see §4.3) | Everything else, searchable |

- Badges: Inbox = unread threads; Leads = overdue+due-today follow-ups. Numeric,
  `danger` for overdue, else `accent`.
- Active tab = `accent` icon + label; inactive = `text/secondary`.
- Tab bar hides on scroll-down / shows on scroll-up only inside full-screen immersive
  views (chat thread, builders). It stays put on list screens.

### 4.2 Within a tab — native stack

Each tab is a native stack. Navigation model:
- **List → Detail → Edit** pushes (native slide, swipe-back-to-pop enabled everywhere).
- **Large title** collapses into a standard nav bar on scroll (iOS large-title
  behavior). Nav bar is translucent; content scrolls under it.
- **Create/Edit forms** present as a **modal stack** (slides up, has Cancel/Save in the
  nav bar) — they are tasks, not places.
- **Filters, quick actions, pickers, "More" menus** are **bottom sheets**, never new
  screens.

### 4.3 The "More" hub — a searchable module launcher

Because ~45 screens live here, More is not a long list — it is a **grouped, searchable
grid** (like the App Library / Settings search).

```
More                                    🔍  ← search filters all modules instantly
┌─────────────────────────────────────────┐
│  Pinned                                   │  user can pin up to 4 modules → these
│  [Packages] [Campaigns] [Analytics] [+]   │  also become quick-swap favorites
├───────────────────────────────────────────┤
│  CATALOG                                  │  ← caption2 eyebrow
│  ▸ Packages   ▸ Properties   ▸ Cruises    │  2-col rows, icon + label + chevron
│  ▸ Visas      ▸ Services     ▸ Itineraries│
├───────────────────────────────────────────┤
│  MARKETING                                │
│  ▸ Campaigns  ▸ Ads   ▸ Social  ▸ Reviews │
│  ▸ Templates  ▸ Flows ▸ Automations ▸ Referrals
├───────────────────────────────────────────┤
│  FINANCE                                  │
│  ▸ Payments  ▸ Quotations  ▸ Accounting   │
│  ▸ Vendors   ▸ Package Finance            │
├───────────────────────────────────────────┤
│  INSIGHTS                                 │
│  ▸ Analytics ▸ CRM Report ▸ Calling Report│
├───────────────────────────────────────────┤
│  TEAM                                     │
│  ▸ HRM  ▸ Agents & Routing                │
├───────────────────────────────────────────┤
│  ▸ Settings          ▸ Sign out           │
└───────────────────────────────────────────┘
```

Module visibility respects the existing **per-agency module gating** (sidebar
preferences → the app hides ungranted modules entirely; see the backend module-access
enforcement already in place). A hidden module never appears in the hub or search.

### 4.4 Global gestures

| Gesture | Action |
|---|---|
| Swipe from left edge | Back (pop stack) |
| Swipe down on modal/sheet | Dismiss |
| Pull down on any list | Refresh |
| Swipe left on a list row | Reveal contextual actions (see §5.4) |
| Long-press a row | Quick-actions sheet (peek) |
| Tap status bar | Scroll to top |

---

## 5. Component library

Build these once; every screen composes them. Each is theme-aware and token-driven.

### 5.1 Buttons

- **Primary** — filled `accent`, `text/onAccent`, `headline` weight, radius `md`,
  height 50, full-width in forms / sheet footers. One per screen. Pressed → 0.96
  scale + `accent/pressed`.
- **Secondary** — `bg/fill` background, `text/primary`. For the non-primary choice.
- **Tinted** — `accent/tint` bg, `accent` text. For lightweight affirmative actions.
- **Plain/link** — text-only `accent`. Nav-bar actions, inline links.
- **Destructive** — `danger` text (plain) or `danger` fill (only in a confirm sheet).
- **Icon button** — 44×44 tap target, `text/secondary`.
- **FAB** — only where "create" is the dominant intent and no nav-bar slot fits
  (Inbox → new message). Circular 56, `accent`, `e3`. Otherwise prefer a nav-bar `+`.

All buttons: haptic (light impact) on primary/destructive tap.

### 5.2 Cards & the grouped-list model

The whole app uses the **iOS grouped-list** visual model: `bg/canvas` behind,
content in `bg/surface` cards with radius `lg`, 16pt padding, 12pt gaps.

- **Metric card** — used on every dashboard. Eyebrow (`caption2` label) · big value
  (`title1`, tabular) · delta chip (`success`/`danger` + arrow) · optional sparkline.
- **Object card / list row** — the workhorse (lead, booking, customer, payment,
  package). Anatomy in §5.3.
- **Section card** — a titled container grouping related rows (e.g. a booking's
  payments).

### 5.3 The universal list row

Ninety percent of this app is lists. One row component, configurable:

```
┌────────────────────────────────────────────────┐
│ ⬤   Primary title (headline)          ₹12,500  │  ← leading avatar/icon,
│     Secondary · meta · dot · status   ● Paid    │    trailing value + status,
│                                          ›       │    chevron if it pushes
└────────────────────────────────────────────────┘
```
- **Leading:** avatar (initials, deterministic color from name), thumbnail (package/
  property image), or status icon.
- **Title line:** `headline`. **Subtitle line:** `subhead`/`footnote`, `text/secondary`,
  with `·` separators and a status dot.
- **Trailing:** the one number that matters (amount, count, time) + a status badge,
  or a chevron.
- Tap → detail. Swipe → actions. Height comfortable (min 64). Never more than two
  lines of text + one trailing value — overflow goes to the detail screen.

### 5.4 Swipe actions

Consistent verbs by object. Right-swipe (leading) = positive; left-swipe (trailing) =
negative/more.
- **Lead:** ← Follow-up · Assign · ⋯   |   → Call/WhatsApp
- **Booking:** ← Invoice · ⋯   |   → Collect payment
- **Follow-up:** ← Snooze · ⋯   |   → Mark done (`success`)
- **Thread:** ← Assign · ⋯   |   → Mark read
- Full-swipe triggers the first action. All swipe actions also exist in the row's
  long-press sheet (discoverability + accessibility).

### 5.5 Segmented control & filter chips

- **Segmented control** (top of list, `bg/fill`, sliding `accent`-less white thumb):
  for 2–4 mutually exclusive views (e.g. Bookings: *All / Confirmed / Pending*, or
  Templates: *Presets / Library*). Max 4 segments — more than 4 → filter sheet.
- **Filter chips** (horizontal scroll row): additive filters (source, agent, status).
  Selected = `accent/tint` bg + `accent` text. A leading "Filters ⚙" chip opens the
  full **filter bottom sheet** for anything beyond 5 options.

### 5.6 Filter & sort bottom sheet

Replaces every desktop filter drawer/sidebar. A `@gorhom/bottom-sheet` at 90% height:
grouped rows of options (checkmarks for multi, radio for single), a live result count
("Show 42 leads"), a Reset link, and a primary Apply button. Applied filters surface
back as chips on the list.

### 5.7 Detail sheet vs. detail screen

- **Detail sheet** (bottom sheet, medium detent, expandable to full): for a quick look
  that keeps context — a booking's details, a payment, a lead peek. Has a grabber, a
  title, key facts, and 1–2 actions.
- **Detail screen** (pushed): when the object has tabs/sub-content (Customer profile,
  Campaign detail, Property details). Uses a **segmented control or scrolling
  sections**, not desktop tabs.

### 5.8 Forms & the wizard pattern

Many create-flows are multi-step (Package, Cruise, Property, Itinerary, Campaign).
Native pattern:
- Present as a **modal stack**. Nav bar: `Cancel` (left) · step title · `Next`/`Save`
  (right, `accent`, disabled until valid).
- **Progress**: a thin segmented progress bar under the nav title (`Step 2 of 4 ·
  Inclusions`), not a desktop sidebar.
- **One logical group per step**, each field full-width, label above (`footnote`,
  `text/secondary`), input `bg/fill` height 50 radius `md`. Inline validation on blur,
  error text in `danger` `footnote`.
- Long option lists (destinations, amenities, templates) open a **picker sheet** with
  search, not an inline dropdown.
- Auto-save drafts where the web app did (Itinerary, Campaign). Show "Draft saved".
- Sticky bottom bar for the primary action so it's always thumb-reachable.

### 5.9 Inputs

Text field, textarea (auto-grow), stepper (pax, quantity), currency field (₹ prefix,
tabular, thousands grouping), date/time (native picker sheet), toggle (native Switch,
`accent`/`success` when on), segmented, search bar (rounded `bg/fill`, leading 🔍,
clear ×, cancel link on focus). Icon/emoji picker (Service icons) and color picker
(Website builder) = grid inside a sheet.

### 5.10 Data viz (dashboards, analytics, reports, finance)

- Charts are **Skia/SVG**, single-accent + neutrals, no gridline clutter, no legends
  where a label suffices. Line/area for trends, horizontal bars for rankings/funnels,
  donut only for a single part-to-whole. Animate draw-in once (400ms).
- **Tables do not exist on mobile.** Every desktop table becomes either (a) a card
  list, or (b) a horizontally-scrollable "data strip" *only* for genuine matrices
  (Attendance register, Trial balance) — and even then the first column is pinned.
- KPI grids = 2-up metric cards, scannable in one glance. Tapping a KPI drills into
  the relevant list filtered to that metric.

### 5.11 Feedback & states — every screen implements all four

1. **Loading:** skeleton placeholders shaped like the real content (never a bare
   spinner on first load). Inline refresh uses the pull spinner.
2. **Empty:** centered icon (light `text/tertiary`), one-line `title3` explaining the
   space, one `body` `text/secondary` hint, one primary button to create the first
   item. Warm, never blank.
3. **Error:** inline card with a plain-language message + Retry. Network errors are
   non-blocking (keep cached data, banner on top).
4. **Success/action:** toast (top, auto-dismiss 2.5s) or inline; destructive/irre-
   versible = a confirm **action sheet** with the destructive verb in `danger`.
   Prefer **undo toasts** over confirm dialogs wherever a soft-delete is possible.

### 5.12 Other primitives

Badge/pill (status language §3.1), avatar, tag chip, progress bar & ring, toast,
banner (top, for offline/connection/permission states), skeleton, divider (hairline —
used rarely), grabber, section header (`caption2` eyebrow + optional trailing action).

---

## 6. Motion

Spring-based, quick, meaningful. Never decorative.

```
transition.screenPush     native platform default
sheet.present             spring(damping 30, stiffness 320)   ~350ms feel
press.scale               0.96, spring(damping 15, stiffness 400)
list.itemEnter            fade+8pt-rise, staggered 20ms, only on first mount
value.count               animate number changes (KPIs) 400ms ease-out
chart.draw                400ms ease-out, once
skeleton.shimmer          1200ms loop
tabSwitch                 crossfade 120ms
```
Respect **Reduce Motion**: replace springs/slides with crossfades. Haptics: light on
selection, medium on primary submit, success/warning/error notification haptics on
matching outcomes. Never haptic on scroll.

---

## 7. Accessibility (built in, not bolted on)

- **Contrast:** all text ≥ 4.5:1 (the token pairs above are pre-checked). Status is
  never conveyed by color alone — always paired with an icon/label (dot + word).
- **Dynamic Type:** layouts reflow to the largest accessibility sizes; no clipped text.
- **Tap targets:** 44×44 minimum, enforced.
- **VoiceOver:** every control labeled; list rows read "title, subtitle, status,
  amount"; charts have an accessible summary; decorative images hidden.
- **Keyboard/external:** forms tab in order; return advances fields.
- **RTL:** layout mirrors (Arabic-ready — the platform serves multilingual agencies).

---

## 8. Theming & white-label hook

Although this build is single-brand, keep the accent + logo behind the token layer so
the existing **white-label partner** system (branding by host) can later inject a
partner's `accent` and logo at launch with zero screen changes. One variable
(`theme.accent`) + one asset (`brand.logo`) is all a re-skin should touch.

---

## 9. Suggested app structure

```
src/
  theme/        theme.ts (tokens, light/dark), typography.ts, ThemeProvider
  ui/           Button, Card, ListRow, Sheet, Segmented, Chip, Badge, Avatar,
                Input, Field, Stepper, CurrencyField, Toast, Banner, Skeleton,
                EmptyState, ErrorState, MetricCard, Chart/*  (the §5 library)
  navigation/   RootTabs, HomeStack, InboxStack, BookingsStack, LeadsStack,
                MoreStack (+ ModuleHub), modals
  features/     <domain>/  screens + hooks + api (reuse web query hooks/schemas)
  lib/          api client, query client, mmkv, haptics, formatters (money/date)
  hooks/        useTheme, useModuleAccess, usePermissions
```

Continue to Document 2 for the screen-by-screen specifications.
