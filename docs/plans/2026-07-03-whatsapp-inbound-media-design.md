# WhatsApp inbound media in the CRM inbox

**Date:** 2026-07-03
**Goal:** Render received WhatsApp media (photo, voice/audio, video, document, sticker) inline in the agent inbox instead of a `[Media message]` placeholder. Cover both direct Cloud-API channels and Marketing-OS-routed channels.

## Decisions

- **Serving model:** on-demand proxy. Store only the WhatsApp `mediaId` + `mimeType` on each message; the backend streams the bytes from Meta (or via MOS) when an agent opens the chat. No file storage. Caveat: media that ages off Meta's servers may stop loading.
- **Channels:** direct Cloud API **and** Marketing-OS. MOS needs a new inbound-media retrieval endpoint.
- **Scope:** inbound display of all media types. Outbound media send is unchanged.
- **Access control:** the media proxy reuses `assertThreadAccess` so an agent can only fetch media for a conversation they may view.

## Current state (why this is not a frontend tweak)

- The bot never downloads inbound media. `extractIncoming` (`bot/src/webhook.js`) captures a `mediaId` for image/document/audio only, and the row is saved with `content = "[Media Received: <id>]"`. No `mediaUrl`/`mediaId` column exists on `Message`.
- The inbox bubble (`frontend/src/pages/WhatsAppInbox.jsx`) renders `message.content` text only.
- MOS exposes outbound media send (`POST /messages/media`) but no inbound media retrieval.

## Changes

### 1. Data model — `backend/src/models/Message.ts`
Add nullable columns (additive, safe for `sequelize.sync`):
- `mediaId` STRING — WhatsApp media id.
- `mimeType` STRING — e.g. `image/jpeg`, `audio/ogg`.
- `mediaFilename` STRING — for documents.
Extend `type` ENUM with `VIDEO`, `STICKER`, `VOICE` (or reuse `AUDIO` for voice).

### 2. Bot capture — `bot/src/webhook.js`
- `extractIncoming`: capture `mediaId`, `mimeType`, `filename`, and the `voice` flag for **all** media types (image, audio, voice, video, document, sticker). Fix `normalizeInboundType` so video/sticker/voice no longer collapse to TEXT.
- On `Message.create`, persist `mediaId`, `mimeType`, `mediaFilename`, and set `content` to the caption (or empty) — no more placeholder string.
- Same for the coexistence/history path (`saveCoexistenceMessage`/`extractMessageContent`).

### 3. Backend proxy — `messageService` + `routes/messages.ts` + controller
`GET /api/messages/:messageId/media`:
- Load message → customer → channel (`provider`, `whatsappAccessToken`, `marketingOsTenantId`, `whatsappPhoneNumberId`).
- Enforce `assertThreadAccess`.
- **Direct Cloud API:** `GET graph.facebook.com/v21.0/{mediaId}` with channel token (or `WHATSAPP_CLOUD_API_TOKEN`) → temporary `url` → download with Bearer token → stream to client with `Content-Type: mimeType`, `Cache-Control: private, max-age=86400`.
- **Marketing-OS channel:** `marketingOsPartnerService.getTenantWhatsAppMedia(tenantToken, mediaId)` → stream through.
- 404/410 with a clear code when media is gone.

### 4. travel-bot MOS client — `marketingOsPartnerService.ts`
Add `getTenantWhatsAppMedia(tenantToken, mediaId)` → `GET /whatsapp/media/:mediaId` with `responseType: 'stream'`.

### 5. Marketing-OS — `marketing-os-server`
Add `GET /messages/media/:mediaId` (tenant-scoped, same auth as `POST /messages/media`) in `whatsapp.routes.ts` + a `WebhookController.getMedia` (or a dedicated MediaController) that resolves the tenant's WABA access token from `WhatsappBusinessConfig`, calls Graph for the media url, downloads, and streams the binary back.

### 6. Frontend — `WhatsAppInbox.jsx` (and `ChatPanel.jsx`)
Render by `message.type`/`mimeType`, `src` = `/api/messages/:id/media` (through the api client so auth cookies apply):
- image/sticker → `<img>` (click to open full).
- audio/voice → `<audio controls>`.
- video → `<video controls>`.
- document → download link with filename + icon.
- caption (if any) shown under the media.
- Thread list preview: show `📷 Photo`, `🎤 Voice message`, `🎬 Video`, `📄 <filename>` instead of empty text.

## Staging
1. **Slice A (self-contained, ship first):** model columns + bot capture + backend proxy (direct Cloud API branch) + frontend rendering. Delivers media for direct-Cloud agencies.
2. **Slice B:** MOS `GET media` endpoint + `getTenantWhatsAppMedia` + backend MOS branch. Delivers media for MOS agencies.

## Testing / verification
- Bot unit: `extractIncoming` returns correct `mediaId`/`mimeType`/`type` for each Meta payload shape.
- Backend: media route 200s with correct content-type for a direct channel (mock Graph), 403s for a non-owner agent, 404s for missing media.
- Manual: send a photo + voice note from a real customer number to a direct-Cloud agency, confirm both render in the inbox.
