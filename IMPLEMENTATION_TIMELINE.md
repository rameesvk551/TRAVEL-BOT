# Catalog Management Feature - Implementation Timeline & Checklist

## 📅 Implementation Timeline

### Phase 1: Backend Foundation (Days 1-5)
**Goal:** Set up database, models, and core sync service

#### Day 1: Database & Models
- [ ] Create and run database migration
  - [ ] Add catalog fields to agencies table
  - [ ] Add catalog fields to packages table
  - [ ] Add catalog fields to leads table
  - [ ] Add catalog fields to bookings table
  - [ ] Create indexes for catalog lookups
  - [ ] Verify migration runs without errors

- [ ] Update Agency Model
  - [ ] Add catalogConfig JSONB field
  - [ ] Add catalogSyncStatus enum
  - [ ] Add type definitions

- [ ] Update Package Model
  - [ ] Add catalogProductId field
  - [ ] Add catalogSyncStatus field
  - [ ] Add lastCatalogSync timestamp

**Completion Checklist:** Models compile, migrations run, DB schema correct

#### Day 2-3: Catalog Sync Service
- [ ] Create catalogSyncService.ts
  - [ ] Implement syncPackageToCatalog()
  - [ ] Implement syncAllPackages()
  - [ ] Implement removePackageFromCatalog()
  - [ ] Implement getCatalogSyncStatus()
  - [ ] Add Meta API integration
  - [ ] Add error handling & logging

- [ ] Unit tests for catalogSyncService
  - [ ] Test package to product mapping
  - [ ] Test API error handling
  - [ ] Test sync status updates

**Completion Checklist:** Service code compiles, unit tests pass

#### Day 4: Catalog Settings API
- [ ] Create/update catalogSettings.ts routes
  - [ ] PUT /agencies/:id/catalog-settings
  - [ ] GET /agencies/:id/catalog-settings
  - [ ] POST /agencies/:id/sync-all-packages
  - [ ] GET /agencies/:id/catalog-status

- [ ] Add middleware & validation
  - [ ] Auth middleware check
  - [ ] Agency ownership validation
  - [ ] Input validation with Zod

- [ ] Test API endpoints
  - [ ] Postman/curl tests for each endpoint
  - [ ] Error scenarios
  - [ ] Token encryption verification

**Completion Checklist:** All routes respond correctly, token encrypted

#### Day 5: Package Controller Integration
- [ ] Update packageController.ts
  - [ ] Modify createPackage() to trigger sync
  - [ ] Modify updatePackage() to trigger sync
  - [ ] Add syncToCatalog checkbox handling
  - [ ] Return catalogSyncStatus in response

- [ ] Setup job queue (optional but recommended)
  - [ ] Install Bull + Redis
  - [ ] Create catalogSyncQueue
  - [ ] Setup worker process
  - [ ] Test queue functionality

- [ ] Integration tests
  - [ ] Create package → Verify sync triggered
  - [ ] Update package → Verify sync triggered
  - [ ] Disable sync → Verify not triggered

**Completion Checklist:** Package save triggers sync, queue working

---

### Phase 2: Webhook & Lead Creation (Days 6-10)
**Goal:** Handle catalog orders and create leads

#### Day 6-7: Catalog Order Handler
- [ ] Create catalogOrderHandler.js
  - [ ] Parse catalog order webhook
  - [ ] Extract order items & total
  - [ ] Find/create customer
  - [ ] Validate order data

- [ ] Lead Creation Logic
  - [ ] Create Lead with source='catalog_order'
  - [ ] Store catalogOrderData in JSONB
  - [ ] Link to customer
  - [ ] Set correct status/stage

- [ ] Booking Creation
  - [ ] Create Booking linked to lead
  - [ ] Set source='catalog'
  - [ ] Store catalogOrderId
  - [ ] Calculate total price

- [ ] Unit Tests
  - [ ] Test order parsing
  - [ ] Test lead creation
  - [ ] Test booking creation
  - [ ] Test error scenarios

**Completion Checklist:** Handler creates leads correctly, tests pass

#### Day 8: Webhook Integration
- [ ] Update webhook.js
  - [ ] Add order event routing
  - [ ] Add order handler call
  - [ ] Add error handling

- [ ] Update botRouter.js
  - [ ] Check for message.order
  - [ ] Route to catalogOrderHandler
  - [ ] Handle handler response

- [ ] Test webhook
  - [ ] Send test order message (via Postman/webhook tool)
  - [ ] Verify lead created
  - [ ] Verify booking created
  - [ ] Check database records

**Completion Checklist:** Webhook receives order, lead created

#### Day 9: Confirmation & Notification
- [ ] Create order confirmation message
  - [ ] Create template or dynamic message
  - [ ] Send to customer via WhatsApp
  - [ ] Include order ID, total, items

- [ ] Agent notification
  - [ ] Send in-app notification
  - [ ] Send email notification (optional)
  - [ ] Update dashboard in real-time

- [ ] Error handling
  - [ ] Fail gracefully if message send fails
  - [ ] Log all events
  - [ ] Create fallback alerts

- [ ] Test
  - [ ] Test confirmation message sent
  - [ ] Test agent gets notification
  - [ ] Test error scenarios

**Completion Checklist:** Confirmations sent, agent notified

#### Day 10: Lead Model Updates
- [ ] Update Lead model
  - [ ] Add source enum value
  - [ ] Add stage enum value
  - [ ] Add catalogOrderData JSONB field

- [ ] Update Booking model
  - [ ] Add source field
  - [ ] Add catalogOrderId field
  - [ ] Add catalogOrderItems field

- [ ] Database migration for model changes
  - [ ] Run migration
  - [ ] Verify schema

- [ ] Test data retrieval
  - [ ] Query leads by source
  - [ ] Query bookings by catalog
  - [ ] Verify all data stored correctly

**Completion Checklist:** Models updated, migrations run, queries work

---

### Phase 3: Frontend (Days 11-15)
**Goal:** Create UI for settings, package sync, and lead details

#### Day 11: Settings Page
- [ ] Create CatalogSettingsForm.jsx
  - [ ] Form inputs for credentials
  - [ ] Test connection button
  - [ ] Enable/disable toggle
  - [ ] Error/success messages

- [ ] Add to Settings page
  - [ ] Create new tab "Catalog Management"
  - [ ] Include CatalogSettingsForm
  - [ ] Include sync history table

- [ ] Test settings UI
  - [ ] Form submission
  - [ ] Token validation
  - [ ] Enable/disable functionality
  - [ ] Error handling

**Completion Checklist:** Settings form works, can save credentials

#### Day 12: Package Updates UI
- [ ] Update Packages page
  - [ ] Add "Catalog Status" column
  - [ ] Show sync state (synced/failed/syncing/pending)
  - [ ] Add sync timestamp
  - [ ] Add retry button for failed

- [ ] Update PackageForm.jsx
  - [ ] Add "Sync to Catalog" checkbox
  - [ ] Show syncing status during save
  - [ ] Display success/error toast
  - [ ] Add link to catalog product

- [ ] Test package UI
  - [ ] Create package → Shows syncing
  - [ ] Wait for sync → Shows synced
  - [ ] Sync fails → Shows error + retry

**Completion Checklist:** Package status visible, can retry sync

#### Day 13-14: Lead & Booking UI
- [ ] Create CatalogOrderSummary.jsx
  - [ ] Show order ID
  - [ ] Show items with quantities/prices
  - [ ] Show total amount
  - [ ] Show customer message

- [ ] Update Lead Card
  - [ ] Show "Catalog Order" badge if applicable
  - [ ] Show order summary
  - [ ] Link to order details
  - [ ] Quick actions for agent

- [ ] Update Lead Detail Page
  - [ ] Show full catalog order data
  - [ ] Show linked booking
  - [ ] Show confirmation status
  - [ ] Allow agent to take action

- [ ] Test lead UI
  - [ ] Create catalog order
  - [ ] Verify appears in leads
  - [ ] Verify all data displays
  - [ ] Test agent actions

**Completion Checklist:** Leads show catalog order data correctly

#### Day 15: Dashboard & Analytics
- [ ] Create CatalogStatsCard.jsx
  - [ ] Total catalog leads (this month)
  - [ ] Conversion rate
  - [ ] Top ordered packages
  - [ ] Sync status

- [ ] Add to Dashboard.jsx
  - [ ] Include stats card
  - [ ] Position appropriately
  - [ ] Style consistently

- [ ] Test dashboard
  - [ ] Stats calculate correctly
  - [ ] Updates in real-time
  - [ ] Mobile responsive

**Completion Checklist:** Dashboard shows catalog metrics

---

### Phase 4: Testing & Optimization (Days 16-20)
**Goal:** Full testing, bug fixes, performance optimization

#### Day 16-17: End-to-End Testing
- [ ] Setup test environment
  - [ ] Use Meta Sandbox catalog
  - [ ] Get test credentials
  - [ ] Create test packages

- [ ] Complete flow test
  - [ ] Save credentials in settings ✓
  - [ ] Create package → syncs to catalog ✓
  - [ ] Package appears in catalog ✓
  - [ ] Customer orders from catalog ✓
  - [ ] Webhook receives order ✓
  - [ ] Lead created with details ✓
  - [ ] Booking created ✓
  - [ ] Confirmation sent ✓
  - [ ] Agent notified ✓
  - [ ] Lead appears in dashboard ✓

- [ ] Error scenarios
  - [ ] Invalid credentials
  - [ ] Sync fails → Package still saves
  - [ ] Webhook fails → Log error but continue
  - [ ] Missing package → Order still creates lead
  - [ ] Rate limiting

**Completion Checklist:** Full flow works end-to-end

#### Day 18: Performance & Optimization
- [ ] Database optimization
  - [ ] Add indexes (if not done)
  - [ ] Test query performance
  - [ ] Analyze slow queries

- [ ] Backend optimization
  - [ ] Reduce API response time
  - [ ] Optimize queue processing
  - [ ] Add caching (if needed)

- [ ] Frontend optimization
  - [ ] Lazy load components
  - [ ] Optimize re-renders
  - [ ] Minimize bundle size

- [ ] Monitor & profile
  - [ ] Use APM tools
  - [ ] Check memory usage
  - [ ] Monitor queue depth

**Completion Checklist:** Performance benchmarks met

#### Day 19: Bug Fixes & Edge Cases
- [ ] Fix identified bugs
- [ ] Handle edge cases
  - [ ] Duplicate orders
  - [ ] Deleted packages
  - [ ] Invalid webhook signatures
  - [ ] Concurrent sync requests

- [ ] Security audit
  - [ ] Check token encryption
  - [ ] Validate webhook signature
  - [ ] Check permissions
  - [ ] Review error messages

**Completion Checklist:** No critical bugs, security reviewed

#### Day 20: Documentation & Deployment Prep
- [ ] Finalize documentation
  - [ ] README for feature
  - [ ] API documentation
  - [ ] Troubleshooting guide
  - [ ] Admin guide

- [ ] Deployment checklist
  - [ ] Environment variables set
  - [ ] Database migrations backed up
  - [ ] Feature flags ready
  - [ ] Rollback plan

- [ ] Training
  - [ ] Admin training docs
  - [ ] Agent training
  - [ ] Support team prep

**Completion Checklist:** Ready for production deployment

---

## ✅ Feature Completion Checklist

### Backend Components
- [ ] Database migration created and tested
- [ ] Agency model updated
- [ ] Package model updated
- [ ] Lead model updated
- [ ] Booking model updated
- [ ] catalogSyncService.ts created
- [ ] catalogOrderHandler.js created
- [ ] Catalog settings routes created
- [ ] Package controller updated for sync
- [ ] Webhook router updated for orders
- [ ] Encryption utilities implemented
- [ ] Error handling & logging complete
- [ ] API validation with Zod
- [ ] Unit tests written
- [ ] Integration tests written

### Frontend Components
- [ ] CatalogSettingsForm.jsx created
- [ ] Settings.jsx tab added
- [ ] Packages.jsx status column added
- [ ] PackageForm.jsx sync checkbox added
- [ ] CatalogOrderSummary.jsx created
- [ ] LeadCard.jsx updated
- [ ] Lead detail page updated
- [ ] CatalogStatsCard.jsx created
- [ ] Dashboard updated
- [ ] Error/success notifications
- [ ] Loading states
- [ ] Mobile responsive design
- [ ] Accessibility checks

### Testing
- [ ] Unit tests for service
- [ ] Unit tests for handlers
- [ ] Integration tests for API
- [ ] End-to-end flow tests
- [ ] Error scenario tests
- [ ] Load testing
- [ ] Security testing

### Deployment
- [ ] Environment variables configured
- [ ] Database migrations backed up
- [ ] Feature flags implemented
- [ ] Rollback plan documented
- [ ] Monitoring setup
- [ ] Logging configured
- [ ] Error tracking setup

### Documentation
- [ ] Implementation plan documented ✅
- [ ] Code snippets provided ✅
- [ ] API documentation
- [ ] Admin guide
- [ ] Troubleshooting guide
- [ ] Training materials

---

## 📊 Key Metrics to Track

### During Implementation
- **Code coverage:** Target >80%
- **Build time:** < 5 minutes
- **Test execution time:** < 10 minutes

### Post-Launch Monitoring
- **Sync success rate:** > 95%
- **Order processing latency:** < 5 seconds
- **Lead creation latency:** < 2 seconds
- **Webhook delivery success:** > 99%
- **Error rate:** < 0.1%

---

## 🎯 Success Criteria

### Functional
- ✓ User can save Catalog ID
- ✓ Packages auto-sync to catalog
- ✓ Customers can order from catalog
- ✓ Orders create leads with details
- ✓ Agents are notified immediately

### Non-Functional
- ✓ < 2 second lead creation time
- ✓ < 10 second package sync time
- ✓ Zero data loss on sync failures
- ✓ Secure token storage
- ✓ No duplicate order processing

### User Experience
- ✓ Clear settings interface
- ✓ Visual sync status feedback
- ✓ Informative error messages
- ✓ Quick order-to-lead flow
- ✓ Easy agent workflow

---

## 🚨 Common Pitfalls to Avoid

1. **Blocking API calls** → Use async queue for sync
2. **Exposing provider credentials** → Keep provider credentials secure and avoid logging them
3. **Duplicate orders** → Check for existing catalogOrderId
4. **Failing silently** → Log all errors comprehensively
5. **Wrong timezone** → Store all timestamps in UTC
6. **Missing validation** → Validate all webhook data
7. **Poor error recovery** → Implement retry logic
8. **Unclear feedback** → Show clear status to users
9. **No test coverage** → Write tests as you code
10. **Rushing deployment** → Follow testing checklist

---

## 📞 Support & Troubleshooting

### Common Issues & Solutions

**Issue:** Catalog sync fails with "Invalid Catalog ID"
- **Solution:** Verify the Catalog ID in Meta Commerce Manager and refresh the existing WhatsApp connection

**Issue:** Orders not creating leads
- **Solution:** Check webhook logs, verify handler registration, test webhook manually

**Issue:** Duplicate leads created
- **Solution:** Add check for existing catalogOrderId before creating

**Issue:** Sync very slow
- **Solution:** Move to async queue, implement batch processing

**Issue:** Settings won't save
- **Solution:** Validate form inputs, check database permissions, review logs

---

## 📈 Future Enhancements

1. **Inventory Sync:** Update catalog when package spots fill
2. **Price Updates:** Auto-update catalog on price changes
3. **Bulk Operations:** Resync all packages with one click
4. **Analytics:** Track which products sell best
5. **A/B Testing:** Compare catalog vs direct inquiry conversion
6. **Multi-Catalog:** Support multiple catalogs per agency
7. **Catalog Campaigns:** Broadcast catalog link via campaigns
8. **Smart Recommendations:** Suggest related packages in catalog
9. **Review Sync:** Sync customer reviews to catalog
10. **Inventory Alerts:** Alert when packages running low

---

## Quick Commands Reference

```bash
# Database
npm run migrate:up              # Run migrations
npm run migrate:down            # Rollback migrations
npm run seed:catalog            # Seed test data

# Testing
npm test                        # Run all tests
npm run test:coverage          # Generate coverage report
npm run test:e2e               # Run E2E tests

# Development
npm run dev                    # Start dev server
npm run dev:bot               # Start bot in dev mode

# Production
npm run build                 # Build for production
npm run start                 # Start production server
npm run pm2:start             # Start with PM2

# Monitoring
npm run logs                  # View live logs
npm run logs:error            # View error logs only
npm run health:check          # Health check endpoint
```

