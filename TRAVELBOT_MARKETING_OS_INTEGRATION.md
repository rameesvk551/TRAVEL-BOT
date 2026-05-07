# How TravelBot Uses Marketing OS

## 🎯 Quick Answer

**TravelBot** is a complete travel/hospitality platform. **Marketing OS** is NOT a full replacement - it acts as the **WhatsApp/Meta messaging provider layer** for TravelBot agencies.

Think of it like this:
- **TravelBot** = The hotel/travel company's complete system (bookings, customers, campaigns, etc.)
- **Marketing OS** = The WhatsApp/Meta proxy that connects TravelBot to Meta Cloud API

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      TRAVEL BOT                              │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Campaign & Marketing System                │   │
│  │                                                         │   │
│  │  • Campaign creation & scheduling                     │   │
│  │  • Audience segmentation                              │   │
│  │  • Message templates                                  │   │
│  │  • Broadcast management                               │   │
│  │  • Analytics & reporting                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                 │                             │
│                                 ▼                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │       WhatsApp Message Sending Service               │   │
│  │                                                         │   │
│  │  Checks: agency.whatsappProvider                     │   │
│  │                                                         │   │
│  │  IF provider === "MARKETING_OS"                       │   │
│  │     ├─► Send via Marketing OS API                    │   │
│  │     └─► managedOsTenantId = "xyz-agency-slug"       │   │
│  │                                                         │   │
│  │  ELSE                                                  │   │
│  │     ├─► Send directly to Meta (SELF_HOSTED)         │   │
│  │     └─► Send via Interakt (INTERAKT provider)       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                 │                             │
└─────────────────────────────────┼─────────────────────────────┘
                                  │
                                  │ (if Marketing OS provider)
                                  │
                    ┌─────────────▼──────────────┐
                    │     MARKETING OS            │
                    │                            │
                    │  • WhatsApp proxy          │
                    │  • Meta embedded signup    │
                    │  • Template management     │
                    │  • Flow management         │
                    │  • Instagram support       │
                    │  • Webhook routing         │
                    │  • Message tracking        │
                    └─────────────┬──────────────┘
                                  │
                                  │ (HTTP/REST)
                                  │
                    ┌─────────────▼──────────────┐
                    │   META CLOUD API           │
                    │   (WhatsApp Business)      │
                    │                            │
                    │  • Actually sends msgs     │
                    │  • Template approval       │
                    │  • Delivery status         │
                    └────────────────────────────┘
```

---

## 🔄 Message Flow: From Campaign to Delivery

### Step 1: TravelBot Admin Creates Campaign

```
TravelBot Dashboard
  ↓ Create Campaign
├─ Name: "Summer Promotions"
├─ Audience: Leads in India
├─ Channel: WhatsApp
├─ Template: "travel_promo"
├─ Schedule: Now
└─ Save to TravelBot DB
```

### Step 2: TravelBot Sends Campaign

```
TravelBot Backend
  ↓ campaignService.send()
  ├─ Load campaign
  ├─ Build audience (filter leads/customers)
  ├─ Create CampaignRecipient records (for tracking)
  ├─ Queue messages for sending
  └─ Start marketingSchedulerService
```

### Step 3: Check Which Provider to Use

```
marketingSchedulerService.processQueue()
  ↓ For each recipient:
  ├─ Get agency
  ├─ Check agency.whatsappProvider
  │
  ├─ IF provider === "MARKETING_OS"
  │  ├─ Get marketing_os_tenant_id from agency
  │  ├─ Call marketingOsPartnerService
  │  ├─ Send via Marketing OS API
  │  │   POST /api/v1/api/v1/messages
  │  │   Headers: x-api-key, x-tenant-id
  │  └─ Get message ID from Marketing OS
  │
  ├─ ELSE IF provider === "SELF_HOSTED"
  │  ├─ Send directly to Meta Cloud API
  │  └─ Get message ID from Meta
  │
  └─ ELSE IF provider === "INTERAKT"
     ├─ Send via Interakt proxy
     └─ Get message ID from Interakt
```

### Step 4: Track Delivery

```
TravelBot Webhooks (from Marketing OS or Meta)
  ↓ Message delivered/read/replied
  ├─ Update CampaignRecipient status
  ├─ Update contact conversation
  ├─ Trigger bot workflows (if reply)
  └─ Update analytics
```

---

## 🏢 Agency Model

Each agency in TravelBot has these WhatsApp settings:

```typescript
// Agency model
{
  id: "agency-123",
  name: "TravelCo Holidays",
  
  // WhatsApp Provider Choice
  whatsappProvider: "MARKETING_OS",  // or "SELF_HOSTED" or "INTERAKT"
  whatsappConnectionStatus: "CONNECTED",
  
  // Marketing OS Connection (if provider === "MARKETING_OS")
  marketingOsTenantId: "travelco-holidays-a1b2c3",
  whatsappChannelId: "mos_channel_123",
  whatsappBusinessAccountId: "1234567890",
  whatsappPhoneNumberId: "9876543210",
  whatsappDisplayPhoneNumber: "+91 90000 00000",
  whatsappNumber: "+919000000000",
  
  // If provider === "SELF_HOSTED"
  // (direct Meta Cloud API credentials)
  metaBusinessAccountId: "...",
  metaAccessToken: "...",
  metaPhoneNumberId: "...",
  
  // Connection history
  whatsappConnectionError: null,
  whatsappLastSyncedAt: "2026-05-06T10:30:00Z",
}
```

---

## 🔗 Integration Endpoints

### 1. WhatsApp Connection (Onboarding)

```bash
# TravelBot Admin clicks "Connect to WhatsApp"

POST /api/agencies/me/whatsapp-connection/connect
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "onboardingMode": "standard"
}

# TravelBot Backend:
# 1. Creates/finds Marketing OS tenant for agency
# 2. Gets tenant token from Marketing OS
# 3. Fetches Meta embedded signup config from Marketing OS
# 4. Returns encrypted session to frontend

Response:
{
  "success": true,
  "data": {
    "provider": "MARKETING_OS",
    "status": "PENDING",
    "marketingOsTenantId": "travelco-holidays-xyz",
    "embeddedSignup": {
      "appId": "2324108781440313",
      "configId": "928972376649008",
      "sessionToken": "signed-token"
    }
  }
}

# Frontend:
# Opens Meta embedded signup popup with appId & configId
# User logs in to Meta/Facebook
# Selects WABA and phone number
# Approves permissions
# Meta redirects with authorization code
```

### 2. Complete WhatsApp Connection

```bash
POST /api/agencies/me/whatsapp-connection/complete
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "sessionToken": "signed-token",
  "authorizationCode": "code-from-meta"
}

# TravelBot Backend:
# 1. Validates session token
# 2. Sends completion payload to Marketing OS
# 3. Marketing OS completes signup against Meta
# 4. Saves WhatsApp metadata in agency record
# 5. Agency now ready to send messages

Response:
{
  "success": true,
  "whatsappNumber": "+919876543210",
  "displayNumber": "+91 98765 43210",
  "businessAccountId": "1234567890",
  "phoneNumberId": "9876543210"
}
```

### 3. Marketing OS Callback (After Signup)

```bash
# Marketing OS calls TravelBot after signup

POST /api/agencies/whatsapp/marketing-os/callback
X-Marketing-OS-Secret: webhook_secret

{
  "agencyId": "agency-123",
  "status": "CONNECTED",
  "whatsappNumber": "+919876543210",
  "displayPhoneNumber": "+91 98765 43210",
  "businessAccountId": "1234567890",
  "phoneNumberId": "9876543210",
  "channelId": "mos_channel_123",
  "errorMessage": ""
}

# TravelBot:
# 1. Verifies webhook secret
# 2. Updates agency record
# 3. Marks agency as ready
```

### 4. Send Message

```bash
# TravelBot sends campaign message

POST /api/campaigns/:campaignId/send
Authorization: Bearer jwt_token

# Behind the scenes:
# For each recipient in campaign:

if (agency.whatsappProvider === "MARKETING_OS") {
  // Send via Marketing OS
  POST https://marketing-os-api.com/api/v1/api/v1/messages
  Headers:
    x-api-key: partner_api_key
    x-tenant-id: travelco-holidays-xyz
  Body:
    {
      "phoneNumber": "+919876543210",
      "messageType": "template",
      "templateName": "travel_promo",
      "language": "en",
      "parameters": ["John", "50% off"]
    }
} else {
  // Send directly to Meta
  POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
  Headers:
    Authorization: Bearer metaAccessToken
  Body:
    {...}
}
```

### 5. Receive Message Status (Webhook)

```bash
# Meta or Marketing OS sends delivery status to TravelBot

POST /api/whatsapp/webhook
X-Signature: hmac_signature

{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "statuses": [
              {
                "id": "wamid.123456",
                "status": "delivered",  # sent, delivered, read, failed
                "timestamp": "1234567890",
                "recipient_id": "919876543210",
                "errors": []
              }
            ]
          }
        }
      ]
    }
  ]
}

# TravelBot:
# 1. Verifies webhook signature
# 2. Updates CampaignRecipient status
# 3. Updates conversation
# 4. Triggers follow-ups if needed
```

---

## 📋 What TravelBot Owns

| Component | Owned By | Notes |
|-----------|----------|-------|
| **Campaigns** | TravelBot | Full management, scheduling, automation |
| **Audience/Contacts** | TravelBot | Customer database, segmentation |
| **Templates** | Shared | TravelBot creates, Marketing OS syncs with Meta |
| **Message Sending** | Marketing OS (proxy) | TravelBot routes through Marketing OS |
| **Delivery Tracking** | TravelBot | Updates from webhooks |
| **Analytics** | TravelBot | Dashboard reports |
| **User Management** | TravelBot | Agencies, agents, permissions |
| **WhatsApp Setup** | Marketing OS | Embedded signup, onboarding |
| **Meta Integration** | Marketing OS | Cloud API proxy |

---

## 🔐 Security

### API Authentication

```
TravelBot → Marketing OS

Header: x-api-key: mk_live_[partnerApiKey]
Header: x-tenant-id: travelco-holidays-xyz

Marketing OS validates:
1. API key exists and isn't expired
2. API key belongs to TravelBot partner
3. Tenant belongs to this partner
4. Request is for correct tenant
```

### Webhook Verification

```
Marketing OS → TravelBot

Header: x-signature: hmac_sha256(payload, webhookSecret)

TravelBot validates:
1. X-Signature header present
2. Signature matches computed HMAC
3. Payload is genuine from Marketing OS
```

---

## 🚀 What's Implemented

### ✅ What Works Now

1. **Agency WhatsApp Setup**
   - Agencies can connect WhatsApp through TravelBot UI
   - Meta embedded signup flow
   - Automatic tenant creation in Marketing OS

2. **Message Sending**
   - TravelBot campaigns send via Marketing OS
   - Text messages, templates, media, interactive
   - Instagram messages

3. **Delivery Tracking**
   - Message status updates (sent, delivered, read, failed)
   - Webhook integration

4. **Template Management**
   - TravelBot creates templates
   - Marketing OS syncs with Meta
   - Template approval tracking

5. **Flows & Automation**
   - WhatsApp flows support
   - Business automation rules

### ⚠️ Partial Support

- **Analytics** - Basic stats exist, full analytics API coming
- **Campaigns** - Campaign creation works, advanced features planned
- **Contacts** - Basic contact management, advanced segmentation planned

### ❌ Not Yet Implemented

- **SDKs** for TravelBot-to-Marketing OS integration
- **GraphQL API** for complex queries
- **Advanced Reporting** beyond basic stats
- **A/B Testing** for campaigns

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAVELBOT DATABASE                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Agencies          │ Campaigns    │ CampaignRecipient  │   │
│  ├──────────────────┼──────────────┼────────────────────┤   │
│  │ id               │ id           │ id                 │   │
│  │ name             │ name         │ campaignId         │   │
│  │ whatsappProvider │ agencyId     │ customerId         │   │
│  │ marketingOsTenant│ template     │ status (PENDING)   │   │
│  │ Timing           │ scheduledAt  │ sentAt, readAt     │   │
│  │ whatsappNumber   │ audienceId   │ deliveredAt        │   │
│  │ phoneNumberId    │ status       │ failedAt           │   │
│  └──────────────────┴──────────────┴────────────────────┘   │
│                         ▲                                     │
│                         │ Read                                │
│                         │ Write Status Updates                │
└─────────────────────────┼─────────────────────────────────────┘
                          │
                ┌─────────▼──────────┐
                │                    │
        ┌───────▼────────┐    ┌──────▼──────────┐
        │ MARKETING OS    │    │ META CLOUD API  │
        │                │    │                 │
        │ Tenant-1       │    │ • Send message  │
        │ ├─ whatsapp    │    │ • Get templates │
        │ ├─ templates   │    │ • Track status  │
        │ ├─ flows       │    │ • Approvals     │
        │ ├─ webhooks    │    │ • Media upload  │
        │ └─ messages    │    │ • Insights      │
        └────────────────┘    └─────────────────┘
```

---

## 🎯 How Campaigns Work

### Campaign Lifecycle in TravelBot

```
1. CREATE CAMPAIGN
   Admin → TravelBot Dashboard
   ├─ Name, channel, audience, template
   └─ Save to campaigns table

2. SCHEDULE/QUEUE
   Scheduler checks every minute
   ├─ If scheduled time reached
   ├─ Get audience (filter customers/leads)
   ├─ Create CampaignRecipient for each
   └─ Queue for sending

3. SEND MESSAGES
   marketingSchedulerService processes queue
   ├─ Get agency
   ├─ Check agency.whatsappProvider
   ├─ If MARKETING_OS → send via Marketing OS
   ├─ If SELF_HOSTED → send via Meta directly
   └─ Save messageId for tracking

4. TRACK DELIVERY
   Webhooks update status
   ├─ Message sent → CampaignRecipient.sentAt
   ├─ Message delivered → CampaignRecipient.status = DELIVERED
   ├─ Message read → CampaignRecipient.readAt
   └─ Message failed → CampaignRecipient.failedReason

5. ANALYTICS
   Dashboard shows
   ├─ Total sent
   ├─ Delivery rate %
   ├─ Read rate %
   ├─ Reply rate %
   └─ Cost per message
```

---

## 📞 Integration Points

### Inbound Webhooks (Marketing OS → TravelBot)

```typescript
// WhatsApp Message Status
POST /api/whatsapp/webhook
├─ message.sent
├─ message.delivered
├─ message.read
├─ message.failed
└─ message.replied

// WhatsApp Connection Callback
POST /api/agencies/whatsapp/marketing-os/callback
└─ Status: CONNECTED/FAILED

// Incoming Customer Messages
POST /api/whatsapp/webhook
├─ Message content
├─ Customer info
├─ Media (if any)
└─ Trigger bot workflows
```

### Outbound API Calls (TravelBot → Marketing OS)

```typescript
// Send Message
POST /api/v1/api/v1/messages
├─ Template
├─ Text
├─ Media
└─ Interactive

// Template Management
GET/POST/PUT/DELETE /api/v1/api/v1/templates
├─ Create
├─ Update
├─ Submit for approval
└─ Delete

// Get WhatsApp Config
GET /api/v1/api/v1/whatsapp/settings
├─ Templates list
├─ Connection status
└─ Business account info

// Flow Management
GET/POST/PUT/DELETE /api/v1/api/v1/whatsapp/flows
├─ Create flow
├─ Update flow
├─ Publish flow
└─ Delete flow
```

---

## 🎓 Summary

**TravelBot uses Marketing OS like this:**

1. **For Onboarding:** TravelBot agencies use Marketing OS embedded signup to connect WhatsApp
2. **For Sending:** TravelBot campaigns send messages through Marketing OS API (not direct Meta)
3. **For Tracking:** TravelBot receives webhooks from Marketing OS about delivery status
4. **For Templates:** TravelBot creates templates, Marketing OS manages them with Meta
5. **For Flows:** TravelBot manages WhatsApp flows through Marketing OS

**Why?**
- Agencies don't need Meta developer accounts
- TravelBot doesn't need to manage Meta API complexity
- Marketing OS handles compliance, webhooks, template approvals
- TravelBot can easily support multiple providers (Marketing OS, Interakt, Direct Meta)

**Key Difference:**
- TravelBot = Marketing/Campaign platform
- Marketing OS = WhatsApp provider/proxy layer

---

## 🚀 Next Steps

If you want to expand TravelBot + Marketing OS integration:

1. **Add Campaign API to Marketing OS** - Let partners create campaigns directly
2. **Add Billing/Invoicing** - Track costs per agency
3. **Add Advanced Analytics** - Engagement metrics, attribution
4. **Add Contact Sync** - Two-way sync of customer data
5. **Add Multi-channel** - SMS, Email alongside WhatsApp

---

**Version:** 1.0 | **Last Updated:** May 6, 2026

For technical details, see: [docs/whatsapp/marketing-os-integration.md](../docs/whatsapp/marketing-os-integration.md)
