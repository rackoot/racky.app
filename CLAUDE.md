# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Racky is a **multi-tenant SaaS marketplace management platform** that allows users to connect and manage multiple e-commerce marketplaces from a single interface. The application consists of:

- **Backend**: Node.js/Express API with MongoDB (`/server`)
- **Frontend**: React + TypeScript + Vite application (`/client`)

**SaaS Features:**
- Multi-tenant architecture with complete user data isolation
- Role-based access control (USER, SUPERADMIN)
- **Contributor-based subscription model** with three contributor types:
  - **Junior Contributors** ($29/month each): 1K actions/contributor, up to 5 contributors
  - **Senior Contributors** ($79/month each): 5K actions/contributor, up to 5 contributors, AI assistance
  - **Executive Contributors** (Contact Sales): Unlimited actions, up to 50 contributors, premium features
- Action-based usage tracking and limits enforcement per contributor
- Scalable contributor hiring with quantity selector (1-5 contributors for most plans)
- 14-day free trial for new users
- Admin panel for user and subscription management

## Development Commands

### Frontend (Client)
```bash
cd client
npm run dev          # Start development server (usually http://localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run typecheck    # Check TypeScript types without compiling
npm run validate     # Run both typecheck and lint (MANDATORY after code changes)
npm run preview      # Preview production build locally
```

### Backend (Server) 
```bash
cd server
npm run dev          # Start development server with nodemon (http://localhost:5000)
npm start           # Start production server
npm test            # Run tests with Jest
npm run typecheck    # Check TypeScript types without compiling
npm run validate     # Run both typecheck and tests (MANDATORY after code changes)
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
node scripts/setup.js        # 🚀 Complete setup for contributor-based platform
node scripts/create-admin.js # Create super admin only (admin@racky.app / admin123!)
node scripts/create-plans.js # Create contributor plans only
```

### Testing Commands

#### Backend Testing
```bash
cd server
npm test                    # Run all tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
npm test auth.test.ts       # Run specific test file
npm test -- --verbose      # Run tests with verbose output
```

#### Frontend Testing  
```bash
cd client
npm test                    # Run unit tests with Vitest
npm run test:ui             # Open Vitest UI
npm run test:run            # Run tests once (CI mode)
npm run test:coverage       # Run tests with coverage
npm run e2e                 # Run E2E tests with Playwright
npm run e2e:ui              # Open Playwright UI
npm run e2e:debug          # Debug E2E tests
npm run e2e:report         # View E2E test report
```

## Architecture Overview

### Backend Structure (`/server/src/`) - Modular Architecture

**New Modular Structure:**
```
/server/src/
├── _common/                    # Shared code across modules
│   ├── middleware/             # Auth, validation, errorHandler
│   ├── config/                # Database, environment configuration  
│   ├── constants/             # Marketplace constants, general constants
│   ├── types/                 # Shared TypeScript interfaces
│   └── utils/                 # General utilities
├── modules/                   # Feature modules
│   ├── auth/                  # Authentication & authorization
│   │   ├── routes/            # Auth endpoints
│   │   ├── models/            # User model
│   │   ├── services/          # Auth business logic
│   │   └── interfaces/        # Auth-specific types
│   ├── subscriptions/         # Subscription management
│   │   ├── routes/            # Plans, billing, usage endpoints
│   │   ├── models/            # Plan, Subscription, Usage models
│   │   ├── services/          # Subscription business logic
│   │   └── interfaces/        # Subscription-specific types
│   ├── marketplaces/          # Marketplace integrations
│   │   ├── routes/            # Marketplace endpoints
│   │   ├── services/          # Marketplace integration logic
│   │   └── interfaces/        # Marketplace-specific types
│   ├── stores/                # Store/connection management
│   │   ├── routes/            # Store connection endpoints
│   │   ├── models/            # StoreConnection model
│   │   ├── services/          # Store management logic
│   │   └── interfaces/        # Store-specific types
│   ├── products/              # Product management
│   │   ├── routes/            # Product endpoints
│   │   ├── models/            # Product model
│   │   ├── services/          # Product business logic
│   │   └── interfaces/        # Product-specific types
│   ├── opportunities/         # Optimization opportunities
│   │   ├── routes/            # Opportunity & optimization endpoints
│   │   ├── models/            # Opportunity, Suggestion models
│   │   ├── services/          # AI service, optimization logic
│   │   └── interfaces/        # Opportunity-specific types
│   ├── admin/                 # Admin panel functionality
│   │   ├── routes/            # Admin endpoints
│   │   ├── services/          # Admin business logic
│   │   └── interfaces/        # Admin-specific types
│   ├── dashboard/             # Dashboard & analytics
│   │   ├── routes/            # Dashboard endpoints
│   │   ├── services/          # Dashboard logic
│   │   └── interfaces/        # Dashboard-specific types
│   ├── notifications/         # Notification system
│   │   ├── services/          # Email & notification scheduler
│   │   └── interfaces/        # Notification-specific types
│   └── demo/                  # Demo functionality
│       ├── routes/            # Demo endpoints
│       ├── services/          # Demo logic
│       └── interfaces/        # Demo-specific types
└── index.ts                   # Main application entry point
```

**API Base URL**: `http://localhost:5000/api`
**Authentication**: JWT tokens in Authorization header (`Bearer <token>`)

**Modular Benefits:**
- **Clear separation of concerns** - Each module owns its domain logic
- **Improved maintainability** - Changes isolated to specific modules  
- **Better scalability** - Easy to add new modules or scale existing ones
- **Enhanced testability** - Module-specific testing strategies
- **Reduced coupling** - Modules communicate through well-defined interfaces

### SaaS Architecture

**Multi-Tenant Data Isolation:**
- All data models include `userId` field for complete user isolation
- Middleware automatically scopes all database queries to authenticated user
- SUPERADMIN role can access cross-user data for administration
- Zero data leakage between tenant users

**Role-Based Access Control:**
- `USER`: Standard subscription users with plan-based limits
- `SUPERADMIN`: Platform administrators with unrestricted access
- Middleware: `requireSuperAdmin`, `checkSubscriptionStatus`, `checkUsageLimits`

**Subscription Management:**
- Three subscription tiers: BASIC ($29/month), PRO ($79/month), ENTERPRISE ($199/month)
- 14-day free trial for all new users (30 days for Enterprise)
- Usage tracking: API calls, product syncs, store connections
- Automatic limit enforcement based on subscription tier

**Plan Limits by Tier:**
- **BASIC**: 1 store, 100 products, 2 marketplaces, 1K API calls/month
- **PRO**: 5 stores, 1K products, 5 marketplaces, 10K API calls/month  
- **ENTERPRISE**: 50 stores, 10K products, 10 marketplaces, 100K API calls/month

**Admin Management:**
- Complete user management via `/api/admin/*` endpoints
- User activation/deactivation, subscription modifications, role changes
- Platform analytics and usage monitoring
- User data deletion with cascading cleanup

### Core Architecture Patterns

**Service Layer Pattern:**
- `src/services/marketplaceService.js` contains all marketplace integration logic
- Each marketplace has dedicated connection testing functions that make real API calls
- Standardized credential validation and test result formatting across all marketplaces

**User Data Isolation:**
- All database queries are scoped to `req.user._id` from JWT authentication
- StoreConnection model links users to their marketplace connections
- Nested marketplace configurations stored as subdocuments within connections

**Marketplace Integration Design:**
- `SUPPORTED_MARKETPLACES` array defines all marketplace configurations including required credentials and documentation URLs
- Connection testing validates credentials by making actual API calls to each marketplace
- Extensible factory pattern for adding new marketplaces

### Database Relationships

```
User (1) ──→ (N) StoreConnection ──→ (N) Marketplace Subdocs
StoreConnection (1) ──→ (N) Product
Product (1) ──→ (N) Opportunity/Suggestion
```

**Key Model Features:**
- `StoreConnection` uses embedded subdocuments for multiple marketplace configurations per store
- Products have compound unique index on `userId`, `marketplace`, `externalId`
- Sync status tracking (`pending`, `syncing`, `completed`, `failed`) for each marketplace connection

### API Design Patterns

**Three Main Route Groups:**
- `/api/auth` - JWT authentication (register/login)
- `/api/connections` - CRUD operations for store connections with nested marketplace management
- `/api/marketplaces` - Marketplace discovery, testing, and connection workflows

**Connection Management Workflow:**
1. Test marketplace credentials via `POST /api/marketplaces/test`
2. Either connect to existing store via `POST /api/marketplaces/connect` or create new store via `POST /api/marketplaces/create-store`
3. Manage individual marketplace connections via `PUT /api/marketplaces/:connectionId/:marketplaceId/test|toggle`

### Frontend Structure (`/client/src/`)
- **Pages**: Route-level components (dashboard, stores, auth)
- **Components**: Reusable UI components organized by feature
  - `auth/`: Authentication-related components
  - `dashboard/`: Dashboard-specific components  
  - `marketplace/`: Marketplace management UI
  - `layout/`: Application layout and navigation
  - `ui/`: shadcn/ui components
- **Services**: API integration layers (marketplace.ts)
- **Types**: TypeScript interfaces (marketplace.ts)

### Key Technologies
- **Frontend**: React 19, TypeScript, React Router, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Express, Mongoose, JWT, bcryptjs, Joi validation
- **Styling**: Tailwind CSS v3 with shadcn/ui component system

## Authentication Flow
- JWT tokens stored in localStorage
- `ProtectedRoute` component wraps authenticated pages
- Token included in API requests via `getAuthHeaders()` utility
- `/login` and `/register` are public routes, all others require authentication
- JWT middleware (`src/middleware/auth.js`) injects `req.user` on protected routes
- All routes except `/api/auth` and `/api/health` require Bearer token authentication

## Marketplace Integration
The application supports 7 marketplace types:
- Shopify, Amazon, VTEX, MercadoLibre, Facebook Shop, Google Shopping, WooCommerce

**Connection Flow**:
1. User selects marketplace type
2. Enters required credentials (varies by marketplace)
3. Tests connection before saving
4. Creates store connection or adds to existing store
5. Syncs products and manages via dashboard

**Key API Endpoints**:
- `GET /marketplaces/status` - Get user's marketplace connections
- `POST /marketplaces/test` - Test credentials before saving
- `POST /marketplaces/create-store` - Create new store with marketplace
- `PUT /marketplaces/:connectionId/:marketplaceId/test` - Sync existing connection

### Marketplace Integration Status

**Fully Integrated (Real API Testing):**
- Shopify (REST API)
- VTEX (Catalog API)
- MercadoLibre (User API)
- WooCommerce (REST API)
- Facebook Shop (Graph API)

**Placeholder Implementations:**
- Amazon (SP-API requires complex AWS signature - currently validates credential format only)
- Google Shopping (Requires service account JWT - currently validates credential format only)

## UI/UX Architecture
- **UI Components**: Uses shadcn/ui component library for all UI components (buttons, forms, dialogs, etc.)
- Custom responsive sidebar layout (not using shadcn sidebar due to overlay issues)
- Desktop: Sidebar collapses to icon-only mode (64px width)
- Mobile: Sidebar slides over content with backdrop
- Dark/light theme support via CSS custom properties
- Form validation with react-hook-form + Zod

## Path Aliases
```json
{
  "@/*": ["./src/*"],
  "components": "@/components",
  "utils": "@/lib/utils",
  "ui": "@/components/ui"
}
```

## Environment Configuration

**Required Environment Variables:**
```bash
MONGODB_URI=mongodb://localhost:27017/racky
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
PORT=5000
```

## Security Implementation

**Authentication Security:**
- bcrypt password hashing with pre-save middleware
- JWT tokens with configurable expiration
- Rate limiting (100 requests/15min per IP)

**Data Protection:**
- Helmet.js security headers
- CORS configuration
- Input validation via Joi schemas on all endpoints
- Sensitive marketplace credentials stored in Mixed schema type

## SaaS API Endpoints

### Admin Management (SUPERADMIN only)
- `GET /api/admin/users` - List all users with pagination and filtering
- `GET /api/admin/users/:id` - Get specific user details with usage data
- `PUT /api/admin/users/:id/status` - Activate/deactivate user accounts
- `PUT /api/admin/users/:id/role` - Update user role (USER/SUPERADMIN)
- `PUT /api/admin/users/:id/subscription` - Update user subscription status/plan
- `DELETE /api/admin/users/:id?force=true` - Delete user with all data
- `GET /api/admin/analytics?period=30d` - Platform usage analytics

### Subscription Plans
- `GET /api/plans` - Get all public subscription plans
- `GET /api/plans/:name` - Get specific plan details
- `GET /api/plans/user/current` - Get current user's plan info (requires auth)

### Authentication (Enhanced)
- `POST /api/auth/register` - Register new user (starts 14-day trial)
- `POST /api/auth/login` - Login with enhanced response including subscription info

### Setup & Initialization
- `node scripts/setup-saas.js` - Initialize SaaS platform with super admin and plans
- Super admin credentials: `admin@racky.app` / `admin123!`

## Important Notes
- Backend API documented in `/RACKY_BACKEND_API.md` 
- Postman collection available at `/server/postman_collection.json`
- Frontend uses custom sidebar implementation due to shadcn sidebar overlay issues
- All API responses follow consistent format with error handling
- Marketplace credentials are securely validated before storage
- Development database `racky` with collections: users, storeconnections, products, opportunities, suggestions, subscriptions, plans, usages
- Legacy admin user: admin@example.com / admin123 (now has SUPERADMIN role)
- New super admin: admin@racky.app / admin123!
- API responses use standardized `{ success, message, data }` format
- Marketplace credentials are returned with `documentationUrl` for setup guidance
- Connection testing provides detailed success/failure information with marketplace-specific data
- All routes except `/api/auth`, `/api/plans`, and `/api/health` require authentication
- Store creation and product sync endpoints enforce subscription and usage limits

## Development Guidelines

### Modular Architecture Patterns
- **Module-Based Development**: All new backend features MUST follow the modular architecture pattern located in `/server/src/modules/`
- **Module Structure**: Each module MUST contain its own `routes/`, `services/`, `models/`, and `interfaces/` directories
- **Shared Code Placement**: Common utilities, middleware, and types belong in `/server/src/_common/`
- **Import Conventions**: Always import from module-specific paths (e.g., `import User from '../modules/auth/models/User'`)
- **Module Isolation**: Each module should be self-contained with minimal cross-module dependencies

### Implementation Requirements
- **Full-Stack Implementation Required**: When implementing new features, ALWAYS work on both backend (`/server`) and frontend (`/client`) components. Features must be complete end-to-end implementations.
- **🚨 MANDATORY TYPE VALIDATION**: After ANY code changes, you MUST:
  1. Run `npm run validate` in both client and server directories
  2. Use `mcp__ide__getDiagnostics` to check for TypeScript errors
  3. Fix ALL TypeScript errors before marking tasks as completed
  4. NEVER mark a task as completed if there are TypeScript errors or validation failures
- **Documentation Updates Required**: When adding new features or making changes to frontend/backend, update relevant documentation including `/RACKY_BACKEND_API.md`
- **Postman Collection Maintenance**: Always update `/server/postman_collection.json` when new API endpoints are added to the server
- **Entity Relationship Diagram Maintenance**: **CRITICAL** - When modifying existing entities in `/server/src/modules/*/models/` or creating new entities, MUST update the Entity Relationship Diagram in `/server/ER_DIAGRAM.md`. This includes:
  - Adding new entities with their complete field definitions
  - Updating existing entities when fields are added, removed, or modified  
  - Adding new relationships between entities
  - Updating the description sections to reflect changes
  - Updating the "Última Actualización" section with current date and entity count
- **Breaking Changes**: Document any API changes or breaking changes that affect client-server communication
- **CRITICAL - Workspace Context Reactivity**: **MANDATORY** for all new frontend pages that display workspace-specific data. See "Frontend Workspace Context Requirements" section below.

### Frontend Workspace Context Requirements

**CRITICAL REQUIREMENT**: All new frontend pages that display or interact with workspace-specific data MUST implement proper workspace context reactivity to ensure seamless workspace switching behavior.

#### **When This Applies:**
- Any page that fetches data scoped to a workspace (products, stores, analytics, usage, etc.)
- Any page that makes API calls to endpoints using `requireWorkspace` middleware
- Any page displaying workspace-specific content that should refresh when switching workspaces

#### **Implementation Requirements:**

1. **Import Workspace Context:**
   ```typescript
   import { useWorkspace } from "@/components/workspace/workspace-context"
   ```

2. **Use Workspace Hook:**
   ```typescript
   export function YourPage() {
     const { currentWorkspace } = useWorkspace()
     // ... other state
   }
   ```

3. **Include Workspace in useEffect Dependencies:**
   ```typescript
   useEffect(() => {
     // Only load if we have a current workspace
     if (currentWorkspace) {
       loadYourData()
     }
   }, [currentWorkspace]) // Always include currentWorkspace as dependency
   ```

4. **For Pages with Multiple Dependencies:**
   ```typescript
   useEffect(() => {
     if (currentWorkspace) {
       loadYourData()
     }
   }, [query, filters, currentWorkspace]) // Include currentWorkspace alongside other dependencies
   ```

#### **Examples of Properly Implemented Pages:**
- `/client/src/pages/dashboard.tsx`
- `/client/src/pages/stores.tsx` 
- `/client/src/pages/products.tsx`
- `/client/src/pages/usage.tsx`
- `/client/src/pages/product-detail.tsx`
- `/client/src/pages/stores/[marketplace].tsx`

#### **Why This Is Critical:**
- **Data Isolation**: Ensures users see only data belonging to their current workspace
- **User Experience**: Provides seamless workspace switching without manual page refreshes
- **Multi-Tenant Security**: Prevents data leakage between workspaces
- **Consistent Behavior**: All pages behave predictably when workspace changes

#### **Testing Checklist for New Pages:**
1. ✅ Page loads data when first visiting with a selected workspace
2. ✅ Page content refreshes automatically when switching to a different workspace  
3. ✅ Page shows appropriate loading state during workspace switch
4. ✅ Page handles empty/new workspaces gracefully
5. ✅ No cached data from previous workspace is shown

**FAILURE TO IMPLEMENT**: Pages without proper workspace context will show stale data from previous workspaces, breaking the multi-tenant architecture and potentially exposing data across workspace boundaries.

### Module Creation Guidelines
When creating a new module:
1. Create the module directory structure: `/server/src/modules/{module-name}/{routes,services,models,interfaces}/`
2. Add module route imports to `/server/src/index.ts`
3. Update this CLAUDE.md file to document the new module
4. Create module-specific interfaces in the `interfaces/` directory
5. Keep module business logic in the `services/` directory

## Testing Requirements & Guidelines

### **🚨 MANDATORY TESTING POLICY**

**ALL new API endpoints and components MUST include comprehensive tests before being merged.**

#### **Backend Testing Requirements**

**Test Coverage Thresholds:**
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

**Required Tests for New Endpoints:**
1. **Integration Tests** (Primary) - Test complete request/response cycle
2. **Authentication & Authorization** - Verify proper access control  
3. **Data Isolation** - Ensure workspace data scoping
4. **Validation** - Test input validation and error handling
5. **Subscription Limits** - Verify usage limits enforcement
6. **Error Scenarios** - Test failure cases and error responses

**Backend Test Structure:**
```
/server/src/__tests__/
├── integration/           # API endpoint tests
│   ├── auth.test.ts      # Authentication system
│   ├── workspaces.test.ts # Workspace management  
│   ├── subscriptions.test.ts # Plans & billing
│   ├── stores.test.ts    # Store connections
│   └── products.test.ts  # Product management
├── setup/                # Test configuration
│   ├── jest.setup.ts     # Global setup
│   ├── testDb.ts         # Database utilities
│   └── cleanup.ts        # Cleanup utilities
├── helpers/              # Test utilities
│   ├── testAuth.ts       # Auth helpers
│   └── testData.ts       # Mock data
└── fixtures/             # Test data
    └── testData.ts       # Sample data
```

**Example Integration Test Pattern:**
```typescript
describe('API Endpoint Tests', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await teardownTestDb()
  })

  beforeEach(async () => {
    await clearTestDb()
  })

  it('should handle success case with authentication', async () => {
    const { user, workspace } = await createTestUserWithWorkspace()
    
    const response = await request(app)
      .get('/api/endpoint')
      .set(getAuthHeaders(user.token, workspace._id.toString()))
      .expect(200)

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object)
    })
  })

  it('should enforce workspace data isolation', async () => {
    // Test that users can only access their workspace data
  })

  it('should require authentication', async () => {
    await request(app)
      .get('/api/endpoint')
      .expect(401)
  })
})
```

#### **Frontend Testing Requirements**

**Test Coverage Thresholds:**
- **Lines**: 70%
- **Functions**: 70%  
- **Branches**: 70%
- **Statements**: 70%

**Required Tests for New Components:**
1. **Unit Tests** - Component rendering and behavior
2. **Integration Tests** - Component interactions with services
3. **User Interaction** - Click, form submission, navigation
4. **Accessibility** - Keyboard navigation, ARIA labels
5. **Error Handling** - Error states and fallbacks
6. **Loading States** - Skeleton screens, spinners
7. **Mobile Responsiveness** - Various viewport sizes

**Frontend Test Structure:**
```
/client/src/
├── components/
│   └── ui/__tests__/
│       └── button.test.tsx
├── services/__tests__/
│   └── marketplace.test.ts
├── e2e/
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── products.spec.ts
└── test/
    ├── setup.ts
    └── utils.tsx
```

**Component Test Example:**
```typescript
describe('Component Tests', () => {
  it('renders correctly', () => {
    render(<Component prop="value" />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    
    render(<Component onClick={handleClick} />)
    await user.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalled()
  })
})
```

#### **E2E Testing Requirements**

**Required E2E Test Coverage:**
1. **Authentication Flow** - Login, registration, logout
2. **Core User Journeys** - Store setup, product management
3. **Workspace Switching** - Multi-tenant functionality
4. **Mobile Experience** - Responsive design validation
5. **Error Recovery** - Network failures, API errors

**E2E Test Example:**
```typescript
test('should complete user journey', async ({ page }) => {
  await page.goto('/auth/login')
  
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign In' }).click()
  
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText('Welcome')).toBeVisible()
})
```

### **Testing Infrastructure**

**Backend Technologies:**
- **Jest** - Test framework with TypeScript support
- **Supertest** - HTTP assertions for API testing
- **MongoDB Memory Server** - Isolated database testing
- **Test helpers** - Authentication, workspace, and data utilities

**Frontend Technologies:**
- **Vitest** - Fast unit testing with React support
- **React Testing Library** - Component testing utilities
- **Playwright** - Cross-browser E2E testing
- **User Event** - Realistic user interaction simulation

### **Testing Commands Reference**

```bash
# Backend Testing
cd server
npm test                    # Run all tests
npm test auth.test.ts       # Run specific test
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Frontend Testing  
cd client
npm test                    # Unit tests
npm run test:ui             # Interactive UI
npm run e2e                 # E2E tests
npm run e2e:ui              # E2E test UI
npm run test:coverage       # Coverage report
```

### **Pre-Commit Requirements**

Before committing code with new endpoints or components:

1. ✅ **All tests pass** (`npm test` in both client and server)
2. ✅ **Coverage thresholds met** (80% backend, 70% frontend)  
3. ✅ **Integration tests included** for new API endpoints
4. ✅ **Component tests included** for new UI components
5. ✅ **E2E tests updated** for new user flows
6. ✅ **Authentication tests** for protected endpoints
7. ✅ **Workspace isolation tests** for multi-tenant features

### **Testing Best Practices**

1. **Test Data Isolation** - Each test should use fresh data
2. **Realistic Test Data** - Use data that matches production patterns  
3. **Error Scenarios** - Test failure cases, not just happy paths
4. **Mock External APIs** - Don't make real API calls in tests
5. **Test Descriptions** - Clear, descriptive test names
6. **Async Handling** - Proper async/await usage in tests
7. **Cleanup** - Clean up resources after tests complete

**FAILURE TO TEST**: Any new endpoints or components without proper tests will be rejected. Testing is not optional - it's a fundamental requirement for code quality and system reliability.