# WhatsApp Catalog Management - Quick Reference Guide

## 🎯 Feature Summary

**What It Does:**
- Users save WhatsApp Catalog ID in Settings
- When packages are created/updated → Auto-sync to WhatsApp Catalog
- Customers order from the catalog → Creates lead + booking automatically
- Agent gets instant notification with order details

**Timeline:** 20 days for full implementation (4 phases)

---

## 📋 Architecture At A Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│  1. Settings → Save Catalog ID                              │
│     ↓                                                        │
│  2. Packages → Create/Update → Auto-sync to Catalog        │
│     ↓                                                        │
│  3. View sync status in Package list                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  CUSTOMER WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│  1. Receives catalog link on WhatsApp                       │
│     ↓                                                        │
│  2. Browse & select packages                                │
│     ↓                                                        │
│  3. Place order                                             │
│     ↓                                                        │
│  4. Webhook creates Lead + Booking                          │
│     ↓                                                        │
│  5. Agent notified automatically                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Core Components

### 1️⃣ Settings Management
**What:** User interface to save Catalog ID
**Where:** Frontend → Settings → "Catalog Management" tab
**How:** 
- User enters Catalog ID
- System validates the Catalog ID using the existing WhatsApp connection
- Saves Catalog ID securely

### 2️⃣ Catalog Sync Service
**What:** Automatically syncs packages to WhatsApp Catalog
**Where:** Backend → `services/catalogSyncService.ts`
**When:** Triggered when package is created/updated
**How:**
- Reads package data from database
- Maps to Meta Catalog product format
- Calls Meta API to create/update product
- Stores catalogProductId in database
- Async processing (doesn't block user action)

### 3️⃣ Webhook Handler
**What:** Receives and processes customer orders from catalog
**Where:** Bot → `handlers/catalogOrderHandler.js`
**When:** Customer places order in WhatsApp Catalog
**How:**
- Parses webhook message
- Extracts order items and customer info
- Creates Lead with source = 'catalog_order'
- Creates Booking linked to lead
- Sends confirmation message
- Notifies agent

### 4️⃣ Dashboard Integration
**What:** Shows catalog orders like regular leads
**Where:** Frontend → Leads, Bookings, Dashboard
**What User Sees:**
- Leads appear with "Catalog Order" badge
- Full order details (items, total, message)
- Agent can quote, confirm, or message customer

---

## 📁 File Structure

### Files to Create (New)
```
backend/
├── src/
│   └── services/
│       └── catalogSyncService.ts          ← Core sync logic
│   └── routes/
│       └── catalogSettings.ts             ← API endpoints
│   └── queues/
│       └── catalogSyncQueue.ts            ← Job queue (optional)

bot/
├── src/
│   └── handlers/
│       └── catalogOrderHandler.js         ← Process orders
│   └── utils/
│       └── catalogMessages.js             ← Confirmation messages

frontend/
├── src/
│   └── components/
│       ├── CatalogSettingsForm.jsx        ← Settings form
│       ├── CatalogSyncHistory.jsx         ← Sync history table
│       ├── CatalogOrderSummary.jsx        ← Order details display
│       └── CatalogStatsCard.jsx           ← Dashboard widget
```

### Files to Modify (Existing)
```
backend/
├── src/
│   ├── models/
│   │   ├── Agency.ts                      + catalog fields
│   │   ├── Package.ts                     + catalog fields
│   │   ├── Lead.ts                        + catalog order data
│   │   └── Booking.ts                     + catalog source
│   ├── controllers/
│   │   └── packageController.ts           + trigger sync
│   ├── routes/
│   │   └── packages.ts                    + sync endpoint

bot/
├── src/
│   ├── webhook.js                         + handle orders
│   └── botRouter.js                       + route to handler

frontend/
├── src/
│   ├── pages/
│   │   ├── Settings.jsx                   + Catalog tab
│   │   ├── Packages.jsx                   + Status column
│   │   ├── PackageForm.jsx                + Sync checkbox
│   │   └── Dashboard.jsx                  + Stats widget
│   └── components/
│       ├── LeadCard.jsx                   + Catalog badge
│       └── LeadPipeline.jsx               (updates)

Database/
└── migrations/
    └── [timestamp]_add_catalog_fields.sql  ← NEW migration
```

---

## 🔑 Key Data Flows

### Flow 1: Save Catalog ID
```
User fills Settings form
        ↓
Submit with credentials
        ↓
API validates token with Meta
        ↓
Save Catalog ID securely
        ↓
Save to Agency.catalogConfig
        ↓
Return success ✓
```

### Flow 2: Package Auto-Sync
```
User creates/edits Package
        ↓
Click Save
        ↓
Package saved to DB
        ↓
Check: Is catalog enabled?
        ↓ YES
Enqueue sync job
        ↓
Return immediately (don't wait)
        ↓
[Async] Call Meta API
        ↓
Save catalogProductId
        ↓
Update sync status
```

### Flow 3: Catalog Order to Lead
```
Customer places order in Catalog
        ↓
WhatsApp sends webhook to your server
        ↓
catalogOrderHandler processes:
  - Extract customer info
  - Extract order items
  - Calculate total
        ↓
Create Lead (source=catalog_order)
        ↓
Create Booking (linked to lead)
        ↓
Send confirmation to customer
        ↓
Notify agent
        ↓
Lead appears in dashboard ✓
```

---

## 💾 Database Schema Changes

### New Fields in AGENCIES table
```sql
catalog_config JSONB = {
  whatsappCatalogId: string,
  enableCatalogSync: boolean,
  catalogSyncStatus: 'active'|'inactive'|'error'
}
catalog_sync_status VARCHAR
last_catalog_sync TIMESTAMP
```

### New Fields in PACKAGES table
```sql
catalog_product_id VARCHAR
catalog_sync_status VARCHAR ('synced'|'failed'|'pending')
last_catalog_sync TIMESTAMP
```

### New Fields in LEADS table
```sql
catalog_order_data JSONB = {
  catalogOrderId: string,
  items: [{packageId, packageName, quantity, price}],
  totalAmount: number,
  customerMessage: string,
  orderedAt: timestamp
}
```

### New Fields in BOOKINGS table
```sql
catalog_order_id VARCHAR
source VARCHAR ('manual'|'catalog'|'whatsapp')
catalog_order_items JSONB
```

---

## 🛡️ Security Checklist

- ✅ Catalog ID stored securely
- ✅ Sensitive provider credential data never logged or exposed
- ✅ Webhook signature validation
- ✅ Rate limiting on order creation
- ✅ Input validation on all API endpoints
- ✅ HTTPS for all Meta API calls
- ✅ Database encryption for sensitive fields
- ✅ Audit logging for all changes
- ✅ Access control for settings modifications

---

## 🧪 Testing Strategy

### Unit Tests
```
- catalogSyncService.ts
  ✓ Package to product mapping
  ✓ API error handling
  ✓ Sync status updates

- catalogOrderHandler.js
  ✓ Order parsing
  ✓ Lead creation
  ✓ Booking creation

- Models
  ✓ Field validations
  ✓ Relationships
```

### Integration Tests
```
- Package creation → Sync triggered
- Settings save → Catalog ID saved
- Webhook received → Lead created
- Lead created → Booking linked
```

### End-to-End Tests
```
1. Save Catalog ID ✓
2. Create package → Syncs to catalog ✓
3. Customer orders ✓
4. Webhook processes order ✓
5. Lead visible in dashboard ✓
6. Agent can quote/confirm ✓
```

---

## 📊 Monitoring & Logging

### What to Log
```
CATALOG_SYNC_STARTED
CATALOG_SYNC_SUCCESS
CATALOG_SYNC_FAILED
CATALOG_ORDER_RECEIVED
CATALOG_LEAD_CREATED
CATALOG_CONFIRMATION_SENT
WEBHOOK_SIGNATURE_VALID
WEBHOOK_SIGNATURE_INVALID
DUPLICATE_ORDER_DETECTED
PACKAGE_NOT_FOUND_IN_CATALOG
```

### Metrics to Track
```
- Packages synced (count, %)
- Sync success rate
- Order processing latency
- Lead creation latency
- Webhook delivery success
- Error rate
- Duplicate order rate
```

### Alert Thresholds
```
- Sync failure rate > 5% ⚠️
- Order processing latency > 10s ⚠️
- Webhook failures > 3 in 10 min ⚠️
- Invalid signatures detected ⚠️
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing (100% critical paths)
- [ ] Code review completed
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Feature flags ready
- [ ] Monitoring configured
- [ ] Alert channels active
- [ ] Team trained

### Deployment
- [ ] Backup database
- [ ] Run migrations
- [ ] Deploy backend code
- [ ] Deploy frontend code
- [ ] Deploy bot code
- [ ] Verify health checks
- [ ] Test catalog sync
- [ ] Test order webhook

### Post-Deployment
- [ ] Monitor error logs
- [ ] Check sync success rate
- [ ] Verify lead creation
- [ ] Monitor performance
- [ ] Gather user feedback
- [ ] Update documentation

---

## 📞 Support Guide

### Common Issues & Quick Fixes

**Q: "Invalid Catalog ID" error**
- A: Verify the Catalog ID in Meta Commerce Manager and confirm the existing WhatsApp connection is active

**Q: Orders not creating leads**
- A: Check webhook logs, verify handler is registered

**Q: Packages not syncing**
- A: Verify catalog is enabled in settings and the Catalog ID is still valid

**Q: Duplicate leads**
- A: Check for existing catalogOrderId, implement deduplication

**Q: Slow sync performance**
- A: Enable job queue processing, increase timeout

---

## 📚 Documentation Files Created

1. **CATALOG_MANAGEMENT_PLAN.md** (Main Plan)
   - Complete architecture
   - Phase breakdown
   - Implementation steps

2. **CATALOG_IMPLEMENTATION_GUIDE.md** (Step-by-Step)
   - User workflows
   - File structure
   - Configuration

3. **CODE_SNIPPETS_CATALOG_IMPLEMENTATION.md** (Code)
   - Ready-to-use code
   - Database migrations
   - API endpoints

4. **IMPLEMENTATION_TIMELINE.md** (Timeline & Checklist)
   - 20-day timeline
   - Daily tasks
   - Success metrics

5. **QUICK_REFERENCE_GUIDE.md** (This Document)
   - Quick overview
   - Key components
   - Common issues

---

## 🎬 Getting Started

### Step 1: Review Documents
1. Read this Quick Reference
2. Read CATALOG_MANAGEMENT_PLAN.md
3. Read CATALOG_IMPLEMENTATION_GUIDE.md

### Step 2: Setup
1. Review database migration
2. Set up environment variables
3. Create git feature branch

### Step 3: Implement
1. Create database migration
2. Update models
3. Create catalogSyncService
4. Follow 20-day timeline

### Step 4: Test
1. Unit tests first
2. Integration tests
3. End-to-end flow test
4. Meta Sandbox testing

### Step 5: Deploy
1. Code review
2. Pre-deployment checklist
3. Gradual rollout (10% → 50% → 100%)
4. Monitor metrics

---

## 💡 Pro Tips

1. **Use async queue** for catalog sync to avoid blocking
2. **Validate webhooks** to prevent processing fake orders
3. **Implement retries** for failed syncs
4. **Log everything** for debugging
5. **Test webhook** endpoint before going live
6. **Encrypt tokens** before storing
7. **Handle duplicates** gracefully
8. **Version your API** for future changes
9. **Monitor metrics** from day 1
10. **Document as you code** for team clarity

---

## 📞 Questions to Ask Before Starting

- [ ] Do we have Meta Business Manager setup?
- [ ] Do we have test Catalog ID settings?
- [ ] What's our deployment timeline?
- [ ] Who tests with Meta sandbox?
- [ ] What monitoring tools do we use?
- [ ] Any regulatory requirements?
- [ ] Multi-tenant or single agency?
- [ ] Need inventory sync in future?
- [ ] Payment integration needed?
- [ ] What's our rollback procedure?

---

## 🎯 Success Metrics

**After 30 Days:**
- ✓ Feature deployed to production
- ✓ Sync success rate > 95%
- ✓ Order processing latency < 5 sec
- ✓ 0 critical bugs
- ✓ Team fully trained
- ✓ Monitoring alerts configured

**After 90 Days:**
- ✓ 50+ packages synced
- ✓ 20+ catalog orders processed
- ✓ 30%+ conversion rate (catalog → booking)
- ✓ Customer feedback positive
- ✓ Performance optimized

---

## 📖 Additional Resources

**Meta Documentation:**
- Meta Catalog API: https://developers.facebook.com/docs/commerce-api/catalogs
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp/cloud-api/

**Your Documentation:**
- [CATALOG_MANAGEMENT_PLAN.md](CATALOG_MANAGEMENT_PLAN.md)
- [CATALOG_IMPLEMENTATION_GUIDE.md](CATALOG_IMPLEMENTATION_GUIDE.md)
- [CODE_SNIPPETS_CATALOG_IMPLEMENTATION.md](CODE_SNIPPETS_CATALOG_IMPLEMENTATION.md)
- [IMPLEMENTATION_TIMELINE.md](IMPLEMENTATION_TIMELINE.md)

---

## 🔄 Version History

| Date | Version | Change |
|------|---------|--------|
| 2024-04-18 | 1.0 | Initial planning document |
| - | 1.1 | Code snippets added |
| - | 1.2 | Timeline created |
| - | 1.3 | Quick reference added |

---

**Ready to implement? Start with Phase 1, Day 1: Database setup!**

For questions or clarifications, refer to the main CATALOG_MANAGEMENT_PLAN.md or CODE_SNIPPETS_CATALOG_IMPLEMENTATION.md

