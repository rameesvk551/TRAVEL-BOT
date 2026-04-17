# Developer Reference: Bot Flow Implementation

## 🏗️ Architecture Overview

```
WhatsApp Message
    ↓
Meta Webhook (Port 3001)
    ↓
webhook.js → Signature verification
    ↓
botRouter.js → Route to handlers
    ↓
travelFlowHandler.js → Core business logic
    ↓
whatsappService.ts → Send messages back
    ↓
Database (Leads, Messages, Sessions)
```

---

## 📁 Key Files & Their Purpose

### Webhook & Routing
- **`bot/src/webhook.js`** - Receives and validates WhatsApp webhooks
  - `handleVerification()` - Meta verification challenge
  - `handleIncoming()` - Processes messages asynchronously
  - `processMessage()` - Main message handler

- **`bot/src/botRouter.js`** - Routes messages to appropriate handler
  - Checks message type (text, button, flow response)
  - Routes to travel flow, agent actions, or handoff

### Flow Handlers
- **`bot/src/handlers/travelFlowHandler.js`** - Complete travel booking flow
  ```
  User Initiation → showMainMenu()
  Category Selection → openPackageFlow()
  Package Selection → showPackageDetail()
  Enquiry Start → openEnquiryFlow() or startEnquiry()
  Form Submission → handleEnquiryStep()
  Enquiry Complete → finalizeEnquiry() → notifyAgentOfNewEnquiry()
  ```

- **`bot/src/handlers/agentLeadHandler.js`** - Agent WhatsApp interactions
  - `handleAgentLeadAction()` - Process agent commands
  - Support for: Call, Mark as Contacted, Mark as Booked, Note

- **`bot/src/utils/sessionManager.js`** - Session state management
  - `loadOrCreateSession()` - Get/create BotSession
  - `updateSession()` - Persist session changes

### Services
- **`backend/src/services/whatsappService.ts`** - WhatsApp API wrapper
  - `sendTextMessage()`, `sendButtonsMessage()`, `sendFlowMessage()`
  - `sendTypingIndicator()`, `updateMessageStatus()`

- **`backend/src/services/leadService.ts`** - Lead database operations
  - `createLead()`, `updateLead()`, `listLeads()`
  - `findLeastBusyAgent()` - Auto-assign agents

### Models
- **`backend/src/models/Lead.ts`** - Lead status, customer info, package selection
- **`backend/src/models/BotSession.ts`** - Conversation state, form data
- **`backend/src/models/Customer.ts`** - User profile, phone, name
- **`backend/src/models/Message.ts`** - Message history
- **`backend/src/models/Agent.ts`** - Team members, assignments

---

## 🔄 Complete Flow - Code Path

### Step 1: Message Arrives

```javascript
// webhook.js - Handle incoming message
async function handleIncoming(req, res) {
  // 1. Verify Meta signature
  if (!verifySignature(rawBody, signature)) return;
  
  // 2. Extract message data
  const msg = entries[0].changes[0].value.messages[0];
  const metadata = entries[0].changes[0].value.metadata;
  
  // 3. Find agency
  const agency = await Agency.findOne({ 
    where: { whatsappNumber: toPhone } 
  });
  
  // 4. Create customer session
  const { session, customer } = await loadOrCreateSession(fromPhone, agency.id);
  
  // 5. Ensure lead exists
  await ensureLead(session, customer, agency, {
    status: 'JUST_CONTACTED'
  });
  
  // 6. Route message to handler
  await routeMessage(session, incoming, customer, agency);
}
```

### Step 2: Route to Handler

```javascript
// botRouter.js - Determine handler
async function routeMessage(session, incoming, customer, agency) {
  const messageText = incoming?.text || '';
  
  // Is this a fresh greeting?
  if (['hi', 'hello', 'start', 'menu'].includes(messageText.toLowerCase())) {
    return handleTravelFlow(session, incoming, customer, agency);
  }
  
  // Is this an agent?
  if (agent) {
    return handleAgentLeadAction({ agent, agency, incoming });
  }
  
  // Handle travel flow
  return handleTravelFlow(session, incoming, customer, agency);
}
```

### Step 3: Show Menu

```javascript
// travelFlowHandler.js - Show main menu
async function showMainMenu(session, customer, agency) {
  // 1. Update session to MENU step
  await transitionTo(session, STEPS.MENU, {
    packageCategory: null,
    packageResults: [],
    selectedPackageId: null
  });
  
  // 2. Send greeting + buttons
  return whatsappService.sendButtonsMessage(
    customer.phone,
    `Hi ${firstName(customer)} 👋\nWelcome to ${agency.name}`,
    [
      { id: 'menu_domestic', title: 'Domestic' },
      { id: 'menu_international', title: 'International' }
    ]
  );
}
```

### Step 4: Category Selection

```javascript
// Handle button click: Domestic or International
async function openPackageFlow(session, customer, agency, category) {
  const normalizedCategory = normalizeCategory(category); // 'DOMESTIC'
  
  // 1. Find packages
  const packages = await findPackagesForCategory(
    agency.id, 
    normalizedCategory, 
    5
  );
  
  // 2. Update lead with interest
  await ensureLead(session, customer, agency, {
    interest: normalizedCategory,
    notes: `Category selected: ${normalizedCategory}`
  });
  
  // 3. Update session to CATEGORY_PACKAGES
  await transitionTo(session, STEPS.CATEGORY_PACKAGES, {
    packageCategory: normalizedCategory,
    packageResults: packages.map(p => p.id),
    selectedPackageId: null
  });
  
  // 4. Send flow or fallback list
  if (isMetaTripFlowConfigured(agency)) {
    return sendFlowMessage(...); // Interactive flow
  } else {
    return showPackageListFallback(...); // List message
  }
}
```

### Step 5: Package Selection

```javascript
// User selects package
async function showPackageDetail(session, customer, agency, packageId) {
  const pkg = await Package.findOne({ 
    where: { id: packageId, agencyId: agency.id } 
  });
  
  // 1. Update lead with package
  await ensureLead(session, customer, agency, {
    packageId: pkg.id,
    destination: pkg.destinations[0],
    notes: `Package selected: ${pkg.name}`
  });
  
  // 2. Update session to PACKAGE_DETAIL
  await transitionTo(session, STEPS.PACKAGE_DETAIL, {
    selectedPackageId: pkg.id
  });
  
  // 3. Build package message with price, highlights
  const message = buildPackageCaption(pkg);
  
  // 4. Send with [Enquire Now] [Call Now] buttons
  return whatsappService.sendButtonsMessage(
    customer.phone,
    message,
    [
      { id: 'action_enquire', title: 'Enquiry' },
      { id: 'action_call_now', title: 'Call Now' }
    ]
  );
}
```

### Step 6: Enquiry Collection

```javascript
// User clicks "Enquire Now"
async function openEnquiryFlow(session, customer, agency) {
  // Option A: Send WhatsApp Flow (if configured)
  if (isMetaTripFlowConfigured(agency)) {
    return whatsappService.sendFlowMessage(
      customer.phone,
      'Share your details 👇',
      {
        flowId: FLOW_ENQUIRY_ID,
        firstScreenId: 'ENQUIRY_FORM',
        data: { package_name: pkg.name }
      }
    );
  }
  
  // Option B: Fallback to chat collection
  return startEnquiry(session, customer, agency);
}

// Chat-based collection
async function handleEnquiryStep(session, incoming, customer, agency) {
  switch (session.currentStep) {
    case STEPS.ENQUIRY_NAME:
      // Ask for name, validate, move to next
      enquiry.name = text;
      await transitionTo(session, STEPS.ENQUIRY_PLACE, { enquiryDraft: enquiry });
      return sendTextMessage('Please share travel date');
    
    case STEPS.ENQUIRY_PLACE:
      // Ask for date
      enquiry.travelDate = text;
      await transitionTo(session, STEPS.ENQUIRY_ADDRESS, { enquiryDraft: enquiry });
      return sendTextMessage('How many people?');
    
    case STEPS.ENQUIRY_DATE:
      // Ask for budget, then finalize
      enquiry.budgetPerPerson = parseBudgetPaise(text);
      await transitionTo(session, STEPS.COMPLETE, { enquiryDraft: enquiry });
      return finalizeEnquiry(session, customer, agency);
  }
}
```

### Step 7: Enquiry Finalized + Agent Notified

```javascript
// handleFlowSubmission() OR finalizeEnquiry() from chat
async function finalizeEnquiry(session, customer, agency) {
  const enquiry = getProfile(session).enquiryDraft;
  const pkg = await Package.findOne({ where: { id: profile.selectedPackageId } });
  
  // 1. Update customer name if provided
  await Customer.update({ name: enquiry.name }, { where: { id: customer.id } });
  
  // 2. Create comprehensive notes
  const notes = `Lead captured from WhatsApp\n...${enquiry.name}|Date: ${enquiry.travelDate}|People: ${enquiry.travellers}|Budget: ${budgetText}`;
  
  // 3. Update lead to ENQUIRY status
  const lead = await ensureLead(session, customer, agency, {
    packageId: pkg.id,
    travelDates: enquiry.travelDate,
    travellers: enquiry.travellers,
    budgetPerPerson: enquiry.budgetPerPerson,
    status: 'ENQUIRY',  // CHANGED FROM NEW
    notes
  });
  
  // 4. ⭐ NOTIFY AGENT (NEW ADDITION)
  await notifyAgentOfNewEnquiry(lead, customer, agency, pkg, enquiry);
  
  // 5. Send confirmation to customer
  return sendTextMessage(
    customer.phone,
    `Thanks ${enquiry.name}! Our expert will contact you.`
  );
}

// ⭐ NEW FUNCTION: Notify Agent
async function notifyAgentOfNewEnquiry(lead, customer, agency, pkg, enquiry) {
  if (!lead.assignedAgentId) return; // No agent assigned, skip
  
  const agent = await Agent.findOne({ where: { id: lead.assignedAgentId } });
  if (!agent?.phone) return; // Agent has no WhatsApp
  
  // Build notification message
  const message = `🔥 New Enquiry\n\nName: ${customer.name}\n📍 Package: ${pkg.name}\nDate: ${enquiry.travelDate}\nPeople: ${enquiry.travellers}\nBudget: ₹${budget}`;
  
  // Send with action buttons
  return whatsappService.sendButtonsMessage(
    agent.phone,
    message,
    [
      { id: `lead_call:${lead.id}`, title: '📞 Call Now' },
      { id: `lead_contacted:${lead.id}`, title: '✅ Mark as Contacted' },
      { id: `lead_booked:${lead.id}`, title: '🎉 Mark as Booked' }
    ]
  );
}
```

### Step 7A: Agent Actions

```javascript
// agentLeadHandler.js - Process agent button clicks
async function handleAgentLeadAction({ agent, agency, incoming }) {
  const actionId = incoming.actionId; // 'lead_contacted:lead-uuid'
  
  if (actionId.startsWith('lead_contacted:')) {
    const leadId = actionId.split(':')[1];
    const lead = await Lead.findOne({ where: { id: leadId } });
    
    // Update lead status
    await leadService.updateLead(lead.id, agency.id, { 
      status: 'CONTACTED'  // ENQUIRY → CONTACTED
    });
    
    // Add note
    await appendLeadNote(lead, agency.id, 'Marked as contacted via WhatsApp');
    
    // Confirm to agent
    return sendTextMessage(agent.phone, 'Lead updated to CONTACTED.');
  }
}
```

### Step 8: Call Now

```javascript
// User clicks "Call Now" from package detail
async function sendCallNow(session, customer, agency) {
  const pkg = await Package.findOne({
    where: { id: profile.selectedPackageId }
  });
  
  // 1. Update lead to ENQUIRY status (even though not filled form)
  const lead = await ensureLead(session, customer, agency, {
    status: 'ENQUIRY',  // Mark as enquiry
    packageId: pkg.id,
    notes: 'Call Now clicked'
  });
  
  // 2. Send phone number to customer
  await sendTextMessage(
    customer.phone,
    `📞 Call us: ${agency.phone}`
  );
  
  // 3. Notify agent (same as enquiry completion)
  if (lead.assignedAgentId) {
    const agent = await Agent.findOne(...);
    await sendButtonsMessage(
      agent.phone,
      '🔥 Call Now Intent - Name: $name...',
      [
        { id: `lead_call:${lead.id}`, title: '📞 Call Now' },
        { id: `lead_contacted:${lead.id}`, title: '✅ Mark as Contacted' },
        { id: `lead_booked:${lead.id}`, title: '🎉 Mark as Booked' }
      ]
    );
  }
}
```

---

## 🔧 Session State Management

### Initial Session

```javascript
BotSession = {
  customerId: 'uuid',
  agencyId: 'uuid',
  currentStep: 'MENU',
  isHandedOff: false,
  collectedData: {
    packageCategory: null,
    packageResults: [],
    selectedPackageId: null,
    activeLeadId: null,
    enquiryDraft: { name: '', travelDate: '', travellers: null, budgetPerPerson: null }
  }
}
```

### After Category Selection

```javascript
currentStep: 'CATEGORY_PACKAGES'
collectedData: {
  packageCategory: 'DOMESTIC',
  packageResults: ['pkg-1', 'pkg-2', 'pkg-3', 'pkg-4', 'pkg-5'],
  selectedPackageId: null
}
```

### After Package Selection

```javascript
currentStep: 'PACKAGE_DETAIL'
collectedData: {
  packageCategory: 'DOMESTIC',
  packageResults: ['pkg-1', 'pkg-2', ...],
  selectedPackageId: 'pkg-1',
  selectedPackageName: 'Bali Adventure'
}
```

### During Enquiry (Chat Mode)

```javascript
currentStep: 'ENQUIRY_NAME' // then ENQUIRY_PLACE, ENQUIRY_DATE, etc.
collectedData: {
  activeLeadId: 'lead-123',
  enquiryDraft: {
    name: 'Ramees',  // gradually filled
    travelDate: 'May 10-20',
    travellers: 2,
    budgetPerPerson: 2500000  // in paise
  }
}
```

### Enquiry Complete

```javascript
currentStep: 'COMPLETE'
collectedData: {
  activeLeadId: 'lead-123',
  enquiryDraft: { /* fully filled */ }
}
```

---

## 🚨 Error Handling

### Network/API Errors

```javascript
try {
  await finalizeEnquiry(session, customer, agency);
} catch (err) {
  console.error('[TravelFlow] Enquiry finalization failed:', err.message);
  
  // Fallback: Tell customer
  await sendTextMessage(
    customer.phone,
    'Something went wrong. Please try again.'
  );
  
  // Retry logic handled by scheduler
  await schedulerService.scheduleFollowUp(customer.id, agency.id);
}
```

### Flow Not Opening

```javascript
const flowResponse = await sendFlowMessage(...);

if (flowResponse?.status === 'FAILED') {
  // Fall back to chat-based collection
  return startEnquiry(session, customer, agency);
}
```

### Lead Assignment Failure

```javascript
if (!lead.assignedAgentId) {
  const agent = await leadService.findLeastBusyAgent(agency.id);
  if (!agent) {
    // No agents available - won't notify
    // Lead still created, manual assignment needed
    console.warn('[TravelFlow] No agents available for assignment');
    return; // Skip agent notification
  }
}
```

---

## 📊 Key Data Transformations

### Price Conversion

```javascript
// Input from customer: "25000" or "₹25,000" or "₹25k"
// Internal storage: Paise (smallest unit)
// Display: Rupees formatted

function parseBudgetPaise(value) {
  const cleaned = String(value).replace(/[₹,\s]|rs\.?/gi, '').trim();
  const amount = parseInt(cleaned, 10);
  return amount * 100; // Convert to paise
}

function formatCurrency(paise) {
  const rupees = paise / 100;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

// Example
parseBudgetPaise('₹25,000') // returns 2500000 (25000 * 100)
formatCurrency(2500000) // returns '₹25,000'
```

### Package Category Inference

```javascript
// If package has explicit category, use it
// Otherwise, infer from name/details

function inferPackageCategory(pkg) {
  const domestic = ['Goa', 'Kerala', 'Mumbai', 'India', ...];
  const searchText = [pkg.name, pkg.summary, ...pkg.destinations].join(' ');
  
  return domestic.some(kw => searchText.toLowerCase().includes(kw))
    ? 'DOMESTIC'
    : 'INTERNATIONAL';
}
```

---

## 🔐 Message Flow

### Incoming Message (Customer → Bot)

```
Meta Webhook
 ├─ Signature verification
 ├─ Extract phone, text, type
 ├─ Find agency
 ├─ Load/create customer
 ├─ Create JUST_CONTACTED lead
 ├─ Save message to DB
 ├─ Route to handler
 └─ Return 200 ASAP
```

### Outgoing Message (Bot → Customer)

```
travelFlowHandler
 ├─ Decide message type
 ├─ Build message content
 ├─ Call whatsappService
 └─ Return message

whatsappService
 ├─ Build WhatsApp API payload
 ├─ Call Meta WhatsApp API
 ├─ Handle response
 ├─ Save message to DB
 └─ Return success/failure
```

### Agent Notification (Bot → Agent)

```
finalizeEnquiry()
 └─ notifyAgentOfNewEnquiry()
     ├─ Find assigned agent
     ├─ Get agent's WhatsApp phone
     ├─ Build notification message
     ├─ Call whatsappService.sendButtonsMessage()
     └─ Log the notification
```

---

## 🧪 Testing Scenarios

### Test Case 1: Complete Happy Path

```bash
# 1. Send "Hi"
# Verify: Menu shown

# 2. Click "Domestic"
# Verify: Packages listed, session updated to CATEGORY_PACKAGES

# 3. Select first package
# Verify: Package detail shown

# 4. Click "Enquire Now"
# Verify: Form or chat collection started

# 5. Complete form/chat
# Verify: 
# - Lead created with ENQUIRY status
# - Agent receives notification
# - Customer sees confirmation
```

### Test Case 2: Flow Fallback

```bash
# Disable WHATSAPP_TRIP_FLOW_ID

# 1. Send "Hi" → Click "Domestic"
# Verify: List message shown instead of flow

# 2. Select package
# Verify: Chat-based form started

# 3. Complete chat collection
# Verify: Same result as flow path
```

### Test Case 3: Agent Actions

```bash
# After lead created:

# 1. Agent receives notification
# Verify: Buttons visible

# 2. Click "Mark as Contacted"
# Verify: Lead status  → CONTACTED

# 3. Send "NOTE: Customer wants AC room"
# Verify: Note appended to lead.notes
```

---

## 📈 Debugging Checklist

Before deployment:

- [ ] Webhook receives messages (check logs)
- [ ] Lead created automatically (check DB)
- [ ] Session persists across messages (check DB)
- [ ] Package list loads correctly (check logs)
- [ ] Enquiry form validates properly
- [ ] Agent gets notification (agent receives WhatsApp)
- [ ] Agent can update lead status (click button)
- [ ] All message types rendered correctly (text, buttons, flow)
- [ ] Error handling graceful (customer sees message, system logs error)
- [ ] No duplicate leads created
- [ ] Message history saved correctly

---

**Last Updated:** April 17, 2024
**Version:** 1.0 - Initial Release
