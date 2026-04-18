# WhatsApp Catalog Management - Step-by-Step Implementation Guide

## Quick Start Summary
1. **Settings** → Save Catalog ID in Settings page
2. **Package Updates** → Auto-sync to WhatsApp Catalog when saved
3. **Customer Orders** → Webhook captures catalog orders → Creates Lead + Booking
4. **Agent Notified** → Lead appears in dashboard with order details

---

## STEP 1: Setup Catalog ID

### What User Does:
1. Go to **Settings → Catalog Management**
2. Enter:
   - WhatsApp Catalog ID (from Meta Business Manager)
3. Click **"Test Connection"** to validate
4. Click **"Enable Catalog Sync"** toggle
5. Click **"Save"**

### Backend Processing:
- Save Catalog ID to `Agency.catalogConfig`
- Use existing WhatsApp provider connection for authentication
- Return sync status to frontend

---

## STEP 2: Create/Update a Package (Auto-Sync)

### What User Does:
1. Go to **Packages → Create New** or **Edit**
2. Fill package details:
   - Name, Description, Price
   - Destinations, Itinerary
   - Images/PDFs
3. Toggle **"Sync to Catalog"** (enabled by default if catalog is configured)
4. Click **"Save Package"**

### Backend Processing:
```
Flow:
Package Save
    ↓
Check if catalog enabled for agency
    ↓ Yes
Enqueue catalogSyncService.syncPackageToCatalog(packageId)
    ↓
(Async - doesn't block package save)
Call Meta Catalog API:
  POST /v18.0/{catalog-id}/products
  {
    "name": "Goa Beach Package",
    "description": "5-day beach vacation in Goa",
    "price": 25000,
    "currency": "INR",
    "image_url": "https://...",
    "url": "https://yoursite.com/packages/goa-beach",
    "category": "Travel"
  }
    ↓
Receive catalogProductId from Meta
    ↓
Save to Package.catalogProductId
Update Package.catalogSyncStatus = 'synced'
Update Package.lastCatalogSync = now()
    ↓
Log success
```

### Frontend Feedback:
- **While Saving:** "Syncing with catalog..."
- **On Success:** ✅ "Package synced to catalog"
- **On Failure:** ❌ "Catalog sync failed - check settings"
- **In Package List:** Status column shows sync state + timestamp

---

## STEP 3: Customer Orders from Catalog

### What Customer Does:
1. Receives WhatsApp message with Catalog link (or clicks Products in menu)
2. Browsing catalog
3. Selects package(s)
4. Enters quantity
5. Clicks **"Order"** button
6. WhatsApp sends order message

### Backend Processing:

**Webhook receives Order Message:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "+919876543210",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "order",
          "order": {
            "catalog_id": "123456789",
            "product_items": [
              {
                "product_retailer_id": "pkg_1",
                "quantity": 2,
                "item_price": 25000,
                "currency": "INR"
              }
            ],
            "text": "Please arrange for April 20"
          }
        }]
      }
    }]
  }]
}
```

**Handler Flow:**
```
Webhook receives order message
    ↓
Call catalogOrderHandler(message, sessionData)
    ↓
Extract:
  - Customer phone: +919876543210
  - Order items: [{packageId, quantity, price}]
  - Total amount: 50000
  - Custom message: "Please arrange for April 20"
    ↓
Fetch/Create Customer:
  Customer.findOrCreate({
    phoneNumber: "+919876543210",
    agencyId: agencyId
  })
    ↓
Create Lead:
  Lead.create({
    agencyId,
    customerId,
    phoneNumber: "+919876543210",
    source: "catalog_order",
    status: "just_contacted",
    catalogOrderData: {
      catalogOrderId: "wamid.xxx",
      items: [{packageId, packageName, quantity, price}],
      totalAmount: 50000,
      orderedAt: now(),
      customerMessage: "Please arrange for April 20"
    }
  })
    ↓
Create Booking:
  Booking.create({
    leadId,
    packageIds: ["pkg_1"],
    source: "catalog",
    totalPrice: 50000,
    catalogOrderId: "wamid.xxx",
    status: "pending"
  })
    ↓
Send Confirmation Message:
  "Hi John, we received your order for 2x Goa Package (₹50,000).
   Our agent will contact you soon with details."
    ↓
Notify Agent:
  Dashboard notification: "New order from Catalog"
  Email alert to agent
    ↓
Complete
```

---

## STEP 4: View in Dashboard

### Lead Pipeline View:
The new catalog order appears as:
```
Lead Card:
├─ John Doe (+919876543210)
├─ Source: Catalog Order
├─ Status: Just Contacted
├─ Order Details:
│  ├─ Catalog Order ID: wamid.xxx
│  ├─ Items: 2x Goa Beach Package
│  ├─ Total: ₹50,000
│  └─ Message: "Please arrange for April 20"
├─ Booking: Pending (₹50,000)
└─ Timeline: Order received [timestamp]
```

### Agent Actions:
- ✅ Accept quote → Move to "Quoted" stage
- ✅ Send custom quote → Send message
- ✅ Confirm booking → Move to "Booked"
- 📞 Call customer
- 💬 Send WhatsApp message
- ❌ Mark as lost
- 📋 Add notes

---

## STEP 5: Key Files Overview

### Backend

#### A. CatalogSyncService (NEW)
**Location:** `backend/src/services/catalogSyncService.ts`

**Methods:**
```typescript
1. syncPackageToCatalog(packageId, agencyId)
   - Gets package from DB
   - Gets agency catalog config
   - Calls Meta API to create/update product
   - Saves catalogProductId to package
   - Returns success/error

2. removePackageFromCatalog(packageId, agencyId)
   - Calls Meta API DELETE
   - Removes catalogProductId from package

3. syncAllPackages(agencyId)
   - Loop through all packages for agency
   - Call syncPackageToCatalog for each
   - Return summary of successes/failures

4. getCatalogSyncStatus(agencyId)
   - Returns current sync status for agency
   - Last sync time
   - Error message if any
```

#### B. Catalog Order Handler (NEW)
**Location:** `bot/src/handlers/catalogOrderHandler.js`

**What it does:**
- Parses webhook order message
- Extracts customer, items, total
- Creates Lead with catalogOrderData
- Creates Booking linked to lead
- Sends confirmation message
- Notifies agent

#### C. Package Controller (MODIFY)
**Location:** `backend/src/controllers/packageController.ts`

**Changes:**
```typescript
Create/Update endpoint:
  if (agency.catalogConfig?.enableCatalogSync) {
    // Enqueue sync job (don't wait)
    await catalogSyncQueue.add({
      packageId: package.id,
      agencyId: package.agencyId,
      action: 'sync'
    });
  }
  
  // Return immediately with package data
  return response.json({
    success: true,
    package,
    catalogSyncStatus: 'syncing'
  });
```

#### D. Webhook Router (MODIFY)
**Location:** `bot/src/webhook.js` / `bot/src/botRouter.js`

**Add:**
```javascript
if (message.order) {
  return await handleCatalogOrder(message, session);
}
```

#### E. Models (MODIFY)

**Agency Model:**
```typescript
catalogConfig: {
  whatsappCatalogId: string,
  enableCatalogSync: boolean,
  catalogSyncStatus: 'active'|'inactive'|'error',
  lastSyncTime: Date,
  syncErrorMessage?: string
}
```

**Package Model:**
```typescript
catalogProductId?: string;
catalogSyncStatus?: 'synced'|'failed'|'pending';
lastCatalogSync?: Date;
```

**Lead Model:**
```typescript
source: 'whatsapp'|'website'|'catalog_order'|'admin';
stage: 'catalog_inquiry'|...;
catalogOrderData?: {
  catalogOrderId: string,
  items: Array<{packageId, packageName, quantity, price}>,
  totalAmount: number,
  orderedAt: Date,
  customerMessage?: string
}
```

**Booking Model:**
```typescript
catalogOrderId?: string;
source: 'manual'|'catalog'|'whatsapp';
```

### Frontend

#### A. Settings Page (MODIFY)
**Location:** `frontend/src/pages/Settings.jsx`

**Add Tab:** "Catalog Management"
```jsx
Components:
- CatalogSettingsForm
  └─ Catalog ID input
  └─ Test Connection button
  └─ Enable/Disable toggle
  └─ Status badge
  └─ Last sync timestamp

- CatalogSyncHistory
  └─ Table of last 10 syncs
  └─ Timestamp, Status, Count, Error
```

#### B. Packages Page (MODIFY)
**Location:** `frontend/src/pages/Packages.jsx`

**Add Column:** "Catalog Status"
```
✅ Synced (2024-04-18 10:30)
⏳ Syncing...
❌ Failed - Click for details | Retry
⚪ Not Synced - Catalog disabled
```

#### C. Package Form (MODIFY)
**Location:** `frontend/src/pages/PackageForm.jsx`

**Add:**
```jsx
- Checkbox: "Sync to Catalog" (checked by default)
- During save: "Syncing with catalog..."
- Toast on success: "✅ Package synced to catalog"
- Toast on error: "❌ Sync failed - check settings"
```

#### D. Lead Card (MODIFY)
**Location:** `frontend/src/components/LeadCard.jsx`

**If source === 'catalog_order':**
```jsx
<CatalogOrderBadge />
  ├─ "Catalog Order" tag
  ├─ Order ID
  └─ "View Order Details" link

Expanded details show:
├─ Items ordered (with quantities & prices)
├─ Total amount
├─ Customer message
├─ Order timestamp
└─ "Create Booking" button
```

#### E. Dashboard (MODIFY)
**Location:** `frontend/src/pages/Dashboard.jsx`

**Add Widget:** "Catalog Performance"
```
- 📦 Total Catalog Leads (This Month): 12
- 📊 Conversion Rate: 33% (4 booked)
- 🏆 Top Ordered Package: "Goa Beach" (8 orders)
- ⚙️ Sync Status: Active | Last sync: 2h ago
- 💾 Products Synced: 15/18
```

---

## STEP 6: Configuration Checklist

### Meta Business Manager Setup
- [ ] Create WhatsApp Catalog
- [ ] Get Catalog ID
- [ ] Whitelist your webhook URL

### Database Setup
- [ ] Run migrations (add catalog fields)
- [ ] Create indexes on catalogProductId, catalogSyncStatus

### Environment Variables
```
# .env
META_CATALOG_API_VERSION=v18.0
MAX_CATALOG_SYNC_RETRIES=3
```

### Code Setup
- [ ] Create catalogSyncService.ts
- [ ] Create catalogOrderHandler.js
- [ ] Update all models
- [ ] Update controllers/routes
- [ ] Update webhook router
- [ ] Create frontend components
- [ ] Test end-to-end

---

## STEP 7: Error Handling Scenarios

### Scenario 1: Catalog ID Invalid
```
User action: Save Settings
Result: Catalog ID validation fails

Handling:
- Show error: "Invalid Catalog ID. Check Meta Commerce Manager"
- Don't save invalid value
- Keep previous valid settings
```

### Scenario 2: Sync Fails for Package
```
User action: Create package with catalog enabled
Result: Meta API returns 403 Unauthorized

Handling:
- Package saves successfully (don't block user)
- catalogSyncStatus = 'failed'
- Error message logged
- Toast warning: "Catalog sync failed - ⚙️ check settings"
- Agent sees ❌ status in package list
- User can retry from UI
```

### Scenario 3: Webhook Order for Deleted Package
```
Customer: Orders from catalog
Backend: Package ID from catalog order doesn't exist in our DB

Handling:
- Create Lead anyway with catalogProductId only
- Leave packageId empty
- Agent notified: "Order received but package details missing"
- Agent can manually map or clarify with customer
```

### Scenario 4: Duplicate Order Prevention
```
Scenario: Same order webhook received twice (Meta resends)

Handling:
- Check if Lead.catalogOrderId already exists
- If yes, return existing lead (don't create duplicate)
- Log duplicate attempt
```

---

## STEP 8: Testing Guide

### Local Testing (without Meta)
```
1. Mock Meta Catalog API responses
2. Use webhook testing tool to send order messages
3. Verify Lead + Booking created correctly
4. Verify confirmation message queued
```

### Meta Sandbox Testing
```
1. Create test Catalog in Meta Sandbox
2. Save test credentials in Settings
3. Create test package → Verify sync API called
4. Get test phone number from Meta
5. Send test order → Verify Lead created
6. Check webhook logs
```

### Production Testing
```
1. Create single test package
2. Enable catalog sync
3. Verify it appears in catalog
4. Send test order from test phone
5. Verify lead created with all details
6. Verify confirmation sent
7. Monitor logs for 24 hours
```

---

## STEP 9: Monitoring & Debugging

### Dashboard Metrics
- Total packages synced
- Catalog lead count
- Conversion rate
- Last sync time
- Sync error count

### Logs to Monitor
```
CATALOG_SYNC_STARTED {packageId, agencyId}
CATALOG_SYNC_SUCCESS {packageId, catalogProductId}
CATALOG_SYNC_FAILED {packageId, error}
CATALOG_ORDER_RECEIVED {orderId, customerId}
CATALOG_LEAD_CREATED {leadId, orderId}
CATALOG_CONFIRMATION_SENT {leadId, status}
```

### Troubleshooting Commands
```sql
-- Find packages by sync status
SELECT * FROM packages WHERE catalog_sync_status = 'failed';

-- Find catalog orders
SELECT * FROM leads WHERE source = 'catalog_order';

-- Check latest sync attempt
SELECT * FROM agencies WHERE id = 'agency_123'
LIMIT 1;
```

---

## STEP 10: Security Checklist

- [ ] Ensure Catalog ID is stored securely
- [ ] Never expose provider credentials in logs
- [ ] Validate webhook signature from Meta
- [ ] Rate limit catalog order creation (prevent spam)
- [ ] Validate user permissions before syncing
- [ ] Use HTTPS for all Meta API calls
- [ ] Rotate provider credentials periodically if your WhatsApp provider requires it
- [ ] Audit catalog changes in logs

---

## Quick Command Reference

### Trigger Manual Sync
```bash
# Via API
POST /api/v1/agencies/{agencyId}/sync-all-packages
Authorization: Bearer {token}

# Via CLI (optional)
npm run catalog:sync-agency {agencyId}
```

### View Sync Status
```bash
# Via API
GET /api/v1/agencies/{agencyId}/catalog-settings

# Via Dashboard
Settings → Catalog Management → View History
```

### Re-sync Single Package
```bash
POST /api/v1/packages/{packageId}/sync-catalog
```

---

## Common Questions

**Q: What if Meta Catalog API is down?**
A: Package saves normally. Sync marked as 'pending'. Retries automatically.

**Q: Can user disable catalog later?**
A: Yes. Toggle off in Settings. Existing products stay in catalog (can be removed manually).

**Q: What if customer modifies order before we see it?**
A: We capture the final order state from webhook. No need to track edits.

**Q: How many times retry if sync fails?**
A: 3 times with exponential backoff. If still fails, admin alerted.

**Q: Can we sync prices dynamically?**
A: Yes (future feature). Add price update trigger in packageController.

**Q: What's the performance impact?**
A: Async sync doesn't block user. Queue processes in background.

