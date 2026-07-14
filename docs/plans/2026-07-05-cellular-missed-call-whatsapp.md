# Cellular Missed-Call → WhatsApp Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a customer's phone call to an agency's registered mobile number goes unanswered (a *cellular* missed call), the customer automatically receives a WhatsApp message from the agency.

**Architecture:** One shared backend "call-event" ingest endpoint feeds the *existing* missed-call pipeline (agency match → contact link → auto-reply → `/missed-calls` log). Two thin sensors deliver the event to that endpoint: (1) an **Android** listener built into the existing Expo mobile app (reads the OS call log, free, catches native missed calls); (2) an **iPhone** fallback using carrier conditional-forwarding to a cloud number whose webhook posts the same event. Both normalize to `{ callerPhone, occurredAt }`.

**Tech Stack:** Node/Express + Sequelize (backend), Expo / React Native + a custom Android native module (mobile), marketing-os partner API for WhatsApp send (free-form text + approved template), optional Twilio/local-DID for the iPhone leg.

---

## Critical Constraint: the WhatsApp 24-hour window

The existing WhatsApp-call auto-reply is **free** because an inbound *WhatsApp* call opens Meta's 24h customer-service window, so it replies with free-form text ([missedCallService.ts:112](../../backend/src/services/missedCallService.ts#L112)).

A **cellular** missed call opens **no** WhatsApp window. Therefore the outbound message must be:

1. **Free-form text** — only if that customer already has an open 24h window (messaged the agency's WhatsApp in the last 24h). Cheap path, often unavailable.
2. **Approved template** (WhatsApp "utility" category) — works anytime, small per-message fee, text pre-approved by Meta. This is the default path.

Rule implemented: **try free-form when a recent inbound WhatsApp message exists for that customer, else send the configured template.** Template infra already exists (`sendTenantWhatsAppTemplate`, [marketingOsPartnerService.ts:192](../../backend/src/services/marketingOsPartnerService.ts#L192)).

---

## Phasing

- **Phase 1 — Backend (the brain).** Shared ingest endpoint + cellular send logic + schema. Ship-able and testable on its own.
- **Phase 2 — Android sensor.** Native call-log module in the Expo app posting to Phase 1. Covers all Android agents, **$0**.
- **Phase 3 — iPhone fallback (optional, later).** Carrier-forward → cloud-number webhook → same endpoint. Only where an iPhone number needs coverage.

Build Phase 1 fully, then Phase 2. Phase 3 is deferred until an iPhone agency actually needs it.

---

## Data Model

Extend the existing `whatsapp_calls` table rather than create a new one — the `/missed-calls` page, dedupe, and auto-reply lifecycle are all reusable.

**New columns on `WhatsAppCall`:**
- `source` ENUM(`'WHATSAPP'`, `'CELLULAR'`) NOT NULL DEFAULT `'WHATSAPP'` — which sensor produced the row.
- `reportedByUserId` UUID NULL — for cellular: the agent/device that reported it (from the JWT).

**New columns on `Agency`** (mirrors the existing `whatsappMissedCall*` fields):
- `cellularMissedCallEnabled` BOOLEAN DEFAULT false — master switch for this feature.
- `cellularMissedCallTemplateName` STRING NULL — approved template to send when no 24h window is open.

No separate "registered number" table: the Android sensor authenticates as the logged-in agent, so the **agency comes from the JWT**. The device's own number is self-reported as `businessPhone` for display only.

---

## Phase 1 — Backend

### Task 1: Schema — add columns

**Files:**
- Modify: `backend/src/models/WhatsAppCall.ts`
- Modify: `backend/src/models/Agency.ts`
- Create: `backend/migrations/<timestamp>-cellular-missed-call.js` (match existing migration style in `backend/migrations/`)

**Step 1:** Add `source` and `reportedByUserId` to the `WhatsAppCall.define` block; add `cellularMissedCallEnabled` and `cellularMissedCallTemplateName` to `Agency`.

**Step 2:** Write the migration adding the four columns (idempotent: `addColumn` guarded by a `describeTable` check, matching the repo's existing migrations).

**Step 3:** Run migration against a scratch DB. Expected: columns present, existing rows default `source='WHATSAPP'`.

**Step 4:** Commit — `feat(missed-calls): schema for cellular missed-call source`.

---

### Task 2: `ingestCellularMissedCall` service method (TDD)

Reuse the private helpers already in [missedCallService.ts](../../backend/src/services/missedCallService.ts): `matchCustomer`, `latestLeadForCustomer`, contact-link + `autoReplyStatus` atomic-claim pattern ([:201-230](../../backend/src/services/missedCallService.ts#L201-L230)). Only the **send** differs.

**Files:**
- Modify: `backend/src/services/missedCallService.ts`
- Test: `backend/test/missedCallService.cellular.test.js` (match the repo's existing test runner/style)

**Step 1: Write failing tests**

```js
// given an agency with cellularMissedCallEnabled=false → no row change, no send
// given enabled + customer WITH open 24h window → sends FREE-FORM text, status SENT
// given enabled + customer WITHOUT window → sends TEMPLATE, status SENT
// given duplicate (same caller+businessPhone within 60s) → single row, single send
// given unknown caller + whatsappMissedCallUnknownAction='CREATE_LEAD' → lead created
```

**Step 2:** Run — expect FAIL (method undefined).

**Step 3: Implement** `ingestCellularMissedCall(agency, { callerPhone, businessPhone, occurredAt, reportedByUserId })`:

- Guard on `agency.cellularMissedCallEnabled`; if off, return null (no log).
- `providerCallId = 'cell-' + normalizePhone(callerPhone) + '-' + Math.floor(occurredAt/60000)` → gives the 60s idempotency window via the existing unique index `(agency_id, provider_call_id)`.
- `findOrCreate` the `WhatsAppCall` row with `source:'CELLULAR'`, `direction:'INBOUND'`, `status:'MISSED'`, `reportedByUserId`.
- Reuse the contact-link + unknown-lead block verbatim from `processSingleCall`.
- Reuse the atomic `autoReplyStatus` claim, but swap the send for a new `sendCellularReply(agency, callerPhone, providerCallId)`:
  - Look up whether an inbound WhatsApp message from `callerPhone` exists in the last 24h (query the messages/conversation table used by the inbox).
  - **If yes:** `marketingOsPartnerService.sendMessage(tenantId, { to, body })` (free-form, existing path).
  - **If no + `cellularMissedCallTemplateName` set:** `getTenantToken` → `sendTenantWhatsAppTemplate(token, { to, templateName, language, components })`.
  - **If no template configured:** set `autoReplyStatus='SKIPPED'`, `autoReplyError='No template configured and 24h window closed'`.

**Step 4:** Run tests — expect PASS. **Step 5:** Commit — `feat(missed-calls): cellular missed-call ingest + window-aware send`.

> **Extract shared code (DRY):** pull the contact-link + auto-reply-claim block out of `processSingleCall` into a private `linkAndClaim(agency, row, rawFrom)` helper both paths call, so the WhatsApp and cellular flows don't drift. Do this as the first refactor step of Task 2, keeping existing WhatsApp tests green.

---

### Task 3: Ingest endpoint (TDD)

**Files:**
- Modify: `backend/src/controllers/missedCallController.ts`
- Modify: `backend/src/routes/missedCalls.ts`
- Test: `backend/test/missedCalls.route.test.js`

**Step 1: Failing test** — `POST /api/missed-calls/events` with a valid JWT + body `{ callerPhone, businessPhone, occurredAt }` returns 200 and creates a `source='CELLULAR'` row for `req.agency.id`; missing `callerPhone` → 400; no auth → 401.

**Step 2:** Run — FAIL.

**Step 3: Implement**
- Controller `ingestEvent(req,res,next)`: validate `callerPhone` present, coerce `occurredAt` (epoch ms; default now), call `missedCallService.ingestCellularMissedCall(req.agency, { ...body, reportedByUserId: req.user.id })`, return `{ success:true }`.
- Route: `router.post('/events', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), missedCallController.ingestEvent);` — authenticated as the agent (agency from JWT), **not** a public webhook.

**Step 4:** Run — PASS. **Step 5:** Commit — `feat(missed-calls): POST /events ingest endpoint`.

---

### Task 4: Settings UI

**Files:**
- Modify: `frontend/src/pages/MissedCalls.jsx` (or the agency settings page hosting `whatsappMissedCall*`)
- Modify: `frontend/src/api/missedCallsApi.js`
- Modify: the agency-update controller/service to persist the two new fields (follow the existing `whatsappMissedCallAutoReplyEnabled` write path — beware the zod `validateBody` strip gotcha noted in memory `lead-status-update-schema-gotcha`: add the new fields to the schema or they silently no-op).

**Step 1:** Toggle "Auto-reply to missed *phone* calls" + a template picker (reuse the existing template list). **Step 2:** Show `source` as a WhatsApp/Phone badge in the `/missed-calls` list. **Step 3:** Manual verify. **Step 4:** Commit — `feat(missed-calls): settings + source badge for cellular calls`.

**Phase 1 done: cURL `POST /events` → WhatsApp arrives → row shows on the page.**

---

## Phase 2 — Android sensor (Expo app)

The Expo app is at [mobile/](../../mobile). Reading the Android call log needs `READ_CALL_LOG` + a `PHONE_STATE` `BroadcastReceiver` — **not possible in Expo Go**; requires a **development/EAS build** and a config plugin. Detecting a *missed* call = phone rang (`RINGING`) then went to `IDLE` without an `OFFHOOK` in between; read the newest `CallLog.Calls.MISSED_TYPE` entry for the number.

### Task 5: Native module scaffold
- Create an Expo config plugin adding `READ_CALL_LOG`, `READ_PHONE_STATE`, `RECEIVE_BOOT_COMPLETED` to `AndroidManifest`.
- Create a native module (Kotlin) exposing a `PhoneStateReceiver` that, on missed call, reads the last call-log row and emits `{ number, timestamp }` to JS.
- Wire into `mobile/app.json` plugins + rebuild dev client.
- Manual verify: place a missed call → JS event fires in a dev build.
- Commit — `feat(mobile): android missed-call native module`.

### Task 6: Post to backend
- JS listener → `POST /api/missed-calls/events` with the logged-in agent's token (reuse the app's existing auth/api client), body `{ callerPhone: number, businessPhone: <device number/self>, occurredAt: timestamp }`.
- Debounce/dedupe locally (ignore repeats within 60s) so a flaky receiver can't double-post; backend dedupe is the backstop.
- Runtime permission request UX on first launch + a settings toggle to opt in.
- Manual end-to-end: missed call on the device → WhatsApp received by the "customer" test number → row on `/missed-calls`.
- Commit — `feat(mobile): report missed calls to backend`.

> **Reality check to surface to the user before building Phase 2:** background reliability on Android varies by OEM battery-killers (Xiaomi/Oppo/etc. may kill the receiver). A foreground service or `WorkManager` re-check on next app open mitigates but doesn't fully solve it. Note this limitation in the UI.

---

## Phase 3 — iPhone fallback (deferred)

iOS forbids reading the call log, so the only path is carrier **conditional call-forwarding** (on no-answer/busy/unreachable) → a cloud number that captures caller ID and posts to `/events`.

### Task 7 (when needed)
- Provision a cloud number (local DID preferred over Twilio for GCC — international forwarding leg is the real cost, see the design discussion).
- Public webhook `POST /api/missed-calls/telephony/:agencySecret` (or map by the forwarded-to `To`): read the caller `From`, `<Reject>` the call (no connected minutes), call the **same** `ingestCellularMissedCall` with the resolved agency.
- Per-agency onboarding: show the exact `**61*<number>#`-style forwarding codes to dial.
- Commit — `feat(missed-calls): telephony webhook for iPhone forwarding`.

---

## Out of scope (YAGNI)
- Recording, transcription, answered-call capture, per-call analytics.
- iOS call-log reading (impossible).
- Agency-configurable "any call vs missed only" — user confirmed **missed only**.
