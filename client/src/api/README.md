# Racky API Client Documentation

This directory contains the centralized API client for the Racky frontend application. The API layer provides a clean, type-safe interface for communicating with the backend.

## Architecture

```
/api
├── client.ts                    # HTTP client & interceptors
├── config.ts                    # API configuration & endpoints
├── index.ts                     # Central exports
├── resources/                   # API modules by resource
│   ├── auth.ts                 # Authentication & registration
│   ├── workspaces.ts           # Workspace management
│   ├── products.ts             # Product CRUD & sync
│   ├── marketplaces.ts         # Marketplace connections
│   ├── orders.ts               # Order management
│   ├── customers.ts            # Customer management
│   ├── opportunities.ts        # Optimization opportunities
│   ├── optimizations.ts        # AI-powered optimizations
│   ├── dashboard.ts            # Dashboard analytics
│   ├── subscription.ts         # Subscription management
│   ├── billing.ts              # Payment processing
│   ├── usage.ts                # Usage tracking
│   ├── workspace-usage.ts      # Workspace-specific usage
│   ├── plans.ts                # Subscription plans
│   ├── coupons.ts              # Coupon management
│   ├── videos.ts               # Video generation
│   ├── admin.ts                # Admin panel
│   └── demo.ts                 # Demo functionality
└── types/                       # TypeScript type definitions
    ├── index.ts                # Re-export all types
    ├── common.ts               # Shared types (ApiResponse, Pagination, etc.)
    ├── auth.ts                 # Authentication types
    ├── workspace.ts            # Workspace types
    ├── product.ts              # Product types
    ├── marketplace.ts          # Marketplace types
    ├── subscription.ts         # Subscription types
    ├── opportunities.ts        # Opportunity types
    ├── optimizations.ts        # Optimization types
    ├── dashboard.ts            # Dashboard types
    ├── admin.ts                # Admin types
    └── usage.ts                # Usage types
```

## Usage

### Basic Import

```typescript
import { authApi, productsApi, type Product, type AuthResponse } from '@/api'
```

### Authentication

```typescript
import { authApi } from '@/api'

// Login
const response = await authApi.login({
  email: 'user@example.com',
  password: 'password123'
})

// Register
const response = await authApi.register({
  email: 'user@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe'
})
```

### Products

```typescript
import { productsApi, type ProductsQuery } from '@/api'

// Get all products with filtering
const query: ProductsQuery = {
  page: 1,
  limit: 20,
  search: 'shirt',
  marketplace: 'shopify',
  sortBy: 'createdAt',
  sortOrder: 'desc'
}

const { products, pagination } = await productsApi.getAllProducts(query)

// Sync products from marketplace
await productsApi.syncProducts(connectionId, true)

// Get single product
const product = await productsApi.getProductById(productId)
```

### Marketplaces

```typescript
import { marketplacesApi, type TestConnectionResponse } from '@/api'

// Test marketplace credentials
const result: TestConnectionResponse = await marketplacesApi.testConnection('shopify', {
  shop_url: 'mystore.myshopify.com',
  access_token: 'xxx'
})

// Connect to existing store
await marketplacesApi.connectToStore({
  storeConnectionId: 'store-123',
  type: 'shopify',
  credentials: { /* ... */ }
})

// Create new store with marketplace
await marketplacesApi.createStoreWithMarketplace({
  storeName: 'My Store',
  type: 'shopify',
  credentials: { /* ... */ }
})
```

### Workspaces & Subscriptions

```typescript
import {
  workspacesApi,
  subscriptionApi,
  getWorkspaceSubscription,
  type WorkspaceSubscription
} from '@/api'

// Get all workspaces
const workspaces = await workspacesApi.getWorkspaces()

// Get workspace subscription (helper function)
const subscription: WorkspaceSubscription = await getWorkspaceSubscription(workspaceId)

// Update subscription
await subscriptionApi.updateSubscription(workspaceId, {
  contributorType: 'SENIOR',
  contributorCount: 3,
  billingCycle: 'monthly'
})

// Preview subscription changes
const preview = await subscriptionApi.previewSubscriptionChanges(workspaceId, {
  contributorType: 'JUNIOR',
  contributorCount: 2,
  billingCycle: 'monthly'
})
```

### Optimizations

```typescript
import { optimizationsApi, type OptimizationSuggestion } from '@/api'

// Get product optimization status
const status = await optimizationsApi.getProductOptimizationStatus(productId)

// Get description optimization for platform
const { suggestion, cached } = await optimizationsApi.getDescriptionOptimization(
  productId,
  'amazon'
)

// Regenerate optimization
const { suggestion: newSuggestion } = await optimizationsApi.regenerateDescriptionOptimization(
  productId,
  'amazon'
)

// Apply optimization to store
await optimizationsApi.applyDescriptionToStore(productId, 'amazon', suggestionId)
```

## HTTP Client

The API client (`client.ts`) provides:

### Automatic Authentication
Authentication token and workspace ID are automatically added to all requests via interceptors:

```typescript
// Automatically adds:
// Authorization: Bearer <token>
// X-Workspace-ID: <workspaceId>
```

### Response Handling
All API calls use a standardized response format:

```typescript
interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
```

The `handleApiResponse` helper automatically:
- Extracts data from successful responses
- Throws errors for failed responses
- Handles network errors

### Helper Functions

```typescript
import { apiGet, apiPost, apiPut, apiDelete } from '@/api'

// GET request
const data = await apiGet<Product[]>('/products')

// POST request
const created = await apiPost<Product>('/products', productData)

// PUT request
const updated = await apiPut<Product>(`/products/${id}`, updateData)

// DELETE request
await apiDelete(`/products/${id}`)
```

## Configuration

### API Base URL
```typescript
// Development: Uses Vite proxy (/api)
// Production: Set via VITE_API_BASE_URL env variable
```

### Endpoints
All endpoints are centralized in `config.ts`:

```typescript
import { ENDPOINTS } from '@/api'

// Usage
const url = ENDPOINTS.PRODUCTS.LIST
const getUrl = ENDPOINTS.PRODUCTS.GET(productId)
```

## Error Handling

### Authentication Errors (401)
Automatically handled by the response interceptor:
- Clears local storage
- Redirects to login page

### API Errors
```typescript
try {
  await productsApi.syncProducts(connectionId)
} catch (error) {
  if (error instanceof Error) {
    console.error('Sync failed:', error.message)
  }
}
```

## Type Safety

All API methods are fully typed:

```typescript
// TypeScript ensures correct types
const query: ProductsQuery = {
  page: 1,
  limit: 20,
  marketplace: 'shopify' // Type-checked
}

const response: ProductsResponse = await productsApi.getAllProducts(query)
// response.products is Product[]
// response.pagination is PaginationResponse
```

## Best Practices

### 1. Always Use Typed Imports
```typescript
// Good
import { productsApi, type Product } from '@/api'

// Avoid
import { productsApi } from '@/api'
import { Product } from '@/types/product'
```

### 2. Use Helper Functions for Complex Operations
```typescript
// Helper functions provide better ergonomics
const subscription = await getWorkspaceSubscription(workspaceId)

// Instead of
const subscription = await subscriptionApi.getSubscription(workspaceId)
```

### 3. Handle Errors Appropriately
```typescript
try {
  const data = await productsApi.getAllProducts()
  // Handle success
} catch (error) {
  // Handle error
  toast.error(error instanceof Error ? error.message : 'Failed to load products')
}
```

### 4. Use Query Parameters for Filtering
```typescript
// Leverage TypeScript for query building
const query: ProductsQuery = {
  search: searchTerm,
  marketplace: selectedMarketplace,
  page: currentPage
}

const { products } = await productsApi.getAllProducts(query)
```

## Testing

API methods can be easily mocked in tests:

```typescript
import { vi } from 'vitest'
import { productsApi } from '@/api'

// Mock the API
vi.mock('@/api', () => ({
  productsApi: {
    getAllProducts: vi.fn().mockResolvedValue({
      products: [],
      pagination: { /* ... */ }
    })
  }
}))

// Test component that uses the API
test('loads products on mount', async () => {
  render(<ProductsList />)
  expect(productsApi.getAllProducts).toHaveBeenCalled()
})
```

## Migration from `/services`

The API layer replaces the deprecated `/services` directory. All service imports have been migrated:

```typescript
// Old (deprecated)
import { marketplaceService } from '@/services/marketplace'

// New
import { marketplacesApi } from '@/api'
```

Helper functions from services are now exported from the main API index:

```typescript
// These still work for backward compatibility
import {
  getWorkspaceSubscription,
  getWorkspaceUsage,
  updateWorkspaceSubscription
} from '@/api'
```

## Contributing

When adding new API endpoints:

1. **Create resource file** in `/api/resources/`
2. **Define types** in `/api/types/`
3. **Export from index** in `/api/index.ts`
4. **Update ENDPOINTS** in `/api/config.ts`
5. **Add tests** in `/api/resources/__tests__/`
6. **Update this README** with usage examples

## Resources

- Backend API Documentation: `/server/RACKY_BACKEND_API.md`
- Postman Collection: `/server/postman_collection.json`
- Type Definitions: `/client/src/types/`
