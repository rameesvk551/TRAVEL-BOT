# Click-to-WhatsApp Ad Attribution — Design

**Date:** 2026-06-29
**Goal:** When an agency runs several Meta ads that all point to the *same* WhatsApp
number, the CRM must show which ad each lead came from — captured automatically, with
a readable ad name resolved from Meta.

## Problem

All four ads share one WhatsApp number, so the phone number cannot distinguish them.
Meta solves this: every Click-to-WhatsApp (CTWA) ad click attaches a `referral` object
to the first inbound WhatsApp message. The `referral.source_id` is the **ad ID** — a
unique fingerprint per ad — plus `headline`, `body`, `source_url`, and `ctwa_clid`.

## What already exists

- `Lead` model already has the columns: `adId`, `adHeadline`, `adSourceUrl`,
  `metaAdId`, `metaAdName`, `metaCampaignId`, `metaCampaignName`, `metaAdSetId/Name`,
  `metaPlatform`, `metaRawPayload` (JSONB). No migration needed.
- The bot parses the raw WhatsApp Cloud webhook directly in `bot/src/webhook.js`
  (`processMessage` → `extractIncoming`), so `msg.referral` is available.
- `metaAdsService` + `marketingOsPartnerService` already resolve Meta campaigns/forms
  via the Marketing-OS partner API and cache them in `MetaAdCampaign`.

## Approach: capture-instantly, enrich-async (chosen)

1. **Capture** (bot): on every inbound message read `msg.referral`. If it carries a
   `source_id`, hand it to the backend attribution service.
2. **Stamp** (backend `adReferralService`): write ad fields onto the customer's current
   lead — **first touch wins**, never overwrite an already-attributed lead. The ad
   headline becomes the initial display label so attribution is *never blank*.
3. **Enrich** (backend, async, best-effort): resolve `source_id` (ad ID) → real
   Ads-Manager ad name + ad set + campaign via the partner API. If the partner API has
   no ad-level endpoint (it currently exposes only campaign-level), the call fails
   softly and the headline label stays. Resolved names are cached on the lead and in
   `MetaAdCampaign`.

This guarantees attribution today (headline) and upgrades to the exact ad name when
Meta resolution is available — the "best long-term" behaviour the user asked for.

## Components

### Backend
- `services/adReferralService.ts` (new)
  - `applyCtwaReferral(agencyId, customerId, referral, session?)` — find latest lead for
    the customer, stamp ad fields if not already attributed, mark source as
    `facebook_ad`/`instagram_ad`, store raw referral in `metaRawPayload.ctwaReferral`,
    then fire-and-forget `enrichAdReference`.
  - `enrichAdReference(agencyId, leadId, adId)` — best-effort name resolution + cache.
- `services/marketingOsPartnerService.ts` — add `getTenantMetaAd(tenantToken, adId)`.
- `services/metaAdsService.ts` — add `resolveAdReference(agencyId, adId)` (normalize +
  cache), tolerant of unsupported endpoint.
- `services/analyticsService.ts` + route — add `getLeadsByAd(agencyId, range)` grouping
  leads by `adId` with a readable name (`metaAdName || adHeadline`), count, campaign.

### Bot
- `webhook.js` — `extractIncoming` surfaces `referral`; `processMessage` calls
  `adReferralService.applyCtwaReferral` after `ensureLead`.

### Frontend
- `Leads.jsx` — "Source Ad" column / badge (`metaAdName || adHeadline`).
- Lead detail — "Came from ad" block: ad name, campaign, `fb.me` link.
- `Analytics.jsx` — "Leads by Ad" breakdown card.

## Edge cases
- Referral only on the first post-click message → stamp the freshly-ensured lead.
- Repeat customer clicking a new ad → most recent open lead gets the new attribution;
  historical leads keep theirs (first-touch per lead).
- No referral → unchanged organic behaviour.
- Enrichment failure → silent; headline label remains. Never blocks the reply.

## Out of scope (phase 2)
- Cost-per-lead per ad (needs insights join), ad-level spend sync, IG-vs-FB platform
  precision beyond `source_url` heuristic.
