# Travel-Bot Codebase Overview

## Architecture

The project is organized into 4 main components:
- **Backend** (`/backend`): Node.js/Express API server
- **Bot** (`/bot`): WhatsApp webhook handler & message routing
- **Frontend** (`/frontend`): React/Vite web dashboard
- **Docs** (`/docs`): Documentation and flow diagrams

---

## 1. WhatsApp Integration & Webhook Handling

### Entry Point: `bot/src/webhook.js`
**Responsibilities:**
- Handles Meta/WhatsApp webhook verification (GET /webhook)
- Processes incoming messages (POST /webhook)
- Verifies signatures: Meta HMAC-SHA256 or Marketing OS secret
- Always returns 200 immediately (Meta requirement), then processes async
- Routes messages through session manager and bot router

**Key Functions:**
- `handleVerification()` - Meta challenge response
- `verifySignature()` - HMAC-SHA256 validation
- `handleIncoming()` - Message processing pipeline

**Environment Variables:**
- `WEBHOOK_VERIFY_TOKEN` - Meta verification token
- `WEBHOOK_APP_SECRET` - Meta HMAC secret
- `MARKETING_OS_WEBHOOK_SECRET` - Alternative provider secret

### Message Router: `bot/src/botRouter.js`
**Routes messages based on context:**
1. **Reset keywords** (hi, hello, menu, restart) → Fresh greeting lead
2. **Active handoff** → Forward to assigned agent
3. **Order type messages** → Order handler
4. **Interactive actions** (Flow CTAs) → Travel flow handler first
5. **Handoff detection** → Escalate to agent
6. **Payment states** → Payment handler
7. **Review states** → Review handler
8. **Default** → Travel flow handler

**Reset Keywords:** hi, hello, start, menu, main menu, restart

### Message Handlers: `bot/src/handlers/`

#### **leadCapture.js**
Implements state machine for initial lead information collection:
- **NEW** → Detect language from first message (EN/ML)
- **COLLECTING_NAME** → Validate name (min 2 chars)
- **COLLECTING_DESTINATION** → Save destination preference
- **COLLECTING_DATE** → Parse travel dates
- **COLLECTING_TRAVELLERS** → Number of people
- **COLLECTING_NOTES** → Additional requirements

Uses `sessionManager` to persist state and `messageTemplates` for language-aware responses.

#### **packageDiscoveryHandler.js**
- Intent detection: Checks for keywords (package, tour, holiday, itinerary)
- Package search and filtering
- Formats package lists with price (in paise), duration, destinations
- Bilingual support (EN/ML)
- Sends formatted package catalogs back to customer

#### **travelFlowHandler.js**
Main conversation flow orchestrator:
- **MENU** → Display main options
- **CATEGORY_PACKAGES** → Show DOMESTIC/INTERNATIONAL packages
- **PACKAGE_DETAIL** → Show full itinerary and pricing
- **ENQUIRY_STEPS** → Collect detailed enquiry info
- Integrates WhatsApp Flows for interactive UX
- Uses environment variables for Flow IDs and CTAs

#### **quoteHandler.js**
- Generates quotes based on selected packages and traveller info
- Sends formatted quote with breakdowns
- Stores quote information in database

#### **paymentHandler.js**
- Handles payment-related messages during PAYMENT_PENDING step
- Integrates with payment service
- Tracks payment status

#### **reviewHandler.js**
- Collects review/feedback during REVIEW step
- Stores customer ratings and comments

#### **orderHandler.js**
- Processes Meta Commerce cart orders
- Converts orders to bookings

#### **handoffHandler.js**
- Detects escalation keywords (help, agent, problem, issue)
- Hands off to assigned agent or available agent
- Manages handoff state in session

#### **agentLeadHandler.js**
- Handles agent actions on leads
- Agent assignment and reassignment
- Status updates from agent interface

---

## 2. Package & Product Management System

### Database Models

#### **Package.ts**
```
- id (UUID, PK)
- agencyId (FK)
- name (string)
- category (DOMESTIC | INTERNATIONAL)
- duration (e.g., "3 Nights 4 Days")
- destinations (array of strings)
- inclusions (array of strings)
- exclusions (array of strings)
- basePrice (integer, stored in paise)
- imageUrl (Cloudinary URL)
- summary (max 2000 chars)
- brochureUrl (PDF on Cloudinary)
- brochureFileName
- itinerary (array of day objects with title, description, activities)
- isActive (boolean)
```

#### **Itinerary.ts**
Related model for detailed day-by-day itineraries
- Day number, title, description
- Activities array

### Repository: `packageRepository.ts`
- `findAllByAgency(agencyId, activeOnly)` - List packages (optionally active only)
- `findByIdAndAgency(packageId, agencyId)` - Get single package
- `create(data)` - Create new package
- `update(pkg, updates)` - Update package

### Service: `packageService.ts`
High-level package operations (CRUD, validation, image/PDF handling)

### Controller: `packageController.ts`
REST endpoints:
- `GET /api/packages` - List all packages (requires PACKAGES_VIEW permission)
- `GET /api/packages/:id` - Get package details
- `POST /api/packages` - Create package (ADMIN only)
- `PATCH /api/packages/:id` - Update package (ADMIN only)
- `DELETE /api/packages/:id` - Deactivate package
- `POST /api/packages/upload-image` - Upload image to Cloudinary
- `POST /api/packages/upload-brochure` - Upload PDF brochure

### Routes: `routes/packages.ts`
- Uses Zod validation for request bodies
- Image upload: 5MB max, image/* MIME types only
- Brochure upload: 10MB max, PDF only
- Requires authentication and permissions

### Frontend: `frontend/src/pages/Packages.jsx`
- Displays package catalog in table
- Shows: name, category, destinations, duration, price, status
- **ADMIN only:** Can create, edit, deactivate packages
- Uses `@tanstack/react-query` for data fetching and caching
- Links to package detail and form pages

### Frontend: `frontend/src/pages/PackageForm.jsx`
- Create/edit package form
- Upload image and brochure
- Set itinerary (day-by-day builder)
- Price in rupees (converted to paise for storage)

---

## 3. Lead Management System

### Database Models

#### **Lead.ts**
```
- id (UUID, PK)
- customerId (FK)
- agencyId (FK)
- assignedAgentId (FK, nullable)
- destination (string)
- travelDates (free text: "Dec 15-20")
- travelStart, travelEnd (DATE fields)
- travellers (integer)
- budgetPerPerson (integer, in paise)
- interest (DOMESTIC | INTERNATIONAL)
- packageId (FK, nullable)
- status (enum): JUST_CONTACTED | NEW | ENQUIRY | CONTACTED | QUOTED | NEGOTIATING | BOOKED | LOST | CANCELLED
- lostReason (string, optional)
- notes (text)
- createdAt, updatedAt (timestamps)
```

### Service: `leadService.ts`
**Key Functions:**
- `listLeads(agencyId, filters)` - List with filtering:
  - By status (single or array)
  - By assigned agent
  - By date range
  - By search (customer name or phone)
  - Pagination (page, pageSize)
- `createLead(data)` - Create from customer info
- `updateLead(leadId, updates)` - Update status, assignment, notes
- `getLeadById(leadId)` - Fetch with relations (customer, agent, package)
- Lead scoring service (scoring.ts) - Calculates lead quality/priority

### Repository: `leadRepository.ts` (if exists, otherwise in service)
Direct database access patterns for leads

### Controller: `leadController.ts`
REST endpoints:
- `GET /api/leads` - List leads with filters
- `GET /api/leads/:id` - Get lead details
- `POST /api/leads` - Create new lead
- `PATCH /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Soft delete/cancel lead

### Routes: `routes/leads.ts`
**Request Validation (Zod schemas):**

**Create Lead:**
- customerId (optional if customerPhone provided)
- customerName, customerPhone (optional if customerId provided)
- destination, travelDates, travellers, budgetPerPerson
- interest (DOMESTIC | INTERNATIONAL, nullable)
- assignedAgentId (nullable)
- packageId (nullable)
- status (defaults to JUST_CONTACTED)

**Update Lead:**
- status, assignedAgentId, destination, travelDates, travellers
- budgetPerPerson, interest, packageId, notes, lostReason
- travelStart, travelEnd (dates)

**Permissions:**
- LEADS_VIEW - List/view leads
- LEADS_MANAGE - Create/update/delete leads

### Lead Creation Flow
1. **WhatsApp Bot** - `handleLeadCapture.js` collects info via multi-step conversation
2. **ensureLead()** function in `travelFlowHandler.js` - Creates lead in DB if not exists
3. **Manual creation** - Via frontend Leads page
4. **API creation** - Direct POST to /api/leads
5. Lead status progresses: JUST_CONTACTED → NEW → ENQUIRY → CONTACTED → QUOTED → NEGOTIATING → BOOKED/LOST/CANCELLED

### Frontend: `frontend/src/pages/Leads.jsx`
- Displays all leads in pipeline view
- Filter by status, agent, customer
- Shows customer name, phone, destination, travel dates, budget
- Assign to agent
- Update status
- Add notes
- View booking timeline

---

## 4. Settings & Configuration System

### Database Models

#### **Agency.ts** (Configuration Storage)
```
- id (UUID, PK)
- name, phone, email (unique)
- whatsappNumber (the customer-facing number)
- whatsappProvider (SELF_HOSTED | INTERAKT | MARKETING_OS)
- whatsappConnectionStatus (NOT_CONNECTED | PENDING | CONNECTED | FAILED)
- marketingOsTenantId (for Marketing OS integration)
- marketingOsPartnerId (for Marketing OS integration)
- marketingOsApiKey (encrypted)
- razorpayKeyId, razorpayKeySecret (payment credentials)
- webhookUrl, webhookSecret (for outgoing events)
- settings (JSONB) - flexible key-value store for custom settings
```

#### **Agent.ts** (Team Settings)
```
- id (UUID, PK)
- agencyId (FK)
- name, email, phone
- role (ADMIN | MANAGER | AGENT)
- permissions (array)
- status (ACTIVE | INACTIVE)
- assignedLeadCount (for workload balancing)
```

### Controller: `settingsController.ts` (if exists)
Likely endpoints:
- `GET /api/settings` - Get agency settings
- `PATCH /api/settings` - Update settings
- `POST /api/settings/whatsapp-connect` - WhatsApp integration
- `POST /api/settings/razorpay-verify` - Payment credentials
- `GET /api/settings/connections` - Check all integration statuses

### Frontend: `frontend/src/pages/Settings.jsx`
**Major Sections:**
1. **Agency Info**
   - Name, email, phone
   - WhatsApp Business number

2. **WhatsApp Integration**
   - Provider selection (SELF_HOSTED, INTERAKT, MARKETING_OS)
   - Facebook embedded signup flow
   - Connection status display (NOT_CONNECTED → PENDING → CONNECTED)
   - Webhook setup instructions

3. **Payment Settings (Razorpay)**
   - Key ID and Secret
   - Validation and encryption

4. **Team Management**
   - Add/remove agents
   - Assign roles and permissions
   - View workload

5. **Webhook Configuration**
   - Webhook URL
   - Secret token
   - Test webhook

6. **Business Hours**
   - Operating hours per day
   - Auto-responder templates

**Environment Variables (.env file):**
```
# Core
NODE_ENV=production
BACKEND_PORT=3000
BOT_PORT=3001
BASE_URL=https://travel-bot.example.com
DATABASE_URL=postgresql://user:pass@host/db

# WhatsApp
WEBHOOK_VERIFY_TOKEN=your_verify_token
WEBHOOK_APP_SECRET=your_app_secret
MARKETING_OS_WEBHOOK_SECRET=optional_secret

# WhatsApp Flow IDs
WHATSAPP_TRIP_FLOW_ID=flow_id_for_packages
WHATSAPP_TRIP_FLOW_FIRST_SCREEN_ID=PACKAGE_SELECTOR
WHATSAPP_TRIP_FLOW_CTA=View Packages
WHATSAPP_TRIP_ENQUIRY_FLOW_ID=flow_id_for_enquiry
WHATSAPP_TRIP_ENQUIRY_FIRST_SCREEN_ID=ENQUIRY_FORM
WHATSAPP_TRIP_ENQUIRY_CTA=Share Enquiry

# Media & Files
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Auth & Tokens
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
REFRESH_TOKEN_EXPIRE=30d

# Features
ENABLE_PAYMENT_COLLECTION=true
ENABLE_REVIEWS=true
ENABLE_REFERRALS=true
```

### Storage Methods
1. **Agency table** - Core configuration
2. **Settings JSONB** - Flexible custom settings
3. **Environment variables** - Secrets and deployment config
4. **.env file** - Local development configuration

---

## 5. API Routes & Endpoints Structure

### Base: `backend/src/routes/index.ts`
Registers all route modules:

### Available Route Modules
```
/api/agencies          - Agency management
/api/agents            - Team/agent management
/api/analytics         - Dashboard analytics
/api/auth              - Login, token refresh, password reset
/api/bookings          - Booking operations
/api/campaigns         - Marketing campaigns
/api/drips             - Email drip sequences
/api/itineraries       - Itinerary templates
/api/leads             - Lead management
/api/messages          - Message history/logging
/api/packages          - Package catalog (DETAILED ABOVE)
/api/payments          - Payment processing & webhooks
/api/referrals         - Referral codes and tracking
/api/reviews           - Customer reviews
/api/templates         - Message templates
/api/whatsapp          - WhatsApp specific operations
```

### Middleware Stack (app.ts)
```
1. helmet() - Security headers
2. cors() - CORS configuration
3. morgan() - Request logging
4. express.json() - JSON parsing (with rawBody for webhooks)
5. express.urlencoded() - Form data parsing
6. apiLimiter - Rate limiting on /api routes
7. errorHandler - Global error handler
```

### Authentication Middleware
- `authenticate` - Requires valid JWT token
- `requireRole(role)` - Role-based access (ADMIN, MANAGER, AGENT)
- `requirePermission(permission)` - Permission-based access (LEADS_VIEW, PACKAGES_MANAGE, etc.)

### Error Handling
- Global error handler middleware
- Consistent error response format:
  ```json
  {
    "success": false,
    "error": "Error message",
    "code": "ERROR_CODE"
  }
  ```

---

## 6. Frontend Components & Pages

### Key Pages

#### **Dashboard.jsx**
- Overview statistics (leads this month, conversion rate, revenue)
- Recent leads and bookings
- Analytics charts
- Team activity

#### **Leads.jsx**
- Lead pipeline view
- Filter by status, agent, date range
- Inline status updates
- Customer details modal
- Assignment to agents
- Add/edit notes

#### **Bookings.jsx**
- List confirmed bookings
- Timeline of booking progression
- Payment status
- Customer information
- Itinerary details

#### **Customers.jsx**
- Customer directory
- Contact history
- Segmentation by interest (DOMESTIC/INTERNATIONAL)
- Communication preferences

#### **Packages.jsx** (described above)
- Package catalog
- Create/edit packages (ADMIN)
- View itinerary
- Manage pricing

#### **Payments.jsx**
- Payment tracking
- Invoice generation
- Payment reminders
- Settlement reports

#### **Settings.jsx** (described above)
- WhatsApp integration
- Razorpay setup
- Team management
- Business configuration

#### **Analytics.jsx**
- Conversion funnel
- Lead source analysis
- Agent performance
- Revenue trends
- Booking timeline analysis

#### **Campaigns.jsx & CreateCampaign.jsx**
- Marketing campaign management
- Multi-channel drip sequences
- Campaign wizard
- A/B testing setup

#### **Templates.jsx**
- Message template library
- WhatsApp Flow templates
- Email template editor
- Multilingual support

#### **Reviews.jsx**
- Customer feedback and ratings
- Review management
- Public review integration

### Key Components

#### **LeadCard.jsx**
- Compact lead summary
- Quick status change
- Assignment button
- Customer details preview

#### **LeadPipeline.jsx**
- Kanban-style lead pipeline
- Drag-and-drop status updates
- Lead count by stage
- Filter options

#### **PackageCard.jsx**
- Package preview
- Price, duration, destinations
- Quick view itinerary
- Select for booking

#### **ChatPanel.jsx**
- WhatsApp message history
- Send messages to customer
- Display bot transcript
- Message templates

#### **HandoffModal.jsx**
- Agent handoff interface
- Notes for agent
- Priority level
- Agent selection

#### **SendPaymentModal.jsx**
- Send payment link
- Payment amount input
- Customer confirmation
- Razorpay integration

#### **BookingTimeline.jsx**
- Visual timeline of booking progression
- Lead → Quote → Booking → Payment → Delivery
- Status change history

#### **CampaignWizard.jsx**
- Multi-step campaign creation
- Recipient selection
- Template assignment
- Schedule timing

#### **Sidebar.jsx**
- Navigation menu
- Active page highlighting
- User profile/logout
- Collapsible on mobile

#### **AppTopbar.jsx**
- Agency/user info
- Notifications bell
- Settings access
- Search bar

### Component Utilities

#### **uiHelpers.jsx**
- Common UI utilities
- Form components
- Modal helpers
- Notification/toast system

### State Management (Zustand)

#### **authStore**
- accessToken, refreshToken
- agent (current user)
- agency (current agency)
- Login/logout actions
- Token refresh

#### **uiStore**
- sidebarCollapsed
- notificationsOpen
- selectedLead
- activeTab
- Toast/notification queue

### API Integration

#### **client.js**
- Axios instance
- Base URL configuration
- Request/response interceptors
- Auth token handling

#### **packagesApi.js**
- list() - GET /api/packages
- getById(id)
- create(data)
- update(id, data)
- uploadImage(formData)
- uploadBrochure(formData)
- delete(id)

Similar API modules for other resources (leads, bookings, payments, etc.)

### Styling
- **Tailwind CSS** - Utility-first CSS framework
- **Heroicons** - Icon library (@heroicons/react/24/outline)
- **Custom components** - Built on Tailwind
- **Dark mode support** - Via Tailwind config

### Build & Development
- **Vite** - Fast build tool
- **React 18** - UI library
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Zustand** - State management
- **Axios** - HTTP client

---

## Data Flow Examples

### Example 1: Customer Enquiry to Booking
```
1. Customer messages WhatsApp
   ↓ (webhook.js)
2. Signature verification
   ↓ (botRouter.js)
3. Route to travel flow handler
   ↓ (travelFlowHandler.js)
4. Show package catalog (packageDiscoveryHandler.js)
   ↓
5. Customer selects package
   ↓
6. Lead capture (leadCapture.js) collects details
   ↓
7. ensureLead() creates/updates Lead in DB
   ↓
8. Generate quote (quoteHandler.js)
   ↓
9. Customer confirms
   ↓
10. Create booking & payment request
    ↓ (Razorpay integration)
11. Customer pays
    ↓
12. Update booking status to CONFIRMED
    ↓
13. Request review (reviewHandler.js)
```

### Example 2: Agent Viewing & Managing Leads
```
1. Agent logs into frontend (Login.jsx)
   ↓ (authStore)
2. JWT token stored, redirects to Dashboard
   ↓
3. Leads page fetches leads
   ↓ (/api/leads - leadController.list)
4. Shows lead pipeline (LeadPipeline.jsx)
   ↓
5. Agent clicks lead (LeadCard.jsx)
   ↓
6. Shows lead details modal
   - Customer info
   - Messages history (ChatPanel)
   - Timeline (BookingTimeline)
   - Update status/notes
   ↓
7. Agent changes status (ENQUIRY → QUOTED)
   ↓ (PATCH /api/leads/:id - leadController.update)
8. Sends quote via WhatsApp (quoteHandler)
   ↓ (whatsappService.sendTextMessage)
9. Tracks in lead history
```

### Example 3: Admin Setting Up WhatsApp
```
1. Admin goes to Settings page
   ↓ (Settings.jsx)
2. Selects WhatsApp provider
   ↓
3. Clicks "Connect WhatsApp"
   ↓ (Embedded Facebook signup)
4. Approves in Facebook
   ↓
5. Frontend sends authorization code
   ↓ (/api/auth/whatsapp or similar)
6. Backend validates & stores credentials
   ↓ (Agency model: marketingOsApiKey, etc.)
7. Tests connection
   ↓
8. Updates whatsappConnectionStatus to CONNECTED
   ↓
9. Bot can now send/receive messages
```

---

## Key Files Quick Reference

### Backend Files
| File | Purpose |
|------|---------|
| `backend/src/app.ts` | Express app setup, middleware |
| `backend/src/server.ts` | Server startup |
| `backend/src/models/` | Database models (Sequelize) |
| `backend/src/services/` | Business logic |
| `backend/src/controllers/` | API handlers |
| `backend/src/routes/` | API route definitions |
| `backend/src/middleware/` | Auth, validation, error handling |
| `backend/src/constants/` | Permissions, enums |

### Bot Files
| File | Purpose |
|------|---------|
| `bot/src/webhook.js` | Meta webhook handler |
| `bot/src/index.js` | Bot server startup |
| `bot/src/botRouter.js` | Message routing logic |
| `bot/src/handlers/` | State machine handlers |
| `bot/src/utils/sessionManager.js` | Persist bot conversation state |
| `bot/src/utils/messageTemplates.js` | Bilingual message templates |

### Frontend Files
| File | Purpose |
|------|---------|
| `frontend/src/App.jsx` | Main router and layout |
| `frontend/src/pages/` | Full-page views |
| `frontend/src/components/` | Reusable UI components |
| `frontend/src/store/` | Zustand state stores |
| `frontend/src/api/` | API client modules |
| `frontend/src/utils/` | Utility functions |

---

## Key Concepts

### Lead Status Pipeline
```
JUST_CONTACTED (initial)
    ↓
NEW (bot collected info)
    ↓
ENQUIRY (details sent to agent)
    ↓
CONTACTED (agent reached out)
    ↓
QUOTED (quote sent)
    ↓
NEGOTIATING (haggling price/dates)
    ↓
BOOKED (confirmed)
    LOST (deal fell through)
    CANCELLED (customer withdrew)
```

### Package Categories
- **DOMESTIC** - Within country
- **INTERNATIONAL** - Cross-border travel

### Permissions System
- `LEADS_VIEW`, `LEADS_MANAGE`
- `PACKAGES_VIEW`, `PACKAGES_MANAGE`
- `BOOKINGS_VIEW`, `BOOKINGS_MANAGE`
- `PAYMENTS_VIEW`, `PAYMENTS_MANAGE`
- `AGENTS_VIEW`, `AGENTS_MANAGE`
- `CAMPAIGNS_VIEW`, `CAMPAIGNS_MANAGE`
- `ANALYTICS_VIEW`
- `SETTINGS_MANAGE`

### Multi-Language Support
- English (EN) - Default
- Malayalam (ML) - For Indian market
- Messages templates support both languages
- Language auto-detected from first message

### Integration Providers
- **WhatsApp Providers:**
  - SELF_HOSTED - Direct Meta Business API
  - INTERAKT - Third-party provider
  - MARKETING_OS - Internal system integration
- **Payments:** Razorpay
- **Media:** Cloudinary (images, PDFs)
- **Email:** Custom email service

---

## Performance & Security

### Rate Limiting
- Applied to all `/api/*` routes
- Prevents abuse and DoS attacks

### Authentication
- JWT tokens with expiration
- Refresh token rotation
- Role-based access control (RBAC)

### Data Validation
- Zod schema validation on all inputs
- Request/response type safety

### Encryption
- Payment credentials stored encrypted
- API secrets in environment variables
- HTTPS in production

### Logging
- Morgan middleware for HTTP logs
- Detailed bot event logging
- Message history stored in DB

---

## Environment Dependencies

The system requires these external services:
1. **PostgreSQL** - Database
2. **Meta WhatsApp Business API** - WhatsApp integration
3. **Razorpay** - Payment processing
4. **Cloudinary** - Image/file hosting
5. **SMTP/Email provider** - Transactional emails
6. **Marketing OS** (optional) - Alternative WhatsApp provider
7. **Facebook Graph API** - Embedded signup flow

