# Complete WhatsApp Travel Bot Flow Documentation

## Overview
This document outlines the complete 8-step WhatsApp chatbot flow for travel booking, from initial user contact through agent follow-up and booking management.

---

## 🟢 Step 1: User Starts Chat → Lead Creation

**Trigger:** User sends any message on WhatsApp

**What Happens:**
1. **Webhook receives message** → `src/webhook.js:processMessage()`
   - Extracts phone number, WhatsApp profile name, and message content
   - Finds agency by WhatsApp number
   - Loads or creates customer session

2. **Lead is auto-created** → `travelFlowHandler.js:ensureLead()`
   ```
   Status: JUST_CONTACTED
   Fetches from WhatsApp:
   - Customer name (from profile)
   - Phone number
   - Timestamp
   ```

3. **Session is initialized** → `utils/sessionManager.js`
   - Creates BotSession in database
   - Stores customer ID, agency ID
   - Initializes currentStep to 'MENU'

4. **Message saved** → `Message.create()`
   - Records incoming message
   - Tracks message direction (IN), type, timestamp, status (DELIVERED)

**Example Flow:**
```
User sends: "Hi"
↓
Webhook captures message
↓
System creates Lead (status: JUST_CONTACTED)
↓
Session created for this conversation
```

**Database Changes:**
- ✅ Lead created with status `JUST_CONTACTED`
- ✅ Customer record updated with name (if available)
- ✅ Message logged as incoming
- ✅ BotSession created

---

## 🟢 Step 2: Auto Greeting + Menu

**Trigger:** Immediately after Step 1

**What Happens:**
1. **Greeting Message Sent** → `travelFlowHandler.js:showMainMenu()`
   ```
   "Hi {{name}} 👋
   Welcome to XYZ Travels ✈️
   We offer Honeymoon 💕 & Family Tour Packages.
   
   How can I help you today?"
   ```

2. **Interactive Buttons Shown:**
   - [Domestic] → action_id: `menu_domestic`
   - [International] → action_id: `menu_international`
   - [🛒 Shop Catalog] → (if catalog configured)

3. **Session Updated:**
   - `currentStep` → `MENU`
   - `collectedData.packageCategory` → `null`
   - `collectedData.packageResults` → `[]`
   - `collectedData.enquiryDraft` → pre-filled with customer.name

**Example Message:**
```
Hi Ramees 👋
Welcome to XYZ Travels ✈️
We offer Honeymoon 💕 & Family Tour Packages.

How can I help you today?

[Domestic] [International] [🛒 Shop Catalog]
```

---

## 🟢 Step 3: Category Selection

**Trigger:** User clicks [Domestic] or [International]

**What Happens:**
1. **Category Captured** → `travelFlowHandler.js:openPackageFlow()`
   - Normalizes selection to `DOMESTIC` or `INTERNATIONAL`
   - Logs selection: `[TravelFlow] category_selected`

2. **Lead Updated:**
   - Field: `interest` → Set to selected category
   - Field: `status` → Remains as is (JUST_CONTACTED)
   - Field: `notes` → Appends "Category selected: Domestic/International"

3. **Activity Logged:**
   - Lead notes updated with timestamp
   - Message flow tracked in BotSession

4. **Packages Fetched:**
   ```
   SELECT * FROM packages
   WHERE agencyId = {agency.id}
   AND isActive = true
   ORDER BY createdAt DESC, bookingCount DESC
   LIMIT 5
   ```
   - System ranks packages by booking count (popular first)
   - Filters by category (domestic keywords: Goa, Kerala, Mumbai, etc.)

**Session Updated:**
```javascript
{
  currentStep: 'CATEGORY_PACKAGES',
  collectedData: {
    packageCategory: 'DOMESTIC' | 'INTERNATIONAL',
    packageResults: ['pkg-id-1', 'pkg-id-2', ...],
    selectedPackageId: null,
    enquiryDraft: { name: 'Ramees' }
  }
}
```

---

## 🟢 Step 4: Package Selection

**Trigger:** User selects a package from list

**What Happens:**
1. **Package Loaded:**
   ```sql
   SELECT * FROM packages
   WHERE id = {packageId}
   AND agencyId = {agency.id}
   AND isActive = true
   ```

2. **Lead Updated:**
   - Field: `packageId` → Assigned package
   - Field: `destination` → First destination from package
   - Field: `status` → Remains existing
   - Field: `notes` → Appends "Package selected: {packageName}"

3. **Package Details Sent to Customer:**
   ```
   🌴 {Package Name}
   
   💰 ₹{Base Price}
   📅 {Duration}
   
   {Short Description}
   
   ✨ Highlights:
   • Hotel stay
   • Sightseeing
   • Activities
   ```

4. **Interactive Buttons Shown:**
   ```
   [Enquire Now]    [Call Now]
   ```
   - Optionally: [Download Itinerary] (if brochure URL exists)
   - Optionally: [Back to Packages]

**Session Updated:**
```javascript
{
  currentStep: 'PACKAGE_DETAIL',
  collectedData: {
    selectedPackageId: 'pkg-123',
    selectedPackageName: 'Bali Adventure',
    packageCategory: 'INTERNATIONAL'
  }
}
```

---

## 🟢 Step 5: Enquiry Flow

**Trigger:** User clicks [Enquire Now]

### 5A. Meta WhatsApp Flow (Preferred)
If `WHATSAPP_TRIP_ENQUIRY_FLOW_ID` is configured:
- System sends interactive Flow form
- User fills details: Name, Travel Date, Number of People, Budget
- Form validates inline (client-side)

### 5B. Chat-Based Collection (Fallback)
If flow unavailable, system collects via text:

1. **Step 1: Collect Name**
   ```
   "Great choice. I will take your enquiry in chat.
   
   Please share your full name."
   ```
   - Validates: min 2 characters, alphanumeric + spaces
   - Session step: `ENQUIRY_NAME`

2. **Step 2: Collect Travel Date**
   ```
   "Please share your travel date or month."
   ```
   - Accepts: Any format (e.g., "May 10", "May 10-20", "Next month")
   - Session step: `ENQUIRY_PLACE`

3. **Step 3: Collect Number of Travelers**
   ```
   "How many people will be travelling?"
   ```
   - Validates: 1-50 people (numeric)
   - Session step: `ENQUIRY_ADDRESS`

4. **Step 4: Collect Budget**
   ```
   "What is your budget per person?
   You can reply in rupees, for example 25000."
   ```
   - Accepts: ₹10,000 or 10000 or 10k
   - Converts to paise (₹ × 100) for storage
   - Session step: `ENQUIRY_DATE`

### 5C. Data Collected
```javascript
{
  name: "Ramees",
  travelDate: "May 10-20",
  travellers: 2,
  budgetPerPerson: 2500000, // in paise (₹25,000)
  notes: "" // optional
}
```

**Session Updated:**
```javascript
currentStep: 'COMPLETE',
collectedData: {
  activeLeadId: 'lead-123',
  enquiryDraft: {
    name: "Ramees",
    travelDate: "May 10-20",
    travellers: 2,
    budgetPerPerson: 2500000
  }
}
```

---

## 🟢 Step 6: Notify Agent

**Trigger:** Automatically after enquiry finalization (Step 5)

**What Happens:**

1. **Enquiry Validated & Lead Updated:**
   ```
   Status: JUST_CONTACTED → ENQUIRY
   travelDates: "May 10-20"
   travellers: 2
   budgetPerPerson: 2500000
   notes: "Lead captured from WhatsApp package enquiry funnel | Package: Bali Adventure | Travel date: May 10-20 | Travellers: 2 | Budget per person: ₹25,000 | Other details: none"
   ```

2. **Agent Auto-Assignment:**
   - If no agent assigned: System finds agent with least active leads
   - Update: `lead.assignedAgentId = agent.id`

3. **Agent Notification Sent:**
   ```
   Agent receives WhatsApp message:
   
   🔥 New Enquiry
   
   Name: Ramees
   Phone: +91-XXXXX
   📍 Package: Bali Adventure
   📍 Date: May 10-20
   👥 People: 2
   💰 Budget: ₹25,000
   
   Take action:
   ```

4. **Interactive Buttons for Agent:**
   ```
   [📞 Call Now]
   [✅ Mark as Contacted]
   [🎉 Mark as Booked]
   ```

5. **Customer Confirmation:**
   ```
   "Thanks Ramees 🙌
   Our travel expert will contact you shortly."
   ```

**Agent's Inbox:**
- Lead appears with status: `ENQUIRY`
- Assigned to agent automatically
- Buttons enable quick actions

---

## 🟢 Step 7: Agent Actions

**Trigger:** Agent clicks a button or replies with command

### 7A. Mark as Contacted
**Agent clicks:** [✅ Mark as Contacted]

**What Happens:**
```
Lead Status: ENQUIRY → CONTACTED
Lead Notes: Appends "Marked as contacted via WhatsApp"
Agent Gets: "Lead updated to CONTACTED."
```

### 7B. Mark as Booked
**Agent clicks:** [🎉 Mark as Booked]

**What Happens:**
```
Lead Status: ENQUIRY → BOOKED
Lead Notes: Appends "Marked as booked via WhatsApp"
Agent Gets: "Lead updated to BOOKED."
Booking cascade: Backend may auto-create booking record
```

### 7C. Add Note
**Agent sends:** `NOTE: Customer wants AC room only`

**What Happens:**
```
Lead Notes: Appends "Agent note: Customer wants AC room only"
Agent Gets: "Note added to the lead."
```

### 7D. Call Now
**Agent clicks:** [📞 Call Now]

**What Happens:**
```
Agent Gets: Lead summary with phone number ready to call
```

**Commands Agent Can Send:**
- `NOTE: <text>` → Add note to lead
- `contacted` → Mark as contacted (text alternative)
- `booked` → Mark as booked (text alternative)
- `call now` → Display call summary

---

## 🟢 Step 8: Call Now Flow

**Trigger:** User clicks [Call Now] on package detail

**What Happens:**

1. **Lead Updated:**
   ```
   Status: (current) → ENQUIRY
   notes: Appends "Call Now clicked for {packageName}"
   ```

2. **Customer Gets:**
   ```
   "📞 Call us: +91-9876543210"
   ```
   - Clicking the number initiates WhatsApp call or phone call

3. **Agent Gets Notified** (same as Step 6):
   ```
   🔥 Call Now Intent
   
   Name: Ramees
   Phone: +91-XXXXX
   Package: Bali Adventure
   📍 Date: Not shared yet
   👥 People: Not shared yet
   💰 Budget: Not shared yet
   
   [📞 Call Now]
   [✅ Mark as Contacted]
   [🎉 Mark as Booked]
   ```

4. **After Agent Calls:**
   - Agent clicks [✅ Mark as Contacted] or [🎉 Mark as Booked]
   - Lead status updates accordingly
   - Backend tracks conversation

---

## 📊 Lead Status Progression

```
JUST_CONTACTED
    ↓
   NEW
    ↓
  [User selects package]
    ↓
  ENQUIRY
    ↓
[Agent responds]
    ↓
CONTACTED or QUOTED or NEGOTIATING
    ↓
  BOOKED or LOST
```

### Status Definitions:
- **JUST_CONTACTED**: Initial message received, lead created
- **NEW**: Menu shown, ready for category selection
- **ENQUIRY**: Customer submitted enquiry with details
- **CONTACTED**: Agent has reached out
- **QUOTED**: Agent sent price quote
- **NEGOTIATING**: Back-and-forth with price/dates
- **BOOKED**: Booking confirmed
- **LOST**: Customer opted out
- **CANCELLED**: Booking cancelled

---

## 🔄 Session Data Structure

```javascript
BotSession = {
  id: "sess-uuid",
  customerId: "cust-uuid",
  agencyId: "agency-uuid",
  currentStep: "MENU" | "CATEGORY_PACKAGES" | "PACKAGE_DETAIL" | "ENQUIRY_*" | "COMPLETE",
  isHandedOff: false,
  handedOffToId: null,
  failedAttempts: 0,
  collectedData: {
    packageCategory: "DOMESTIC" | "INTERNATIONAL" | null,
    packageResults: ["pkg-id-1", "pkg-id-2"],
    selectedPackageId: "pkg-uuid" | null,
    activeLeadId: "lead-uuid",
    enquiryDraft: {
      name: "Ramees",
      travelDate: "May 10-20",
      travellers: 2,
      budgetPerPerson: 2500000,
      notes: ""
    }
  },
  createdAt: "2024-04-17T10:00:00Z",
  updatedAt: "2024-04-17T10:30:00Z"
}
```

---

## 📱 File Structure & Key Functions

### WhatsApp Bot (`bot/src/`)
- **webhook.js** → Receives & validates WhatsApp webhooks
- **botRouter.js** → Routes messages to handlers
- **handlers/travelFlowHandler.js** → Complete flow logic
  - `ensureLead()` - Create/update lead
  - `showMainMenu()` - Step 2 greeting
  - `openPackageFlow()` - Step 3 packages
  - `showPackageDetail()` - Step 4 display
  - `handleEnquiryStep()` - Step 5 collection
  - `finalizeEnquiry()` - Step 5→6 transition + agent notify
  - `sendCallNow()` - Step 8 call flow
- **handlers/agentLeadHandler.js** → Step 7 agent actions

### Backend Services (`backend/src/`)
- **services/leadService.ts** → CRUD operations
- **services/whatsappService.ts** → WhatsApp API calls
- **models/Lead.ts** → Lead schema
- **models/Customer.ts** → Customer schema
- **models/BotSession.ts** → Session schema

---

## 🧪 Testing the Flow

### Manual Test (via WhatsApp):
1. Send "Hi" to agency WhatsApp number
2. Receive greeting with buttons
3. Click "Domestic"
4. Select a package
5. Click "Enquire Now"
6. Fill enquiry form
7. Agent receives notification
8. Agent clicks action button
9. Lead status updates

### Check Lead Status:
```sql
SELECT id, status, packageId, interest, travellers, budgetPerPerson, notes
FROM leads
WHERE customerId = 'cust-uuid'
ORDER BY createdAt DESC;
```

### Check Session State:
```sql
SELECT id, currentStep, collectedData
FROM bot_sessions
WHERE customerId = 'cust-uuid'
ORDER BY updatedAt DESC;
```

---

## 🚨 Error Handling

### If WhatsApp Flow fails:
- System falls back to chat-based collection
- User unaware of change
- Same data collected via text

### If Agent Assignment fails:
- Lead remains unassigned
- Backend scheduled job may assign later
- Agent can manually claim lead from dashboard

### If Notification fails:
- Log error but don't block customer flow
- Customer still gets confirmation
- Lead still created and waiting for agent

---

## 🔧 Configuration

### Required Environment Variables:
```env
# WhatsApp Business API
WEBHOOK_VERIFY_TOKEN=random_secret
WEBHOOK_APP_SECRET=from_meta_dashboard
WHATSAPP_BUSINESS_ACCOUNT_ID=xxx
WHATSAPP_PHONE_NUMBER_ID=xxx
WHATSAPP_ACCESS_TOKEN=xxx

# Flow IDs (for interactive forms)
WHATSAPP_TRIP_FLOW_ID=your-flow-id
WHATSAPP_TRIP_ENQUIRY_FLOW_ID=your-enquiry-flow-id

# Optional
WHATSAPP_TRIP_FLOW_FIRST_SCREEN_ID=PACKAGE_SELECTOR
WHATSAPP_TRIP_FLOW_CTA=View Packages
```

### Agency Configuration:
```javascript
Agency = {
  whatsappNumber: "+91-9876543210",
  whatsappTripFlowId: "custom-flow-id", // overrides env
  whatsappCatalogId: "catalog-id", // optional catalog
  name: "XYZ Travels",
  phone: "+91-9876543210"
}
```

---

## 📈 Analytics & Insights

### Metrics to Track:
- **Funnel Conversion Rate:**
  - Messages received → Leads created `(JUST_CONTACTED)`
  - Leads → Enquiries submitted `(ENQUIRY)`
  - Enquiries → Contacted by agent `(CONTACTED)`
  - Contacted → Booked `(BOOKED)`

- **Time Metrics:**
  - Time from contact to enquiry
  - Time from enquiry to agent contact
  - Response time by agent

### Queries:
```sql
-- Step 1: Leads created today
SELECT COUNT(*) FROM leads
WHERE DATE(createdAt) = CURDATE();

-- Step 5: Enquiries submitted today
SELECT COUNT(*) FROM leads
WHERE DATE(createdAt) = CURDATE()
AND status IN ('ENQUIRY', 'CONTACTED', 'BOOKED');

-- Step 7: Contacted leads
SELECT COUNT(*) FROM leads
WHERE status = 'CONTACTED';

-- Step 8: Call now clicks (inferred)
SELECT COUNT(*) FROM leads
WHERE status = 'ENQUIRY'
AND notes LIKE '%Call Now%';
```

---

## 🎯 Next Steps for Agent

After receiving the enquiry notification:
1. Review lead details
2. Check availability for requested dates
3. Call customer for initial discussion
4. Send quote (mark as `QUOTED`)
5. Negotiate terms (mark as `NEGOTIATING`)
6. Close the deal (mark as `BOOKED`)
7. Create booking record
8. Send itinerary & payment details

---

**Last Updated:** April 17, 2024
**Version:** 1.0
