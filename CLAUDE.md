# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Racky is a marketplace management platform that allows users to connect and manage multiple e-commerce marketplaces from a single interface. The application consists of:

- **Backend**: Node.js/Express API with MongoDB (`/server`)
- **Frontend**: React + TypeScript + Vite application (`/client`)

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
node scripts/createAdmin.js  # Creates admin@example.com / admin123
```

## Architecture Overview

### Backend Structure (`/server/src/`)
- **Models**: Mongoose schemas for User, StoreConnection, Product, Opportunity, Suggestion
- **Routes**: API endpoints organized by feature (auth, connections, marketplaces)
- **Services**: Business logic for marketplace integrations (marketplaceService.js)
- **Middleware**: Authentication (JWT), validation (Joi), error handling

**API Base URL**: `http://localhost:5000/api`
**Authentication**: JWT tokens in Authorization header (`Bearer <token>`)

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

## Important Notes
- Backend API documented in `/RACKY_BACKEND_API.md` 
- Postman collection available at `/server/postman_collection.json`
- Frontend uses custom sidebar implementation due to shadcn sidebar overlay issues
- All API responses follow consistent format with error handling
- Marketplace credentials are securely validated before storage
- Development database `racky` with collections: users, storeconnections, products, opportunities, suggestions
- Admin user available: admin@example.com / admin123
- API responses use standardized `{ success, message, data }` format
- Marketplace credentials are returned with `documentationUrl` for setup guidance
- Connection testing provides detailed success/failure information with marketplace-specific data

## Development Guidelines
- **Full-Stack Implementation Required**: When implementing new features, ALWAYS work on both backend (`/server`) and frontend (`/client`) components. Features must be complete end-to-end implementations.
- **Documentation Updates Required**: When adding new features or making changes to frontend/backend, update relevant documentation including `/RACKY_BACKEND_API.md`
- **Postman Collection Maintenance**: Always update `/server/postman_collection.json` when new API endpoints are added to the server
- **Breaking Changes**: Document any API changes or breaking changes that affect client-server communication