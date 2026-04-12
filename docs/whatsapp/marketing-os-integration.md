# Marketing OS WhatsApp Integration

TravelBot can onboard agency WhatsApp channels through Marketing OS, which acts as the Meta provider partner.

## What was added

- A `Connect to WhatsApp` action in Settings.
- Agency-level WhatsApp connection metadata:
  - `whatsappProvider`
  - `whatsappConnectionStatus`
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
MARKETING_OS_CONNECT_URL_TEMPLATE=https://partner.marketingos.example/whatsapp/connect?agencyId={{agencyId}}&agencyName={{agencyName}}&agencyEmail={{agencyEmail}}&agencyPhone={{agencyPhone}}&whatsappNumber={{whatsappNumber}}
MARKETING_OS_WEBHOOK_SECRET=replace_with_shared_secret_from_marketing_os
```

The connect URL template supports:

- `{{agencyId}}`
- `{{agencyName}}`
- `{{agencyEmail}}`
- `{{agencyPhone}}`
- `{{whatsappNumber}}`

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

TravelBot marks the agency as `PENDING` and returns the Marketing OS launch URL for the frontend to open.

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
2. Frontend opens the URL returned by `POST /connect`.
3. Agency completes embedded signup or partner onboarding in Marketing OS.
4. Marketing OS calls the callback endpoint with the final Meta IDs and approved WhatsApp number.
5. TravelBot starts using the connected number for routing and status display.

## Important note

If Marketing OS also proxies message sending, update `backend/src/services/whatsappService.ts` to send outbound messages through Marketing OS instead of direct Meta Cloud API for agencies whose `whatsappProvider === 'MARKETING_OS'`.
