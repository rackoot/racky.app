# VTEX Integration Analysis - Racky Platform

**Document Version**: 1.0
**Date**: 2025-10-23
**Status**: Active Development
**Severity Level**: CRITICAL - Multiple blocking issues identified

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Integration Status](#current-integration-status)
3. [Architecture Overview](#architecture-overview)
4. [Detailed Component Analysis](#detailed-component-analysis)
5. [Critical Issues Identified](#critical-issues-identified)
6. [VTEX APIs: Current vs Recommended](#vtex-apis-current-vs-recommended)
7. [Data Mapping](#data-mapping)
8. [Solution Roadmap](#solution-roadmap)
9. [Technical Specifications](#technical-specifications)
10. [References](#references)

---

## Executive Summary

### Overview

The VTEX marketplace integration in Racky is **partially functional** with several critical issues preventing production readiness. While connection testing, order sync, and customer sync work correctly, the core product synchronization feature has severe limitations that make it unsuitable for production use.

### Key Findings

| Component | Status | Severity | Impact |
|-----------|--------|----------|--------|
| Connection Testing | ✅ Working | - | Validates credentials correctly |
| Product Sync | ❌ Broken | **CRITICAL** | Only syncs 30 products with incomplete data |
| Product Details | ❌ Not Implemented | **HIGH** | Mock implementation, no real API calls |
| Batch Processor | ❌ Not Implemented | **HIGH** | Returns hardcoded test data |
| Order Sync | ✅ Working | - | Fully functional |
| Customer Sync | ✅ Working | - | Fully functional |
| Product Updates | ✅ Working | - | Can update descriptions |

### Business Impact

**Current State**:
- ❌ Cannot sync more than 30 products per store
- ❌ Products imported without prices (all show $0)
- ❌ Products imported without inventory levels (all show 0 stock)
- ❌ Products imported without images
- ❌ Products imported without variant information
- ❌ Async job system not functional for VTEX

**Risk Assessment**:
- **Revenue Impact**: HIGH - Feature unusable for stores with >30 products
- **User Experience**: CRITICAL - Synced products lack essential business data
- **Data Integrity**: HIGH - Incomplete product information
- **Scalability**: CRITICAL - Hard limit prevents growth

### Recommended Actions

**Immediate (Week 1-2)**:
1. Replace public API with private catalog API
2. Remove 30-product hard limit
3. Implement real pricing and inventory sync
4. Add proper pagination support

**Short-term (Week 3-4)**:
5. Implement product details fetching
6. Complete batch processor implementation
7. Add image and variant sync
8. Implement comprehensive error handling

**Medium-term (Month 2)**:
9. Add tests for all VTEX integration points
10. Optimize API call patterns
11. Add retry logic and rate limiting
12. Create monitoring and alerting

---

## Current Integration Status

### Working Components (40%)

#### 1. Connection Testing ✅
- **File**: `/server/src/modules/marketplaces/services/marketplaceService.ts:127-191`
- **Status**: Fully functional
- **API**: Private Collections API
- **Authentication**: Uses AppKey + AppToken correctly

#### 2. Order Synchronization ✅
- **File**: `/server/src/modules/orders/services/ordersService.ts:261-288`
- **Status**: Fully functional
- **API**: OMS (Order Management System) API
- **Features**: Fetches orders with proper date filtering, status mapping, price conversion

#### 3. Customer Synchronization ✅
- **File**: `/server/src/modules/customers/services/customersService.ts:255-282`
- **Status**: Fully functional
- **API**: CRM Documents API
- **Features**: Fetches customer data with proper field mapping

#### 4. Product Description Updates ✅
- **File**: `/server/src/modules/products/services/marketplaceUpdateService.ts:124-160`
- **Status**: Fully functional
- **API**: Private Catalog API
- **Features**: Can push updated descriptions back to VTEX

### Broken/Incomplete Components (60%)

#### 1. Product List Synchronization ❌
- **File**: `/server/src/modules/products/routes/products.ts:734-776`
- **Status**: Partially functional but critically flawed
- **Issues**:
  - Uses public API (no authentication)
  - Hard limit of 30 products
  - Missing price, inventory, images, variants
  - Credentials not used despite being passed

#### 2. Product Details Fetching ❌
- **File**: `/server/src/modules/products/routes/products.ts:432-445`
- **Status**: Mock implementation only
- **Issue**: Returns hardcoded test data, no real API integration

#### 3. Batch Sync Processor ❌
- **File**: `/server/src/jobs/processors/marketplaceSyncProcessor.ts:381-387`
- **Status**: Mock implementation only
- **Issue**: Returns fake product IDs, RabbitMQ async processing non-functional

---

## Architecture Overview

### File Structure

```
racky.app/
├── server/src/
│   ├── common/
│   │   ├── constants/
│   │   │   └── marketplaces.ts              # VTEX configuration
│   │   ├── models/
│   │   │   ├── Job.ts                       # Job status tracking
│   │   │   └── JobHistory.ts                # Job history
│   │   ├── services/
│   │   │   └── rabbitMQService.ts           # Queue management
│   │   └── types/
│   │       └── jobTypes.ts                  # Job type definitions
│   ├── modules/
│   │   ├── marketplaces/
│   │   │   └── services/
│   │   │       └── marketplaceService.ts    # ✅ Connection testing
│   │   ├── products/
│   │   │   ├── routes/
│   │   │   │   ├── products.ts              # ❌ Product sync (broken)
│   │   │   │   └── sync.ts                  # Async sync endpoints
│   │   │   ├── models/
│   │   │   │   └── Product.ts               # Product schema
│   │   │   └── services/
│   │   │       ├── marketplaceUpdateService.ts # ✅ Product updates
│   │   │       └── ProductHistoryService.ts    # History tracking
│   │   ├── orders/
│   │   │   └── services/
│   │   │       └── ordersService.ts         # ✅ Order sync
│   │   ├── customers/
│   │   │   └── services/
│   │   │       └── customersService.ts      # ✅ Customer sync
│   │   └── stores/
│   │       └── models/
│   │           └── StoreConnection.ts       # Store credentials
│   └── jobs/
│       └── processors/
│           └── marketplaceSyncProcessor.ts   # ❌ Batch processor (mock)
```

### Data Flow Diagram

#### Current (Broken) Product Sync Flow

```
┌─────────────┐
│   User UI   │
│  (Frontend) │
└──────┬──────┘
       │ Click "Sync Products"
       ▼
┌─────────────────────────────────────────┐
│ POST /api/products/sync/{connectionId} │
└──────┬──────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│  Fetch StoreConnection from DB    │
│  Extract: account_name, app_key,  │
│           app_token                │
└──────┬─────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ fetchVtexProducts(account, key, token)  │
│                                          │
│ ❌ PROBLEM: Credentials passed but      │
│    NOT USED in function                 │
└──────┬───────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│ VTEX Public API Call (NO AUTH)            │
│                                            │
│ GET /pub/products/search?_from=0&_to=29  │
│                                            │
│ ❌ PROBLEMS:                               │
│   • No authentication headers             │
│   • Hard limit: 30 products only          │
│   • Returns minimal data                  │
└──────┬─────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────┐
│ Response: Array of products   │
│                                │
│ ⚠️  Missing:                   │
│   • Prices (all = 0)          │
│   • Inventory (all = 0)       │
│   • Images (empty array)      │
│   • Variants (empty array)    │
└──────┬─────────────────────────┘
       │
       ▼
┌────────────────────────────────┐
│ saveVtexProduct() - Loop      │
│                                │
│ For each product:             │
│   • externalId = productId    │
│   • title = productName       │
│   • price = 0 ❌              │
│   • inventory = 0 ❌          │
│   • images = [] ❌            │
│   • currency = 'BRL' (hard)   │
└──────┬─────────────────────────┘
       │
       ▼
┌────────────────────────────────┐
│ MongoDB: products collection  │
│                                │
│ Result: Incomplete products   │
│ stored in database            │
└────────────────────────────────┘
```

#### Recommended Product Sync Flow

```
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │
       ▼
┌────────────────────────────────────┐
│ POST /api/products/sync/start     │
│ Returns: jobId (immediate)        │
└──────┬─────────────────────────────┘
       │
       ▼
┌────────────────────────────────────┐
│ Create RabbitMQ Job               │
│ Type: MARKETPLACE_SYNC            │
└──────┬─────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ Worker: processMarketplaceSync()            │
│                                              │
│ ✅ Use Private API with Auth:               │
│ GET /pvt/products/GetProductAndSkuIds       │
│ Headers: X-VTEX-API-AppKey, AppToken       │
│                                              │
│ ✅ Fetch ALL products (paginated)           │
│ ✅ Get complete SKU list                    │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Create Batches (75 products each)   │
│ Queue child jobs                     │
└──────┬───────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────┐
│ Worker: processProductBatch() × 3          │
│ (3 concurrent workers)                     │
│                                            │
│ For each product:                          │
│   1. Get product details                   │
│      GET /pvt/product/{id}                │
│                                            │
│   2. Get pricing info                      │
│      GET /pricing/pvt/prices/{id}         │
│                                            │
│   3. Get inventory                         │
│      GET /logistics/pvt/inventory/{sku}   │
│                                            │
│   4. Transform & save complete data        │
│      ✅ Real prices                        │
│      ✅ Real inventory                     │
│      ✅ Images                             │
│      ✅ Variants                           │
└──────┬─────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────┐
│ MongoDB: Complete products    │
│ ProductHistory: Audit trail   │
└────────────────────────────────┘
```

---

## Detailed Component Analysis

### 1. VTEX Configuration

**File**: `/server/src/common/constants/marketplaces.ts`

**Current Configuration**:

```typescript
{
  id: 'vtex',
  name: 'VTEX',
  credentials: [
    {
      name: 'account_name',
      label: 'Account Name',
      type: 'text',
      required: true,
      placeholder: 'mystore',
      helpText: 'Your VTEX account name (e.g., "mystore" from mystore.vtexcommercestable.com.br)'
    },
    {
      name: 'app_key',
      label: 'App Key',
      type: 'text',
      required: true,
      placeholder: 'vtexappkey-mystore-XXXXX',
      helpText: 'VTEX App Key (format: vtexappkey-account-XXX)'
    },
    {
      name: 'app_token',
      label: 'App Token',
      type: 'password',
      required: true,
      helpText: 'VTEX App Token for authentication'
    }
  ],
  testEndpoint: 'https://{account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/collection/search'
}
```

**Analysis**:
- ✅ Correct credentials required
- ✅ Proper help text for users
- ✅ Secure password field for token
- ✅ Test endpoint uses private API (correct)

---

### 2. Connection Testing

**File**: `/server/src/modules/marketplaces/services/marketplaceService.ts:127-191`

**Function**: `testVtexConnection()`

**Code Analysis**:

```typescript
async function testVtexConnection(credentials: VtexCredentials) {
  const { account_name, app_key, app_token } = credentials;

  // Validation
  if (!account_name || !app_key || !app_token) {
    return {
      success: false,
      message: 'Missing required VTEX credentials',
      data: { missing_fields: [...] }
    };
  }

  // ✅ GOOD: Account name cleaning handles multiple formats
  let cleanAccountName = account_name
    .replace(/^https?:\/\//, '')
    .replace(/\.vtexcommercestable\.com\.br.*$/, '')
    .replace(/\.vtex\.com\.br.*$/, '')
    .replace(/\.vtexcommerce\.com\.br.*$/, '')
    .replace(/\/$/, '');

  // ✅ GOOD: Uses private API with authentication
  const vtexUrl = `https://${cleanAccountName}.vtexcommercestable.com.br/api/catalog_system/pvt/collection/search`;

  const response = await axios.get(vtexUrl, {
    headers: {
      'X-VTEX-API-AppKey': app_key,      // ✅ Correct
      'X-VTEX-API-AppToken': app_token,  // ✅ Correct
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 10000
  });

  return {
    success: true,
    message: 'VTEX connection successful',
    data: {
      account_name: cleanAccountName,
      collections_count: response.data?.length || 0,
      url_tested: vtexUrl
    }
  };
}
```

**Status**: ✅ **FULLY FUNCTIONAL**

**Strengths**:
- Proper credential validation
- Handles multiple domain formats
- Uses authenticated private API
- Good error handling
- Informative response

**Weaknesses**:
- None identified

---

### 3. Product List Synchronization

**File**: `/server/src/modules/products/routes/products.ts:734-776`

**Function**: `fetchVtexProducts()`

**Code Analysis**:

```typescript
// ❌ PROBLEM 1: Parameters defined but NOT USED
async function fetchVtexProducts(
  accountName: string,
  appKey: string,      // ❌ Never used
  appToken: string,    // ❌ Never used
  limit: number = 30   // ❌ Hard limit
) {
  try {
    const axios = require('axios');

    // ❌ PROBLEM 2: Uses PUBLIC API (no authentication)
    const apiUrl = `https://${accountName}.vtexcommercestable.com.br/api/catalog_system/pub/products/search`;

    console.log(`[VTEX] Fetching products from: ${apiUrl}`);

    // ❌ PROBLEM 3: No authentication headers despite having credentials
    const response = await axios.get(apiUrl, {
      params: {
        '_from': 0,
        '_to': limit - 1  // ❌ Maximum 29 (for limit=30)
      },
      timeout: 30000
      // ❌ NO HEADERS for AppKey/AppToken
    });

    const products = response.data;

    // ❌ PROBLEM 4: Public API returns incomplete data
    // Missing: prices, inventory, images, variants

    return products.slice(0, limit);

  } catch (error: any) {
    // ❌ PROBLEM 5: Silent fallback on auth errors
    if (error.response?.status === 401) {
      console.error('[VTEX] Authentication failed - using public API instead');
      // Continues without notifying user
    }
    throw new Error(`Failed to fetch VTEX products: ${error.message}`);
  }
}
```

**Status**: ❌ **CRITICALLY BROKEN**

**Problems Identified**:

1. **Uses Public API** (Severity: CRITICAL)
   - Public endpoint doesn't require authentication
   - Returns minimal product data
   - No access to pricing, inventory, or detailed info

2. **Hard Limit of 30 Products** (Severity: CRITICAL)
   - Line 712: `await fetchVtexProducts(cleanAccountName, app_key, app_token, 30);`
   - Stores with >30 products cannot sync full catalog
   - No pagination implemented

3. **Credentials Not Used** (Severity: HIGH)
   - `appKey` and `appToken` parameters passed but ignored
   - Private API benefits unavailable

4. **Missing Critical Data** (Severity: CRITICAL)
   - Price: Always 0
   - Inventory: Always 0
   - Images: Empty array
   - Variants: Empty array

5. **Silent Error Handling** (Severity: MEDIUM)
   - 401 errors logged but not surfaced to user
   - User doesn't know credentials are invalid

**Call Site**:

```typescript
// Line 712 in products.ts
const vtexProducts = await fetchVtexProducts(
  cleanAccountName,
  app_key,    // ❌ Passed but not used
  app_token,  // ❌ Passed but not used
  30          // ❌ Hard limit
);
```

---

### 4. Product Data Transformation

**File**: `/server/src/modules/products/routes/products.ts:778-861`

**Function**: `saveVtexProduct()`

**Code Analysis**:

```typescript
async function saveVtexProduct(
  vtexProduct: any,
  userId: Types.ObjectId,
  workspaceId: Types.ObjectId,
  connectionId: Types.ObjectId
) {
  // Extract VTEX product fields
  const {
    productId,           // ✅ Available
    productName,         // ✅ Available
    productReference,    // ✅ Available
    metaTagDescription,  // ✅ Available
    brand,               // ✅ Available
    categories           // ✅ Available
  } = vtexProduct;

  // ❌ PROBLEM: Platform data incomplete
  const vtexPlatform = {
    platform: 'vtex' as PlatformType,
    platformId: productId || '',
    platformSku: productReference || '',
    platformPrice: undefined,     // ❌ Public API doesn't provide
    platformInventory: 0,         // ❌ Public API doesn't provide
    platformStatus: 'active',     // ⚠️  Assumption (no verification)
    lastSyncAt: new Date()
  };

  // ❌ PROBLEM: Product data with zero values
  const productData: Partial<IProduct> = {
    workspaceId,
    userId,
    storeConnectionId: connectionId,

    // ✅ WORKING: Basic metadata
    externalId: productId,
    title: productName || 'Untitled Product',
    description: metaTagDescription || '',
    vendor: brand || '',
    productType: categories?.[0] || '',

    // ❌ CRITICAL: Missing business data
    price: 0,                    // ❌ Always zero
    sku: productReference || '',
    inventory: 0,                // ❌ Always zero
    compareAtPrice: undefined,   // ❌ Not available
    cost: undefined,             // ❌ Not available
    taxable: false,              // ❌ Default assumption
    barcode: undefined,          // ❌ Not available
    weight: undefined,           // ❌ Not available

    // ❌ CRITICAL: Empty collections
    images: [],                  // ❌ Would need additional API call
    variants: [],                // ❌ Would need additional API call
    videos: [],                  // ❌ Not available in public API

    // Metadata
    marketplace: 'vtex' as MarketplaceType,
    status: ProductStatus.ACTIVE,
    platforms: [vtexPlatform],

    // ⚠️  PROBLEM: Hardcoded currency
    currency: 'BRL',             // ❌ Assumes Brazil

    // Tracking
    lastSyncedAt: new Date()
  };

  // Upsert to database
  const product = await Product.findOneAndUpdate(
    {
      workspaceId,
      marketplace: 'vtex',
      externalId: productId
    },
    { $set: productData },
    { upsert: true, new: true }
  );

  return product;
}
```

**Status**: ❌ **INCOMPLETE - Missing Critical Data**

**Data Quality Issues**:

| Field | Status | Value | Issue |
|-------|--------|-------|-------|
| `title` | ✅ Working | From API | Good |
| `description` | ✅ Working | From API | Good |
| `vendor` | ✅ Working | From API | Good |
| `productType` | ✅ Working | From API | Good |
| `price` | ❌ Missing | Always `0` | CRITICAL |
| `inventory` | ❌ Missing | Always `0` | CRITICAL |
| `images` | ❌ Missing | Always `[]` | HIGH |
| `variants` | ❌ Missing | Always `[]` | HIGH |
| `currency` | ⚠️  Hardcoded | Always `BRL` | MEDIUM |
| `sku` | ⚠️  Partial | Basic only | MEDIUM |

---

### 5. Product Details Fetching

**File**: `/server/src/modules/products/routes/products.ts:432-445`

**Function**: `fetchVtexProductDetails()`

**Code Analysis**:

```typescript
async function fetchVtexProductDetails(productId: string, credentials: any) {
  // ❌ CRITICAL: Mock implementation - NO REAL API CALL
  // TODO: Implement actual VTEX product details fetching

  return {
    id: productId,
    title: `VTEX Product ${productId}`,
    description: 'Mock VTEX product description',
    price: 99.99,
    inventory: 100,
    images: [
      {
        src: 'https://via.placeholder.com/300',
        alt: 'Mock product image'
      }
    ],
    variants: [
      {
        id: `${productId}-variant-1`,
        title: 'Default Variant',
        price: 99.99,
        sku: `SKU-${productId}`,
        inventory: 100
      }
    ]
  };
}
```

**Status**: ❌ **NOT IMPLEMENTED - Mock Only**

**Issues**:
1. Returns hardcoded test data
2. No actual API integration
3. Function exists but does nothing useful
4. Would break individual product sync if attempted

**Recommended Implementation**:

```typescript
async function fetchVtexProductDetails(productId: string, credentials: any) {
  const { account_name, app_key, app_token } = credentials;

  // Get product details
  const productUrl = `https://${account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/product/${productId}`;
  const productResponse = await axios.get(productUrl, {
    headers: {
      'X-VTEX-API-AppKey': app_key,
      'X-VTEX-API-AppToken': app_token
    }
  });

  // Get SKU details with pricing
  const skus = productResponse.data.skus;
  const skuDetails = await Promise.all(
    skus.map(sku => fetchVtexSkuDetails(sku.id, credentials))
  );

  return {
    product: productResponse.data,
    skus: skuDetails
  };
}
```

---

### 6. Batch Sync Processor

**File**: `/server/src/jobs/processors/marketplaceSyncProcessor.ts:381-387`

**Function**: `fetchVtexProducts()` (in processor context)

**Code Analysis**:

```typescript
async function fetchVtexProducts(credentials: any): Promise<string[]> {
  // ❌ CRITICAL: Mock implementation
  // TODO: Implement actual VTEX product fetching

  return [
    'vtex_product_1',
    'vtex_product_2',
    'vtex_product_3'
  ];
}
```

**Status**: ❌ **NOT IMPLEMENTED - Mock Only**

**Issues**:
1. Returns fake product IDs
2. RabbitMQ job system non-functional for VTEX
3. Async batch processing broken
4. Would need complete rewrite for production

**Impact**:
- Modern async sync flow doesn't work
- Can only use legacy synchronous sync (also broken)
- No progress tracking
- No job status updates

---

### 7. Working Components

#### Order Synchronization ✅

**File**: `/server/src/modules/orders/services/ordersService.ts:261-288`

**Code Analysis**:

```typescript
private static async fetchVtexOrders(
  store: IStoreConnection,
  sinceDate: Date
): Promise<any[]> {
  const { account_name, app_key, app_token } = store.credentials;

  // ✅ GOOD: Proper validation
  if (!account_name || !app_key || !app_token) {
    throw new Error('Missing VTEX credentials');
  }

  // ✅ GOOD: Uses private OMS API
  const url = `https://${account_name}.vtexcommercestable.com.br/api/oms/pvt/orders`;

  // ✅ GOOD: Date filtering
  const params = {
    f_creationDate: `creationDate:[${sinceDate.toISOString().split('T')[0]} TO NOW]`,
    per_page: 100,
    page: 1
  };

  // ✅ GOOD: Proper authentication
  const response = await axios.get(url, {
    headers: {
      'X-VTEX-API-AppKey': app_key,
      'X-VTEX-API-AppToken': app_token,
      'Content-Type': 'application/json'
    },
    params,
    timeout: 30000
  });

  return response.data.list || [];
}
```

**Status**: ✅ **FULLY FUNCTIONAL**

**Strengths**:
- Uses authenticated private API
- Proper date filtering
- Good pagination (100 per page)
- Correct header format
- Error handling

---

#### Customer Synchronization ✅

**File**: `/server/src/modules/customers/services/customersService.ts:255-282`

**Status**: ✅ **FULLY FUNCTIONAL**

Similar quality to order sync - uses private CRM API with proper authentication.

---

#### Product Updates ✅

**File**: `/server/src/modules/products/services/marketplaceUpdateService.ts:124-160`

**Code Analysis**:

```typescript
private static async updateVtexProductDescription(
  product: IProduct,
  description: string,
  credentials: any
): Promise<void> {
  const { account_name, app_key, app_token } = credentials;
  const productId = product.externalId;

  // ✅ GOOD: Uses private catalog API
  const response = await axios.put(
    `https://${account_name}.vtexcommercestable.com.br/api/catalog/pvt/product/${productId}`,
    {
      Description: description  // ✅ Correct capitalization for VTEX API
    },
    {
      headers: {
        'X-VTEX-API-AppKey': app_key,
        'X-VTEX-API-AppToken': app_token,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  console.log(`[VTEX] Updated product ${productId} description`);
}
```

**Status**: ✅ **FULLY FUNCTIONAL**

**Strengths**:
- Uses authenticated private API
- Correct endpoint
- Proper field naming (capitalized "Description")
- Good timeout handling

---

## Critical Issues Identified

### Issue #1: 30 Product Hard Limit

**Severity**: 🔴 CRITICAL
**File**: `/server/src/modules/products/routes/products.ts:712`
**Impact**: Business-blocking for any store with >30 products

**Problem**:
```typescript
const vtexProducts = await fetchVtexProducts(
  cleanAccountName,
  app_key,
  app_token,
  30  // ❌ Hardcoded limit
);
```

**Business Impact**:
- Average VTEX store has 100-1,000+ products
- Feature unusable for 95%+ of potential users
- No workaround available
- Competitors can sync unlimited products

**Solution**:
```typescript
// Remove limit, implement proper pagination
let allProducts = [];
let page = 1;
let hasMore = true;

while (hasMore) {
  const products = await fetchVtexProductsPaginated(
    credentials,
    page,
    100  // Per page
  );
  allProducts = allProducts.concat(products);
  hasMore = products.length === 100;
  page++;
}
```

**Effort**: 2-3 days
**Priority**: P0 - Must fix immediately

---

### Issue #2: Public API Usage (No Authentication)

**Severity**: 🔴 CRITICAL
**File**: `/server/src/modules/products/routes/products.ts:739`
**Impact**: Missing all pricing, inventory, and detailed product data

**Problem**:
```typescript
// Uses public endpoint
const apiUrl = `https://${accountName}.vtexcommercestable.com.br/api/catalog_system/pub/products/search`;

// No authentication headers sent
const response = await axios.get(apiUrl, {
  params: { '_from': 0, '_to': 29 },
  // ❌ Missing: headers with AppKey/AppToken
});
```

**Data Loss**:
| Field | Public API | Private API |
|-------|------------|-------------|
| Product ID | ✅ | ✅ |
| Title | ✅ | ✅ |
| Description | ⚠️  Basic | ✅ Full |
| Price | ❌ | ✅ |
| Inventory | ❌ | ✅ |
| Images | ❌ | ✅ |
| Variants | ❌ | ✅ |
| SKUs | ⚠️  Basic | ✅ Full |

**Solution**:
```typescript
// Use private authenticated endpoint
const apiUrl = `https://${accountName}.vtexcommercestable.com.br/api/catalog_system/pvt/products/GetProductAndSkuIds`;

const response = await axios.get(apiUrl, {
  headers: {
    'X-VTEX-API-AppKey': appKey,
    'X-VTEX-API-AppToken': appToken,
    'Content-Type': 'application/json'
  },
  params: {
    page: pageNumber,
    pagesize: 100
  }
});
```

**Effort**: 1-2 days
**Priority**: P0 - Critical data missing

---

### Issue #3: Zero Prices and Inventory

**Severity**: 🔴 CRITICAL
**File**: `/server/src/modules/products/routes/products.ts:837-843`
**Impact**: Products unusable for business operations

**Problem**:
```typescript
const productData: Partial<IProduct> = {
  price: 0,        // ❌ Always zero
  inventory: 0,    // ❌ Always zero
  images: [],      // ❌ Always empty
  variants: [],    // ❌ Always empty
  // ...
};
```

**Business Impact**:
- Cannot track inventory levels
- Cannot display product prices
- Cannot calculate revenue
- Cannot manage stock
- Cannot show product images
- Cannot handle product variants

**Root Cause**: Public API doesn't provide this data

**Solution**: Implement multi-step fetching

```typescript
// Step 1: Get product list
const productIds = await fetchProductIds(credentials);

// Step 2: For each product, get details
for (const productId of productIds) {
  // Get product info
  const product = await fetchProductDetails(productId, credentials);

  // Get pricing
  const pricing = await fetchProductPricing(productId, credentials);

  // Get inventory for each SKU
  for (const sku of product.skus) {
    const inventory = await fetchSkuInventory(sku.id, credentials);
    sku.inventory = inventory.totalQuantity;
  }

  // Save complete product
  await saveCompleteProduct(product, pricing);
}
```

**Required APIs**:
1. `/api/catalog_system/pvt/products/GetProductAndSkuIds` - Product list
2. `/api/catalog_system/pvt/product/{id}` - Product details
3. `/api/pricing/pvt/prices/{sellerId}/{skuId}` - Pricing
4. `/api/logistics/pvt/inventory/skus/{skuId}` - Inventory

**Effort**: 3-5 days
**Priority**: P0 - Core functionality broken

---

### Issue #4: Mock Product Details Implementation

**Severity**: 🔴 HIGH
**File**: `/server/src/modules/products/routes/products.ts:432-445`
**Impact**: Individual product sync completely non-functional

**Problem**:
```typescript
async function fetchVtexProductDetails(productId: string, credentials: any) {
  // TODO: Implement actual VTEX product details fetching
  return {
    id: productId,
    title: `VTEX Product ${productId}`,  // ❌ Fake data
    description: 'Mock VTEX product description',
    price: 99.99,
    // ... all hardcoded
  };
}
```

**Impact**:
- Cannot sync individual products
- Cannot refresh product data
- Testing shows fake data
- Users would see obviously wrong information

**Solution**: Implement real API call

```typescript
async function fetchVtexProductDetails(
  productId: string,
  credentials: VtexCredentials
): Promise<VtexProductDetails> {
  const { account_name, app_key, app_token } = credentials;

  const url = `https://${account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/product/${productId}`;

  const response = await axios.get(url, {
    headers: {
      'X-VTEX-API-AppKey': app_key,
      'X-VTEX-API-AppToken': app_token,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}
```

**Effort**: 1 day
**Priority**: P1 - Required for complete implementation

---

### Issue #5: Mock Batch Processor

**Severity**: 🔴 HIGH
**File**: `/server/src/jobs/processors/marketplaceSyncProcessor.ts:381-387`
**Impact**: Async job system non-functional

**Problem**:
```typescript
async function fetchVtexProducts(credentials: any): Promise<string[]> {
  // TODO: Implement actual VTEX product fetching
  return ['vtex_product_1', 'vtex_product_2', 'vtex_product_3'];
}
```

**Impact**:
- RabbitMQ async processing doesn't work
- No batch job support
- No progress tracking
- Cannot use modern sync flow

**Solution**: Implement real fetching logic

```typescript
async function fetchVtexProducts(credentials: VtexCredentials): Promise<string[]> {
  const { account_name, app_key, app_token } = credentials;

  let productIds: string[] = [];
  let page = 1;
  let pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `https://${account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/products/GetProductAndSkuIds`;

    const response = await axios.get(url, {
      headers: {
        'X-VTEX-API-AppKey': app_key,
        'X-VTEX-API-AppToken': app_token
      },
      params: { page, pagesize: pageSize }
    });

    const data = response.data.data;
    productIds = productIds.concat(
      data.map((item: any) => item.productId.toString())
    );

    hasMore = data.length === pageSize;
    page++;
  }

  return productIds;
}
```

**Effort**: 2-3 days
**Priority**: P1 - Required for scalable sync

---

### Issue #6: Credentials Passed But Not Used

**Severity**: 🟡 MEDIUM
**File**: `/server/src/modules/products/routes/products.ts:736`
**Impact**: Code confusion, wasted parameters

**Problem**:
```typescript
// Function signature includes credentials
async function fetchVtexProducts(
  accountName: string,
  appKey: string,      // ❌ Parameter exists but never used
  appToken: string,    // ❌ Parameter exists but never used
  limit: number = 30
) {
  // Function body never references appKey or appToken
  const response = await axios.get(apiUrl, {
    // No auth headers
  });
}
```

**Impact**:
- Confusing code
- Developer expects authentication but doesn't happen
- Debugging difficulty

**Solution**: Either use the credentials or remove parameters

**Effort**: 30 minutes (as part of fixing Issue #2)
**Priority**: P2 - Code quality

---

### Issue #7: Duplicated Account Name Cleaning

**Severity**: 🟡 LOW
**Files**:
- `/server/src/modules/marketplaces/services/marketplaceService.ts:140-153`
- `/server/src/modules/products/routes/products.ts:693-702`

**Problem**: Same regex-based cleaning logic duplicated

**Impact**:
- Code duplication
- Risk of inconsistency if one updated but not the other
- Harder maintenance

**Solution**: Create shared utility

```typescript
// /server/src/common/utils/vtexUtils.ts
export function cleanVtexAccountName(accountName: string): string {
  return accountName
    .replace(/^https?:\/\//, '')
    .replace(/\.vtexcommercestable\.com\.br.*$/, '')
    .replace(/\.vtex\.com\.br.*$/, '')
    .replace(/\.vtexcommerce\.com\.br.*$/, '')
    .replace(/\/$/, '');
}
```

**Effort**: 1 hour
**Priority**: P3 - Code quality improvement

---

### Issue #8: Silent Authentication Failure

**Severity**: 🟡 MEDIUM
**File**: `/server/src/modules/products/routes/products.ts:770-772`
**Impact**: Users don't know their credentials are invalid

**Problem**:
```typescript
catch (error: any) {
  console.error('[VTEX] Error fetching products:', error.message);
  if (error.response?.status === 401) {
    console.error('[VTEX] Authentication failed - using public API instead');
    // ❌ Continues silently, user not notified
  }
  throw new Error(`Failed to fetch VTEX products: ${error.message}`);
}
```

**Impact**:
- User thinks sync succeeded
- Doesn't know credentials are wrong
- Continues with incomplete data

**Solution**: Surface authentication errors

```typescript
if (error.response?.status === 401) {
  throw new Error(
    'VTEX authentication failed. Please check your App Key and App Token in store settings.'
  );
}
```

**Effort**: 30 minutes
**Priority**: P2 - User experience

---

### Issue #9: Hardcoded BRL Currency

**Severity**: 🟡 MEDIUM
**File**: `/server/src/modules/products/routes/products.ts:849`
**Impact**: Wrong currency for non-Brazilian stores

**Problem**:
```typescript
const productData: Partial<IProduct> = {
  currency: 'BRL',  // ❌ Assumes all VTEX stores are in Brazil
  // ...
};
```

**Impact**:
- VTEX operates in Mexico (MXN), Argentina (ARS), Colombia (COP), Chile (CLP), etc.
- Prices shown in wrong currency
- Conversion calculations incorrect

**Solution**: Fetch from store settings or make configurable

```typescript
// Option 1: From VTEX store settings API
const storeSettings = await fetchVtexStoreSettings(credentials);
const currency = storeSettings.currencyCode;

// Option 2: User configuration
const currency = store.settings?.currency || 'BRL';
```

**Effort**: 2-3 hours
**Priority**: P2 - International support

---

### Issue #10: API Endpoint Inconsistency

**Severity**: 🟡 MEDIUM
**Impact**: Confusion about which API to use

**Problem**:

| Function | API Type | Authenticated |
|----------|----------|---------------|
| Connection Test | Private (`/pvt/`) | ✅ Yes |
| Product List | Public (`/pub/`) | ❌ No |
| Product Update | Private (`/pvt/`) | ✅ Yes |
| Orders | Private (`/pvt/`) | ✅ Yes |
| Customers | Private (`/pvt/`) | ✅ Yes |

**Impact**:
- Only product sync uses public API
- Inconsistent authentication pattern
- Confusing for developers

**Solution**: Standardize on private APIs with authentication

**Effort**: Included in fixing Issue #2
**Priority**: P2 - Architectural consistency

---

## VTEX APIs: Current vs Recommended

### Current API Usage

#### Connection Testing ✅
```http
GET /api/catalog_system/pvt/collection/search
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```
**Status**: Correct, keep as-is

---

#### Product List ❌
```http
GET /api/catalog_system/pub/products/search?_from=0&_to=29
Host: {account}.vtexcommercestable.com.br
# No authentication
```
**Status**: Wrong API, no auth, limited data

---

### Recommended API Usage

#### Product List (Recommended) ✅
```http
GET /api/catalog_system/pvt/products/GetProductAndSkuIds
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
Content-Type: application/json

Query Parameters:
  - page: number (1-based)
  - pagesize: number (max 100)
```

**Response**:
```json
{
  "data": [
    {
      "productId": 123,
      "skuIds": [456, 789]
    }
  ],
  "range": {
    "total": 1000,
    "from": 0,
    "to": 99
  }
}
```

**Advantages**:
- ✅ Authenticated access
- ✅ Complete product list
- ✅ Proper pagination
- ✅ Returns SKU IDs for detailed fetching

---

#### Product Details (New) ✅
```http
GET /api/catalog_system/pvt/product/{productId}
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```

**Response**: Complete product data including:
- Product metadata
- Brand, categories
- Specifications
- SKU list
- Image URLs (requires separate calls for full data)

---

#### SKU Details ✅
```http
GET /api/catalog_system/pvt/sku/stockkeepingunitbyid/{skuId}
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```

**Response**: Complete SKU data:
- SKU metadata
- Reference code
- EAN/UPC
- Dimensions and weight
- Image IDs

---

#### Pricing (New - Required) ✅
```http
GET /api/pricing/pvt/prices/{sellerId}/{skuId}
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```

**Response**:
```json
{
  "itemId": "456",
  "listPrice": 199.90,
  "costPrice": 100.00,
  "markup": 99.90,
  "basePrice": 199.90,
  "fixedPrices": [
    {
      "value": 179.90,
      "listPrice": 199.90,
      "minQuantity": 1
    }
  ]
}
```

**Maps to**:
- `listPrice` → `compareAtPrice`
- `fixedPrices[0].value` → `price`
- `costPrice` → `cost`

---

#### Inventory (New - Required) ✅
```http
GET /api/logistics/pvt/inventory/skus/{skuId}
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```

**Response**:
```json
{
  "skuId": "456",
  "balance": [
    {
      "warehouseId": "1_1",
      "warehouseName": "Main Warehouse",
      "totalQuantity": 100,
      "reservedQuantity": 10,
      "availableQuantity": 90
    }
  ],
  "totalQuantity": 100
}
```

**Maps to**: `inventory` = `totalQuantity`

---

#### Product Images (New - Recommended) ✅
```http
GET /api/catalog/pvt/stockkeepingunit/{skuId}/file
Host: {account}.vtexcommercestable.com.br
X-VTEX-API-AppKey: {app_key}
X-VTEX-API-AppToken: {app_token}
```

**Response**:
```json
[
  {
    "Id": 789,
    "ArchiveId": 1001,
    "SkuId": 456,
    "Name": "Product Image",
    "IsMain": true,
    "Label": "",
    "Url": "https://example.vteximg.com.br/arquivos/image.jpg"
  }
]
```

**Maps to**: `images` array

---

### Complete Sync Flow with Recommended APIs

```typescript
// Step 1: Get all product IDs (paginated)
async function getAllProductIds(credentials) {
  const productIds = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(
      `https://${credentials.account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/products/GetProductAndSkuIds`,
      {
        headers: {
          'X-VTEX-API-AppKey': credentials.app_key,
          'X-VTEX-API-AppToken': credentials.app_token
        },
        params: { page, pagesize: 100 }
      }
    );

    productIds.push(...response.data.data.map(p => p.productId));
    hasMore = response.data.data.length === 100;
    page++;
  }

  return productIds;
}

// Step 2: Get product details
async function getProductDetails(productId, credentials) {
  const response = await axios.get(
    `https://${credentials.account_name}.vtexcommercestable.com.br/api/catalog_system/pvt/product/${productId}`,
    {
      headers: {
        'X-VTEX-API-AppKey': credentials.app_key,
        'X-VTEX-API-AppToken': credentials.app_token
      }
    }
  );

  return response.data;
}

// Step 3: Get SKU pricing
async function getSkuPricing(skuId, credentials) {
  const sellerId = '1'; // Or fetch from store settings

  const response = await axios.get(
    `https://${credentials.account_name}.vtexcommercestable.com.br/api/pricing/pvt/prices/${sellerId}/${skuId}`,
    {
      headers: {
        'X-VTEX-API-AppKey': credentials.app_key,
        'X-VTEX-API-AppToken': credentials.app_token
      }
    }
  );

  return {
    price: response.data.fixedPrices?.[0]?.value || response.data.basePrice,
    compareAtPrice: response.data.listPrice,
    cost: response.data.costPrice
  };
}

// Step 4: Get SKU inventory
async function getSkuInventory(skuId, credentials) {
  const response = await axios.get(
    `https://${credentials.account_name}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${skuId}`,
    {
      headers: {
        'X-VTEX-API-AppKey': credentials.app_key,
        'X-VTEX-API-AppToken': credentials.app_token
      }
    }
  );

  return response.data.totalQuantity || 0;
}

// Step 5: Get SKU images
async function getSkuImages(skuId, credentials) {
  const response = await axios.get(
    `https://${credentials.account_name}.vtexcommercestable.com.br/api/catalog/pvt/stockkeepingunit/${skuId}/file`,
    {
      headers: {
        'X-VTEX-API-AppKey': credentials.app_key,
        'X-VTEX-API-AppToken': credentials.app_token
      }
    }
  );

  return response.data.map(img => ({
    src: img.Url,
    alt: img.Label || img.Name,
    position: img.IsMain ? 0 : img.Id
  }));
}

// Complete sync
async function syncVtexProducts(credentials) {
  const productIds = await getAllProductIds(credentials);

  for (const productId of productIds) {
    const product = await getProductDetails(productId, credentials);

    for (const sku of product.skus) {
      const [pricing, inventory, images] = await Promise.all([
        getSkuPricing(sku.id, credentials),
        getSkuInventory(sku.id, credentials),
        getSkuImages(sku.id, credentials)
      ]);

      await saveCompleteProduct({
        externalId: productId,
        title: product.name,
        description: product.description,
        ...pricing,
        inventory,
        images,
        variants: product.skus.map(s => ({
          id: s.id,
          title: s.name,
          sku: s.sku
        }))
      });
    }

    // Rate limiting
    await sleep(100);
  }
}
```

---

### API Call Volume Analysis

**Current Implementation**:
- 1 API call for up to 30 products
- **Total**: 1 call (but incomplete data)

**Recommended Implementation** (for 100 products with 2 variants each):
- 1+ calls for product IDs (paginated)
- 100 calls for product details
- 200 calls for SKU pricing (2 per product)
- 200 calls for SKU inventory
- 200 calls for SKU images
- **Total**: ~701 calls

**Optimization Strategies**:
1. Batch processing (75 products per batch)
2. Parallel requests (3 concurrent batches)
3. Rate limiting (100ms between calls)
4. Caching (avoid re-fetching unchanged products)
5. Incremental sync (only changed products)

**Estimated Time** (for 1000 products):
- Sequential: ~100 seconds (with 100ms delays)
- With 3 concurrent batches: ~35 seconds
- With caching (10% changed): ~4 seconds

---

## Data Mapping

### Current Mapping (Incomplete)

| VTEX Field | Racky Field | Source | Status |
|------------|-------------|--------|--------|
| `productId` | `externalId` | Public API | ✅ |
| `productName` | `title` | Public API | ✅ |
| `productReference` | `sku` | Public API | ✅ |
| `metaTagDescription` | `description` | Public API | ⚠️  Basic |
| `brand` | `vendor` | Public API | ✅ |
| `categories[0]` | `productType` | Public API | ⚠️  First only |
| N/A | `price` | - | ❌ Always 0 |
| N/A | `inventory` | - | ❌ Always 0 |
| N/A | `images` | - | ❌ Empty |
| N/A | `variants` | - | ❌ Empty |
| Hardcoded | `currency` | - | ⚠️  Always BRL |

### Recommended Complete Mapping

| VTEX API | VTEX Field | Racky Field | Transformation |
|----------|------------|-------------|----------------|
| **Product Details** | | | |
| Catalog | `Id` | `externalId` | String |
| Catalog | `Name` | `title` | Direct |
| Catalog | `Description` | `description` | HTML to text |
| Catalog | `BrandName` | `vendor` | Direct |
| Catalog | `CategoryPath` | `productType` | Join with " > " |
| Catalog | `MetaTagDescription` | `metaDescription` | Direct |
| Catalog | `RefId` | `sku` | Product-level SKU |
| **SKU Data** | | | |
| Catalog | `SkuId` | `variants[].id` | String |
| Catalog | `SkuName` | `variants[].title` | Direct |
| Catalog | `RefId` | `variants[].sku` | Direct |
| Catalog | `EAN` | `variants[].barcode` | First EAN |
| Catalog | `WeightKg` | `variants[].weight` | kg to grams |
| **Pricing** | | | |
| Pricing | `fixedPrices[0].value` | `price` | Divide by 100 |
| Pricing | `listPrice` | `compareAtPrice` | Divide by 100 |
| Pricing | `costPrice` | `cost` | Divide by 100 |
| **Inventory** | | | |
| Logistics | `totalQuantity` | `inventory` | Direct |
| Logistics | `balance[].warehouseId` | `variants[].inventoryManagement` | Map warehouse |
| **Images** | | | |
| Catalog | `Url` | `images[].src` | Direct |
| Catalog | `Label` | `images[].alt` | Direct |
| Catalog | `IsMain` | `images[].position` | Main = 0 |
| **Metadata** | | | |
| Store Settings | `CurrencyCode` | `currency` | Direct |
| Catalog | `IsActive` | `status` | Map to enum |
| Catalog | `ReleaseDate` | `publishedAt` | ISO date |

### Data Transformation Functions

```typescript
// Price conversion (VTEX stores in cents)
function convertVtexPrice(centavos: number): number {
  return centavos / 100;
}

// Weight conversion (VTEX in kg, Racky in grams)
function convertVtexWeight(kg: number): number {
  return kg * 1000;
}

// Category path
function formatCategoryPath(categories: string[]): string {
  return categories.join(' > ');
}

// Status mapping
function mapVtexStatus(isActive: boolean): ProductStatus {
  return isActive ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
}

// Image transformation
function transformVtexImages(vtexImages: VtexImage[]): ProductImage[] {
  return vtexImages
    .sort((a, b) => (b.IsMain ? 1 : 0) - (a.IsMain ? 1 : 0))
    .map((img, index) => ({
      src: img.Url,
      alt: img.Label || img.Name,
      position: img.IsMain ? 0 : index
    }));
}

// Variant transformation
function transformVtexSkus(
  skus: VtexSku[],
  pricing: Map<string, PricingData>,
  inventory: Map<string, number>
): ProductVariant[] {
  return skus.map(sku => ({
    id: sku.Id.toString(),
    title: sku.Name,
    sku: sku.RefId,
    barcode: sku.EAN,
    price: pricing.get(sku.Id)?.price || 0,
    compareAtPrice: pricing.get(sku.Id)?.compareAtPrice,
    cost: pricing.get(sku.Id)?.cost,
    inventory: inventory.get(sku.Id) || 0,
    weight: sku.WeightKg * 1000,
    requiresShipping: true,
    inventoryManagement: 'VTEX'
  }));
}
```

---

## Solution Roadmap

### Phase 1: Critical Fixes (Week 1-2)

**Goal**: Make product sync functional with complete data

#### Task 1.1: Replace Public API with Private API
- **Effort**: 2 days
- **Priority**: P0
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Replace `/pub/` endpoint with `/pvt/products/GetProductAndSkuIds`
  - Add authentication headers
  - Implement pagination

#### Task 1.2: Remove 30 Product Limit
- **Effort**: 1 day
- **Priority**: P0
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Implement pagination loop
  - Fetch all products
  - Add progress tracking

#### Task 1.3: Implement Pricing Sync
- **Effort**: 2 days
- **Priority**: P0
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Add Pricing API integration
  - Map price fields correctly
  - Handle currency conversion

#### Task 1.4: Implement Inventory Sync
- **Effort**: 2 days
- **Priority**: P0
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Add Logistics API integration
  - Sum inventory across warehouses
  - Handle multi-warehouse scenarios

#### Task 1.5: Testing & Validation
- **Effort**: 1 day
- **Priority**: P0
- **Deliverables**:
  - Test with real VTEX store
  - Verify all fields populated
  - Validate data accuracy

**Phase 1 Total**: 8 days

---

### Phase 2: Complete Implementation (Week 3-4)

**Goal**: Add remaining features and optimize

#### Task 2.1: Implement Product Details Fetching
- **Effort**: 1 day
- **Priority**: P1
- **Files**: `/server/src/modules/products/routes/products.ts:432-445`
- **Changes**:
  - Replace mock with real API call
  - Use `/pvt/product/{id}` endpoint
  - Handle edge cases

#### Task 2.2: Implement Image Sync
- **Effort**: 2 days
- **Priority**: P1
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Add SKU File API integration
  - Download and map images
  - Handle image ordering

#### Task 2.3: Implement Variant Sync
- **Effort**: 2 days
- **Priority**: P1
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Map SKUs to variants
  - Handle variant-specific pricing
  - Handle variant-specific inventory

#### Task 2.4: Implement Batch Processor
- **Effort**: 3 days
- **Priority**: P1
- **Files**: `/server/src/jobs/processors/marketplaceSyncProcessor.ts`
- **Changes**:
  - Replace mock implementation
  - Integrate with RabbitMQ
  - Add progress tracking
  - Handle errors properly

#### Task 2.5: Error Handling & Retry Logic
- **Effort**: 2 days
- **Priority**: P1
- **Changes**:
  - Add comprehensive error handling
  - Implement retry with exponential backoff
  - Surface errors to users
  - Log for debugging

**Phase 2 Total**: 10 days

---

### Phase 3: Optimization & Polish (Month 2)

**Goal**: Production-ready, optimized, tested

#### Task 3.1: Create VTEX Utility Module
- **Effort**: 1 day
- **Priority**: P2
- **Files**: New file `/server/src/common/utils/vtexUtils.ts`
- **Changes**:
  - Consolidate account name cleaning
  - Add helper functions
  - Reduce code duplication

#### Task 3.2: Implement Incremental Sync
- **Effort**: 3 days
- **Priority**: P2
- **Changes**:
  - Track last sync time
  - Only fetch changed products
  - Use VTEX change notifications

#### Task 3.3: Add Comprehensive Tests
- **Effort**: 5 days
- **Priority**: P1
- **Deliverables**:
  - Unit tests for all VTEX functions
  - Integration tests with mock API
  - E2E tests with test account
  - Test coverage >80%

#### Task 3.4: Performance Optimization
- **Effort**: 2 days
- **Priority**: P2
- **Changes**:
  - Optimize API call patterns
  - Implement request batching
  - Add caching layer
  - Reduce redundant calls

#### Task 3.5: Currency Detection
- **Effort**: 1 day
- **Priority**: P2
- **Files**: `/server/src/modules/products/routes/products.ts`
- **Changes**:
  - Query VTEX store settings
  - Map to correct currency
  - Remove BRL hardcode

#### Task 3.6: Monitoring & Alerting
- **Effort**: 2 days
- **Priority**: P2
- **Deliverables**:
  - Add logging for sync operations
  - Track sync success/failure rates
  - Alert on repeated failures
  - Dashboard for sync status

#### Task 3.7: Documentation
- **Effort**: 2 days
- **Priority**: P2
- **Deliverables**:
  - Update API documentation
  - Add code comments
  - Create troubleshooting guide
  - Document VTEX-specific quirks

**Phase 3 Total**: 16 days

---

### Total Implementation Estimate

| Phase | Duration | Priority | Status |
|-------|----------|----------|--------|
| Phase 1: Critical Fixes | 8 days | P0 | 🔴 Blocking |
| Phase 2: Complete Implementation | 10 days | P1 | 🟡 High Priority |
| Phase 3: Optimization & Polish | 16 days | P2 | 🟢 Enhancement |
| **Total** | **34 days** (~7 weeks) | | |

### Resource Requirements

- **Backend Developer**: 1 full-time (all phases)
- **QA Engineer**: 0.5 (Phase 1 & 2 testing)
- **VTEX Expert**: 0.25 (consultation, validation)

### Risk Mitigation

**Risk 1**: VTEX API rate limits
- **Mitigation**: Implement rate limiting, request throttling
- **Impact**: May slow sync for large catalogs

**Risk 2**: API changes or deprecation
- **Mitigation**: Version API calls, add monitoring
- **Impact**: May require updates

**Risk 3**: Complex variant scenarios
- **Mitigation**: Start with simple products, add complexity
- **Impact**: May need Phase 4 for edge cases

---

## Technical Specifications

### Environment Requirements

```bash
# VTEX API Access
VTEX_ACCOUNT_NAME=mystore
VTEX_APP_KEY=vtexappkey-mystore-XXXXX
VTEX_APP_TOKEN=eyJhbGc...

# Rate Limiting
VTEX_REQUESTS_PER_SECOND=10
VTEX_MAX_CONCURRENT_REQUESTS=3
VTEX_RETRY_ATTEMPTS=3
VTEX_RETRY_DELAY_MS=1000

# Sync Configuration
VTEX_PRODUCTS_PER_BATCH=75
VTEX_MAX_PRODUCTS_PER_SYNC=10000
VTEX_SYNC_TIMEOUT_MS=300000
```

### Dependencies

```json
{
  "dependencies": {
    "axios": "^1.11.0",      // Already installed
    "p-limit": "^4.0.0",      // For concurrency control
    "p-retry": "^5.1.2"       // For retry logic
  }
}
```

### Database Indexes

```typescript
// Optimize queries
db.products.createIndex({
  workspaceId: 1,
  marketplace: 1,
  externalId: 1
}, { unique: true });

db.products.createIndex({
  workspaceId: 1,
  lastSyncedAt: 1
});

db.products.createIndex({
  marketplace: 1,
  status: 1
});
```

### API Rate Limiting Strategy

```typescript
import pLimit from 'p-limit';
import pRetry from 'p-retry';

// 10 requests per second max
const limit = pLimit(10);
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRateLimit(url, options) {
  return limit(async () => {
    await delay(100); // 100ms between requests

    return pRetry(
      async () => {
        const response = await axios.get(url, options);
        return response.data;
      },
      {
        retries: 3,
        onFailedAttempt: error => {
          console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
        }
      }
    );
  });
}
```

---

## References

### Official VTEX Documentation

1. **Catalog API**
   - https://developers.vtex.com/docs/api-reference/catalog-api
   - Product management endpoints

2. **Pricing API**
   - https://developers.vtex.com/docs/api-reference/pricing-api
   - Price management

3. **Logistics API**
   - https://developers.vtex.com/docs/api-reference/logistics-api
   - Inventory and warehouse management

4. **Orders API (OMS)**
   - https://developers.vtex.com/docs/api-reference/orders-api
   - Order management (already implemented)

5. **Authentication**
   - https://developers.vtex.com/docs/guides/authentication
   - AppKey and AppToken setup

### Internal Documentation

- **Project Structure**: `/CLAUDE.md`
- **Backend API**: `/RACKY_BACKEND_API.md`
- **Entity Relationships**: `/server/ER_DIAGRAM.md`
- **Development Setup**: `/DEV_SETUP.md`

### Code References

**Working Examples** (to follow):
- Order Sync: `/server/src/modules/orders/services/ordersService.ts:261-288`
- Customer Sync: `/server/src/modules/customers/services/customersService.ts:255-282`
- Product Updates: `/server/src/modules/products/services/marketplaceUpdateService.ts:124-160`

**Broken Code** (to fix):
- Product Sync: `/server/src/modules/products/routes/products.ts:734-861`
- Product Details: `/server/src/modules/products/routes/products.ts:432-445`
- Batch Processor: `/server/src/jobs/processors/marketplaceSyncProcessor.ts:381-387`

---

## Appendix: Quick Reference

### Severity Levels

- 🔴 **CRITICAL**: Blocks core functionality, data loss, or wrong data
- 🔴 **HIGH**: Major feature incomplete or broken
- 🟡 **MEDIUM**: Impacts user experience or data quality
- 🟡 **LOW**: Code quality, maintainability, or minor issues

### Priority Levels

- **P0**: Must fix immediately, blocking release
- **P1**: Required for production, high priority
- **P2**: Should have, quality improvement
- **P3**: Nice to have, future enhancement

### Issue Summary Table

| # | Issue | Severity | Priority | Effort | Status |
|---|-------|----------|----------|--------|--------|
| 1 | 30 product limit | 🔴 CRITICAL | P0 | 2d | Open |
| 2 | Public API usage | 🔴 CRITICAL | P0 | 2d | Open |
| 3 | Zero prices/inventory | 🔴 CRITICAL | P0 | 3d | Open |
| 4 | Mock product details | 🔴 HIGH | P1 | 1d | Open |
| 5 | Mock batch processor | 🔴 HIGH | P1 | 3d | Open |
| 6 | Unused credentials | 🟡 MEDIUM | P2 | 0.5d | Open |
| 7 | Code duplication | 🟡 LOW | P3 | 0.1d | Open |
| 8 | Silent auth failure | 🟡 MEDIUM | P2 | 0.1d | Open |
| 9 | Hardcoded BRL | 🟡 MEDIUM | P2 | 0.2d | Open |
| 10 | API inconsistency | 🟡 MEDIUM | P2 | 0d | Open |

---

## Document Control

**Version History**:
- v1.0 (2025-10-23): Initial comprehensive analysis

**Next Review**: After Phase 1 completion

**Stakeholders**:
- Engineering Team
- Product Management
- QA Team

**Contact**: For questions about this document or VTEX integration, consult the development team or refer to `/CLAUDE.md`.

---

**End of Document**
