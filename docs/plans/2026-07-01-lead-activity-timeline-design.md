# Lead Activity Timeline + Converted-Lead Handoff to Customers

Date: 2026-07-01
Branch: feature/white-label-partners (or new feature branch)

## Goal

An agent opening a lead (or a converted customer) should read the lead's whole
story top-to-bottom — every note, follow-up, outcome, message, call, and payment —
with **who did it** and **when**, in a polished vertical activity feed.

When a lead is converted (a booking is created), it should disappear from the
Leads working list and live on under Customers, where its full journey is shown.

## Current state (already built)

- Conversion: creating a Booking sets `lead.status = 'CONVERTED'` and the
  customer's `isCustomer = true` (`bookingService.ts:190`).
- `buildLeadTimeline()` (`leadService.ts:97`) already merges lead-created, notes,
  follow-ups (+ outcomes), messages, calls, and payments into one sorted timeline
  with actor + time. This is the single source of truth for "the flow."
- Lead drawer already renders `lead.timeline` in a Timeline tab (`Leads.jsx` ~2900).
- Leads list already classifies `['CONVERTED','LOST','CANCELLED']` as closed
  (`leadService.ts:629`) but the "All Leads" tab still surfaces CONVERTED.
- Customer drawer has a Timeline tab but only shows registration + recent messages;
  no link to the customer's lead(s), no lead history (`Customers.jsx:662`).
- `Customer hasMany Lead` via `Lead.customerId` (`models/index.ts:189/204`).

## Decisions

1. **Converted leads stay in the Leads listing** (no change to Leads filtering).
   The full story is *also* surfaced on the Customer record. Nothing is removed
   from Leads.
2. **Multi-lead customers: one merged story.** Combine all of a customer's leads
   into a single chronological feed, with a subtle divider where each new enquiry
   began ("Enquiry: Dubai (Mar)").
3. Reuse `buildLeadTimeline` — no new timeline logic. Only wiring + UI.

## Implementation

### Backend
- Leads listing: no change — converted leads remain visible in Leads.
- Customer detail endpoint (`customerController.ts`): for the opened customer,
  fetch its leads (ordered by createdAt), build each lead's timeline via
  `buildLeadTimeline`, tag each event with its source enquiry (leadId + a short
  label like destination + created month), merge, sort desc. Return as
  `customer.activityTimeline`.

### Frontend
- Leads.jsx: no removal — converted leads still listed. Polish the lead drawer's
  existing Timeline tab into the same vertical activity-feed style (below).
- Customers.jsx Timeline tab: replace the thin "registered + messages" view with
  the unified activity feed:
  - vertical rail with colored dots per event type (reuse the lead Timeline's
    icon/color map for consistency),
  - actor name/avatar + relative time on every node,
  - note/outcome body under the node,
  - enquiry dividers between merged leads,
  - filter chips: All · Notes · Follow-ups · Messages · Calls,
  - a "View original lead" link per enquiry group.

## Out of scope (YAGNI for now)
- Real-time websocket timeline updates.
- Timeline export.
- Editing/deleting historical timeline events.

## Testing
- Convert a lead (create a booking) → verify it vanishes from Leads and appears
  under Customers with the full story.
- Customer with 2+ leads → verify merged, dividers correct, sorted desc.
- Actor + time render for note, follow-up, follow-up outcome, message, call, payment.
