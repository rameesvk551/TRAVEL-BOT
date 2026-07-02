# Public Embed API — Catalog + Lead Capture

Date: 2026-06-17

## Goal

Let agency customers expose their catalog (packages, properties, services, visas,
cruises) on **their own websites** and capture leads back into TravelBot, through
a public API secured by per-agency **publishable keys**. The user provides only
the API; customers build any site (browser or server, any stack).

## Security framing

A public embed API is readable by design — the catalog is meant to be shown. So
"100% security" means:

- **Tenant isolation** — a key can only ever read/write its own agency's data.
- **No privilege escalation** — the public surface has zero path into agent/admin
  actions (separate middleware, separate controllers, read-only catalog queries).
- **Least privilege** — keys carry explicit scopes (`catalog:read`, `leads:write`).
- **Abuse resistance** — writes are gated by honeypot + dedup + stacked per-key
  rate limits. (No CAPTCHA, by product choice.)
- **Revocability + visibility** — instant kill switch, usage metering per key.

## Key model

`AgencyApiKey` table. Raw key format: `pk_live_<keyId>_<secret>`.

- `keyId` (16 hex) — public, indexed lookup component.
- `secret` (~36 bytes base64url) — entropy.
- Only `keyHash` (SHA-256 of the full key) is stored; the raw key is shown **once**.
- Lookup: parse `keyId` → load row → constant-time compare SHA-256 → load agency.
- Fields: `scopes`, `allowedOrigins`, `isActive`, `revokedAt`, `lastUsedAt`,
  `lastUsedIp`, `requestCount`, `label`, `createdByAgentId`.

## Surfaces

### Public (publishable key)  `/api/public/v1/*`
- `GET  /catalog` — all active resources at once.
- `GET  /catalog/:resource` — one of packages|properties|services|visas|cruises.
- `GET  /catalog/:resource/:id` — single item, scoped to the key's agency.
- `POST /leads` — create a website lead.
- Guarded by `authenticatePublicKey({ scope })`. Permissive router-level CORS
  (reflect origin) since it's embedded on arbitrary domains; CORS is **not** the
  security boundary. Optional per-key `allowedOrigins` lock for browser keys.

### Dashboard (JWT + ADMIN)  `/api/api-keys`
- `GET /` list keys (never the raw value/hash).
- `POST /` mint a key (returns raw key **once**).
- `DELETE /:id` revoke.

## Write-path protections (lead submit)
1. **Honeypot** — hidden `company` / `website_url` fields; if filled, return 202
   and create nothing.
2. **Dedup/idempotency** — identical website lead (same agency + phone + item)
   within 5 min returns the existing lead instead of duplicating.
3. **Stacked rate limits** — 5/min burst + 30/hour, keyed by API key (or IP).
4. **Validation** — zod schema; phone normalized/validated in `leadService`.
5. **Reuse** — goes through `leadService.createLead` (agent routing, notifications,
   customer find-or-create) for behavioral parity with other lead sources.

## Reads
Active items only (`isActive: true`), scoped by `agencyId`, capped at 200,
projected through per-type sanitizers that expose only display fields.

## Files
- `models/AgencyApiKey.ts` (+ registration/associations in `models/index.ts`)
- `services/apiKeyService.ts` — mint/verify/revoke/meter
- `middleware/authenticatePublicKey.ts` — key auth + scope + origin + metering
- `middleware/rateLimiter.ts` — `publicReadLimiter`, `publicWrite{Burst,Hourly}Limiter`
- `controllers/publicApiController.ts` — catalog + lead submit
- `routes/publicApi.ts` — `/api/public/v1` router (own CORS)
- `controllers/apiKeyController.ts` + `routes/apiKeys.ts` — key management
- `app.ts` — CORS branch (public API skips the restrictive policy)
- `services/schemaBootstrap.ts` — `agency_api_keys` production table

## Notes / future
- The legacy `/public/:agencyKey/*` (id/subdomain/domain-keyed) endpoints remain
  for the built-in website builder; the new keyed API is the embeddable one.
- Possible later: optional Turnstile per key, signed server-side `sk_` keys,
  webhook on new lead, per-key catalog field allowlists.
