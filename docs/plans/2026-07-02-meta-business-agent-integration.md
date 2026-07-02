# Meta Business Agent (MBA) Platform Integration — Full Implementation Plan (Architecture A)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Meta's Business Agent Platform (native WhatsApp AI agent) as a **reusable platform capability owned by marketing-os**, so every vertical you resell (travel, retail, real-estate) can turn on a per-tenant WhatsApp AI agent that auto-provisions from CRM data, takes real actions via secured connectors, and coordinates control handoff with the existing automation engine — **without changing existing behavior for any tenant that does not opt in.**

**Architecture (A — marketing-os owns MBA end-to-end):** All MBA logic lives in a new marketing-os module `src/modules/mba/`. marketing-os holds the per-tenant Meta/BISU credentials and is the *only* service that calls Meta's MBA API. It **pulls** knowledge content and **routes connector actions** to the vertical backend (travel-bot) over a service-authenticated read API. travel-bot adds only two additive, namespaced surfaces: a knowledge read endpoint (marketing-os pulls it) and `/mba/tools/*` connector-target endpoints (Meta's agent calls them with a per-tenant scoped key). Every new path is gated by a per-tenant `mba_enabled` flag defaulting `false`; when off, the webhook, send, and routing behave byte-for-byte as today.

**Tech Stack / Per-Repo Conventions (do not mix):**

| Repo | Root | Framework | Schema | Tests |
|---|---|---|---|---|
| **marketing-os** (owns MBA) | `c:\Users\ACER\www\marketting-os\marketing-os-server` | Express + TS, run via `tsx`; modules under `src/modules/*` created by factory functions (`createXxx(pool, deps)`) | Postgres via `pg` **Pool**; changes = **new forward-only SQL migration** in `src/db/migrations` (nullable/defaulted, no drops) | **jest** (`npm test`) |
| **travel-bot** (connector targets + knowledge source) | `c:\Users\ACER\www\travel-bot\backend` | Express + TS | **Sequelize `sync()`** — additive nullable model fields, no migration files | self-contained **`tsx`+`assert`** scripts (`npx tsx <file>.test.ts`) |

MBA REST: base `https://api.facebook.com/{entity_id}/...`, header `X-API-Version: 2.0.0`, `Authorization: Bearer <per-tenant BISU token>`. `entity_id` **is** the WhatsApp phone-number-id already stored per tenant in marketing-os.

**Verified real target files (marketing-os):**
- Inbound webhook: `src/modules/whatsapp/controllers/WebhookController.ts`
- Cloud API send: `src/modules/whatsapp/providers/MetaCloudProvider.ts`
- Automation/reply engine: `src/modules/whatsapp/services/AutomationEngine.ts` (`createAutomationEngine`, `processEvent`)
- Tenant + per-tenant WhatsApp creds: `src/modules/tenant/tenant.model.ts`, `src/modules/tenant/whatsapp-account.model.ts`
- travel-bot bridge: `src/modules/travelbot/`

> ⚠️ The `tmp-mos/` folder inside travel-bot is a **snapshot, not deployed** — never edit it.
> ⚠️ **No handover prior art exists** in marketing-os. Phase 5 is new code built to the MBA docs; code-review it before rollout.

---

## Non-Negotiable Isolation Invariants (acceptance criteria for "don't affect existing system")

1. **Default-off:** tenant with no MBA fields behaves exactly as today. `mba_enabled` defaults `false`.
2. **Additive schema only:** marketing-os = new forward-only nullable-column migrations; travel-bot = new nullable model fields. No renames/drops/type-changes.
3. **No rewrites of existing logic.** Existing services are *reused/imported*, never modified. Permitted edits to existing files, minimal and comment-fenced: (a) register new routers, (b) one guarded branch atop `WebhookController` that returns to the legacy path when MBA is off, (c) one guarded pre-check in `AutomationEngine` for the take-control trigger, (d) add nullable columns/fields.
4. **New routes namespaced:** marketing-os `/api/mba/*` (admin, JWT); travel-bot `/mba/knowledge/*` (service-auth) + `/mba/tools/*` (per-tenant scoped key). Zero collisions.
5. **Credential boundary respected:** only marketing-os calls Meta's MBA API. BISU tokens never leave marketing-os. travel-bot never receives a Meta token.
6. **Reversible:** a `disable` action (`mba_enabled=false` + `settings.active=false`) fully restores legacy behavior with no residue.

The final phase (8) asserts 1, 3, 4, 6 in code before any rollout.

---

## Zero-Impact Design (how the invariants are enforced mechanically)

The invariants above are guarantees; these are the mechanisms that make them true. Every risky touchpoint has an explicit safety control.

### 1. Two-level kill switch + shadow mode (three states)
- **Global env `MBA_ENABLED`** (marketing-os) — master off switch. Flipping it to `false` disables all MBA code paths **without a redeploy** (instant rollback).
- **Per-tenant `mba_enabled`** — a tenant only participates when explicitly turned on. Both must be true.
- **`MBA_SHADOW=true` (new, default true until GA)** — when on, the webhook handover layer *classifies and logs* what it would do (take/pass control, suppress reply) but **performs no Meta thread-control calls and never suppresses a legacy reply**. This lets you validate handover logic against real production traffic with **zero behavioral effect**, before ever letting MBA actually drive a conversation. Promotion path: `SHADOW` → single allowlisted number → widen.

### 2. Migration safety (Postgres, live tables)
- All columns are added with `IF NOT EXISTS`, are nullable or have a **constant** default (`DEFAULT FALSE`). On PG 11+ a constant-default add is a **metadata-only change — no table rewrite, no long lock** on `whatsapp_accounts`/`conversations`.
- Migrations are **forward-only, no backfill, no drops**, wrapped in a transaction. A failed migration rolls back cleanly and changes nothing.
- No existing column is touched, so existing queries and ORM/SQL models keep working whether or not they know about the new columns.

### 3. Webhook-subscription safety (app-level change)
- Adding `standby` + `messaging_handovers` subscriptions is **purely additive**: numbers **without** MBA continue delivering inbound on the `messages` field exactly as today. You simply start *also* receiving the new field types (which the handler ignores for non-MBA numbers via `classifyWebhook → LEGACY`).
- Verify in **staging first**; the subscription is reversible. No existing field subscription is removed.

### 4. Deploy independence (either repo can ship first, dormant)
- **travel-bot** `/mba/knowledge/*` and `/mba/tools/*` are **dormant** until marketing-os calls them — deploying them changes nothing for existing users.
- **marketing-os** MBA module is **dormant** until a tenant is enabled AND shadow is off. Deploying it changes nothing.
- Therefore the two repos deploy on independent schedules with no coordination window and no combined-outage risk.

### 5. Route-mounting safety
- New routers are mounted under dedicated prefixes; a test (Task 8.1) enumerates the live route table and **fails if any `/mba/*` path shadows an existing route**. Existing route resolution is provably unchanged.

### 6. Reuse, never fork
- Connector-target endpoints and knowledge assembly **import and call existing services as libraries**. No existing service is copied or modified, so there is one source of truth and no drift.

### 7. Rollout order (each step reversible, smallest blast radius first)
```
ship dormant code (both repos)  → no effect
run additive migrations         → no effect (metadata-only)
enable 1 pilot tenant, SHADOW=true, allowlist=[1 test number]  → observe logs only, no behavior change
turn SHADOW off for that number → MBA drives ONLY that number; rollback = flip SHADOW or mba_enabled
provision knowledge-only (no connector) → agent answers, cannot act
add connector read tools        → agent can look up
enable payment tool (mba_allow_payment_tool) → last, opt-in
widen allowlist → all            → only after agent_eval passes
```
Rollback at any step: flip `MBA_ENABLED` (global) or the tenant's `mba_enabled`/`SHADOW` — no redeploy, no data change.

---

## Feature Coverage (all, not MVP)

| Subsystem | MBA endpoints | Repo | Phase |
|---|---|---|---|
| Config + MBA API client (transport for all endpoints) | — | mos | 0 |
| Per-tenant MBA credential fields + token resolver | — | mos | 1 |
| Onboarding lifecycle | eligibility, onboarding, settings, allowlist | mos | 2 |
| Knowledge provisioning (pulled from travel-bot) | business_info, faq, files, websites, skills | mos ← travel-bot | 3 |
| Connectors + tools (secured action layer) | connectors (+upsertApiKey/OAuth/Certificate/logs), tools (+run) | mos → travel-bot | 4 |
| Connector-target gateway + knowledge read API | — | travel-bot | 4 |
| Webhook handover | standby, messaging_handovers, Thread Control pass/take, Agent Event | mos | 5 |
| Admin API + UI + per-tenant rollout | — | mos (+ UIs) | 6 |
| Observability / test / eval / cost | agent test, agent eval, connector logs | mos | 7 |
| Isolation verification + rollout runbook | — | both | 8 |

---

## PHASE 0 — Foundations in marketing-os (no behavior change)

### Task 0.1 — MBA config
**Files:** Create `marketing-os-server/src/modules/mba/config.ts`; append commented MBA vars to marketing-os `.env.example`; jest test `src/modules/mba/__tests__/config.test.ts`.

- `config.ts`: `{ baseUrl='https://api.facebook.com', apiVersion='2.0.0', globallyEnabled=(env MBA_ENABLED==='true'), shadowMode=(env MBA_SHADOW!=='false'), requestTimeoutMs=15000 }` + `isMbaGloballyEnabled()` + `isShadowMode()`. Everything defaults off/safe; **`shadowMode` defaults `true`** (observe-only unless explicitly disabled).
- **TDD:** test asserts `isMbaGloballyEnabled()===false` and `isShadowMode()===true` when env unset. Run `npm test -- config`. Expect FAIL → implement → PASS.
- **Commit:** `feat(mba): isolated MBA config module (off by default)`

### Task 0.2 — MBA API client (covers every MBA endpoint)
**Files:** Create `src/modules/mba/mbaApiClient.ts` + jest test.

- Pure `buildRequest({method, entityId, path, token, query?, body?, isMultipart?})` → `{method,url,params,headers,data}` with `url = ${baseUrl}/${entityId}/${path}`, `Authorization: Bearer <token>`, `X-API-Version`. Plus `mbaRequest<T>()` executing via axios (`validateStatus:()=>true`, timeout) mapping `StandardError`→ thrown `MbaError{status,title,detail}`; network errors → `MbaError(0,'network_error',...)`.
- **TDD:** test `buildRequest` URL/headers/params for an onboarding call; test error mapping from a 400 body. FAIL → implement → PASS.
- **Commit:** `feat(mba): MBA API client + typed error mapping`

---

## PHASE 1 — Per-tenant MBA credentials (additive migration)

### Task 1.1 — SQL migration: MBA columns on the WhatsApp-account/tenant table
**Files:** Create `src/db/migrations/<timestamp>_mba_fields.sql` (confirm exact table backing `whatsapp-account.model.ts` first) + jest test that runs the migration against a test DB and asserts columns exist.

```sql
-- forward-only, additive, nullable/defaulted, no drops
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_agent_status TEXT;           -- NOT_ONBOARDED|ONBOARDING|READY|ACTIVE|DISABLED
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_entity_id TEXT;              -- cached phone_number_id used as entity_id
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_settings_id TEXT;
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_bisu_token_ref TEXT;         -- ref/handle into existing encrypted secret store
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_connector_key_hash TEXT;     -- sha256 of scoped key MBA uses to call travel-bot
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_allow_payment_tool BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_last_provisioned_at TIMESTAMPTZ;
ALTER TABLE whatsapp_accounts ADD COLUMN IF NOT EXISTS mba_provision_meta JSONB;        -- {faqIds, fileIds, connectorId, toolIds, skillIds...}
```
- **TDD:** jest migration test asserts each column present + defaults. FAIL → write SQL → PASS.
- **Isolation check:** existing rows get `mba_enabled=false`, everything else NULL → no behavior change.
- **Commit:** `feat(mba): additive nullable MBA columns on whatsapp_accounts`

### Task 1.2 — MBA account accessor + token resolver
**Files:** Create `src/modules/mba/mbaAccountRepo.ts` (pg Pool reads/writes of the new columns) + `src/modules/mba/mbaTokenResolver.ts` + jest tests.

- `getMbaAccount(pool, tenantId)` / `updateMbaAccount(pool, tenantId, patch)`.
- `resolveToken(account)`: decrypt BISU token referenced by `mba_bisu_token_ref` via the **existing** secret-store util marketing-os already uses for WhatsApp access tokens; no new crypto.
- **TDD:** stub pool + decrypt; assert resolver returns decrypted token; assert `mba_entity_id` falls back to the account's phone-number-id. FAIL → implement → PASS.
- **Commit:** `feat(mba): tenant MBA account repo + token resolver`

---

## PHASE 2 — Onboarding lifecycle (marketing-os)

Service factory `createMbaLifecycleService(pool, deps)` in `src/modules/mba/mbaLifecycleService.ts`, one method per task, each jest-tested with `mbaRequest` stubbed.

### Task 2.1 — Eligibility
`checkEligibility(tenantId)` → `GET agent_eligibility` → `{eligible, reason?}`. Test maps response. Commit.

### Task 2.2 — Onboard + persist
`onboard(tenantId)`: resolve token+entityId(=phone-number-id) → `POST agent_onboarding?channel=whatsapp` → persist `mba_entity_id`, `mba_agent_status='ONBOARDING'`, `mba_last_provisioned_at`. Test call shape + persisted status. Commit.

### Task 2.3 — Settings (persona / handoff / followup / active)
`putSettings(tenantId, settings)` → `PUT agent_config/settings` (persona, language, handoff policy, followup policy, `active`). Persist `mba_settings_id`, `mba_agent_status` (`READY` when inactive, `ACTIVE` when active).
> **Guard:** refuse `active=true` unless `account.mba_enabled === true` **and** `isMbaGloballyEnabled()`. Test: throws when flag off; PUTs when on. Commit.

### Task 2.4 — Allowlist (controlled rollout)
`setAllowlistOnly(tenantId, phones[])`: `PUT settings {AIAudience:'ALLOWLISTED_ONLY'}` + per-phone `POST agent_config/allowlist`; add `listAllowlist`/`removeAllowlistEntry`. Test add/list/delete. Commit.

---

## PHASE 3 — Knowledge provisioning (marketing-os pulls from travel-bot)

### Task 3.0 (travel-bot) — Knowledge read API
**Files (travel-bot):** Create `backend/src/mba/knowledgeController.ts` + `backend/src/routes/mbaKnowledge.ts`; Modify `backend/src/routes/index.ts` (additive `use('/mba/knowledge', ...)`); Create `backend/src/mba/serviceAuth.ts` (verifies a shared service token / HMAC from marketing-os — **not** a Meta token). Tests: `tsx`+`assert`.

- `GET /mba/knowledge/:agencyId` (service-authed) → assembles from existing data (no new writes):
  `{ businessInfo, faqs[], brochures:[{name,url}], websiteUrl, persona }` sourced from `Agency`, document-builder outputs, and static-site URL.
- travel-bot↔marketing-os mapping via existing `marketingOsTenantId`.
- **TDD:** valid service token returns assembled knowledge; bad token → 401. Commit.

### Task 3.1–3.5 (marketing-os) — Provision each knowledge source
**Files:** `src/modules/mba/mbaProvisioningService.ts` (factory) + jest tests. It calls travel-bot `GET /mba/knowledge/:agencyId` once, then maps → MBA:
- **3.1 business_info** → `PUT agent_config/business_info`.
- **3.2 faqs** → diff vs `GET faq` by question-hash → create/update/delete; cap few-hundred, log truncation; persist `faqIds`.
- **3.3 files** → download each brochure URL, `POST agent_config/files` (multipart); persist `fileIds`; delete stale.
- **3.4 websites** → `POST agent_config/websites` with the static-site URL.
- **3.5 skills** → build from persona + a fixed travel behavior skill (greet → understand trip → recommend from catalog → offer quote → **hand off / call tool on booking/payment**); consolidate ordered steps into single skills (avoid conflicting priorities); diff vs `GET skills`; persist `skillIds`.
Each is one task: FAIL → implement → PASS → commit.

### Task 3.6 — `provisionAll(tenantId)`
Idempotent orchestrator: fetch knowledge once → 3.1–3.5 → (Phase 4) connector → write consolidated `mba_provision_meta` → return report. Test happy path with sub-calls stubbed. Commit.

---

## PHASE 4 — Connectors + secured action gateway

### Task 4.1 (travel-bot) — Scoped-key auth + key issuance
**Files (travel-bot):** `backend/src/mba/keyHash.ts` (sha256), `backend/src/mba/mbaConnectorAuth.ts` middleware (reads `X-MBA-Key`, resolves agency by matching `mba_connector_key_hash`, sets `req.mbaAgencyId`, 401 otherwise — **never touches JWT**). Key is *generated in marketing-os* (Task 4.3) and its hash stored on the tenant; travel-bot only verifies. Tests: valid key resolves, invalid 401. Commit.

> Note: hash lives in marketing-os (`mba_connector_key_hash`), but travel-bot must verify it. Store the hash in travel-bot's `AgencyChannel.mbaConnectorKeyHash` too (additive Sequelize field) and have marketing-os push it during 4.3 via the service API. Keep the plaintext only transiently.

### Task 4.2 (travel-bot) — Connector-target endpoints (thin, reuse existing services)
**Files (travel-bot):** `backend/src/mba/mbaToolsController.ts` + `backend/src/routes/mbaTools.ts` + additive register in `routes/index.ts`. All under `mbaConnectorAuth`, scoped to `req.mbaAgencyId`, reusing existing services as libraries:
- `POST /mba/tools/search_packages` → package service (activeOnly + destination/pax/budget filter)
- `POST /mba/tools/create_quotation` → quotation create (returns `EST-YYYY-####` + PDF url)
- `GET  /mba/tools/booking_status` → booking getById (scoped)
- `POST /mba/tools/request_payment` → payment requestPayment — **guarded by `mba_allow_payment_tool` (default false)**
- `GET  /mba/tools/itinerary/:id` → itinerary getById
One test per endpoint (auth + happy path, service stubbed). Commit per endpoint.

### Task 4.3 (marketing-os) — Register connector + tools in MBA
**Files:** extend `mbaProvisioningService` with `provisionConnector(tenantId)`:
- Generate scoped key → sha256 → push hash to travel-bot (`POST /mba/knowledge/:agencyId/connector-key` service-authed) → `POST agent_connectors {base_url:'<travelbot-public>/mba/tools', auth_type:'API_KEY'}` → `upsertApiKey` with plaintext.
- For each tool, `POST agent_connectors/{id}/tools` with a **typed `request_definition`** (explicit field types/descriptions/required) so the agent extracts args from conversation. Persist `connectorId`, `toolIds`.
Test: connector + one tool shape (typed schema present); key hash pushed, plaintext not persisted. Commit.

### Task 4.4 (marketing-os) — Connector health
`getConnectorLogs(tenantId, {summary_only, include_stats})` → `GET agent_connectors/{id}/logs` (7-day clamp). Test shape. Commit.

---

## PHASE 5 — Webhook handover layer (the sensitive one — behind the flag)

### Task 5.1 — Subscribe new webhook fields (config/doc)
Script `src/scripts/mba-subscribe-fields.ts` logging that `standby` + `messaging_handovers` must be added (alongside `messages`,`statuses`) in the Meta app config. No runtime change. Commit.

### Task 5.2 — Control-state migration + accessor
**Files:** `src/db/migrations/<timestamp>_mba_control_state.sql` (confirm conversation/session table name) + `src/modules/mba/controlState.ts` (pg Pool) + jest test.
```sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mba_control_holder TEXT;    -- 'AGENT'|'APP'|NULL(legacy)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mba_last_handover_at TIMESTAMPTZ;
```
NULL ⇒ legacy/APP. Test read/write defaults. Commit.

### Task 5.3 — Handover router (pure, exhaustively unit-tested)
**Files:** `src/modules/mba/handoverRouter.ts` + jest test. Pure `classifyWebhook(change, account)`:
- `LEGACY` — when `!account.mba_enabled`: **always**, every field.
- `MBA_STANDBY` — field `standby`: sync/copy only, no reply.
- `MBA_HANDOVER` — field `messaging_handovers`: update `mba_control_holder`.
- `APP_MESSAGE` — field `messages` while we hold control: run existing engine.
Truth-table tests, especially **`mba_enabled=false ⇒ LEGACY for every field`**. Commit.

### Task 5.4 — Thread control + agent event
**Files:** `src/modules/mba/threadControl.ts` + jest test.
- `takeControl(account, consumerPhone)` — take control by sending via existing `MetaCloudProvider`; explicit intent marker.
- `passControl(account, consumerPhone)` → Cloud API Thread Control `pass`.
- `agentEvent(account, consumerPhone, event)` → `POST` Agent Event (e.g. purchase completed).
Test call shapes. Commit.

### Task 5.5 — Wire into WebhookController + AutomationEngine (minimal, fenced)
**Files:** Modify `src/modules/whatsapp/controllers/WebhookController.ts` — **one** `classifyWebhook` call atop per-change handling; `LEGACY`/`APP_MESSAGE` fall through to **existing** code unchanged; only `MBA_STANDBY`/`MBA_HANDOVER` branch. Modify `src/modules/whatsapp/services/AutomationEngine.ts` — a guarded pre-check: on an MBA-active number, when a booking/payment/campaign-button intent is detected, `takeControl` → run flow → `passControl`.

**Shadow-mode enforcement (critical):** when `isShadowMode()` is true, every new branch **logs its intended action and then behaves as `LEGACY`** — no `takeControl`/`passControl` call, no reply suppression. Real driving happens only when shadow is off AND the number is enabled/allowlisted. This is the mechanism that lets Phase 5 run against live traffic with zero effect.

**Isolation tests (jest):**
1. synthetic `messages` webhook for `mba_enabled=false` → exact same downstream call as before (spy).
2. with `mba_enabled=true` but `MBA_SHADOW=true` → still no thread-control call and legacy reply still sent (spy asserts shadow safety).
Commit.

---

## PHASE 6 — Admin API + UI + per-tenant rollout

### Task 6.1 (marketing-os) — Admin API
**Files:** `src/modules/mba/mba.controller.ts` + `src/modules/mba/mba.routes.ts` + register; JWT + platform/tenant-admin gated (reuse existing auth middleware).
Endpoints: `GET /api/mba/status`, `POST /api/mba/onboard`, `POST /api/mba/provision`, `POST /api/mba/enable`, `POST /api/mba/disable`, `POST /api/mba/allowlist`, `GET /api/mba/connector/logs`, `POST /api/mba/test`, `GET /api/mba/eval`.
`enable` guard: requires eligibility + provisioned. jest tests for gating + enable-guard. Commit per group.

### Task 6.2 — Admin UI
**Files:** new "AI Agent" page in `marketing-os-ui` (and surface in the travel-bot CRM settings via its existing marketing-os embed if applicable). Shows eligibility badge, onboard/provision buttons, provisioning report, persona/skills editor, allowlist manager, enable toggle with a clear "MBA becomes primary responder for new chats" warning, connector health, cost estimate. Additive route/menu only. Commit.

---

## PHASE 7 — Observability, test, eval, cost (marketing-os)

- **7.1** `runAgentTest(tenantId, messages[])` → `POST agent_test`; `getAgentEval(tenantId)` → `agent_eval`; surface in admin. Validate before flipping allowlist → all. Commit.
- **7.2** Connector-log dashboard: success rate, latency percentiles, top failures (`summary_only`) in admin. Commit.
- **7.3** Cost tracking: migration for `mba_usage_daily` (tenant, date, mba_replies, app_replies) counted from webhook copies; expose in admin for pricing decisions ahead of Aug 1 (MBA per-token) / Oct 1 (service-message) billing. Commit.

---

## PHASE 8 — Isolation verification + rollout (gate before any live enable)

### Task 8.1 — Isolation regression tests
**Files:** `marketing-os-server/src/modules/mba/__tests__/isolation.test.ts` (+ a travel-bot `backend/src/mba/isolation.test.ts`). Assert:
1. `classifyWebhook` → `LEGACY` for `messages`/`standby`/`messaging_handovers` when `mba_enabled=false`.
2. `putSettings(active=true)` throws when flag off.
3. No `/mba` route shadows an existing path (both repos).
4. travel-bot `/mba/tools/*` reject requests without a valid scoped key; `/mba/knowledge/*` reject without service token.
5. **Shadow safety:** with `mba_enabled=true` + `MBA_SHADOW=true`, the webhook path performs no thread-control call and still emits the legacy reply.
6. **Global kill-switch:** `MBA_ENABLED=false` forces `LEGACY` regardless of per-tenant flag.
Run `npm test` (mos) + `npx tsx backend/src/mba/isolation.test.ts` (travel-bot) + typecheck both. Commit.

### Task 8.2 — Rollout runbook
**Files:** `docs/plans/2026-07-02-mba-rollout-runbook.md`: Tech-Provider ToS + client MBA ToS; one pilot tenant; allowlist to a single test phone; **knowledge-only first** (no connector); validate via `agent_test`; then enable connector read tools; then payment tool last; then widen audience. Rollback (`disable`) documented at each step. Commit.

---

## Dependency order (critical path)

```
mos: 0.1 → 0.2 → 1.1 → 1.2 → 2.1 → 2.2 → 2.3 → 2.4
travel-bot: 3.0, 4.1, 4.2  (parallel once 1.x lands)
mos: 3.1..3.6 (needs 3.0)   4.3 (needs 2.2, 3.6, 4.1/4.2)   4.4
mos: 5.1 → 5.2 → 5.3 → 5.4 → 5.5 (needs 2.3)
mos: 6.1 → 6.2 (needs 2,3,4,5)   7.x (needs 4,5,6)
both: 8.x (last, gates rollout)
```

## Skills during execution
- superpowers:test-driven-development every task (mos = jest `npm test`; travel-bot = `npx tsx <file>.test.ts`).
- superpowers:systematic-debugging for any webhook-branch misbehavior.
- superpowers:requesting-code-review after Phase 5 and before rollout (Phase 8).

## Open confirmations before/at execution start
1. Exact Postgres table name behind `whatsapp-account.model.ts` (for 1.1) and the conversation/session table (for 5.2).
2. The existing marketing-os secret-store/encrypt util name (for 1.2 token resolver) — reuse, don't add crypto.
3. The existing travel-bot↔marketing-os service-auth mechanism (shared secret/HMAC) to reuse for `/mba/knowledge/*` (3.0).
4. travel-bot public base URL used as the MBA connector `base_url` (4.3).
