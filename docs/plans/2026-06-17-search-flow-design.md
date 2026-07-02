# Search-enabled WhatsApp enquiry flow + Search node + template gallery

Date: 2026-06-17
Status: IMPLEMENTED (2026-06-17). Verified: matcher unit tests 10/10, bot syntax-clean,
frontend builds clean. Pending: live end-to-end WhatsApp run + deploy (not yet deployed/committed).

## Goal

Let an agency build a WhatsApp conversation where a customer:
1. Picks a domain from a main menu (Packages / Properties / Services).
2. Answers a few admin-defined questions.
3. Has the bot **search the agency's inventory using those answers** (typo-tolerant).
4. Sees matching results as **image cards, numbered**, and replies with a number to pick one.
5. Triggers **lead creation/update + agent assignment**, with **every question/answer saved to the lead**, and gets "Our team will contact you shortly."

This is delivered as a reusable **starter template** every company can pick from a **template gallery**.

## Core principle: nothing hard-coded — template is editable data

The only thing written in code is the GENERIC `SEARCH` node engine, which is driven entirely by its
per-node config. No questions, services, locations, field names, captions, or branches are hard-coded.

The flow itself is DATA: a saved graph (like the existing `DEFAULT_DOMAIN_FLOWS`) that the agency
**selects from the gallery first, then edits freely** in the builder — renaming/adding/removing questions,
changing which answer searches which inventory field, adding their own service branches, editing captions
and messages. The example flow below (destination / stayType / munnar) is only the template's STARTING
content the agency overwrites; it is not behaviour baked into the runtime.

## Where it lives (confirmed architecture)

The conversational engine is travel-bot's own — NOT Marketing OS. Marketing OS is only transport
(it proxies the inbound webhook in and sends outbound out).

- Builder UI: `frontend/src/pages/settings/SettingsFlowBuilder.jsx` (Reactflow node graph)
- Persistence: `Agency.whatsappFlowConfig` (JSONB: `{ schemaVersion, entryFlowId, flows[] }`) via `/flows` API
- Runtime: `bot/src/handlers/travelFlowHandler.js` (`executeFlowGraphNode`), driven by `bot/src/webhook.js`

## Decisions (from brainstorming)

- Result display: **image card per result + reply-with-a-number** selection (reuses existing
  numbered-reply handling at `travelFlowHandler.js:3161`).
- Staff notification: **assigned / lead-owner agent** via existing `Save Enquiry` → `notifyAssignedAgent`
  (template, or free text if the agent is inside the 24h window). Nothing new needed.
- Typo correction: **hybrid** — silent auto-correct for obvious typos, "Did you mean X?" when ambiguous,
  fall through to handoff/"talk to team" when there is genuinely no match.
- Services branch: **each service is its own hand-wired branch** in the canvas (not data-driven).
- Build as: **reusable template + a "Use this template" gallery**.

## What already exists (no build needed)

Nodes: `MESSAGE`, `BUTTONS`, `LIST`, `QUESTION` (saves answer to `fields[fieldKey]`), `CONDITION`,
`CATALOG_LIST`, `SEND_ITEM_DETAIL`, `SEND_ITEM_DOCUMENT` (Send PDF), `SAVE_ENQUIRY`, `HANDOFF`, `END`.
`SAVE_ENQUIRY` already persists all `fields` into `lead.customTripDetails.flowSubmissions` + notes,
records the selected item, and assigns the agent. Numbered-reply selection already exists for catalog lists.

## The one new thing: the `SEARCH` node

### Builder config (inspector fields)
- `catalogType`: PACKAGE | PROPERTY | SERVICE | VISA | CRUISE
- `searchMappings[]`: `{ fieldKey, matchField, fuzzy: true }`
  - e.g. Properties: `{stayType → propertyType}`, `{place → location}`
  - e.g. Packages: `{destination → destinations}`
  - Only mapped fields filter the search. Other answers (date, budget, guests) are still collected
    and saved to the lead but do not filter (inventory is not date/budget aware).
- `body`: intro/heading text shown before results
- `cardCaption`: template for each card, e.g. `{name}\n{location} · ₹{price}\n{summary}` (uses item fields)
- `maxResults`: default 6 (cap so we never send 50 images)
- `emptyMessage` + an `empty` edge handle (→ usually Handoff or "talk to team")
- `noMatchBehavior`: handoff (recommended) — when the typed criteria match nothing even after correction

### Runtime behaviour (in `travelFlowHandler.js`)
1. Read mapped answers from `session ... fields`.
2. **Typo correction (JS, no DB extension):** for each mapped field, fetch the DISTINCT real values
   for that column scoped to `{agencyId, catalogType, isActive}` (e.g. the agency's actual property types
   and locations). Normalise + Levenshtein/`string-similarity` the customer's word to the closest distinct
   value. Confidence tiers:
   - high (exact or ~1 edit): silently use the corrected value
   - medium: emit a "Did you mean **X**?" confirm step (Buttons Yes/No) before searching
   - low/none: take the `empty`/handoff edge
3. Query the inventory model with corrected values (`Op.iLike` exact/substring), `agencyId` + `isActive`,
   `limit = maxResults`. Reuse the model-access patterns already in `findFlowCatalogItems`.
4. Render: send `body`, then one **image message per result** (image + numbered caption from `cardCaption`).
   Set `awaitingType = 'CATALOG_LIST'` (so the existing numbered-reply path resolves the pick) and store the
   ordered result ids so reply "2" → that item becomes `selectedItem`.
5. On selection, follow the `selected` edge (→ `SEND_ITEM_DOCUMENT` / `SEND_ITEM_DETAIL` / `SAVE_ENQUIRY`).

No new backend API: the bot queries models directly, exactly as `CATALOG_LIST` does today.

## The template flow (shipped as a gallery starter)

```
Start → Welcome → Main Menu (Buttons: Packages · Properties · Services)

PACKAGES:  Q destination → Q travelDate → Q people → Q budget
           → SEARCH(PACKAGE, {destination→destinations}) → cards/number
           → SAVE_ENQUIRY ("Our team will contact you shortly.")

PROPERTIES: Q stayType → Q place → Q checkIn → Q guests
           → SEARCH(PROPERTY, {stayType→propertyType, place→location}) → cards/number
           → SAVE_ENQUIRY

SERVICES:  Buttons of services → each service its own branch:
           [service-specific Q nodes] → SAVE_ENQUIRY
```

Every `QUESTION` answer lands in `fields` and is persisted by `SAVE_ENQUIRY`, satisfying
"every question/answer saved in lead details".

## Template gallery

- A small library of named starter flows (graphs shaped like `DEFAULT_DOMAIN_FLOWS`), including this
  "Search-enabled enquiry" flow.
- Builder gets a "Use this template" picker that drops the chosen graph into the agency's editable library
  (instead of the current silent auto-merge of one fixed default set).
- Later: per-industry template sets.

## Out of scope (v1)

- Range/numeric filters (budget ≤ X, date availability) — answers are saved, not used to filter.
- `pg_trgm`/DB-side fuzzy search — done in JS instead.
- Data-driven per-service question sets — services are hand-wired branches.

## Risks / notes

- Result images: cap at `maxResults` (≤ ~6) to avoid spamming the chat.
- "Did you mean?" adds one Buttons round-trip only in the medium-confidence case.
- Touches the live bot runtime (customer critical path) — build behind the new node type only; existing
  flows must be unaffected when no `SEARCH` node is present.
- Prod `puppeteer-core` EBADENGINE on Node 18 is unrelated but noted in the deploy runbook.

## Implementation phases (proposed)

1. **Fuzzy matcher** (pure, TDD): `match(input, candidates) → {value, confidence}`. Unit-tested
   (vila→Villa, munar→Munnar, garbage→none).
2. **SEARCH runtime** in `travelFlowHandler.js`: distinct-value fetch, correction, query, image-card render,
   numbered selection wiring, empty/handoff edges.
3. **SEARCH builder node**: palette entry + inspector (catalogType, mappings, caption, maxResults, edges) +
   live preview.
4. **Template gallery**: template registry + "Use this template" picker; add the search-enabled flow.
5. **Verify** by running the flow (preview + a real WhatsApp run), then deploy per the prod-deploy runbook.
