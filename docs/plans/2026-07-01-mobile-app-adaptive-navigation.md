# Travel Bot — Adaptive Multi-Tenant Navigation (React Native)

> **Document 3 of 3.** How one mobile app serves many industries (travel agency,
> resort, cleaning company, CRM-only, marketing-only, …) and many roles, without
> per-tenant forks. **Read Documents 1 and 2 first** — this document changes one thing
> about them: the 5 tabs and the module hub are **not hardcoded**. They are rendered
> from a per-tenant *navigation manifest* delivered at login.
>
> **The single principle:** *The app is a renderer over a manifest, not a fixed set of
> screens.* Every navigation decision — which tabs exist, which modules appear, what
> they're called, what Home shows — comes from data, not from `if (industry === …)`.

---

## 1. The problem this solves

The product is a **multi-tenant, white-label platform**, not one travel CRM:

- Different **industries** need different modules and vocabulary (a resort has
  Reservations & Housekeeping; a cleaning company has Jobs & Crew; a marketing-only
  client has no Bookings at all).
- Different **roles** within one tenant see different things (owner sees Finance & HRM;
  a field agent sees only their jobs).
- **White-label partners** re-brand the whole thing (accent, logo, sometimes their own
  App Store listing).

This already exists on the backend: per-agency **module gating** (`sidebarPreferences`
→ API 403), an **industry** field at signup, and the **white-label partner** tier. The
mobile app must consume that, not reinvent it.

Two axes, resolved server-side into one list:

```
visibleModules = industryPreset.modules  ∩  tenant.purchasedModules  ∩  role.permissions
```

The client never computes this. It receives the result and renders.

---

## 2. The navigation manifest (contract)

Fetched once at login (and cached — see §8). It is the **single source of truth** for
the entire shell.

```jsonc
GET /api/me/app-manifest   →

{
  "tenant": {
    "id": "agcy_123",
    "name": "Palm Cove Resort",
    "industry": "resort",              // key into industryProfiles (§4)
    "logo": "https://…/logo.png",
    "accent": "#0A84FF",               // overrides theme.accent (Doc 1 §3.1, §8)
    "locale": "en-IN",
    "currency": "INR"
  },
  "role": "owner",                     // owner | manager | agent | fieldStaff | accountant
  "modules": [                         // already intersected server-side; render verbatim
    "home","inbox","reservations","guests","housekeeping",
    "payments","invoices","reviews","campaigns","analytics","settings"
  ],
  "tabs": ["home","inbox","reservations","guests","more"],   // ≤5, ordered; see §5
  "labels": {                          // vocabulary overrides (§6); sparse — only diffs
    "bookings": "Reservations",
    "customers": "Guests",
    "leads": "Enquiries"
  },
  "home": {                            // Home dashboard composition (§7)
    "widgets": ["occupancy","revenue","todaysCheckins","attention"]
  },
  "flags": { "canCollectPayment": true, "offlineJobs": false }
}
```

**Rules for the client**
- If a module isn't in `modules`, it does not exist anywhere — no tab, no hub entry,
  no deep link target, no search result. (Same principle as the web 403 gating.)
- `tabs` is authoritative; the client renders exactly those, in order. `home` and
  `more` must always be present (the server guarantees this; client asserts it).
- Unknown module keys are ignored gracefully (forward-compat when the server adds a
  module the app binary doesn't know yet — see §9).

---

## 3. The module registry (client-side)

The app ships a **registry** describing every module it *can* render. The manifest
decides which of them are *active*. This is the join between config and code.

```ts
// registry.ts — one entry per module the app knows how to render
type ModuleDef = {
  key: string;                 // 'reservations'
  defaultLabel: string;        // 'Bookings'  (overridable via manifest.labels)
  icon: LucideIcon;            // tab/hub icon
  group: 'core'|'catalog'|'marketing'|'finance'|'insights'|'team'|'settings';
  stack: React.ComponentType;  // the screen/stack from Doc 2
  engine?: 'list'|'chat'|'dashboard'|'form'|'builder'; // which generic engine (§7)
  schema?: string;             // data schema id for engine-driven modules
  badge?: (data) => number;    // optional tab/hub badge source
};

export const MODULES: Record<string, ModuleDef> = {
  home:         { key:'home', defaultLabel:'Home', icon:Home, group:'core', stack:HomeStack, engine:'dashboard' },
  inbox:        { key:'inbox', defaultLabel:'Inbox', icon:MessageCircle, group:'core', stack:InboxStack, engine:'chat', badge:unreadCount },
  bookings:     { key:'bookings', defaultLabel:'Bookings', icon:CalendarCheck, group:'core', stack:BookingsStack, engine:'list', schema:'booking' },
  reservations: { key:'reservations', defaultLabel:'Reservations', icon:BedDouble, group:'core', stack:BookingsStack, engine:'list', schema:'reservation' },
  jobs:         { key:'jobs', defaultLabel:'Jobs', icon:ClipboardList, group:'core', stack:BookingsStack, engine:'list', schema:'job' },
  leads:        { key:'leads', defaultLabel:'Leads', icon:Users, group:'core', stack:LeadsStack, engine:'list', schema:'lead', badge:attentionCount },
  // …catalog: packages, properties, cruises, visas, services, itineraries
  // …marketing: campaigns, templates, social, ads, reviews, flows, automations, referrals
  // …finance: payments, quotations, accounting, vendors
  // …insights: analytics, crmReport, callingReport
  // …team: hrm, agents
  // …settings
};
```

Note `bookings`, `reservations`, and `jobs` all point at the **same `BookingsStack`**
with a different `schema` and label — this is §7's "one engine, many industries" in
one line.

---

## 4. Industry profiles (config, not code)

A **profile** is pure JSON per vertical. Adding a new industry = adding a profile, with
**zero code changes**. The server owns these (so business ops can add verticals without
an app release), and ships them inside the manifest's resolved fields; the client keeps
a fallback copy for offline first-launch.

```jsonc
// industryProfiles.json  (server-owned; the manifest is the resolved output for one tenant)
{
  "travel": {
    "defaultTabs": ["home","inbox","bookings","leads","more"],
    "coreModules": ["home","inbox","bookings","leads","customers","packages",
                    "itineraries","visas","cruises","quotations","payments"],
    "labels": {},                                  // uses defaults
    "home": { "widgets": ["newLeads","conversion","bookings","revenue","departures","attention"] }
  },
  "resort": {
    "defaultTabs": ["home","inbox","reservations","guests","more"],
    "coreModules": ["home","inbox","reservations","guests","housekeeping","properties",
                    "payments","invoices","reviews"],
    "labels": { "bookings":"Reservations", "customers":"Guests", "leads":"Enquiries" },
    "home": { "widgets": ["occupancy","revenue","todaysCheckins","attention"] }
  },
  "cleaning": {
    "defaultTabs": ["home","inbox","jobs","team","more"],
    "coreModules": ["home","inbox","jobs","clients","scheduling","services",
                    "team","payments","invoices"],
    "labels": { "bookings":"Jobs", "leads":"Requests", "customers":"Clients",
                "agents":"Crew", "followUps":"Visits" },
    "home": { "widgets": ["todaysJobs","crewStatus","revenue","attention"] }
  },
  "crm_marketing": {
    "defaultTabs": ["home","inbox","leads","campaigns","more"],
    "coreModules": ["home","inbox","leads","contacts","campaigns","templates",
                    "social","reviews","analytics","referrals"],
    "labels": { "customers":"Contacts" },
    "home": { "widgets": ["newLeads","conversion","campaignReach","reviews"] }
    // note: no bookings/payments module → those screens are simply absent
  }
}
```

The manifest a tenant receives is `industryProfiles[industry]` **filtered by** what they
purchased and their role, with any per-tenant overrides applied. The client just reads
the manifest; the profile file is the design-time reference and offline seed.

---

## 4a. Scaling to many industries (the growth path)

Industry lives in two places today, with different costs to change:

| Where | What it is | Cost to add an industry |
|---|---|---|
| `Agency.industry` | a **DB ENUM** `('TRAVEL','RESORT','CLEANING','LAUNDRY')` | a migration (ALTER TYPE) every time — the bottleneck |
| `INDUSTRY_PROFILES` (backend `appManifestService`) | **data** (tabs, labels, widgets) | add an object literal + deploy |
| Mobile app | pure renderer of the manifest | **nothing** — no app release for label/module/widget changes |

The manifest architecture already gives you the big win: **the phone app never hardcodes
industries.** A new vertical's tabs, vocabulary, and Home widgets reach users through the
manifest, so adding one needs **no App Store release** — only a genuinely new *engine*
(a new object type with its own screens) requires a client update.

Grow in three stages, adopting the next only when the count justifies it:

**Stage 1 — a handful (now, ≤ ~6 verticals).** Keep it code-driven. To add an industry:
1. extend the `Agency.industry` enum (migration) and the signup `z.enum`,
2. add one entry to `INDUSTRY_PROFILES`,
3. (optional) add per-industry schemas where an object genuinely differs.
Fine while verticals are few and added by engineers.

**Stage 2 — many / partner-defined (the real answer to "many industries later").**
Kill the enum bottleneck: **move industry from a DB ENUM to data.**
- Change `Agency.industry` from `ENUM` to a plain `industryCode` **VARCHAR** (no
  ALTER TYPE ever again), *or* keep a slug and add a JSONB `industryConfig` override.
- Introduce an **`industry_profiles` table** (or a seeded JSON config the platform
  admin edits) holding exactly what `INDUSTRY_PROFILES` holds now:
  ```
  industry_profiles
    code            varchar  pk     -- 'salon', 'clinic', 'gym', 'realestate'
    display_name    varchar
    default_tabs    jsonb           -- ['inbox','bookings','customers']
    labels          jsonb           -- { bookings:'Appointments', customers:'Patients' }
    home_widgets    jsonb           -- ['todaysAppointments','revenue',...]
    module_defaults jsonb           -- default sidebarPreferences for new tenants
    is_active       boolean
  ```
- `appManifestService` reads the profile row instead of the in-code constant. Now
  **adding an industry = inserting a row** — no migration, no deploy, no app release.
  A white-label partner could even define a custom vertical for their niche.

**Stage 3 — fully self-serve.** Expose the profile table in the platform admin portal
(a "Verticals" screen: name, tabs, label overrides, default modules, Home widgets).
Business ops launch a new industry without engineering. The mobile app still just
renders manifests.

**Guardrails as you scale:**
- **Unknown industry code** must fall back to the default profile (never 500). The
  service already does `profileFor(industry)` with a `TRAVEL` fallback — keep that.
- **New module keys** a vertical wants must exist in the client **module registry**
  (Doc 3 §3) to render; until an app release ships them, mark them
  `requiresAppUpdate` so they show a graceful "update to use" row (Doc 3 §9).
- **Home widgets should degrade to enabled modules** — a widget whose backing module
  isn't in `modules` is skipped client-side (so a marketing-only tenant doesn't render
  an empty "departures" card). Keep a `widget → module` map on the client.
- **Labels are additive, not exhaustive** — a new vertical only overrides the nouns it
  changes; everything else uses `DEFAULT_LABELS`. This keeps profiles tiny.

Recommendation: **build Stage 1 now** (the endpoint already is Stage 1), and plan the
**enum → VARCHAR + `industry_profiles` table** migration for the moment you add your
4th–5th vertical. It's a small, well-contained change *because* the manifest already
isolates every consumer from how industry is stored.

## 5. Tab-selection algorithm

The server normally sends an explicit `tabs` array (best — a partner can tune it per
tenant). The client still needs a deterministic fallback when `tabs` is missing or
stale after a module was revoked.

```
buildTabs(manifest):
  fixedFirst = "home"                          # always tab 1
  fixedLast  = "more"                          # always tab 5 (the hub)
  candidates = manifest.tabs ?? profile.defaultTabs
  middle = candidates
             .filter(k => k !== "home" && k !== "more")
             .filter(k => manifest.modules.includes(k))   # drop revoked modules
  if middle.length < 3:                        # backfill from a global priority list
     middle += PRIORITY.filter(k => manifest.modules.includes(k)
                                    && !middle.includes(k))
  middle = middle.slice(0, 3)                  # ≤3 middle tabs
  return [fixedFirst, ...middle, fixedLast]

PRIORITY = ["inbox","bookings","reservations","jobs","leads","campaigns",
            "payments","analytics", …]         # used only as backfill
```

Guarantees: always 3–5 tabs, Home first, More last, never a tab for a module the tenant
can't access, deterministic across launches. Everything not chosen as a tab is reachable
in the **More hub**, whose groups are the registry `group` values filtered to
`manifest.modules` (empty groups disappear).

---

## 6. The vocabulary layer

One helper resolves every user-facing noun through the manifest, so the same screen
speaks each industry's language.

```ts
const t = useLabel();          // from manifest.labels, falling back to MODULES[key].defaultLabel
t('bookings')   // → "Reservations" (resort) | "Jobs" (cleaning) | "Bookings" (travel)
t('leads')      // → "Enquiries" | "Requests" | "Leads"
```

Apply it to: tab labels, hub entries, screen titles, empty-state copy, buttons ("New
Reservation" vs "New Job"), and swipe-action verbs. **Never hardcode a business noun in
a screen** — always `t(key)`. Icons follow the same rule (from the registry, overridable
per industry if a profile wants a different glyph).

Also localize through the normal i18n layer (`manifest.tenant.locale`); the label map is
a *business-vocabulary* override that sits on top of translations, not a replacement for
them.

---

## 7. One engine, many industries

The reason ~60 screens don't multiply per vertical: screens are **generic engines**
parameterized by `schema` + `labels`.

| Engine | Serves | What the schema controls |
|---|---|---|
| `list` | bookings / reservations / jobs / leads / packages / properties / vendors … | fields shown per row, detail sections, form steps, swipe verbs, status language |
| `chat` | inbox / social | channels, quick-reply sets |
| `dashboard` | home / analytics | which widgets/KPIs render |
| `form` | all create/edit | field definitions, validation (zod), pickers |
| `builder` | itinerary / campaign / flow / template | node/step definitions |

A **schema** (server- or config-defined) declares the object's fields, statuses, list
row layout, detail layout, and form steps. So "Reservation" and "Job" are the same
`list` engine + `BookingsStack` with different schemas — the resort sees room/nights/
check-in; the cleaning company sees site/crew/time-slot. Building a new object type for
a new vertical is a **schema entry**, not a new screen.

> Practical scope note: start with label + module + widget adaptation (cheap, covers
> 90% of the difference). Introduce full schema-driven list/form engines where two
> verticals genuinely diverge (bookings↔jobs). Don't over-abstract screens that only
> one industry uses.

---

## 8. Loading, caching, and switching

- **On login:** fetch the manifest, cache it in MMKV keyed by `tenant.id + role`, apply
  `accent`/`logo` to the theme, build the shell. Show a branded splash until the
  manifest resolves (usually instant from cache).
- **Cache-first, revalidate:** render from cached manifest immediately; refetch in the
  background; if `modules`/`tabs` changed, animate the tab bar/hub to the new shape and
  toast "Your workspace was updated."
- **Revocation safety:** if a user deep-links (push notification, universal link) to a
  module no longer in `modules`, route to a graceful "Not available on your plan" screen,
  not a crash.
- **Role/tenant switch:** users who belong to multiple agencies (or switch role) get a
  workspace-switcher in the profile menu → refetch manifest → rebuild shell. Treat it
  like a soft relaunch (reset navigation state).

---

## 9. Forward compatibility

The server evolves faster than app-store releases, so:

- **Unknown module key in `modules`/`tabs`:** the app doesn't have a registry entry →
  skip it silently (never crash), and optionally show a single "Update the app to use
  {X}" hub row if the manifest marks it `requiresAppUpdate: true`.
- **New industry profile:** works instantly for label/module/widget changes (all data).
  Only a genuinely new *engine* needs an app release.
- **Version the contract:** manifest carries `schemaVersion`; the client sends its
  `appCapabilities` so the server can down-shape the manifest for older builds.

---

## 10. White-label distribution

| Need | Approach |
|---|---|
| Re-brand inside the shared app | Runtime: `manifest.tenant.accent` + `logo` (Doc 1 §8). Zero build. |
| Partner wants their **own App Store listing** | Build-time **flavor**: bundle id, app name, app icon, launch screen, default accent — over the *identical* codebase. Config file per flavor; CI builds each. No forked screens. |
| Tenant resolution | Native apps can't use host-based routing (unlike the web). Tenant + industry come from the **logged-in user's** manifest, not the URL. A flavor may pin a default partner for its branding, but modules still come from the user's manifest. |

---

## 11. What changes in Documents 1 & 2

- **Doc 1 §4 (navigation):** the "5 fixed tabs" become "**Home + up to 3 manifest-driven
  tabs + More**." The hub in More filters its groups to `manifest.modules`. Everything
  else in §4 stands.
- **Doc 2 (page specs):** every spec still applies — but read every business noun as
  `t(key)` and treat "Bookings/Leads/Customers" as the **engine**, which a resort renders
  as Reservations/Enquiries/Guests and a cleaning company as Jobs/Requests/Clients.
  Modules absent from a tenant's manifest are simply not built for that tenant.

---

## 12. Worked example — three tenants, one binary

```
TRAVEL AGENCY (owner)      RESORT (owner)             CLEANING CO (owner)
Tabs:                      Tabs:                      Tabs:
 🏠 Home                    🏠 Home                     🏠 Home
 💬 Inbox                   💬 Inbox                    💬 Inbox
 📅 Bookings                🛏 Reservations             🧹 Jobs
 👥 Leads                   👤 Guests                   👷 Team
 ⋯ More                     ⋯ More                      ⋯ More
More hub groups:           More hub groups:           More hub groups:
 Catalog, Marketing,        Catalog(rooms),Marketing,   Scheduling, Marketing,
 Finance, Insights,         Finance, Insights,          Finance, Team,
 Team, Settings             Housekeeping, Settings      Settings

CLEANING CO (field staff)  →  Tabs: 🏠 Home · 💬 Inbox · 🧹 My Jobs · ⋯ More
                              (role intersection strips Finance/Team/Marketing entirely)
```

Same app, same screens — three navigation shells, produced entirely by the manifest.

---

## 13. Build order impact

Fold into Doc 2's roadmap **Phase 0 (Foundation)**:
1. Manifest fetch + cache + `ThemeProvider` accent/logo injection.
2. `MODULES` registry + `useLabel()` + `buildTabs()` + hub group filter.
3. A `travel` and a `crm_marketing` profile to prove the two extremes (full commerce vs
   no-bookings). Add `resort`/`cleaning` profiles as those clients land.

Everything else in the roadmap is unchanged — you're just building the screens *behind*
a shell that assembles itself per tenant.
