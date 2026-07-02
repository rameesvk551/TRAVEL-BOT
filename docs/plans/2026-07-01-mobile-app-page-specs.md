# Travel Bot — Mobile App Page Specs (React Native)

> **Document 2 of 2.** Screen-by-screen specifications. **Read Document 1
> (`2026-07-01-mobile-app-design-system.md`) first** — every "component" named here
> (ListRow, MetricCard, Sheet, Segmented, etc.) and every token is defined there.
>
> **How each spec reads:**
> - **Role** — one line.
> - **Layout** — top→bottom on the phone.
> - **Primary action** — the single filled-accent button/target.
> - **Interactions** — taps, swipes, sheets.
> - **Desktop→mobile** — the key transform from the current web page.
> - **States** — loading / empty / error handled per Doc 1 §5.11.
>
> Screens are ordered by the **Roadmap** (last section). Grouped by the navigation area
> from Doc 1 §4: the tabs, then the More hub, then Auth.
>
> **Multi-tenant note (see Document 3):** this app is multi-industry. Every business
> noun below — *Bookings, Leads, Customers, Agents* — is an **engine** that each
> industry relabels via the login manifest (a resort renders Bookings as
> *Reservations*, a cleaning company as *Jobs*; Customers → *Guests* / *Clients*).
> Always render nouns through `t(key)` (Doc 3 §6). A module absent from a tenant's
> manifest is simply not built for that tenant. The tab assignments below are the
> **travel-agency default**; the tab bar itself is manifest-driven.

---

# TAB 1 — HOME

## Dashboard — Home tab root · (density: med-high)
- **Role:** the daily pulse — money, work waiting, and what's happening today.
- **Layout (large title "Home", scrolls under translucent nav):**
  1. Greeting line (`Good morning, {name}` · agency chip) — `footnote`.
  2. **KPI grid, 2×2 MetricCards:** New Leads · Conversion % · Bookings · Revenue.
     Each shows value (`title1`), period delta chip, tiny sparkline. Tap → drills into
     the source list filtered (e.g. Revenue → Payments; New Leads → Leads/new).
  3. **Revenue trend** section card — 30-day area chart, single accent line.
  4. **Pipeline** section card — horizontal bars by status (from funnel data).
  5. **Today's departures** section card — up to 3 ListRows (customer · package ·
     date), "See all" → Bookings filtered to upcoming.
  6. **Needs attention** — up to 3 rows (overdue follow-ups, unpaid bookings) with a
     `danger`/`warning` dot; tap → the item.
- **Primary action:** none (Home is a glanceable hub). Nav-bar trailing: a `+` quick-
  create sheet (New Lead / Booking / Quotation / Follow-up).
- **Interactions:** pull-to-refresh; period selector (segmented: 7d/30d/90d) pinned
  under KPIs; tap any card → filtered destination.
- **Desktop→mobile:** the multi-chart dashboard becomes a vertical scroll of section
  cards; the departures *table* becomes ListRows. Charts lazy-load with skeletons.
- **States:** skeleton KPI + chart blocks; empty = "No data yet — add your first lead"
  CTA; per-card error is isolated (one chart failing doesn't blank the screen).

---

# TAB 2 — INBOX

## Unified Inbox (WhatsApp + Instagram) — Inbox tab root · (high)
- **Role:** the highest-frequency screen — live customer conversations with bot/human
  handoff. This is the app's flagship; make it feel like iMessage-grade.
- **Layout (thread list):**
  - Sticky search bar + a **Segmented**: *All / Leads / Customers*. A trailing filter
    chip row: channel (WA/IG), assigned-to-me, unread, by number.
  - **FlashList of thread rows:** avatar (channel glyph overlay) · name · last-message
    preview (1 line) · time · unread count badge · assigned-agent chip · a small
    bot/human mode dot.
  - **FAB** (`+`) → new-contact sheet (search existing or enter number).
- **Thread screen (push, immersive — tab bar hides):**
  - Nav bar: back · name + presence/mode subtitle · ⋯ (menu sheet: assign, take over,
    copy conversation, view lead/customer).
  - Message list (iMessage bubbles: outgoing accent-tinted, incoming `bg/fill`),
    delivery ticks (sent=info, delivered/read=success per status language),
    day dividers, media/templates rendered inline.
  - **Composer** (sticky, above keyboard): text field (auto-grow) · attach · voice-to-
    text mic · send (accent, appears when non-empty). A "Bot is handling — Take over"
    banner when in bot mode; taking over switches to human and shows the composer.
- **Primary action:** send message.
- **Interactions:** swipe thread → mark read (→) / assign (←); long-press message →
  copy/react; pull-to-refresh; typing indicator surfaced in the header (matches the
  existing bot→MOS typing behavior).
- **Desktop→mobile:** three-pane (list · thread · lead panel) becomes list → thread
  push; the **lead-intelligence panel** becomes a header-tap → detail sheet.
- **States:** thread-list skeleton; empty = "No conversations yet"; per-send optimistic
  bubble with retry-on-fail; offline banner keeps history readable.

---

# TAB 3 — BOOKINGS

## Bookings — Bookings tab root · (med-high)
- **Role:** browse/manage all travel transactions (packages, properties, cruises,
  visas, services).
- **Layout:** large title "Bookings"; **Segmented** *All / Confirmed / Pending*;
  filter chips (item type, customer, package/service) → filter sheet for the rest;
  FlashList of booking rows: ref · customer (avatar) · type icon · item · travel date ·
  amount + payment-status badge.
- **Primary action:** nav-bar `+` → New Booking (BookingForm modal).
- **Interactions:** tap → Booking detail sheet; swipe → Collect payment (→) / invoice
  + ⋯ (←). Search by customer/ref.
- **Desktop→mobile:** filter bar → chips + sheet; table → ListRows; detail overlay →
  detail sheet.
- **States:** skeleton rows; empty per active segment; error card + retry.

### Booking detail — sheet (expandable to full) · (med)
- Header: ref · status badge · amount `title1`. Facts grid: customer, item, travel
  date, travellers, payment terms. **Payments** section card (paid rows +
  balance-due in `danger`). Notes. Actions: **Collect payment** (primary) ·
  Download invoice · Edit · ⋯.

## BookingForm (create/edit) — modal wizard · (med)
- **Role:** configure a booking: customer → service → pricing/terms.
- **Steps (modal stack, progress bar):**
  1. **Customer** — Segmented *Existing / New*; existing = search-picker sheet; new =
     name/phone inline.
  2. **Service** — item-type Segmented (Package/Property/Cruise/Visa/Service) → item
     picker sheet (search); auto-fills base price.
  3. **Pricing & dates** — travellers stepper, base price, auto total, travel date
     (native picker), payment method segmented, advance CurrencyField, notes.
- **Primary action:** sticky **Save booking**. Cancel (nav left).
- **Desktop→mobile:** the single long form becomes 3 thumb-friendly steps; dropdowns →
  picker sheets; live total recalculates in a pinned summary above the CTA.
- **States:** field-level validation; disabled Save until valid; save = success toast → detail.

## Payments — More hub / linked from Bookings · (low-med)
- **Role:** outstanding balances & collection status across bookings.
- **Layout:** two summary MetricCards (Total outstanding · Collected this month);
  Segmented *Due / Partly paid / Paid*; ListRows: customer · booking ref · balance
  (`danger` if due) · travel date · status.
- **Primary action:** row → **Record payment** sheet (amount, method, date, note;
  optimistic).
- **Desktop→mobile:** ledger table → card rows; record-payment is a sheet, not a page.
- **States:** skeleton; empty = "All settled 🎉"; error + retry.

## Quotations — More hub (Finance) · (low-med)
- **Role:** browse/manage estimates sent to prospects.
- **Layout:** Segmented *All / Draft / Sent / Accepted / Rejected*; ListRows: number ·
  customer/lead · amount · date · status badge.
- **Primary action:** nav `+` → QuotationForm.
- **Interactions:** swipe → Send on WhatsApp (→) / download PDF + ⋯ (←); tap → preview.
- **States:** skeleton; empty CTA; error.

### QuotationForm (build/preview) — modal · (med)
- **Layout:** Segmented **Builder / Preview**.
  - *Builder:* lead/customer picker · template picker sheet · date · status · **line
    items** (add-row: name, description, qty, price → auto amount) · live totals
    footer + amount-in-words.
  - *Preview:* rendered Handlebars template in a WebView, "Send on WhatsApp" primary.
- **Primary action:** Save (Builder) / Send (Preview).
- **Desktop→mobile:** left-config + center-table + preview panes → a two-segment view;
  the item table becomes stacked editable rows; preview is full-width WebView.
- **States:** empty items hint; validation on amounts; save/send toasts.

---

# TAB 4 — LEADS

## Leads — Leads tab root · (high — the app's densest sales screen)
- **Role:** the sales pipeline: capture, filter, nurture, convert.
- **Layout:**
  - Large title "Leads"; a compact **stat strip** (4 mini metrics: Attention ·
    Overdue · Hot · Pipeline ₹) that taps to filter.
  - View toggle (Segmented **List / Board**): List = FlashList; Board = horizontal
    Kanban of status columns with draggable lead cards.
  - Filter chips (source, agent, tag, channel, ad) + "Filters ⚙" sheet; sort control
    (Overdue / Newest); search.
  - **Lead row:** avatar · name · destination · source chip · status dot+label ·
    assigned-agent · a "next follow-up" time (in `danger` if overdue).
- **Primary action:** nav `+` → New Lead (modal form).
- **Interactions:**
  - Tap → **Lead detail sheet** (expandable): contact, trip interest, status, timeline
    of activity, assigned agent, quick actions (Call · WhatsApp · Schedule follow-up ·
    Change status · Convert to booking).
  - Swipe row → Follow-up/Assign/⋯ (←) · Call/WhatsApp (→).
  - Multi-select mode (long-press) → bulk bar (Assign / Delete / Status / Export).
  - Board: drag a card between columns to change status (haptic on drop, optimistic).
- **Desktop→mobile:** filter *drawer* + stats *drawer* → chips + sheets; kanban is
  horizontally scrolled with snap; export = a sheet (PDF/Excel) with progress toast.
- **States:** skeleton cards; empty per filter; overdue emphasized; export error toast.

## FollowUps — Leads tab (secondary) · (med)
- **Role:** the task list — scheduled actions on leads.
- **Layout:** 4 MetricCards (Scheduled · Overdue · Today · Done); Segmented
  *Today / Overdue / Upcoming / Done*; ListRows: due time · lead · trip · note ·
  assigned; overdue in `danger`.
- **Primary action:** nav `+` → New follow-up sheet (lead search, date/time, note,
  agent).
- **Interactions:** swipe → Mark done (→ `success`, undo toast) / Snooze + ⋯ (←);
  filter by agent.
- **Desktop→mobile:** filter/stats drawers → cards + sheet; complete-modal → inline
  swipe + optional note sheet.
- **States:** skeleton; empty = "Nothing due — you're on top of it"; error.

## Customers — Leads tab (secondary) · (high)
- **Role:** the customer database + full lifecycle (bookings, docs, messages, ledger).
- **Layout (list):** search; ListRows: avatar · name · phone · total billed · balance
  due (`danger`) · created date.
- **Customer detail (push screen, not a cramped tabbed drawer):**
  - Header: avatar · name · phone · call/WhatsApp/edit quick buttons · financial
    summary strip (billed · paid · balance).
  - **Segmented sub-nav** replacing the 6 desktop tabs: *Profile · Services · Messages
    · Documents · Ledger · Timeline*. Each renders a scrolling section (not nested
    tabs): Services = booking ListRows; Messages = last conversation → deep-link to
    Inbox thread; Documents = thumbnail grid + upload; Ledger = transaction rows;
    Timeline = activity feed.
- **Primary action:** nav `+` → New customer; in detail, context action = New booking
  for this customer.
- **Desktop→mobile:** the 6-tab detail drawer → a pushed detail screen with a
  scrollable segmented control; documents gallery stays a grid.
- **States:** skeleton; empty tabs handled individually; upload progress + error.

---

# TAB 5 — MORE (module hub)

## Module Hub — More tab root
Spec in Doc 1 §4.3: searchable, grouped, pinned favorites, respects module gating.
Below are the destinations, grouped as in the hub.

---

## CATALOG group

### Packages — /packages · (med)
- **Role:** browse/manage tour packages.
- **Layout:** Segmented *All / Domestic / International / Inactive*; view toggle
  Grid/List; sort sheet (date/price); **package card:** cover image, name, category
  chip, base price, active dot.
- **Primary action:** nav `+` → PackageForm. Row/card: tap → PackageForm (edit) or a
  detail sheet with "Finance" and "Edit".
- **Interactions:** swipe/long-press → Deactivate / Duplicate / Finance; search;
  pagination via infinite scroll.
- **Desktop→mobile:** filter drawer → chips; grid stays 2-col; keep the grid/list toggle.
- **States:** skeleton cards; empty CTA; error.

### PackageForm — modal wizard, 4 steps · (med)
- Steps: **Basics** (name, category, price, tour type, duration, destinations picker,
  summary) → **Inclusions** (add-item list) → **Exclusions** (add-item list) →
  **Media** (cover image upload, PDF brochure, summary). Progress bar; sticky Save;
  destinations open a search picker sheet; image = native picker + crop.
- **Desktop→mobile:** sidebar-step nav → top progress bar; multi-line item editors →
  add/remove chip-rows.

### PackageFinance — /packages/:id/finance · (high)
- **Role:** per-package P&L and reconciliation.
- **Layout:** 2-up MetricCards (Expected · Received · Pending · Cost · Gross profit ·
  Profit % · Cash · Pax); Segmented *Receivables / Payables / Vendor-wise / Aging*;
  each = card rows with status badges. **Add payable** = FAB/sheet (not a sidebar
  form).
- **Desktop→mobile:** the two-column tables + right-sidebar form → segmented sections +
  a bottom-sheet form; 8 KPIs → a 2-col scannable grid; profit/cash panels → two
  headline cards at top.
- **States:** skeleton KPIs; empty payables CTA; delete-payable = swipe + undo.

### Cruises — /cruises · (low-med) — same pattern as Packages
- Segmented *All / Active / Inactive*; cruise card (name, line, port, duration, price).
### CruiseForm — modal, 3 steps: **Details** → **Media & inc/exc** → **Cabins** (add-
  row list: type, price, description). Status toggle in nav.

### Visas — /visas · (low-med)
- Segmented by visa type + Inactive; card (country flag/emoji, type, price, processing
  time, validity).
### VisaForm — modal, 2 steps: **Details** (country, type picker, price, processing,
  validity, banner) → **Requirements** (documents list, eligibility notes).

### Services — /services · (med)
- **Role:** add-on services (ticketing, insurance, documentation).
- **Layout:** category Segmented/chips; **compact 2-col card grid:** emoji icon,
  name, category badge, price + pricing-type chip, top-2 feature pills.
- **Primary:** nav `+` → ServiceForm.
- **Desktop→mobile:** the 6-col dense grid → 2-col cards; per-card 3 action buttons →
  swipe/long-press sheet (Edit / Activate / Delete).
### ServiceForm — single modal: name, category, description, **icon picker** (emoji
  grid in a sheet), **pricing-type** selector (3 cards: Fixed/Starting/Variable),
  price, features (add/remove chips), active toggle.

### Properties — /properties · (med) — same pattern as Packages
- Segmented *For sale / For rent / Inactive*; card (image, name, type, location, ₹/night).
### PropertyForm — modal, 4 steps: **Basics** → **Address/description** → **Amenities**
  (toggle-chip picker + custom add) → **Media** (cover, PDF, active toggle).
### PropertyDetails — /properties/:id · (med)
- **Role:** read-only property view.
- **Layout:** full-bleed hero image; name · type icon · location; facts strip
  (₹/night, address); description; amenities as checkmark badges. Sticky actions:
  Edit · Deactivate (admin).
- **Desktop→mobile:** hero + sidebar + panels → single scroll with a big hero and
  grouped sections.

### Itineraries — /itineraries · (med)
- List/cards: name · client · destination · date · price · margin % · status badge.
- Primary `+` → ItineraryBuilder. Swipe → Duplicate / Delete; tap → builder (edit).

### ItineraryBuilder — modal, 5 steps · (VERY high — the most complex screen)
- **Role:** build a polished multi-day itinerary with live PDF preview.
- **Steps (modal stack, progress bar, autosave draft):**
  0. **Basics** — name, destination, dates, pax, customer picker, "start from package".
  1. **Day plan** — reorderable **day cards** (title + description); each card: edit,
     duplicate, delete, drag-handle. Add day = sticky button.
  2. **Stay & transport** — hotel rows (name, city, category, nights, room, meals) via
     add-row; vehicle type + feature chips.
  3. **Pricing** — price-per-room breakup rows, GST %, inclusions/exclusions list
     editors, live totals footer.
  4. **Finish** — template picker (thumbnail grid sheet) · **Preview** (full-screen
     WebView render) · Download PDF · Send on WhatsApp.
- **Desktop→mobile:** the split form+live-preview becomes step-based editing with a
  **"Preview"** button in each step's nav bar (opens the WebView modally) rather than a
  permanent side pane — phones can't show both. Reorder via long-press drag.
- **States:** autosave "Draft saved" chip; per-step validation; generate-PDF progress;
  send confirmation.

---

## MARKETING group

### Campaigns — /campaigns · (high)
- **Role:** WhatsApp broadcast/promo campaign hub + analytics.
- **Layout:** 6 KPI MetricCards (2-up scroll: Campaigns · Recipients · Sent ·
  Delivered · Read · Failed) with delivery/read/failure rates; status filter chips
  (Draft/Scheduled/Sending/Sent/Failed/Cancelled) + type filter sheet + date range;
  ListRows: name · status badge · recipients · read/delivered mini-stats · date.
- **Primary:** nav `+` → CreateCampaign.
- **Interactions:** swipe → Send now (draft/scheduled, →) / Duplicate · Delete (←);
  tap → CampaignDetail; export CSV via sheet.
- **Desktop→mobile:** wide metrics + table → KPI grid + card rows; filter row →
  chips+sheet.
- **States:** skeleton; empty CTA; export toast.

### CampaignDetail — /campaigns/:id · (very high)
- **Role:** single-campaign analytics down to recipient level.
- **Layout:** header (name · status · type · dates · ⋯ menu); 6 metric cards with
  progress bars (Total/Sent/Delivered/Read/Replied/Failed); outcome cards (Clicks ·
  Leads · Bookings · Revenue); **delivery funnel** (stacked bars); **delivery
  timeline** (hourly area chart); **CTA performance** rows; **package/property
  performance** card list; **recipient activity** = card list (per-customer: delivery,
  click, reply times) — *not* a 20-column table.
- **Primary:** context = Send now / Cancel / Duplicate / Delete (menu).
- **Desktop→mobile:** the multi-panel dashboard → vertical section cards; the giant
  recipient table → searchable ListRows (tap a recipient → their timeline sheet).
- **States:** skeleton panels; per-panel error isolation.

### CampaignReports — /campaigns/reports · (high)
- **Layout:** 5 stat cards; Segmented **By campaign / By recipient**; filters
  (campaign picker, status, type, date, search) in a sheet; results as card rows;
  export (numbers CSV / campaign CSV) via sheet; infinite scroll.
- **Desktop→mobile:** the two side-by-side tables → a segmented single list.

### CreateCampaign — modal wizard, 5 steps · (VERY high)
- **Role:** build broadcast/promo/carousel campaigns.
- **Steps:** **Details** (name, type, format: Standard/Section-CTA/Carousel) →
  **Template** (picker sheet: prebuilt + agency, search, status) → **Audience** (mode
  picker: All / Package bookers / Enquiries / Past travelers / Leads only / By status /
  Import CSV / Advanced, with a live audience count) → **Schedule** (Now / Scheduled
  datetime) → **Review** (summary + Send).
- **Nested config** (from Doc 1 §5.8): **CTA/carousel config** and **flow builder**
  open as full-screen modals from the relevant step — the flow builder is a pannable
  node canvas (see Flows) presented over the wizard, not inline. Carousel = bulk image
  upload + per-card editor. Button actions bind to agency flows/URLs (matches the
  existing configurable-campaign-buttons + carousel-per-image-flow systems).
- **Primary:** step Next → final **Send** (or Schedule).
- **Desktop→mobile:** 50+ fields across 5 steps stay 5 steps; the two side-drawers
  (template picker, config) become full-screen modals; audience selector = mode chips +
  picker sheets.
- **States:** validation gating each step; audience-count loading; send confirmation +
  progress.

### Ads (AdsDashboard) — /ads · (med-high)
- **Role:** Meta Lead Ads reporting (accounts, campaigns, forms, synced leads).
- **Layout:** connection-state screen if not connected ("Connect ad account" →
  in-app-browser to Marketing OS); else: 6 KPI cards (Active campaigns · Spend ·
  Impressions · Clicks · Ad leads · Cost/lead); **campaigns** card list (name,
  objective, status, spend, leads, CTR, CPL) → tap = campaign detail sheet (grid +
  recent leads); collapsible sections for **Connected accounts** and **Lead forms**
  (each form has a Sync button).
- **Primary:** Refresh (pull) · Connect (if disconnected).
- **Desktop→mobile:** table + two sidebars → KPI grid + card list + two accordion
  sections; drawer → detail sheet.
### CreateAd — /ads/new · (very low)
- Informational placeholder (v1 = reporting only): empty-state card, icon, explanation,
  back to Ads. Keep as-is.

### Social (Instagram workspace) — /social · (high)
- **Role:** IG DMs, comments, automations, publishing, insights.
- **Layout:** account picker (if multiple) in nav title; **Segmented** *Inbox ·
  Comments · Automations · Publishing · Insights*.
  - *Inbox:* reuse the Inbox thread pattern; the lead-intelligence panel → header-tap
    detail sheet; actions: Reply, Take over, **Send best matches** (AI) as a primary.
  - *Comments:* comment ListRows → detail (media thumb) with **Public reply** + **Private
    reply** as two composer sections; delete via swipe.
  - *Automations:* active-automation ListRows (keyword, match type, stats, status) +
    **create automation** modal form (name, media, trigger keywords, match type,
    action, quick replies, public-reply toggle, linked packages/properties). Reflects
    the existing IG comment/automation activation rules (status must be 'active').
  - *Publishing:* caption + media upload + preview → Post.
  - *Insights:* KPI cards + simple charts.
- **Desktop→mobile:** the 3-column inbox and side-by-side reply layout → stacked
  thread/detail with segmented sections; tabs stay a top segmented control.

### Reviews — /reviews · (med)
- **Layout:** header card: average rating (big `title1` + stars) beside a distribution
  bar chart (5→1); 2 MetricCards (Total collected +delta · Published/approved); filter
  chips (All / 5★ / 4★ / 3★ / Negative); **review cards** (avatar initials, name, date,
  stars, title, testimonial, Published badge, Respond/Share).
- **Primary:** Respond (sheet with reply); Share (share sheet).
- **Desktop→mobile:** 2-column stats → stacked header card; keep review cards.

### Templates — /templates · (med-high)
- **Role:** WhatsApp template library (presets + agency, Meta sync status).
- **Layout:** search + **Sync status** action; status Segmented (All/Draft/Pending/
  Approved/Rejected); category chips (Marketing/Utility); two sections: **Presets** and
  **Library** as template cards (icon, name, type/category badges, body preview, status
  badge, rejection reason if any).
- **Primary:** nav `+` → New template (opens detail sheet in edit mode).
- **Interactions:** tap → **template detail sheet** (view/edit); Use-prebuilt → edit;
  sync pulls Meta status.
- **Desktop→mobile:** sidebar categories → chips; drawer → detail sheet; 3-col grid →
  1-col cards.

### Flows (WhatsApp Flow builder) — /flows · (med, builder = high)
- **Role:** manage & build WhatsApp Flows.
- **Layout:** status Segmented (All/Draft/Published/Failed/Archived) + **Sync from
  Meta**; flow cards (name, type, status, Meta ID, endpoint, validation-error count).
- **Primary:** nav `+` → New flow → **flow builder** (full-screen modal): a pannable/
  zoomable node canvas (`react-native-reanimated` + gesture-handler; nodes = screens,
  edges = navigation), an "Add node" sheet, node-config sheets, and Validate/Publish
  in the nav bar.
- **Desktop→mobile:** the desktop canvas becomes a pinch-zoom/pan native canvas; node
  editing happens in sheets (a phone can't do side-by-side inspector).
- **States:** validation errors listed in a sheet before publish.

### Automations (drip workflows) — /automations · (low-med)
- **Layout:** sequence cards (icon, name, description, active toggle, trigger, steps
  count, enrolled count).
- **Primary:** nav `+` → Create workflow (step-sequence builder: trigger picker →
  ordered step cards, each an add/edit sheet: delay, message, condition).
- **Interactions:** toggle active/pause inline (optimistic); ⋯ → edit/duplicate/delete.

### Referrals — /referrals · (med)
- **Layout:** 3 MetricCards (Active codes · Total uses · Revenue via referrals);
  **All codes** card list (code + copy, customer, discount, uses used/max, status);
  **Top referrers** leaderboard (rank, avatar, count).
- **Primary:** nav `+` → Generate code (sheet).
- **Desktop→mobile:** table → rows; leaderboard sidebar → a section card.

### WebsiteBuilder — /website · (med-high)
- **Role:** configure & publish the agency's static website.
- **Layout:** **status card** at top (Website Published/Draft · Files ready · DNS) with
  **Publish/Unpublish** primary and "Open live site"; then a form in sections:
  **Identity** (subdomain, custom domain, title, description, phone, email) ·
  **Template** (horizontal thumbnail gallery of the 10 templates) · **Branding**
  (primary color picker sheet, logo/hero image) · **SEO** (title, keywords,
  description, collapsible) · **Advanced CSS** (collapsible textarea). A live
  **preview card** (hero color/image + title/description) pinned near the top.
- **Desktop→mobile:** 2-col form → stacked sections; template gallery → horizontal
  snap-scroll; keep the preview card prominent.
- **States:** save toast; publish progress; DNS instructions in an info sheet.

### Brochure — /brochure · (med, marketing microsite)
- **Role:** the sales pitch deck for prospects (WAYON features, WhatsApp journey).
- **Treatment:** this is outward-facing marketing, not a CRM tool. Render it as a
  polished, scrollable **story screen** (hero → feature cards → 5-step WhatsApp journey
  → closing CTA) with tasteful motion (parallax hero, staggered card reveals). Buttons:
  View features (scroll anchor) · Open dashboard. It's the one screen allowed a little
  more visual flourish — but still within the token system.

---

## FINANCE group

### Accounting hub (Accounts/index) — /accounts · (high)
- **Role:** the accounting entry point.
- **Layout:** **Segmented** *Overview · Chart · Journals · Invoices · Reports*.
  - *Overview:* 4 KPI cards (Customer due · Received · Vendor payable · Paid); unpaid-
    bookings list; recent journal entries; two primary actions → **Record receipt** and
    **Record payment** (split-form sheets showing booking/payment context).
- **Desktop→mobile:** the tabbed accounting suite → a segmented hub; complex modals →
  sheets with the context panel stacked above the form.

### ChartOfAccounts — under Accounting · (high)
- **Layout:** search + type filter chips (Assets/Liabilities/Equity/Revenue/Expense);
  an **expandable tree** as indented ListRows (group rows expand/collapse; leaf rows
  show balance); tap leaf → **Ledger statement** sheet (account activity).
- **Actions:** nav `+` → Ledger editor sheet; row long-press → Edit / Merge / Add
  child / Delete.
- **Desktop→mobile:** the desktop tree stays a tree via indentation + disclosure; the
  slide-over statement → a detail sheet.

### Journals — under Accounting · (high)
- **Layout:** search + period filter; journal ListRows (reference, date, type,
  description). Create = a **+** menu (Journal entry / Receipt / Payment / Expense).
  - *Journal entry form:* multi-line debit/credit editor (add-row), running balance
    validation (`danger` until balanced), attachment upload.
  - *Voucher forms:* single debit/credit guided sheets.
  - Tap entry → JournalDetails sheet (full lines + attachments).
- **Desktop→mobile:** the bulk multi-line editor stays, but each line is a compact row;
  balance status pinned above the Save button.

### Invoices (+ Credit notes) — under Accounting · (med)
- **Layout:** Segmented **Invoices / Credit notes**; invoice ListRows (number,
  customer, date, status, total, paid, due-in-`danger`); tap → invoice detail sheet with
  "Create credit note" and "Customer statement" (party-statement sheet).
- **Desktop→mobile:** two-tab tables → segmented card lists; slide-over statement →
  sheet.

### Accounting Reports — under Accounting · (very high)
- **Layout:** a **report picker** (segmented or a top selector): *Trial balance · P&L ·
  Balance sheet · Aging · Cash flow · Item profitability*; period/item filters in a
  sheet; each report rendered mobile-first:
  - P&L / Balance sheet → collapsible hierarchical section rows with subtotals.
  - Trial balance → the one allowed **pinned-first-column horizontal data strip**.
  - Aging → bucket cards + receivable rows.
  - Cash flow → inflow/outflow sections + a net headline.
  - Item profitability → expandable per-item cards (receivables + payables inside).
- **Desktop→mobile:** six wide report layouts → six mobile-tuned templates; export via
  sheet (PDF/CSV).
- **States:** skeleton; per-report empty; export toast.

### Vendors — /vendors · (low-med)
- List: vendor rows (name, type, contact, status) with Payments + Edit actions.
- Primary `+` → **VendorForm** sheet (name, type picker, email, phone, GSTIN, address,
  active).
### VendorPayments — /vendor-payments (per vendor) · (high)
- **Layout:** Segmented **Record payment / Add bill**; a form (conditional fields:
  against-bill picker for payment; item/service mapping for bill; payment method) with
  the **transaction history** as a list below (not a side pane).
- **Desktop→mobile:** the two-pane form+history → segmented form on top, history list
  below.
### GlobalVendorPayments — /vendor-payments (global) · (med)
- All payments card list (date, vendor, type, mapped item, mode, amount, ref) + filter
  sheet (vendor, item type, vendor type, date range); `+` → vendor picker → VendorPayments.

---

## INSIGHTS group

### Analytics — /analytics · (extremely high — 9 report views)
- **Role:** the deep reporting dashboard (pulse, revenue, leads, channels, marketing,
  customers, packages, team, reviews).
- **Layout:** a **report selector** at top — a horizontally-scrolling segmented/chip row
  (Pulse · Revenue · Leads · Channels · Marketing · Customers · Packages · Team ·
  Reviews) — plus a **date-range control** (preset chips + custom sheet). Each selected
  report is its own vertical scroll of MetricCards + charts:
  - *Pulse:* hero gauge + attention list + pipeline snapshot.
  - *Revenue:* sales-trend area chart + profit-by-package bars.
  - *Leads:* funnel bars + **lead heatmap** (calendar + time-of-day grid) + status mix.
  - *Channels/Marketing:* source performance bars, ad performance rows.
  - *Team:* staff scorecard cards with performance rings.
- **Desktop→mobile:** nine dense multi-chart layouts → nine scrollable report screens
  behind one selector; all tables → card lists; heatmaps stay as compact grids (scroll
  if needed). Export via sheet.
- **States:** per-report skeleton and empty; isolate chart errors.

### CrmReport — /reports (CRM) · (very high)
- **Layout:** KPI cards (leads, open deals, won, conversion, hot); funnel bars;
  month-at-a-glance deltas; won-vs-lost trend; top-sources bars; needs-attention chips;
  top-performers leaderboard; today's schedule (tiles + activity); recent activity feed;
  activity-pulse bars; smart suggestions. **Manage stages** = a modal (reorder/recolor/
  rename pipeline stages, toggle lead status).
- **Desktop→mobile:** nine sections stack vertically; stage-manager modal uses drag-
  reorder rows.

### CallingReport — /reports (Calling) · (very high)
- **Layout:** KPI cards (total calls, answer rate, missed, avg talk, pickup, recorded);
  daily volume area chart (connected vs missed); status-mix bar rows; best-call-window
  heatmap; staff leaderboard; lead-wise activity; **recent call log** rows with an
  inline audio **RecordingButton** (native player). Filters (agent, lead) in a sheet.
- **Desktop→mobile:** charts + deep tables → stacked sections + card lists; keep inline
  recording playback.

---

## TEAM group

### HRM — /hrm · (hub)
- **Role:** HR module container.
- **Layout:** a **Segmented / sub-hub** for *Me · People · Attendance · Leaves ·
  Payroll · Reports · Settings* (non-managers see only *Me*). Pending-leave count badge
  on Leaves.

### MySpace (Me) — HRM · (high)
- **Layout:** **live clock card** + big **Punch in/out** primary (captures GPS —
  required — and shows a force-punch overlay when mandated, matching the existing HRM
  punch-location gate); today's punch times + location links; leave-balance grid
  (quota/used); month timesheet **calendar**; leave-request history.
- **Primary:** Punch in/out. Secondary: Request leave (sheet: type, date range,
  half-day toggle, reason).
- **Desktop→mobile:** stacked sections; calendar is a native month grid; punch is the
  hero action.

### People — HRM · (med)
- Employee ListRows (name, designation, department, join date, salary). Tap →
  **Edit employee** sheet (code, dates, salary, designation, type, weekly offs, active).

### AttendanceBoard — HRM · (high)
- Summary stat tiles (Present/Half/Leave/Absent); daily attendance ListRows (punch
  in/out, status) with a status dropdown + **edit punch** sheet.
### AttendanceRegister — HRM · (very high — a matrix)
- The month×employee grid → the allowed **pinned-first-column horizontal data strip**:
  employee name column frozen left, day columns scroll horizontally with colored
  glyphs (P/½/A/L/W/H); legend chip row; tap a cell → edit-attendance sheet. Add a
  month selector.
### LeaveApprovals — HRM · (med)
- Filter Segmented (Pending/Approved/Rejected/All); request cards (requester, type,
  range, days, reason); swipe → Approve (→ `success`) / Reject (← `danger`).
### Payroll — HRM · (high)
- Month selector; summary tiles (headcount, gross, deductions, net); payroll ListRows
  (employee, paid/unpaid days, net, status) → **payslip detail** sheet (earnings/
  deductions line items, print, finalize/mark-paid). **Generate payroll** primary.
### HRM Reports — HRM · (very high)
- Summary tiles + attendance-% bar chart + detailed report card list; **Export CSV**;
  month selector.
### HRM Settings — HRM · (med)
- Three section cards: **Work rules** (start time, grace, thresholds, payroll basis,
  weekly offs) · **Leave types** (list + add) · **Holidays** (calendar list + add).

### Agents & Routing — /agents · (med)
- **Layout:** Segmented **Team / Service routing**.
  - *Team:* user ListRows (name, email, phone, role, online dot); `+` → user form sheet
    (created-credentials alert with copy).
  - *Service routing:* grouped routing-intent rows (packages/properties/cruises/visas/
    services) each with an assigned-agent picker + fallback indicator; Save.

---

## SETTINGS (from More)

### Settings — /settings · (hub + 18 tabs)
- **Layout:** a **grouped settings list** (iOS Settings style), NOT a horizontal tab
  strip. Sections group the 18 tabs; each row pushes to its editor:
  - **Agency:** General (name, phone, review link) · Company profile (logo, seal,
    signature, GSTIN, UPI, state code, GST rates) · Bank accounts.
  - **Documents:** Invoice / Quotation / Itinerary / Receipt template builders ·
    Document delivery (email options). Each template builder is a **visual editor
    screen** — themed template picker + field mapping + live preview WebView (matches
    the existing document-builders system); on a phone, edit controls in sections with a
    "Preview" button.
  - **Messaging:** Welcome menu · Flow builder · Instagram flow builder · Automations ·
    Integrations (WhatsApp/IG/email OAuth connect cards with status) · API keys.
  - **CRM setup:** Lead form builder · Lead sources · Vendor types · Sidebar modules
    (module visibility toggles — these drive the More hub + gating).
- **Desktop→mobile:** the 18-tab side/scroll nav → a native grouped settings list with
  push-to-detail; builders become focused editor screens with preview modals.
- **States:** each editor saves with a toast; connection cards show live status +
  reconnect.

---

# PLATFORM (separate, admin-only surface)

### Partners — /platform/partners · (high)
- **Role:** white-label partner (reseller) management — behind the separate platform
  login; only super-admins reach it.
- **Layout:** partner cards (logo, name, slug, agency count, revenue-share %, billing
  status); tap → **Partner detail** screen (agencies list + billing invoices);
  `+`/Edit → **PartnerForm** modal grouped into *Identity · Branding · Commercials*
  (20+ fields across sections, each a full-width field).
- **Desktop→mobile:** the detail drawer → a pushed detail screen; the big form → a
  sectioned modal.

---

# AUTH (pre-login)

### Login — /login · (low)
- Centered brand logo + name; email + password fields (`bg/fill`, 50pt); **Sign in**
  primary; "Forgot password?" link; "Create account" link. Optional biometric unlock
  after first login. No hero split — a clean, centered, generous single column.
### Signup — /signup · (med)
- Sectioned form: **Business** (industry picker, business name, phone, WhatsApp) ·
  **You** (name, email, password with strength meter). **Create account** primary.
- **Desktop→mobile:** the 2-column form → a single-column sectioned scroll.
### ForgotPassword — /forgot-password · (low)
- Single email field + **Send reset link** primary; success state ("Check your email");
  back-to-login link.
### ResetPassword — /reset-password · (low)
- New password + confirm (strength meter); **Reset** primary; success → Login.
### Platform Login — /platform/login · (low)
- Same clean login pattern, visually distinguished (platform badge) to signal the
  admin surface.

---

# Roadmap — build order

Ship in vertical slices so the app is usable early. Each phase = a releasable app.

**Phase 0 — Foundation (no user-facing screens):** tokens/theme, component library
(§5), navigation shell (§4), auth screens, API/query/session plumbing. *Exit:* you can
log in and see empty tabs styled correctly.

**Phase 1 — The daily driver (highest frequency):** Home/Dashboard · Inbox (list +
thread) · Leads (list + detail sheet + follow-ups) · Bookings (list + detail +
BookingForm) · Payments. *Exit:* an agent can run their day on the phone.

**Phase 2 — Catalog & quoting:** Packages/Cruises/Visas/Services/Properties (list +
form + detail) · Customers (list + detail) · Quotations · ItineraryBuilder. *Exit:*
they can build and send offers.

**Phase 3 — Marketing:** Campaigns (list + detail + CreateCampaign) · Templates ·
Reviews · Social · Ads · Referrals · Automations · Flows. *Exit:* full outreach.

**Phase 4 — Finance & insights:** Accounting hub (+ Chart/Journals/Invoices/Reports) ·
Vendors · PackageFinance · Analytics · CRM/Calling reports. *Exit:* full back office.

**Phase 5 — Team & config:** HRM (all sub-screens) · Agents & routing · Settings (all
editors) · WebsiteBuilder · Brochure · Platform/Partners. *Exit:* feature-complete.

**Cross-cutting, every phase:** each screen ships with its four states (§5.11),
accessibility (§7), dark mode, and offline-tolerance before it's "done."

---

## Coverage checklist (every current page is specced)

Home/Dashboard · Inbox/thread · Bookings · BookingForm · Booking detail · Payments ·
Quotations · QuotationForm · Leads · FollowUps · Customers · Customer detail · Packages
· PackageForm · PackageFinance · Cruises · CruiseForm · Visas · VisaForm · Services ·
ServiceForm · Properties · PropertyForm · PropertyDetails · Itineraries ·
ItineraryBuilder · Campaigns · CampaignDetail · CampaignReports · CreateCampaign · Ads ·
CreateAd · Social · Reviews · Templates · Flows · Automations · Referrals ·
WebsiteBuilder · Brochure · Accounting hub · ChartOfAccounts · Journals · Invoices ·
Accounting Reports · Vendors · VendorForm · VendorPayments · GlobalVendorPayments ·
Analytics · CrmReport · CallingReport · HRM hub · MySpace · People · AttendanceBoard ·
AttendanceRegister · LeaveApprovals · Payroll · HRM Reports · HRM Settings · Agents ·
Settings (+18 editors) · Partners · Login · Signup · ForgotPassword · ResetPassword ·
Platform Login. ✔ All mapped to the tab/hub structure in Doc 1 §4.
