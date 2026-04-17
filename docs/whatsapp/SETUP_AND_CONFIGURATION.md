# WhatsApp Travel Bot Setup & Configuration Guide

## 📋 Quick Start Checklist

- [ ] WhatsApp Business Account created
- [ ] Phone number verified and registered
- [ ] Business App configured with Meta
- [ ] Access token generated and secured
- [ ] Webhook URL configured in Meta dashboard
- [ ] WhatsApp Display Catalog set up (optional)
- [ ] WhatsApp Flows configured (optional but recommended)
- [ ] Backend database initialized
- [ ] Environment variables configured
- [ ] Bot deployed and webhook receiving messages
- [ ] Agents added and configured with phone numbers
- [ ] Test lead created and processed end-to-end

---

## 🏗️ Environment Variables

### Required for Webhook & WhatsApp API

```env
# Meta WhatsApp Business Account
WEBHOOK_VERIFY_TOKEN=your-random-verify-token-12345
WEBHOOK_APP_SECRET=your-app-secret-from-meta-dashboard
WHATSAPP_ACCESS_TOKEN=your-access-token-from-meta
WHATSAPP_BUSINESS_ACCOUNT_ID=1234567890
WHATSAPP_PHONE_NUMBER_ID=1234567890123
WHATSAPP_DISPLAY_PHONE_NUMBER=+91-9876543210

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/travel_bot_db

# Bot Configuration
BOT_PORT=3001
WEBHOOK_URL=https://your-domain.com/webhook

# Optional: WhatsApp Flows (for interactive forms)
WHATSAPP_TRIP_FLOW_ID=your-flow-id-from-meta-dashboard
WHATSAPP_TRIP_ENQUIRY_FLOW_ID=your-enquiry-flow-id-from-meta
WHATSAPP_TRIP_FLOW_FIRST_SCREEN_ID=PACKAGE_SELECTOR
WHATSAPP_TRIP_FLOW_ENQUIRY_FIRST_SCREEN_ID=ENQUIRY_FORM

# Optional: WhatsApp Catalog
WHATSAPP_CATALOG_ID=your-catalog-id

# Media & Images
BASE_URL=https://your-domain.com
CLOUDINARY_CLOUD_NAME=your-cloudinary-account
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Step-by-Step Environment Setup

1. **Get WhatsApp Access Token:**
   - Go to Meta Business Manager → Apps → Your App
   - Navigate to Messenger Settings
   - Generate Access Token with `whatsapp_business_messaging` scope
   - Save securely (never commit to git)

2. **Get Phone Number ID:**
   - Go to WhatsApp API Dashboard
   - Select your phone number
   - Copy the Phone Number ID from settings

3. **Get Webhook Verify Token:**
   ```bash
   # Generate a random token
   openssl rand -hex 32
   ```
   - Use this token to verify webhook requests

4. **Copy to `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

---

## 🗄️ Database Setup

### 1. Initialize Database Connection

```bash
cd backend
npm run migrate
```

This creates tables:
- `customers` - User data
- `leads` - Sales pipeline
- `agents` - Team members
- `packages` - Travel packages
- `bot_sessions` - Conversation state
- `messages` - Message history
- `bookings` - Confirmed bookings

### 2. Register Your Agency

```sql
INSERT INTO agencies (id, name, email, phone, whatsapp_number, whatsapp_phone_number_id, whatsapp_business_account_id, whatsapp_access_token, is_active)
VALUES (
  gen_random_uuid(),
  'XYZ Travels',
  'admin@xyztravels.com',
  '+91-9876543210',
  '+91-9876543210',
  '1234567890123',
  '1234567890',
  'your-access-token',
  true
);
```

### 3. Add Your Agents

```sql
INSERT INTO agents (id, agency_id, name, email, phone, created_at)
VALUES (
  gen_random_uuid(),
  'agency-uuid',
  'Ramesh Kumar',
  'ramesh@xyztravels.com',
  '+91-8765432109', -- Agent's WhatsApp number
  NOW()
);
```

### 4. Create Sample Packages

```sql
INSERT INTO packages (
  id, agency_id, name, category, summary, description,
  destinations, duration, base_price, image_url, 
  inclusions, itinerary, is_active, created_at
)
VALUES (
  gen_random_uuid(),
  'agency-uuid',
  'Bali Adventure',
  'INTERNATIONAL',
  'Experience the island magic of Bali',
  'Full description...',
  ARRAY['Bali', 'Ubud', 'Seminyak'],
  '5 Days / 4 Nights',
  2500000, -- in paise (₹25,000)
  'https://your-image-url.jpg',
  ARRAY['Flights', 'Hotel', 'Tours', 'Meals'],
  '[{"day": 1, "title": "Arrival"}, ...]'::json,
  true,
  NOW()
);
```

---

## 🔐 Webhook Configuration

### 1. Register Webhook URL in Meta Dashboard

- Go to WhatsApp API Dashboard
- Select your app
- Go to Webhook Settings
- Add webhook URL: `https://your-domain.com/webhook`
- Enter Verify Token (same as `WEBHOOK_VERIFY_TOKEN` in `.env`)
- Subscribe to: `messages`, `message_template_status_update`

### 2. Test Webhook Connection

```bash
# Meta will send a verification request
# Server should respond with 200 and the challenge

curl -X GET "https://your-domain.com/webhook?hub.mode=subscribe&hub.challenge=test123&hub.verify_token=your-token"
```

### 3. Enable Message Delivery Confirmation

In Meta Dashboard → Settings:
- ✅ Webhooks should receive:
  - **messages** - Incoming WhatsApp messages
  - **message_status** - Delivery/read receipts
  - **message_template_status_update** - Template approval status

---

## 📱 WhatsApp Flows Setup (Optional)

WhatsApp Flows allow interactive forms for better UX. If not configured, bot falls back to chat-based collection.

### 1. Create Package Selector Flow

**Flow JSON Structure:**
```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "PACKAGE_SELECTOR",
      "title": "Select a Package",
      "data": {
        "package_options": [
          {
            "id": "pkg-id-1",
            "title": "Bali Adventure",
            "description": "₹25,000 • 5 Days",
            "image": "base64-image-data"
          }
        ]
      },
      "layout": {
        "type": "carousel",
        "components": [...]
      }
    }
  }
}
```

### 2. Create Enquiry Form Flow

**Form Fields:**
```json
{
  "id": "ENQUIRY_FORM",
  "title": "Quick Enquiry",
  "fields": [
    {
      "name": "name",
      "label": "Your Name",
      "required": true,
      "type": "text",
      "min_length": 2,
      "max_length": 100
    },
    {
      "name": "travel_date",
      "label": "Travel Date or Month",
      "required": true,
      "type": "text"
    },
    {
      "name": "travellers",
      "label": "Number of People",
      "required": true,
      "type": "number",
      "min": 1,
      "max": 50
    },
    {
      "name": "budget",
      "label": "Budget per Person (₹)",
      "required": true,
      "type": "text"
    },
    {
      "name": "notes",
      "label": "Any special requests?",
      "required": false,
      "type": "textarea"
    }
  ]
}
```

### 3. Deploy Flow to Meta

- Create flow in Meta Flow Builder
- Get Flow ID and Screen IDs
- Add to `.env`:
  ```env
  WHATSAPP_TRIP_FLOW_ID=flow-id-from-meta
  WHATSAPP_TRIP_ENQUIRY_FLOW_ID=enquiry-flow-id
  ```
- Restart bot service

---

## 🚀 Deployment

### 1. Production Environment

```bash
# Build backend
cd backend
npm run build

# Build bot
cd ../bot
npm install

# Start with process manager
pm2 start bot/src/index.js --name "travel-bot-webhook"
pm2 start backend/src/server.ts --name "travel-bot-api"

# Save PM2 config
pm2 save
```

### 2. Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Bot
COPY bot/package.json bot/package-lock.json ./bot/
WORKDIR /app/bot
RUN npm ci

# Backend
COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /app/backend
RUN npm ci && npm run build

EXPOSE 3000 3001

CMD ["node", "../bot/src/index.js"]
```

### 3. Nginx Reverse Proxy

```nginx
server {
  listen 443 ssl http2;
  server_name your-domain.com;

  location /webhook {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
  }
}
```

---

## 🧪 Testing the Complete Flow

### Manual Test via WhatsApp

Send message to your agency WhatsApp number:

```
User: "Hi"
↓
Bot: "Hi [Name] 👋 Welcome to XYZ Travels..."
    [Domestic] [International]

User: Clicks "Domestic"
↓
Bot: Shows list of domestic packages

User: Selects "Bali Adventure"
↓
Bot: Shows package details, price, highlights
    [Enquire Now] [Call Now]

User: Clicks "Enquire Now"
↓
Bot: Shows enquiry form (Flow or chat)
User: Fills Name, Date, People, Budget

↓
↓ Agent receives notification
Agent: "🔥 New Enquiry - Name: Ramees...
        [Call Now] [Mark as Contacted] [Mark as Booked]"

Agent: Clicks "Mark as Contacted"
↓
Lead Status: NEW → ENQUIRY → CONTACTED
Agent: "Lead updated to CONTACTED"
```

### Verify Database Changes

```sql
-- Check lead created
SELECT id, status, travel_dates, travellers, budget_per_person, assigned_agent_id
FROM leads
WHERE customer_id = 'cust-uuid'
ORDER BY created_at DESC;

-- Check message history
SELECT content, direction, timestamp
FROM messages
WHERE customer_id = 'cust-uuid'
ORDER BY timestamp DESC;

-- Check session state
SELECT current_step, collected_data
FROM bot_sessions
WHERE customer_id = 'cust-uuid'
ORDER BY updated_at DESC;
```

---

## 📊 Monitoring & Debugging

### View Real-time Logs

```bash
# Bot logs
pm2 logs travel-bot-webhook

# API logs
pm2 logs travel-bot-api

# With filtering
pm2 logs travel-bot-webhook | grep "ERROR"
```

### Check Webhook Deliveries

In Meta Business Dashboard:
- Go to App → Webhooks
- View Delivery Attempts
- Check Success/Failure rates
- Debug delivery failures

### Common Issues

#### Issue: Webhook not receiving messages
- ✅ Verify webhook URL is accessible from internet
- ✅ Check verify token matches in `.env`
- ✅ Check firewall/security group allows 443 traffic
- ✅ Restart webhook server after ENV changes

#### Issue: Agent not receiving notifications
- ✅ Check agent has phone number set in database
- ✅ Verify agent's WhatsApp number format (+91-... for India)
- ✅ Check lead.assigned_agent_id is not null
- ✅ Review API error logs for WhatsApp API errors

#### Issue: Flow not opening
- ✅ Check WHATSAPP_TRIP_FLOW_ID is set correctly
- ✅ Verify flow is published in Meta Flow Builder
- ✅ Check flow has been approved by Meta
- ✅ Bot should fallback to chat-based collection

#### Issue: Messages getting duplicated
- ✅ Check bot isn't processing same message twice
- ✅ Verify idempotency keys if using external APIs
- ✅ Check message deduplication in webhook handler

---

## 🔄 Regular Maintenance

### Daily
- Monitor webhook delivery success rate (target: > 99%)
- Check for agent response time
- Review lead conversion metrics

### Weekly
- Archive old/completed sessions
- Clean up failed webhook deliveries
- Review system health (CPU, memory, disk)

### Monthly
- Review and optimize database indexes
- Backup production database
- Audit security (access logs, IP whitelisting)
- Update dependencies and patches

---

## 📞 Support Contacts

- **Meta WhatsApp Support:** support.facebook.com
- **Meta Community Forums:** developers.facebook.com/community
- **Your Team Leads:**
  - Tech Lead: Ramesh Kumar
  - Product Lead: [Name]
  - Support: support@xyztravels.com

---

## ✅ Deployment Checklist

Before going live:

- [ ] All environment variables set in production
- [ ] Database migrations completed
- [ ] Webhook URL registered in Meta
- [ ] SSL certificate installed and valid
- [ ] Bot responds to test messages
- [ ] Agent receives test notifications
- [ ] Complete flow works end-to-end
- [ ] Error handling tested (network failures, API timeouts)
- [ ] Monitoring/alerting configured
- [ ] Team trained on new system
- [ ] Backup and disaster recovery plan in place
- [ ] Legal/Privacy documentation updated

---

**Last Updated:** April 17, 2024
**Document Version:** 1.0
