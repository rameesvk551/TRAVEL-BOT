# Trav Around — Conversational Navigation Flow (WhatsApp + Instagram)

**Date:** 2026-06-17
**Status:** Design locked; Phase 1 (authored templates) in progress
**Surface:** WhatsApp + Instagram DM
**Goal:** One professional, simple, button-driven journey that lets a customer find and
enquire about Packages, Cruises, Visa, and à-la-carte Services with at most a couple of
taps — plus optional free-text search.

---

## 1. Architecture reality (two repos)

The bot is split across two codebases:

| Repo | Role | Relevant pieces |
|---|---|---|
| **travel-bot** (this repo) | The CRM / catalog | `Service`, `Package`, `Cruise`, `Visa` models; `leadService.createLead()`; the WhatsApp **Flow forms** in `defaultFlowDefinitions.ts` |
| **marketing-os** | The bot engine | `flows/flow.engine.ts` (9 node types), `Flow` + `FlowState` models, the **flow-builder UI** (`marketing-os-ui/.../flow-builder`) with loadable JSON templates |

The customer-facing conversational logic (inbound webhook → run a flow → advance on each
reply) lives in **marketing-os**. travel-bot is the data + lead destination.

### Flow engine capabilities (what we can author today)

`flow.engine.ts` node types: `trigger`, `message` (text | image | video | **buttons** |
**list**), `condition` (branch on a variable), `delay`, `action` (HTTP call), `template`,
and three disabled commerce nodes (`dynamic_catalog`, `add_to_cart`, `create_order`).

- Interactive `message` nodes (buttons/list) **pause** the run (`waiting_for_input`) and the
  user's tap becomes a variable used by the next `condition` node. This is the spine.
- `action` nodes do HTTP POST/GET — used to push a captured lead into travel-bot.
- Per-conversation position is stored in `FlowState (tenantId, contactPhone, nodeId, variables)`.

### Honest gaps (Phase 2 — need engine code, not just authoring)

1. **Instagram has no flow runtime.** The engine is WhatsApp-coupled; IG only has
   stub messaging (`sendQuickReplies`, `sendCards`). Running the same flow on IG needs a
   channel adapter + IG quick-reply→resume mapping.
2. **No free-text "collect-input" node.** The engine pauses only on buttons/list, not on a
   typed answer. Free-text fields (from/to city, dates) can't be captured cleanly yet.
3. **No "send WhatsApp Flow" node.** The rich form mini-apps in travel-bot can't be launched
   from a marketing-os flow node.
4. **`dynamic_catalog` is disabled** — live package/service lists from travel-bot's DB can't
   render in-flow yet (only static lists, or an `action` fetch whose response isn't mapped to
   variables).
5. **No keyword→flow trigger matcher** wired on inbound, and **no lead post-back** convention.

**Phase 1 ships within these limits**: button/list navigation + structured (button-based)
service intake + `action` lead post-back, on WhatsApp. Free-text fields degrade to
"an agent will confirm details" or a handoff.

---

## 2. The shared spine (same behind all 3 entry styles)

```
ENTRY (one of 3 styles)
   └─► MAIN ROUTER ─┬─ 🌍 Packages   → Domestic / International → list → Enquire
                    ├─ 🚢 Cruises     → list → Enquire
                    ├─ 🛂 Visa        → list → Enquire        (own top-level section)
                    ├─ 🧰 Services    → pick type → that type's questions → Enquire
                    ├─ 🔍 Search      → typed query → matched cards   (Phase 2: needs free-text)
                    ├─ ✏️ Custom trip → form / guided questions
                    └─ 💬 Talk to agent → human handoff (pause bot)
   └─► ENQUIRE  → action: POST lead to travel-bot → ✅ confirmation + "agent will reach you"
```

Three invariants that make it feel professional:

1. **Always a way back** — every screen offers `🏠 Main menu`.
2. **Max 2 taps to a result** — entry → category → result.
3. **One definition, rendered per channel** — author once; WhatsApp native today, IG in Phase 2.

Packages, Cruises, and Visa are three *catalog* sections that behave identically
(browse list → pick → enquire). Services is the one *form* section. That symmetry means the
customer learns the pattern once.

---

## 3. Where the data comes from

- **Services list** → `services` DB table, agency-managed (`serviceService.listServices(agencyId, {activeOnly:true})`),
  ordered by `displayOrder`. The menu builds itself; no hardcoding.
- **Per-service questions** → authored by the agency in the **flow builder** (the flow
  definition *is* the question set). The 8 seeded flows in `defaultFlowDefinitions.ts` are
  editable starter templates.
- **Lead destination** → `leadService.createLead({ customerName, customerPhone, source,
  interest, itemType, customTripDetails, ... })`.

### Service intake registry (button-first design)

For each service we collect the minimum to quote. Free-text fields are marked `*` (Phase 2 /
agent-confirmed for now); the rest are button/list selectable today.

| Service | Button/list fields (Phase 1) | Free-text fields (`*`) |
|---|---|---|
| ✈️ Flight | trip type, class, pax band | from*, to*, dates* |
| 🚆 Train | class, quota, pax band | from*, to*, date* |
| 🚌 Bus | seat type, pax band | from*, to*, date* |
| 🏨 Hotel | budget/star, rooms, guests band | city*, check-in*, check-out* |
| 🛡️ Insurance | trip type, region, travellers band | dates*, ages* |
| 💱 Forex | currency, buy/sell | amount*, city*, date* |
| 🚕 Cab | vehicle type, pax band | city*, pickup*, drop*, date/time* |

---

## 4. The three entry templates (Phase 1 deliverable)

All three funnel into the same router/spine; they differ only in the front door, so Trav
Around can A/B which converts best without rebuilding the back end.

1. **Menu-first** — greeting + reply buttons (Packages / Cruises / More…). Zero typing.
   Most foolproof; recommended default.
2. **Search-first** — greeting invites a typed destination/budget; a `Browse all` button is the
   fallback. (Search matching itself is Phase 2 — needs the free-text/collect-input node;
   Phase 1 ships the entry + graceful fallback to the menu.)
3. **Hybrid** — a prominent `🔍 Search` button *and* the category menu together. Best of both
   for a multi-service agency.

Delivered as loadable JSON in `marketing-os-ui/src/features/flow-builder/templates/`,
registered in `templates/index.ts`, category `marketing`/`custom`, tagged `travel`.

---

## 5. Channel matrix

| Capability | WhatsApp (Phase 1) | Instagram (Phase 2) |
|---|---|---|
| Greeting + buttons | ✅ reply buttons | quick replies |
| Category list | ✅ list message | carousel / quick replies |
| Condition routing | ✅ | needs adapter |
| Service intake (buttons) | ✅ | quick replies |
| Free-text fields / search | ⛔ (agent-confirmed) | ⛔ |
| WhatsApp Flow forms | ⛔ from engine (use travel-bot dispatch) | n/a |
| Lead post-back (`action`) | ✅ | ✅ once IG runtime exists |

---

## 6. Phased plan

- **Phase 1 (now):** Author the 3 entry templates on the existing engine (WhatsApp,
  button/list spine, `action` lead post-back). Wire keyword trigger + lead endpoint.
- **Phase 2:** Engine work — `collect-input` node (free text), `send-whatsapp-flow` node,
  `dynamic_catalog` for live travel-bot catalog, Instagram flow runtime + channel adapter.
- **Phase 3:** Search matching (NLP over destination/budget), carousels with images.

---

## 7. Open items / decisions still needed

- Confirm the exact keyword set that should trigger the flow (e.g. `hi`, `hello`, `menu`,
  `book`, `package`).
- Confirm the travel-bot endpoint marketing-os should POST leads to (auth + payload shape).
- Decide Phase 2 priority order: Instagram parity vs free-text search vs live catalog.
