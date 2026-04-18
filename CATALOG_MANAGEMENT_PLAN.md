# WhatsApp Catalog Management Implementation Plan

## Overview
This feature enables users to:
1. **Save WhatsApp Catalog ID** in Settings
2. **Auto-sync packages** to WhatsApp Catalog when created/updated
3. **Capture catalog orders** and create leads with order details

---

## Architecture Overview

### Data Flow
```
Admin Updates Package → Backend API → Save to DB 
                                  ↓
                          Trigger Catalog Sync
                                  ↓
                    Call Meta Catalog API
                                  ↓
                    Update Catalog Product
                                  ↓
                    Broadcast Catalog Link to Customers
                                  ↓
        Customer Orders from WhatsApp Catalog
                                  ↓
                    Webhook receives Order Event
                                  ↓
                    Parse Order Details
                                  ↓
                    Create Lead with Order Data
```

---

## 1. SETTINGS & CATALOG CONFIGURATION MANAGEMENT

### 1.1 Backend - Update Agency Model
**File:** `backend/src/models/Agency.ts`

Add new fields for catalog configuration:
```typescript
interface CatalogConfig {
  whatsappCatalogId: string;        // Meta Catalog ID
  enableCatalogSync: boolean;       // Toggle catalog feature
  catalogSyncStatus: 'active' | 'inactive' | 'error';
  lastSyncTime: Date;
  syncErrorMessage?: string;
}

// In Agency model add:
catalogConfig?: CatalogConfig;      // JSONB field
```

### 1.2 Backend - API Endpoint for Catalog Settings
**File:** `backend/src/routes/agencies.ts` OR create `backend/src/routes/catalogSettings.ts`

**Endpoints:**
```typescript
PUT /api/v1/agencies/:id/catalog-settings
  - Request body: { whatsappCatalogId }
  - Save Catalog ID to agency configuration
  - Response: { success, catalogConfig }

GET /api/v1/agencies/:id/catalog-settings
  - Response: { catalogConfig }
```

### 1.3 Frontend - Catalog Settings UI
**File:** `frontend/src/pages/Settings.jsx` (enhance existing)

Add new tab: **"Catalog Management"**
```jsx
Components needed:
- <CatalogSettingsForm />
  - Input field for Catalog ID only
  - Test Connection button
  - Enable/Disable toggle
  - Status badge showing sync state
  - Last sync timestamp
  - Error message display if sync failed

- <CatalogSyncHistory />
  - Table showing last 10 sync attempts
  - Timestamp, status, item count, error message
```

---

## 2. PACKAGE-TO-CATALOG SYNC SYSTEM

### 2.1 Backend - Catalog Sync Service
**Create new file:** `backend/src/services/catalogSyncService.ts`

**Key Methods:**
```typescript
class CatalogSyncService {
  
  // Sync a single package to catalog
  async syncPackageToCatalog(packageId: string, agencyId: string): Promise<{
    success: boolean;
    catalogProductId?: string;
    error?: string;
  }>

  // Sync all packages for an agency
  async syncAllPackages(agencyId: string): Promise<{
    totalPackages: number;
    successCount: number;
    failedCount: number;
    errors: Array<{packageId, error}>
  }>

  // Remove package from catalog
  async removePackageFromCatalog(packageId: string, agencyId: string)

  // Get catalog sync status
  async getCatalogSyncStatus(agencyId: string)

  // Map package data to catalog product format
  private mapPackageToCatalogProduct(package: Package, agencyId: string)
}
```

**Integration with Meta Catalog API:**
```typescript
- Use Meta Catalog API SDK: @facebook/commerce-sdk
- Endpoints:
  POST /v18.0/{catalog-id}/products (Create)
  POST /v18.0/{product-id} (Update)
  DELETE /v18.0/{product-id} (Remove)
  GET /v18.0/{catalog-id}/products (List)

- Product mapping:
  Package.name → product.name
  Package.description → product.description
  Package.basePrice → product.price
  Package.image → product.image_url
  Package.destinations → product.category
  Package.itinerary → product.rich_description (JSON)
  Database link → product.url (points to booking page)
```

### 2.2 Backend - Package Controller Enhancement
**File:** `backend/src/controllers/packageController.ts`

Modify create/update endpoints:
```typescript
// When package is created/updated:
if (agency.catalogConfig?.enableCatalogSync) {
  // Trigger async sync to catalog
  await catalogSyncService.syncPackageToCatalog(package.id, agencyId)
    .catch(err => {
      // Log error but don't block package save
      logger.error('Catalog sync failed:', err);
      // Update catalogSyncStatus in Agency model
    });
}

// Add response:
response.catalogSyncStatus = getCatalogSyncStatus(package.id);
```

### 2.3 Backend - Sync Queue/Job System (Optional but Recommended)
**Create:** `backend/src/jobs/catalogSyncJob.ts`

Use Bull queue for async sync:
```typescript
// This prevents blocking the API response while syncing
const catalogSyncQueue = new Queue('catalog-sync', {
  connection: redisClient
});

// When package is saved, enqueue sync job:
await catalogSyncQueue.add({
  packageId,
  agencyId,
  action: 'sync' // or 'delete'
}, { 
  attempts: 3,
  backoff: 'exponential'
});

// Worker processes queue:
catalogSyncQueue.process(async (job) => {
  await catalogSyncService.syncPackageToCatalog(...)
});
```

### 2.4 Frontend - Auto-Sync UI Feedback
**File:** `frontend/src/pages/PackageForm.jsx`

Add UI elements:
```jsx
- Catalog sync toggle (if enabled in settings)
- "Sync to Catalog" checkbox (enabled by default)
- Status indicator during save: "Syncing with catalog..."
- Toast notification: "Package synced to catalog" / "Sync failed"
- Link to catalog product (if synced successfully)
```

---

## 3. CATALOG ORDER WEBHOOK & LEAD CREATION

### 3.1 Webhook Event Types to Handle
**File:** `bot/src/webhook.js`

Add handlers for catalog-related events:
```javascript
Event: messages[].order (OrderMessage)
  - order.product_items[] → Products ordered
  - order.catalog_id → Which catalog
  - Timestamp → When ordered

Event: orders[].status (OrderStatusUpdate)
  - order.id, order.status
  - order.catalog_id

Event: message_status (Message delivery status)
  - For order confirmations
```

### 3.2 Create Catalog Order Handler
**Create new file:** `bot/src/handlers/catalogOrderHandler.js`

```typescript
async function handleCatalogOrder(message, session) {
  // 1. Extract order details
  const {
    from,              // Customer phone
    order: {
      product_items,   // [{product_id, currency, quantity, price}]
      catalog_id,
      text              // Custom message from customer
    },
    timestamp
  } = message;

  // 2. Fetch product details (map product_id back to Package)
  const orderItems = await Promise.all(
    product_items.map(async (item) => {
      const catalog = await Catalog.findOne({ catalogId: catalog_id });
      const package = await Package.findOne({ 
        catalogProductId: item.product_id 
      });
      return {
        packageId: package.id,
        packageName: package.name,
        price: item.price,
        currency: item.currency,
        quantity: item.quantity,
        catalogProductId: item.product_id
      };
    })
  );

  // 3. Calculate total
  const totalAmount = orderItems.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );

  // 4. Create Lead
  const lead = await Lead.create({
    agencyId,
    customerId,
    phoneNumber: from,
    source: 'catalog_order',
    status: 'just_contacted',
    stage: 'catalog_inquiry',
    orderDetails: {
      catalogOrderId: message.id,
      items: orderItems,
      totalAmount,
      currency: orderItems[0]?.currency || 'INR',
      customerMessage: text,
      orderedAt: new Date(timestamp * 1000)
    },
    notes: `Order from WhatsApp Catalog: ${orderItems.map(i => i.packageName).join(', ')}`
  });

  // 5. Create Booking record
  const booking = await Booking.create({
    leadId: lead.id,
    packageIds: orderItems.map(i => i.packageId),
    status: 'pending',
    totalPrice: totalAmount,
    source: 'catalog',
    catalogOrderId: message.id
  });

  // 6. Send confirmation message
  await sendCatalogOrderConfirmation(from, lead, booking);

  // 7. Notify agent
  await notifyAgentNewCatalogOrder(lead, booking);

  return lead;
}
```

### 3.3 Update Webhook Router
**File:** `bot/src/botRouter.js`

```typescript
// Add to message routing logic:
if (message.order) {
  return handleCatalogOrder(message, session);
}

// Add to status change logic:
if (message.statuses?.[0]?.status === 'order_status_update') {
  return handleOrderStatusUpdate(message);
}
```

### 3.4 Send Catalog Order Confirmation Message
**Create:** `bot/src/handlers/catalogOrderConfirmation.js` OR `bot/src/utils/catalogMessages.js`

```typescript
async function sendCatalogOrderConfirmation(
  phoneNumber: string,
  lead: Lead,
  booking: Booking,
  agency: Agency
) {
  const message = {
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'template',
    template: {
      name: 'order_received_template',
      language: { code: 'en' },
      parameters: {
        body: {
          parameters: [
            { type: 'text', text: lead.customerName },
            { type: 'text', text: booking.id },
            { type: 'text', text: `₹${booking.totalPrice}` },
            { type: 'text', text: booking.packages.map(p => p.name).join(', ') }
          ]
        }
      }
    }
  };

  await sendWhatsAppMessage(message, agency);
}
```

---

## 4. LEAD MODEL & BOOKING ENHANCEMENTS

### 4.1 Update Lead Model
**File:** `backend/src/models/Lead.ts`

```typescript
interface CatalogOrderData {
  catalogOrderId: string;
  items: Array<{
    packageId: string;
    packageName: string;
    catalogProductId: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  totalAmount: number;
  currency: string;
  customerMessage?: string;
  orderedAt: Date;
}

// Add to Lead schema:
source: enum ['whatsapp', 'website', 'catalog_order', 'admin', ...existing]
stage: enum ['catalog_inquiry', ...existing]
catalogOrderData?: CatalogOrderData;
```

### 4.2 Update Booking Model
**File:** `backend/src/models/Booking.ts`

```typescript
// Add fields:
catalogOrderId?: string;     // Link to catalog order ID
source: 'manual' | 'catalog' | 'whatsapp_inquiry';
catalogOrderItems?: Array<{
  catalogProductId: string;
  packageId: string;
  quantity: number;
}>;
```

---

## 5. FRONTEND ENHANCEMENTS

### 5.1 Lead Details - Show Catalog Order Info
**File:** `frontend/src/components/LeadCard.jsx` OR lead detail view

```jsx
// If lead.source === 'catalog_order':
<CatalogOrderSummary lead={lead} />

Component displays:
- Order ID (from WhatsApp catalog)
- Ordered items with quantities & prices
- Total amount
- Items ordered timestamp
- Customer message from catalog
- Link to create booking
```

### 5.2 Dashboard - Catalog Insights Card
**File:** `frontend/src/pages/Dashboard.jsx`

Add new widget:
```jsx
<CatalogStatsCard>
  - Total Catalog Leads (This Month)
  - Conversion Rate (Catalog Orders → Bookings)
  - Top Ordered Packages
  - Sync Status (Last sync time, products synced)
```

### 5.3 Package List - Sync Status Column
**File:** `frontend/src/pages/Packages.jsx`

Add column showing:
- ✅ Synced (with timestamp)
- ⏳ Syncing...
- ❌ Failed (with error details, retry button)
- ⚪ Not Synced (if catalog disabled)

---

## 6. IMPLEMENTATION SEQUENCE (PRIORITY ORDER)

### Phase 1: Backend Foundation (Week 1)
- [ ] Update Agency model with catalogConfig
- [ ] Create CatalogSyncService
- [ ] Add catalog settings API endpoints
- [ ] Implement Meta Catalog API integration
- [ ] Update Package controller to trigger sync
- [ ] Database migration for catalog fields

### Phase 2: Webhook & Lead Creation (Week 2)
- [ ] Create catalogOrderHandler
- [ ] Update webhook router for catalog events
- [ ] Update Lead model with catalog order data
- [ ] Update Booking model with catalog source
- [ ] Create order confirmation message template
- [ ] Agent notification system for catalog orders

### Phase 3: Frontend & Settings UI (Week 3)
- [ ] Create CatalogSettingsForm component
- [ ] Add Settings tab for catalog management
- [ ] Update PackageForm with sync UI
- [ ] Add sync status column to Packages list
- [ ] Create lead detail view for catalog orders
- [ ] Add dashboard catalog metrics card

### Phase 4: Testing & Optimization (Week 4)
- [ ] End-to-end testing with Meta sandbox
- [ ] Error handling & retry logic
- [ ] Performance optimization for bulk sync
- [ ] Implement queue system (Bull/Redis)
- [ ] Logging & monitoring

---

## 7. DATABASE MIGRATIONS

```sql
-- Add catalog fields to agencies
ALTER TABLE agencies ADD COLUMN catalog_config JSONB;
ALTER TABLE agencies ADD COLUMN catalog_sync_status VARCHAR;
ALTER TABLE agencies ADD COLUMN last_catalog_sync TIMESTAMP;

-- Add to packages
ALTER TABLE packages ADD COLUMN catalog_product_id VARCHAR;
ALTER TABLE packages ADD COLUMN catalog_sync_status VARCHAR;
ALTER TABLE packages ADD COLUMN last_catalog_sync TIMESTAMP;

-- Add to leads
ALTER TABLE leads ADD COLUMN catalog_order_data JSONB;

-- Add to bookings
ALTER TABLE bookings ADD COLUMN catalog_order_id VARCHAR;
ALTER TABLE bookings ADD COLUMN source VARCHAR DEFAULT 'manual';
```

---

## 8. ENCRYPTION & SECURITY

**Catalog Configuration:**
- Store Catalog ID in agency configuration
- Use the existing WhatsApp provider connection for authentication
- Never expose provider credentials in responses or logs

**Catalog Order Data:**
- Store encrypted order details in JSONB
- Validate webhook signature from Meta
- Rate limit catalog order creation

---

## 9. ERROR HANDLING & LOGGING

```typescript
// Catalog sync errors should not block user actions
try {
  await catalogSyncService.syncPackageToCatalog(...)
} catch (error) {
  logger.error('CATALOG_SYNC_FAILED', {
    packageId,
    agencyId,
    error: error.message,
    timestamp: new Date()
  });
  
  // Update Agency.catalogSyncStatus
  await Agency.updateOne(
    { id: agencyId },
    { 
      catalogSyncStatus: 'error',
      syncErrorMessage: error.message,
      lastSyncTime: new Date()
    }
  );
  
  // Alert admin via dashboard notification
  // Don't throw - let package save succeed
}
```

---

## 10. TESTING CHECKLIST

- [ ] Create/update package → Catalog API called
- [ ] Catalog API failure → Package saved, error logged
- [ ] Webhook order received → Lead created
- [ ] Lead has all catalog order details
- [ ] Booking links to catalog order
- [ ] Agent receives notification
- [ ] Customer gets confirmation message
- [ ] Settings validation works
- [ ] Token encryption/decryption works
- [ ] Catalog sync status updates correctly

---

## 11. OPTIONAL ENHANCEMENTS (Future)

1. **Bulk Sync:** Resync all packages at once
2. **Catalog Analytics:** Track which products get orders
3. **A/B Testing:** Compare catalog orders vs direct inquiries
4. **Inventory Sync:** Update catalog when package spots fill up
5. **Price Updates:** Auto-update catalog prices
6. **Scheduled Sync:** Nightly sync to keep catalog fresh
7. **Multi-Catalog:** Support multiple catalogs per agency
8. **Catalog Campaigns:** Broadcast catalog link via campaigns

---

## Files to Create/Modify

### NEW FILES:
```
backend/src/services/catalogSyncService.ts
backend/src/routes/catalogSettings.ts (or update agencies.ts)
bot/src/handlers/catalogOrderHandler.js
bot/src/utils/catalogMessages.js
frontend/src/components/CatalogSettingsForm.jsx
frontend/src/components/CatalogSyncHistory.jsx
frontend/src/components/CatalogOrderSummary.jsx
frontend/src/components/CatalogStatsCard.jsx
```

### MODIFIED FILES:
```
backend/src/models/Agency.ts
backend/src/models/Lead.ts
backend/src/models/Booking.ts
backend/src/models/Package.ts
backend/src/controllers/packageController.ts
backend/src/routes/leads.ts
bot/src/webhook.js
bot/src/botRouter.js
frontend/src/pages/Settings.jsx
frontend/src/pages/Packages.jsx
frontend/src/pages/PackageForm.jsx
frontend/src/pages/Dashboard.jsx
```

---

## API Response Examples

### Save Catalog Settings
```json
POST /api/v1/agencies/123/catalog-settings
Request:
{
  "whatsappCatalogId": "123456789",
  "enableCatalogSync": true
}

Response:
{
  "success": true,
  "catalogConfig": {
    "whatsappCatalogId": "123456789",
    "enableCatalogSync": true,
    "catalogSyncStatus": "active",
    "lastSyncTime": "2024-04-18T10:30:00Z"
  }
}
```

### Create Lead from Catalog Order
```json
POST /api/v1/leads
Request: (internal from webhook handler)
{
  "agencyId": "123",
  "phoneNumber": "+919876543210",
  "customerName": "John Doe",
  "source": "catalog_order",
  "catalogOrderData": {
    "catalogOrderId": "order_123",
    "items": [
      {
        "packageId": "pkg_1",
        "packageName": "Goa Beach Package",
        "quantity": 2,
        "price": 25000,
        "currency": "INR"
      }
    ],
    "totalAmount": 50000,
    "orderedAt": "2024-04-18T10:15:00Z"
  }
}

Response:
{
  "id": "lead_456",
  "status": "just_contacted",
  "source": "catalog_order",
  "catalogOrderData": {...},
  "booking": {
    "id": "booking_789",
    "status": "pending",
    "totalPrice": 50000
  }
}
```

---

## Summary Table

| Component | File | Type | Priority |
|-----------|------|------|----------|
| Settings UI | CatalogSettingsForm.jsx | Frontend | P0 |
| Catalog Service | catalogSyncService.ts | Backend | P0 |
| Package Sync | packageController.ts | Backend | P0 |
| Order Handler | catalogOrderHandler.js | Bot | P0 |
| Lead Integration | Lead.ts + leadController | Backend | P0 |
| Dashboard Widget | CatalogStatsCard.jsx | Frontend | P1 |
| Sync History | CatalogSyncHistory.jsx | Frontend | P1 |
| Queue System | Bull + Redis | Backend | P1 |

