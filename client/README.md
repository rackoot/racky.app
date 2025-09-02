# Racky Frontend

This is the React frontend for the Racky marketplace management platform.

## Environment Configuration

The frontend now uses centralized API configuration with environment variable support for different deployment scenarios.

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=
VITE_CLIENT_URL=http://localhost:5173
VITE_DEV_MODE=true
VITE_DEBUG_API=false
```

### Environment Options

#### 1. Docker Development (Default)
Leave `VITE_API_BASE_URL` empty to use Vite's proxy configuration:
```
VITE_API_BASE_URL=
```
This will proxy `/api/*` requests to `http://backend:5000` (Docker service).

#### 2. Local Development
Set full API URL for local backend:
```
VITE_API_BASE_URL=http://localhost:5000/api
```

#### 3. Production
Set production API URL:
```
VITE_API_BASE_URL=https://api.yourdomain.com/api
```

## API Architecture

### Centralized API Services

All API requests are now centralized in `/src/api/` with the following structure:

```
/src/api/
├── client.ts          # Axios instance with interceptors
├── config.ts          # Environment-based configuration
├── types.ts           # Shared API types
├── auth.ts            # Authentication endpoints
├── workspaces.ts      # Workspace management
├── marketplaces.ts    # Marketplace integrations
├── products.ts        # Product management
├── subscriptions.ts   # Billing and subscriptions
├── dashboard.ts       # Dashboard analytics
├── opportunities.ts   # Optimization opportunities
├── admin.ts           # Admin panel endpoints
├── usage.ts           # Usage tracking
├── plans.ts           # Subscription plans
├── billing.ts         # Billing operations
├── demo.ts            # Demo functionality
└── index.ts           # Main exports
```

### Key Features

- **Automatic Authentication**: JWT tokens and workspace headers are automatically added to requests
- **Error Handling**: Centralized error handling with automatic token refresh
- **Type Safety**: Full TypeScript support with proper interfaces
- **Environment Flexibility**: Easy switching between Docker, local, and production environments
- **Request Interceptors**: Automatic handling of authentication and workspace context

### Usage Example

```typescript
import { productsApi, marketplacesApi } from '@/api'

// Get products with filtering
const products = await productsApi.getAllProducts({ 
  search: 'shirt',
  marketplace: 'shopify',
  page: 1,
  limit: 20 
})

// Test marketplace connection
const result = await marketplacesApi.testConnection('shopify', {
  shopUrl: 'mystore.myshopify.com',
  accessToken: 'shpat_xxxxx'
})
```

## Migration from Legacy Services

The old service files in `/src/services/` now re-export the centralized APIs for backward compatibility:

```typescript
// Old way
import { marketplaceService } from '@/services/marketplace'

// New way (recommended)
import { marketplacesApi } from '@/api'

// Both work, but new way is recommended
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run E2E tests
npm run e2e
```

## Docker Usage

The application is configured to work seamlessly with Docker Compose:

```yaml
services:
  frontend:
    build: ./client
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=  # Uses proxy to backend service
```

## Testing

All new API endpoints should include comprehensive tests. See the testing requirements in the main project documentation.

---

## React + TypeScript + Vite Setup

This project uses React with TypeScript and Vite for fast development and building.
