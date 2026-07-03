# WhatsApp Missed-Call Auto-Reply + Missed Calls UI

**Date:** 2026-07-03
**Status:** Approved, implementing
**Scope:** travel-bot only (marketing-os already raw-proxies the Meta webhook)

## Goal

When a customer places a WhatsApp call to an agency and it isn't answered,
travel-bot records the missed call and (optionally, per agency) auto-sends a
WhatsApp message back. Agents see missed calls on a dedicated "Missed Calls"
page.

## Key facts that shape the design

- **marketing-os already raw-proxies the entire Meta webhook** to travel-bot for
  partner-owned tenants. The proxied payload lands at
  `POST /api/agencies/whatsapp/marketing-os/callback` →
  `agencyService.handleMarketingOsCallback` (signature already verified there).
  Meta `calls` events (`entry[].changes[].value.calls[]`) arrive the same way.
- **travel-bot never answers WhatsApp calls** (no voice/media stack), so every
  user-initiated call is effectively "missed" — no accept-state tracking needed.
- **An inbound call opens the 24h customer-service window**, so the auto-reply
  can be a **free-form text (free)** via `marketingOsPartnerService.sendMessage`
  — no paid template required.
- **CallLog can't be reused**: its `leadId/customerId/agentId/agentPhone` are
  `NOT NULL`, wrong for an unknown caller. Use a dedicated `WhatsAppCall` table.

## Data model — new `whatsapp_calls` table (sequelize.sync creates it on boot)

| column | type | notes |
|---|---|---|
| id | UUID pk | |
| agencyId | UUID not null | tenant |
| providerCallId | STRING | Meta `call.id`; unique per agency → idempotency |
| direction | ENUM(INBOUND,OUTBOUND) | default INBOUND |
| callerPhone | STRING not null | `call.from` |
| businessPhone | STRING null | `call.to` |
| status | ENUM(MISSED,COMPLETED,REJECTED) | default MISSED |
| event | STRING null | last Meta event seen (connect/terminate) |
| customerId | UUID null | matched by phone |
| leadId | UUID null | matched/created |
| occurredAt | DATE | from `call.timestamp` |
| autoReplyStatus | ENUM(SENT,FAILED,SKIPPED,DISABLED) null | |
| autoReplySentAt | DATE null | |
| autoReplyMessageId | STRING null | provider message id |
| autoReplyError | TEXT null | |
| rawEvents | JSONB default [] | audit |

Indexes: `(agencyId, occurredAt)`, unique `(agencyId, providerCallId)`, `callerPhone`.

## Per-agency config — new columns on `agencies` (migration script)

- `whatsappMissedCallAutoReplyEnabled` BOOLEAN default false
- `whatsappMissedCallAutoReplyMessage` TEXT (sensible default)
- `whatsappMissedCallUnknownAction` ENUM(LOG_ONLY, CREATE_LEAD) default LOG_ONLY

Saved via the existing `PATCH /api/agencies/me` (add to update schema) and
returned by `getCurrentAgency`.

## Flow

1. Meta → marketing-os → raw-proxy → `handleMarketingOsCallback`.
2. If the raw payload contains any `changes.value.calls`, hand off to
   `missedCallService.processCallWebhook(payload)` and return (do **not** relay
   calls to the bot).
3. For each call: resolve agency (by `phone_number_id`/`waba_id`/tenant header),
   `findOrCreate` by `(agencyId, providerCallId)` — this is the idempotency
   guard. Match `callerPhone` → Customer (and its latest Lead).
4. On a missed (terminate / unanswered user-initiated) event, the newly-created
   row triggers:
   - unknown caller + `CREATE_LEAD` → create Customer+Lead;
   - if `autoReplyEnabled` → `sendMessage(tenantId, { to, body })`, record
     `autoReplyStatus`; else `DISABLED`.
5. Always respond 200 fast; process async (matches existing webhook handlers).

## Backend files

- `models/WhatsAppCall.ts` (new) + register/associate/export in `models/index.ts`
- `models/Agency.ts` — 3 config fields
- `scripts/migrateWhatsappMissedCall.ts` (new) — adds the 3 `agencies` columns
- `services/missedCallService.ts` (new) — `processCallWebhook`, `listMissedCalls`
- `services/agencyService.ts` — `value.calls` detection + dispatch in
  `handleMarketingOsCallback`
- `controllers/missedCallController.ts` (new) — `list`
- `routes/missedCalls.ts` (new) — `GET /api/missed-calls` (auth + LEADS_VIEW);
  mount in `routes/index.ts`
- agency update schema/controller — accept the 3 config fields

## Frontend files

- `api/missedCallsApi.js`, `hooks/useMissedCalls.js` (new)
- `pages/MissedCalls.jsx` (new) — list table + settings panel (toggle, message,
  unknown-caller action) saving via agency update
- `App.jsx` — lazy import + `/missed-calls` route
- `components/Sidebar.jsx` — nav item under Workspace
- `config/industryProfiles.js` — add `/missed-calls` to non-travel module lists

## Ops prerequisites (not code)

Enable calling on each agency phone number and subscribe the Meta app to the
`calls` webhook field. Without this, no missed-call events are emitted.

## Out of scope (YAGNI)

Answering/placing calls, recordings, business-initiated calls, templates,
Twilio CallLog changes.
