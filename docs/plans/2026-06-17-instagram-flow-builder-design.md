# Instagram Flow Builder — Design

Date: 2026-06-17

## Goal

Give Instagram DM automation the same visual conversational flow builder that WhatsApp
already has. An agency edits a node graph (MESSAGE / BUTTONS / LIST / QUESTION / CONDITION /
CATALOG_LIST / SAVE_ENQUIRY / HANDOFF / END …), and inbound Instagram DMs are driven through
that graph — exactly like the WhatsApp "Flow Builder", reusing the same engine.

## Key decisions (confirmed)

- Replicate the **conversational node-graph builder** (`SettingsFlowBuilder.jsx`), not the
  Meta-encrypted form-flow drawer. Instagram has no Meta Flows API, so encrypted form flows
  cannot execute there; the node graph is channel-agnostic and is the correct port.
- Execution goes through the existing **Marketing OS** Instagram DM path
  (`sendTenantInstagramMessage`), the same channel the comment-to-DM automation already uses.

## Architecture — reuse, don't fork

The WhatsApp flow graph is stored on the agency as `agency.whatsappFlowConfig` (JSONB,
`{ schemaVersion: 4, entryFlowId, flows: [...] }`) and executed by a single channel-agnostic
engine in `bot/src/handlers/travelFlowHandler.js` (`getFlowGraphConfig` → `startFlowGraph` →
`executeFlowGraphNode` → `handleFlowGraphReply`). The engine already sends through
`whatsappService.send*`, which already routes `ig_`-prefixed customers to Instagram via
Marketing OS. So we **reuse the same engine** and add a parallel config slot per channel.

### 1. Persistence (backend)

- `Agency` model: add `instagramFlowConfig` JSONB (default `{}`), mirroring `whatsappFlowConfig`.
- `agencyService.updateAgency`: normalize `instagramFlowConfig` with the same library
  normalizer used for `whatsappFlowConfig` (schemaVersion 4 path), **minus** any Meta-flow
  publishing — IG flows never publish to Meta.
- `routes/agencies.ts`: accept `instagramFlowConfig` in the update schema (reuse
  `whatsappFlowConfigSchema`).
- `serializeAgency` already returns model fields, so the frontend receives it automatically.

### 2. Instagram interactive → numbered-text fallback (backend bug fix)

`whatsappService.sendViaMarketingOs` flattens interactive payloads for `ig_` recipients to
`payload.content || payload.text || JSON.stringify(payload)`. Today `sendButtonsMessage` /
`sendListMessage` compute a readable numbered `fallbackContent` but never put it on the
payload sent to the IG branch, so IG users receive `JSON.stringify(payload)` — raw JSON.

Fix: pass the computed `fallbackContent` as `content` (and/or `text`) on the interactive
payload so the IG branch sends the numbered menu. The reply parser already accepts numeric
replies (`/^\d+$/` → option by index), so buttons/lists work on IG as numbered menus.

### 3. Channel-aware engine (bot)

`getFlowGraphConfig(agency, flowId)` currently always reads `agency.whatsappFlowConfig`.
Make it channel-aware:

- Determine channel from the customer at flow entry: `ig_` phone prefix or
  `source === 'instagram'` ⇒ `INSTAGRAM`, else `WHATSAPP`.
- `resolveFlowConfig(agency, channel)` returns `instagramFlowConfig` for Instagram, else
  `whatsappFlowConfig`.
- Persist `channel` in `session.collectedData.activeFlow.channel` at `startFlowGraph` so the
  separate inbound reply path recovers it; thread `channel` through `executeFlowGraphNode` /
  `handleFlowGraphReply` / `getFlowGraphConfig`.
- Inbound auto-start (the existing `if (getFlowGraphConfig(agency)) startFlowGraph(...)`)
  then naturally starts the IG graph for IG customers when `instagramFlowConfig` is set.

### 4. Frontend builder

- Copy `SettingsFlowBuilder.jsx` → `SettingsInstagramFlowBuilder.jsx`, bound to
  `agency.instagramFlowConfig` (load + `PATCH /agencies/me { instagramFlowConfig }`).
- Drop WhatsApp-only nodes that cannot run on IG (e.g. `OPEN_META_FLOW`); keep all
  conversational + catalog + enquiry nodes.
- Add route `/instagram-flow-builder` in `App.jsx` and a nav entry alongside the WhatsApp
  Flow Builder, module-gated the same way.

## Out of scope (YAGNI)

- No Meta-encrypted IG flows (impossible — no API).
- No new model/table; config lives on `Agency`, mirroring WhatsApp.
- Native IG quick-reply chips: Marketing OS IG send is text-only today, so buttons/lists
  render as numbered text. If Marketing OS later exposes IG quick replies, the same engine
  can be upgraded without builder changes.

## Verification

- Backend `tsc`/build passes with the new field + route.
- Frontend builds; the new page loads, edits, and saves `instagramFlowConfig`.
- Manual: set an IG entry flow, send an IG DM, confirm the graph drives the conversation
  with numbered menus and numeric replies advance nodes.
