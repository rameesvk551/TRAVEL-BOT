# Dynamic WhatsApp Flow Builder + 10 Inbuilt Templates — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Build in a dedicated worktree.

**Goal:** Make the travel-bot WhatsApp flow builder (a) understandable by a non-technical agency owner, (b) fully dynamic (no hardcoded categories/flow types), and (c) shipped with **10 best-practice, editable conversation templates** an agency can pick and customize.

**Architecture:** Conversational flows are stored on the agency as `whatsappFlowConfig = { schemaVersion, entryFlowId, flows: [{ id, name, nodes[], edges[] }] }`. Nodes use builder types (`MESSAGE`, `BUTTONS`, `LIST`, `QUESTION`, `CONDITION`, `CATALOG_LIST`, `SEND_ITEM_DETAIL`, `SEND_ITEM_DOCUMENT`, `SAVE_ENQUIRY`, `HANDOFF`, `END`, and routing nodes). Templates are complete preset configs that load into the existing builder as fully editable flows — so they work with the current engine (`bot/src/handlers/travelFlowHandler.js`) on day one, with no engine rewrite required for Phase 1.

**Tech Stack:** React + ReactFlow (`frontend/src/pages/settings/SettingsFlowBuilder.jsx`), Express + Sequelize (`backend/src/services/agencyService.ts`, `flowService.ts`), Postgres `agencies.whatsapp_flow_config` JSONB, bot engine in `bot/src/handlers/travelFlowHandler.js`.

---

## Key references (read before starting)
- Builder UI + node model: `frontend/src/pages/settings/SettingsFlowBuilder.jsx` (NODE_TYPES @47, OPTION_NODE_TYPES @74, buildDefault* @110-460, save mutation @1703).
- Persistence: `agencyService.ts` `normalizeWhatsAppFlowConfig` (@491-542), agency PATCH `whatsappFlowConfig` (@861).
- Engine routing: `travelFlowHandler.js` (entry→sub-flow fallback @3022-3036, OPEN_* handling, `global_main_menu` @5830).
- Current hardcoded flow seeds: `backend/src/services/defaultFlowDefinitions.ts` (Meta form-flows) and builder `DEFAULT_DOMAIN_FLOWS`.

---

## The 10 templates (content spec)

Each template = a complete `whatsappFlowConfig` (entry flow + needed sub-flows). All steps editable after applying.

1. **Resort / Stay only** — entry greet → BUTTONS(Book a stay, Our rooms, Talk to us) → stay journey: ASK check-in date → ASK check-out date → ASK guests → LIST room type → CATALOG_LIST rooms → SEND_ITEM_DETAIL → SAVE_ENQUIRY → HANDOFF.
2. **Full Travel Agency (Everything)** — entry greet → LIST(Packages, Properties, Visas, Cruises, Custom trip, Talk to agent) → each routes to its journey (uses templates 3–6 + custom-trip + handoff).
3. **Holiday Packages** — greet → BUTTONS(Domestic, International) → CATALOG_LIST packages → SEND_ITEM_DETAIL → ASK travel date → ASK travellers → ASK budget → SEND_ITEM_DOCUMENT(brochure) → SAVE_ENQUIRY.
4. **Custom Trip Planner** — greet → ASK destination → ASK dates → ASK travellers → ASK budget → BUTTONS interests(Beach/Adventure/Honeymoon/Family) → SAVE_ENQUIRY → HANDOFF.
5. **Visa Assistance** — greet → ASK country → BUTTONS visa type(Tourist/Business/Student) → ASK travel date → ASK nationality → SEND_ITEM_DOCUMENT(checklist) → SAVE_ENQUIRY.
6. **Cruise Booking** — greet → LIST region → ASK dates → BUTTONS cabin(Interior/Ocean/Balcony/Suite) → ASK guests → CATALOG_LIST cruises → SAVE_ENQUIRY.
7. **Honeymoon Special** — greet → ASK destination pref → ASK dates → ASK budget → ASK special requests → SAVE_ENQUIRY → HANDOFF(specialist).
8. **Umrah / Hajj Packages** — greet → BUTTONS package type(Economy/Standard/Premium) → ASK travel month → ASK travellers (note mahram) → CATALOG_LIST packages → SAVE_ENQUIRY.
9. **Flight + Hotel** — greet → ASK from → ASK to → ASK dates → ASK travellers → BUTTONS class(Economy/Business) → SAVE_ENQUIRY → HANDOFF.
10. **Quick Enquiry (universal)** — greet → ASK name → ASK "what are you looking for?" → ASK preferred date → ASK phone → MESSAGE("we'll contact you") → SAVE_ENQUIRY.

---

## Phase 1 — 10 editable templates + "Start from template" picker (SHIP FIRST)

Highest value, lowest risk: produces flows in the **current** builder format, works with the existing engine immediately.

### Task 1.1: Template registry module
- Create: `backend/src/services/flowTemplates.ts` exporting `FLOW_TEMPLATES: { key, name, description, icon, audience, build(agency): WhatsAppFlowConfig }[]`.
- Each `build()` returns `{ schemaVersion: <current>, entryFlowId, flows: [...] }` in the exact node/edge schema. Reuse helpers mirrored from `SettingsFlowBuilder` buildDefault* so output validates against `normalizeWhatsAppFlowConfig`.
- Test: `backend/test/flowTemplates.test.ts` — for each template, assert `normalizeWhatsAppFlowConfig(agencyId, template.build(agency))` returns without dropping nodes and `entryFlowId` exists in `flows`.

### Task 1.2: List templates API
- Modify: `backend/src/routes/flows.ts` + `flowController.ts` → `GET /flows/templates` returns `[{key,name,description,icon,audience}]` (no graphs).
- Test: route returns 10 entries.

### Task 1.3: Apply template API
- `POST /flows/templates/:key/apply` → builds the config for the caller's agency and saves it via the same path as `whatsappFlowConfig` PATCH (so validation/normalization is identical). Return the new config.
- Guard: require an explicit `?overwrite=true` (or body flag) since it replaces the current builder config; otherwise 409 if a non-empty config already exists.
- Test: applying `resort-stay` to a blank agency persists a config whose `entryFlowId` resolves.

### Task 1.4: "Start from template" picker UI
- Modify: `SettingsFlowBuilder.jsx` — add a "Start from template" button (empty-state + toolbar). Opens a modal grid of the 10 templates (icon, name, audience, 1-line description, "Use this" → preview → confirm overwrite). On apply, load returned config into the canvas state (editable) and toast.
- Use frontend-design skill for the modal/cards.

### Task 1.5: Manual verify + commit
- Use `verify` skill: apply each template on a test agency, open builder, confirm steps render and are editable; send a real "hi" against one template number and confirm the journey runs end-to-end.

---

## Phase 2 — Make cross-flow wiring explicit (UX clarity)
- Render `OPEN_*_FLOW` nodes as accent "↗ Open '<target>' journey" cards resolving to the real sub-flow name + first step.
- Click-to-jump: clicking switches the builder to that flow tab.
- Inline chips on BUTTONS/LIST option rows: `Packages → ↗ Packages journey`.
- Add a read-only **Journey Map** overview tab (Entry → sub-journeys, step counts, empty-flow warnings).
- Pure render/navigation layer — no schema change.

## Phase 3 — Fully dynamic model (remove hardcoding)
- Replace the 7 hardcoded `OPEN_*_FLOW` types with ONE generic `GO_TO_FLOW` node carrying `data.targetFlowId` (any user flow), chosen via dropdown. Keep a back-compat shim mapping old types → `GO_TO_FLOW`.
- Generalize `travelFlowHandler.js`: route on `GO_TO_FLOW.targetFlowId` instead of switching on `OPEN_PACKAGE_FLOW` etc.
- `CATALOG_LIST` binds to a configurable data source (category/filter chosen in UI from real data), not enum literals.
- One-time migration: convert existing agency configs' `OPEN_*_FLOW` nodes → `GO_TO_FLOW` (script + idempotent, with backup of `whatsapp_flow_config`).

## Phase 4 — Storyboard "Simple Mode" + power
- Default **Simple Mode**: vertical plain-language storyboard + live WhatsApp preview; "Advanced" toggle keeps the ReactFlow canvas.
- Power: QUESTION gains named variable + validation (required/type/regex); `{var}` picker in messages; reusable step "snippets"; richer CONDITION on variables.

---

## Execution
Phase 1 is independently shippable and the priority. Build in a worktree, task-by-task, with a fresh subagent + code review per task (subagent-driven-development), verifying against a test agency before each commit.
