# Marketing OS WhatsApp Integration

TravelBot can onboard agency WhatsApp channels through Marketing OS, which acts as the Meta provider partner.

The production flow no longer depends on a placeholder redirect URL. TravelBot now talks to Marketing OS server-to-server, creates or reuses a Marketing OS tenant for the agency, fetches the Meta embedded-signup config, and completes the signup after the Meta popup returns an authorization code.

## What was added

- A `Connect to WhatsApp` action in Settings.
- Agency-level WhatsApp connection metadata:
  - `whatsappProvider`
  - `whatsappConnectionStatus`
  - `marketingOsTenantId`
  - `whatsappChannelId`
  - `whatsappBusinessAccountId`
  - `whatsappPhoneNumberId`
  - `whatsappDisplayPhoneNumber`
  - `whatsappConnectionError`
  - `whatsappLastSyncedAt`
- Backend endpoints for:
  - fetching connection status
  - creating a Marketing OS connect session
  - receiving the Marketing OS callback after onboarding

## Environment variables

Add these in `backend/.env` or project `.env`:

```env
MARKETING_OS_PARTNER_API_BASE_URL=http://127.0.0.1:8000/api/v1
MARKETING_OS_PARTNER_API_KEY=mk_live_partner_key_from_marketing_os
MARKETING_OS_APP_URL=https://app.wayon.in
MARKETING_OS_SESSION_SECRET=replace_with_long_random_session_secret
MARKETING_OS_CONNECT_URL_TEMPLATE=
MARKETING_OS_WEBHOOK_SECRET=replace_with_shared_secret_from_marketing_os
```

## Backend endpoints

### Get current connection state

`GET /api/agencies/me/whatsapp-connection`

Returns:

```json
{
  "success": true,
  "data": {
    "provider": "MARKETING_OS",
    "status": "PENDING",
    "channelId": null,
    "businessAccountId": null,
    "phoneNumberId": null,
    "displayPhoneNumber": "+919999999999",
    "errorMessage": null,
    "lastSyncedAt": null,
    "connectUrl": "https://partner.marketingos.example/...",
    "canLaunchEmbeddedSignup": true
  }
}
```

### Start onboarding from TravelBot

`POST /api/agencies/me/whatsapp-connection/connect`

TravelBot now:

1. upserts a Marketing OS tenant for the agency
2. fetches a tenant JWT from Marketing OS
3. fetches Meta embedded-signup config from Marketing OS
4. returns an encrypted short-lived session token and Meta app/config IDs to the frontend

Example response:

```json
{
  "success": true,
  "data": {
    "provider": "MARKETING_OS",
    "status": "PENDING",
    "marketingOsTenantId": "travelco-holidays-a1b2c3d4",
    "embeddedSignup": {
      "appId": "2324108781440313",
      "configId": "928972376649008",
      "sessionToken": "signed-short-lived-session"
    }
  }
}
```

### Complete onboarding from TravelBot

`POST /api/agencies/me/whatsapp-connection/complete`

Payload:

```json
{
  "code": "meta_authorization_code",
  "sessionToken": "signed-short-lived-session"
}
```

TravelBot sends this to Marketing OS using the partner-created tenant session, then stores the returned connection details on the agency record.

### Marketing OS callback

`POST /api/agencies/whatsapp/marketing-os/callback`

Headers:

- `x-marketing-os-secret: <MARKETING_OS_WEBHOOK_SECRET>`

Payload:

```json
{
  "agencyId": "agency-uuid",
  "status": "CONNECTED",
  "whatsappNumber": "+919999999999",
  "displayPhoneNumber": "+91 99999 99999",
  "businessAccountId": "1234567890",
  "phoneNumberId": "9876543210",
  "channelId": "mos_channel_123",
  "errorMessage": ""
}
```

When `status` is `CONNECTED`, TravelBot stores the provider channel info and updates the agency `whatsappNumber`, which keeps the existing webhook routing working.

## Suggested Marketing OS flow

1. Admin clicks `Connect to WhatsApp` in TravelBot Settings.
2. TravelBot backend creates or reuses the agency tenant in Marketing OS.
3. TravelBot frontend launches Meta embedded signup with the config returned by TravelBot.
4. TravelBot backend completes the signup against Marketing OS using the short-lived signed session token.
5. TravelBot stores the approved WhatsApp number and Meta IDs for that agency.

## Important note

If Marketing OS also proxies message sending in your final architecture, update `backend/src/services/whatsappService.ts` to send outbound messages through Marketing OS instead of direct Meta Cloud API for agencies whose `whatsappProvider === 'MARKETING_OS'`.
