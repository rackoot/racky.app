# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Racky is a **multi-tenant SaaS marketplace management platform** that allows users to connect and manage multiple e-commerce marketplaces from a single interface. The application consists of:

- **Backend**: Node.js/Express API with MongoDB (`/server`)
- **Frontend**: React + TypeScript + Vite application (`/client`)

**SaaS Features:**
- Multi-tenant architecture with complete user data isolation
- Role-based access control (USER, SUPERADMIN)
- Subscription management with three tiers (BASIC, PRO, ENTERPRISE)
- Usage tracking and limits enforcement
- 14-day free trial for new users
- Admin panel for user and subscription management

## Development Commands

### Frontend (Client)
```bash
cd client
npm run dev          # Start development server (usually http://localhost:5173)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build locally
```

### Backend (Server) 
```bash
cd server
npm run dev          # Start development server with nodemon (http://localhost:5000)
npm start           # Start production server
npm test            # Run tests with Jest
node scripts/createAdmin.js  # Creates admin@example.com / admin123 (legacy)
node scripts/setup-saas.js   # Initialize SaaS platform with super admin and plans
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
- **Documentation Updates Required**: When adding new features or making changes to frontend/backend, update relevant documentation including `/RACKY_BACKEND_API.md`
- **Postman Collection Maintenance**: Always update `/server/postman_collection.json` when new API endpoints are added to the server
- **Entity Relationship Diagram Maintenance**: **CRITICAL** - When modifying existing entities in `/server/src/modules/*/models/` or creating new entities, MUST update the Entity Relationship Diagram in `/server/ER_DIAGRAM.md`. This includes:
  - Adding new entities with their complete field definitions
  - Updating existing entities when fields are added, removed, or modified  
  - Adding new relationships between entities
  - Updating the description sections to reflect changes
  - Updating the "Última Actualización" section with current date and entity count
- **Breaking Changes**: Document any API changes or breaking changes that affect client-server communication

### Module Creation Guidelines
When creating a new module:
1. Create the module directory structure: `/server/src/modules/{module-name}/{routes,services,models,interfaces}/`
2. Add module route imports to `/server/src/index.ts`
3. Update this CLAUDE.md file to document the new module
4. Create module-specific interfaces in the `interfaces/` directory
5. Keep module business logic in the `services/` directory