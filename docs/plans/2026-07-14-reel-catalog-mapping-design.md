# Reel → catalog mapping and attribution

**Date:** 2026-07-14
**Status:** design agreed, implementation pending

## Problem

An agency posts a reel about a property. Someone comments. We auto-DM them. They
submit a form, or they land in WhatsApp. Nothing anywhere records which reel
brought them, and nothing knows the reel was about that property — so the bot
cannot send that property's PDF, and the lead carries no attribution.

The reel id is captured on the way in (`instagram_comments.ig_media_id`) and is
dropped at the DM boundary. The DM's link is a static string typed into a rule.

## What we are building

Map a reel to a catalog item once, at the point the item is created or edited.
From then on, every door a commenter can walk through resolves back to that item
and records both the reel and the item on the lead.

Three doors, one resolver:

| Door | How the reel travels | Visible to customer |
| --- | --- | --- |
| Comment → auto-DM → lead form link | reel + item in the URL query | in the URL only |
| Comment → auto-DM → `wa.me` link | short code inside agency-written copy | as a `#7K2Q9` tag |
| Click-to-WhatsApp ad boosted from the reel | `referral.source_id` → Graph → reel id | not at all |

## Decisions

**Mapping is configured on the catalog item, stored as a join.** The Property and
Package forms get an "Instagram posts" picker. Storage is a single
`catalog_media_links` table, not a column per model: a reel lookup becomes one
indexed query instead of a JSONB scan across five catalog tables, the short code
gets a unique index, and services/visas/cruises come for free.

```
catalog_media_links
  id, agency_id, media_id, item_type, item_id,
  code            -- short handoff code, unique per agency
  action_override -- null = inherit the agency default
  form_slug       -- when the action is a lead form
  permalink, thumbnail_url  -- cached for display
```

**Action is an agency default with a per-reel override.** Settings carries
"when someone comments on a mapped reel, send: lead form / WhatsApp link / PDF".
Each linked reel may override it. A client who never opens per-reel settings
still gets sane behaviour.

**The handoff token is readable copy plus an opaque code.** WhatsApp offers no
hidden metadata on an organic `wa.me` link — the prefilled text is the only
carrier and the customer can edit it. So the text is an agency-editable template
(`Hi! I'd like details on {{item}} (#{{code}})`) and the bot extracts the code
from anywhere in the message. The existing `VIEW_PACKAGE:<uuid>` parser keeps
working.

**Travel-bot owns resolution.** The catalog, the flow builder and the leads all
live there. marketing-os becomes transport: it forwards the comment event and
sends the DM travel-bot composed.

**We do not build a PDF sender.** The flow builder already has a
`SEND_ITEM_DOCUMENT` node whose source is per-agency configurable (AUTO /
BROCHURE / ITINERARY / PROPERTY_DOC / UPLOAD). It only needs a catalog item
selected in the flow session. Resolving the reel *seeds that selection*, and the
agency's existing flow does the rest. This is what keeps the feature free of
hardcoded behaviour.

**Rule and mapping compose, they do not merge.** The rule decides *whether to
respond* (keywords, which posts, dedupe, public reply text — all already on
`InstagramAutomation`). The mapping decides *what the reel is about*. A rule with
no mapped reel behaves exactly as today; a mapped reel with no matching rule does
nothing.

## The bug this sits on top of

Travel-bot's comment rules have never fired. marketing-os dispatches the raw Meta
shape (`data: change.value`, nested `media.id`, no `accountId`) while
`instagramAutomationService.processCommentEvent` reads flat `event.accountId` /
`event.mediaId` and throws `INVALID_INSTAGRAM_COMMENT_EVENT` on every real
comment. The throw is swallowed by the catch in `bot/src/webhook.js`. Two rule
stacks shipped six weeks apart against payload shapes that never matched; the
live engine is marketing-os's.

We consolidate on travel-bot: marketing-os sends the flat event it already builds
for its own engine, and its engine is disabled for travel-bot tenants.

## Safety

Fixing the pipe means every stale rule an agency ever saved starts firing at
once, at real commenters. So:

- A per-agency `instagramCommentAutomationEnabled` flag, **defaulted off**.
  Existing rules stay dormant until the agency reviews and enables them.
- Resolution failure never throws into the webhook path: an unmapped reel falls
  back to the rule's configured reply, exactly as today.
- The existing `duplicatePolicy` (USER_PER_POST / COMMENT / USER_24H) continues
  to guard against repeat DMs.
- With the flag off, behaviour is byte-identical to today.

## Verification

Prod evidence has not been gathered. Before enabling for any agency, confirm on
the box: `INVALID_INSTAGRAM_COMMENT_EVENT` present in travel-bot's pm2 logs
(proves the dead path), and `[IG Automation] Sent DM to commenter` present in
marketing-os's (proves which engine is live). If neither appears, no comment
automation is running at all and the picture changes.
