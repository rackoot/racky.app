# Selective Product Sync with Filters - Feature Specification

**Document Version**: 1.0
**Date**: 2025-10-24
**Status**: Design & Planning
**Feature Priority**: HIGH - Solves critical data quality issue

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Current State Analysis](#current-state-analysis)
4. [Feature Specification](#feature-specification)
5. [Architecture & Data Flow](#architecture--data-flow)
6. [Technical Implementation Details](#technical-implementation-details)
7. [Implementation Phases](#implementation-phases)
8. [Detailed Task Breakdown](#detailed-task-breakdown)
9. [API Specifications](#api-specifications)
10. [Frontend Components](#frontend-components)
11. [Backend Services](#backend-services)
12. [Testing Strategy](#testing-strategy)
13. [Performance Considerations](#performance-considerations)
14. [References](#references)

---

## Executive Summary

### Objective

Implement selective product synchronization with configurable filters to allow users to control which products are imported from their e-commerce platforms, solving the problem of syncing incomplete or "trash" products that exist in their marketplace catalogs.

### Key Features

1. **Pre-sync Filter Modal**: Display a configuration dialog before syncing products
2. **Active/Inactive Filter**: Toggle to include/exclude inactive products
3. **Category Multi-Select**: Choose specific product categories to sync
4. **Brand Multi-Select**: Choose specific brands/vendors to sync
5. **Dynamic Filter Loading**: Fetch available categories and brands from the connected marketplace
6. **Multi-Marketplace Support**: Works with VTEX, Shopify, and all future marketplace integrations
7. **Remove Hard Limit**: Eliminate the 30-product hardcoded limit in VTEX sync

### Business Value

- **Data Quality**: Users only sync relevant, complete products
- **Efficiency**: Reduces database clutter from incomplete products
- **Flexibility**: Users have full control over their product catalog
- **Scalability**: Removes artificial 30-product limitation
- **User Experience**: Clear, intuitive filtering interface

### Success Metrics

- ✅ Remove 30-product hard limit from VTEX sync
- ✅ Allow category-based filtering for all marketplaces
- ✅ Allow brand-based filtering for all marketplaces
- ✅ Reduce sync time for users with large catalogs
- ✅ Improve product data quality (fewer incomplete products)

---

## Problem Statement

### Current Issues

1. **VTEX Hardcoded Limit**
   - **Location**: `/server/src/modules/products/routes/products.ts:712`
   - **Code**: `const vtexProducts = await fetchVtexProducts(..., 30)`
   - **Problem**: Only syncs first 30 products, blocking stores with large catalogs

2. **Incomplete Products ("Trash Products")**
   - Many VTEX stores contain incomplete product drafts
   - These products lack essential data (images, descriptions, prices)
   - Current sync imports ALL products indiscriminately
   - Clutters the Racky database with unusable products

3. **No User Control**
   - Users cannot choose which products to import
   - All-or-nothing sync approach
   - No way to filter by category, brand, or status

4. **Performance Impact**
   - Syncing thousands of products when only hundreds are needed
   - Wasted API calls and processing time
   - Slower sync completion

### User Stories

**As a** VTEX store owner with 500+ products
**I want to** sync only active products from specific categories
**So that** I don't import incomplete product drafts cluttering my catalog

**As a** Shopify merchant with multiple brands
**I want to** sync only products from my premium brands
**So that** I can manage different product lines separately

**As a** marketplace administrator
**I want to** exclude inactive/discontinued products from sync
**So that** my Racky dashboard only shows current inventory

---

## Current State Analysis

### Existing Sync Flow

```
User Action: Click "Sync Products"
    ↓
Check if products exist
    ↓
IF exists → Show confirmation dialog (warning about replacement)
    ↓
User confirms
    ↓
Backend: POST /api/products/sync/:connectionId
    ↓
Backend fetches ALL products from marketplace
    ↓
Backend saves to database (replaces all if force=true)
    ↓
UI refreshes with new product counts
```

### Current Limitations

| Aspect | Current Behavior | Limitation |
|--------|------------------|------------|
| **Product Selection** | All products | No filtering |
| **VTEX Limit** | 30 products max | Hardcoded in `fetchVtexProducts()` |
| **User Control** | None | Cannot choose what to sync |
| **Incomplete Products** | Synced | No way to exclude |
| **Category Filter** | Not available | - |
| **Brand Filter** | Not available | - |
| **Status Filter** | Not available | - |

### Key Files Involved

**Frontend**:
- `/client/src/pages/stores/[marketplace].tsx` - Marketplace pages with sync buttons
- `/client/src/components/marketplace/connected-shopify-detail.tsx` - Shopify sync UI
- `/client/src/components/marketplace/connected-marketplace-detail.tsx` - Generic marketplace sync UI
- `/client/src/components/marketplace/sync-confirmation-dialog.tsx` - Current confirmation modal
- `/client/src/api/resources/products.ts` - API client for product operations

**Backend**:
- `/server/src/modules/products/routes/products.ts` - Product sync endpoint (legacy)
- `/server/src/modules/products/routes/sync.ts` - Async sync endpoints (newer)
- `/server/src/modules/marketplaces/services/marketplaceService.ts` - Marketplace API integration
- `/server/src/jobs/processors/marketplaceSyncProcessor.ts` - Background job processing

---

## Feature Specification

### User Interface Flow

#### New Enhanced Sync Flow

```
User Action: Click "Sync Products"
    ↓
Show SelectiveSyncDialog (NEW MODAL)
    ↓
User configures filters:
  ├─ Toggle: Include inactive products? (default: OFF)
  ├─ Multi-select: Categories (loaded from marketplace)
  ├─ Multi-select: Brands (loaded from marketplace)
  └─ Button: "Apply Filters & Sync"
    ↓
Check if products exist locally
    ↓
IF exists → Show additional confirmation (replacement warning)
    ↓
User confirms
    ↓
Backend: POST /api/products/sync/:connectionId
    Body: {
      force: boolean,
      filters: {
        includeInactive: boolean,
        categories: string[],
        brands: string[]
      }
    }
    ↓
Backend fetches products from marketplace with filters
    ↓
Backend saves filtered products to database
    ↓
UI refreshes with new product counts
```

### Filter Specifications

#### 1. Active/Inactive Toggle

**UI Component**: Checkbox or Switch
**Label**: "Include inactive products"
**Default**: OFF (unchecked)
**Behavior**:
- When OFF: Only sync products marked as "active" in marketplace
- When ON: Sync both active and inactive products

**Backend Logic**:
```typescript
if (!filters.includeInactive) {
  products = products.filter(p => p.isActive === true)
}
```

#### 2. Category Multi-Select

**UI Component**: Multi-select dropdown (Shadcn Select with checkboxes)
**Label**: "Select Categories"
**Placeholder**: "All categories" (when none selected)
**Data Source**: Dynamic - fetched from marketplace API
**Behavior**:
- Display list of available categories from the connected store
- User can select multiple categories
- Empty selection = sync from ALL categories
- Selected categories shown as chips/badges

**API Requirement**: New endpoint to fetch categories
```
GET /api/marketplaces/:connectionId/categories
Response: { categories: [{ id, name }] }
```

#### 3. Brand Multi-Select

**UI Component**: Multi-select dropdown (Shadcn Select with checkboxes)
**Label**: "Select Brands"
**Placeholder**: "All brands" (when none selected)
**Data Source**: Dynamic - fetched from marketplace API
**Behavior**:
- Display list of available brands/vendors from the connected store
- User can select multiple brands
- Empty selection = sync from ALL brands
- Selected brands shown as chips/badges

**API Requirement**: New endpoint to fetch brands
```
GET /api/marketplaces/:connectionId/brands
Response: { brands: [{ id, name }] }
```

### Visual Mockup (Text Description)

```
┌─────────────────────────────────────────────────────────────┐
│  Configure Product Sync - VTEX Store                   [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Choose which products to sync from your marketplace.       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ℹ️  Filters help you import only relevant products    │ │
│  │    and exclude incomplete drafts.                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Product Status                                              │
│  ┌─────────────────────────────────────────┐                │
│  │ ☐ Include inactive products             │                │
│  └─────────────────────────────────────────┘                │
│                                                              │
│  Categories                                                  │
│  ┌─────────────────────────────────────────┐                │
│  │ Select categories... (12 available)   ▼ │                │
│  └─────────────────────────────────────────┘                │
│  [Electronics ×] [Clothing ×] [Home ×]                      │
│                                                              │
│  Brands                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │ Select brands... (25 available)       ▼ │                │
│  └─────────────────────────────────────────┘                │
│  [Nike ×] [Apple ×] [Samsung ×]                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📊 Estimated Products: ~145 products                   │ │
│  │    (filtered from 500 total)                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────┐  ┌──────────────────────────────────┐        │
│  │  Cancel  │  │  Apply Filters & Sync Products   │        │
│  └──────────┘  └──────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Modal Behavior

1. **Opening**: Triggered when user clicks "Sync Products" button
2. **Loading State**: While fetching categories and brands
   - Show skeleton loaders for select dropdowns
   - Disable sync button until data loaded
3. **Selection State**: User interacts with filters
   - Selected items displayed as removable chips
   - Count of selected items shown in dropdown label
   - Estimated product count updates dynamically (optional)
4. **Validation**: Before allowing sync
   - At least one filter must be active OR user acknowledges syncing all products
   - Show warning if no filters selected: "This will sync all products"
5. **Confirmation**: If local products exist
   - After filter selection, show additional confirmation
   - Warning about replacing existing products
   - Show count of products to be replaced
6. **Submission**: User clicks "Apply Filters & Sync"
   - Close modal
   - Show loading state on sync button
   - Proceed with filtered sync

---

## Architecture & Data Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  MarketplacePage (/stores/[marketplace])                    │
│    ├─ ConnectedShopifyDetail / ConnectedMarketplaceDetail  │
│    │   └─ "Sync Products" Button                           │
│    │                                                        │
│    ├─ SelectiveSyncDialog (NEW)                            │
│    │   ├─ Fetch categories & brands on mount              │
│    │   ├─ Multi-select filters                            │
│    │   ├─ Apply button → triggers sync with filters       │
│    │   └─ Loading/error states                            │
│    │                                                        │
│    └─ SyncConfirmationDialog (existing)                    │
│        └─ Warns about replacing existing products          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Backend (Node.js/Express)                     │
├─────────────────────────────────────────────────────────────┤
│  NEW ENDPOINTS:                                             │
│  ├─ GET /api/marketplaces/:id/categories                   │
│  │   └─ Fetch categories from marketplace API             │
│  │                                                         │
│  ├─ GET /api/marketplaces/:id/brands                       │
│  │   └─ Fetch brands from marketplace API                 │
│  │                                                         │
│  MODIFIED ENDPOINT:                                         │
│  └─ POST /api/products/sync/:id                            │
│      └─ Accept filters in request body                     │
│          └─ Pass filters to sync functions                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Marketplace API Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Marketplace APIs (VTEX, Shopify, etc.)         │
├─────────────────────────────────────────────────────────────┤
│  VTEX:                                                      │
│  ├─ /api/catalog_system/pvt/category/tree                 │
│  ├─ /api/catalog_system/pvt/brand/list                     │
│  └─ /api/catalog_system/pvt/products/GetProductAndSkuIds  │
│      (with category/brand filters)                          │
│                                                             │
│  Shopify:                                                   │
│  ├─ /admin/api/2024-01/custom_collections.json            │
│  ├─ /admin/api/2024-01/smart_collections.json             │
│  ├─ (Brands extracted from product.vendor field)           │
│  └─ /admin/api/2024-01/products.json                       │
│      ?collection_id=X&vendor=Y&status=active               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Sequence Diagram

```
User          Frontend         Backend         Marketplace API      Database
 │                │               │                    │                │
 │ Click Sync    │               │                    │                │
 │─────────────>│               │                    │                │
 │               │               │                    │                │
 │               │ Open Modal    │                    │                │
 │               │──────────────>│                    │                │
 │               │               │                    │                │
 │               │ GET /categories                    │                │
 │               │──────────────>│                    │                │
 │               │               │ Fetch categories   │                │
 │               │               │───────────────────>│                │
 │               │               │  [category tree]   │                │
 │               │               │<───────────────────│                │
 │               │ { categories }│                    │                │
 │               │<──────────────│                    │                │
 │               │               │                    │                │
 │               │ GET /brands   │                    │                │
 │               │──────────────>│                    │                │
 │               │               │ Fetch brands       │                │
 │               │               │───────────────────>│                │
 │               │               │  [brand list]      │                │
 │               │               │<───────────────────│                │
 │               │ { brands }    │                    │                │
 │               │<──────────────│                    │                │
 │               │               │                    │                │
 │ Select        │               │                    │                │
 │ Filters       │               │                    │                │
 │─────────────>│               │                    │                │
 │               │               │                    │                │
 │ Click Sync    │               │                    │                │
 │─────────────>│               │                    │                │
 │               │               │                    │                │
 │               │ POST /sync    │                    │                │
 │               │ { filters }   │                    │                │
 │               │──────────────>│                    │                │
 │               │               │                    │                │
 │               │               │ Check existing     │                │
 │               │               │ products           │                │
 │               │               │────────────────────────────────────>│
 │               │               │                    │  [count query] │
 │               │               │<────────────────────────────────────│
 │               │               │                    │                │
 │               │               │ IF force=true:     │                │
 │               │               │ Delete existing    │                │
 │               │               │────────────────────────────────────>│
 │               │               │                    │                │
 │               │               │ Fetch filtered     │                │
 │               │               │ products           │                │
 │               │               │───────────────────>│                │
 │               │               │  [product list     │                │
 │               │               │   with filters]    │                │
 │               │               │<───────────────────│                │
 │               │               │                    │                │
 │               │               │ For each product:  │                │
 │               │               │ ├─ Get details     │                │
 │               │               │ ├─ Get pricing     │                │
 │               │               │ ├─ Get inventory   │                │
 │               │               │ └─ Transform data  │                │
 │               │               │                    │                │
 │               │               │ Save products      │                │
 │               │               │────────────────────────────────────>│
 │               │               │                    │   [bulk upsert]│
 │               │               │<────────────────────────────────────│
 │               │               │                    │                │
 │               │ { success,    │                    │                │
 │               │   count }     │                    │                │
 │               │<──────────────│                    │                │
 │               │               │                    │                │
 │ Show success  │               │                    │                │
 │<──────────────│               │                    │                │
 │ Refresh data  │               │                    │                │
```

---

## Technical Implementation Details

### TypeScript Interfaces

#### Filter Types

```typescript
// /client/src/api/types/sync.ts
export interface ProductSyncFilters {
  includeInactive?: boolean
  categories?: string[]  // Category IDs
  brands?: string[]      // Brand IDs or names
}

export interface SyncProductsRequest {
  force?: boolean
  filters?: ProductSyncFilters
}

export interface SyncProductsResponse {
  success: boolean
  message: string
  data: {
    totalProducts: number
    newProducts: number
    updatedProducts: number
    deletedProducts: number
    isForceSync: boolean
    appliedFilters: ProductSyncFilters
  }
}
```

#### Category and Brand Types

```typescript
// /client/src/api/types/marketplace.ts
export interface MarketplaceCategory {
  id: string
  name: string
  parentId?: string | null
  level?: number
  productCount?: number
}

export interface MarketplaceBrand {
  id: string
  name: string
  productCount?: number
}

export interface GetCategoriesResponse {
  success: boolean
  data: {
    categories: MarketplaceCategory[]
    totalCount: number
  }
}

export interface GetBrandsResponse {
  success: boolean
  data: {
    brands: MarketplaceBrand[]
    totalCount: number
  }
}
```

#### Backend Types

```typescript
// /server/src/common/types/syncFilters.ts
export interface ProductSyncFilters {
  includeInactive?: boolean
  categories?: string[]
  brands?: string[]
}

export interface FetchProductsOptions {
  credentials: any
  filters?: ProductSyncFilters
  limit?: number
  offset?: number
}

export interface SyncResult {
  totalProducts: number
  newProducts: number
  updatedProducts: number
  deletedProducts: number
  errors: Array<{ productId: string; error: string }>
}
```

---

## Implementation Phases

### Overview

| Phase | Focus Area | Duration | Dependencies | Priority |
|-------|------------|----------|--------------|----------|
| **Phase 1** | Backend - Filter Endpoints (VTEX) | 2-3 days | None | P0 |
| **Phase 2** | Backend - Filtered Sync Logic (VTEX) | 3-4 days | Phase 1 | P0 |
| **Phase 3** | Frontend - Filter Modal Component | 2-3 days | Phase 1 | P0 |
| **Phase 4** | Frontend - Integration & UX | 2 days | Phase 2, 3 | P0 |
| **Phase 5** | Extend to Other Marketplaces | 4-5 days | Phase 1-4 | P1 |
| **Phase 6** | Testing & Bug Fixes | 3 days | All phases | P0 |
| **Phase 7** | Remove VTEX 30-product limit | 1 day | Phase 2 complete | P0 |
| **Total** | | **17-22 days** (~4-5 weeks) | | |

### Phase 1: Backend - Filter Endpoints for VTEX (2-3 days)

**Goal**: Create API endpoints to fetch categories and brands from VTEX

**Tasks**:
1. Create VTEX category fetcher service
2. Create VTEX brand fetcher service
3. Create GET `/api/marketplaces/:connectionId/categories` endpoint
4. Create GET `/api/marketplaces/:connectionId/brands` endpoint
5. Add caching for filter data (optional but recommended)
6. Write unit tests

**Deliverables**:
- ✅ New service functions: `fetchVtexCategories()`, `fetchVtexBrands()`
- ✅ New route handlers in `/server/src/modules/marketplaces/routes/marketplaces.ts`
- ✅ Working endpoints returning formatted category/brand data

### Phase 2: Backend - Filtered Sync Logic for VTEX (3-4 days)

**Goal**: Modify VTEX product sync to accept and apply filters

**Tasks**:
1. Modify `fetchVtexProducts()` to accept filter parameters
2. Implement category filtering in VTEX API calls
3. Implement brand filtering in VTEX API calls
4. Implement active/inactive filtering
5. Remove 30-product hard limit
6. Update `syncProductsFromMarketplace()` to pass filters
7. Update response to include applied filters
8. Write integration tests

**Deliverables**:
- ✅ Modified sync functions with filter support
- ✅ POST `/api/products/sync/:connectionId` accepts filters in body
- ✅ Filtered product sync working end-to-end
- ✅ 30-product limit removed

### Phase 3: Frontend - Filter Modal Component (2-3 days)

**Goal**: Create reusable SelectiveSyncDialog component

**Tasks**:
1. Create `SelectiveSyncDialog.tsx` component
2. Implement category multi-select with Shadcn UI
3. Implement brand multi-select with Shadcn UI
4. Implement active/inactive checkbox
5. Add loading states while fetching filters
6. Add error handling for failed filter fetches
7. Add filter selection state management
8. Add visual feedback (chips for selected items)
9. Write component tests

**Deliverables**:
- ✅ New component: `/client/src/components/marketplace/selective-sync-dialog.tsx`
- ✅ Reusable, styled, accessible modal
- ✅ Working multi-select with search functionality

### Phase 4: Frontend - Integration & UX (2 days)

**Goal**: Integrate filter modal into existing sync flow

**Tasks**:
1. Modify `connected-shopify-detail.tsx` to use new modal
2. Modify `connected-marketplace-detail.tsx` to use new modal
3. Update sync API calls to include filters
4. Chain modals (SelectiveSyncDialog → SyncConfirmationDialog)
5. Update loading/success messages
6. Add filter summary in confirmation dialog
7. Update UI to show applied filters in last sync info

**Deliverables**:
- ✅ Integrated filter modal in all marketplace pages
- ✅ Smooth UX flow from filter selection to sync completion
- ✅ Visual feedback throughout process

### Phase 5: Extend to Other Marketplaces (4-5 days)

**Goal**: Implement filter support for Shopify and other marketplaces

**Tasks**:
1. **Shopify**:
   - Implement `fetchShopifyCollections()` (categories)
   - Implement `fetchShopifyVendors()` (brands)
   - Modify `fetchShopifyProducts()` with filter parameters
   - Add Shopify-specific filter endpoints
2. **WooCommerce**:
   - Similar implementation for WooCommerce
3. **MercadoLibre**:
   - Category and brand filtering
4. **Generic fallback**:
   - For marketplaces without native filtering support
   - Client-side filtering as backup

**Deliverables**:
- ✅ Filter support for Shopify
- ✅ Filter support for WooCommerce
- ✅ Filter support for MercadoLibre
- ✅ Graceful degradation for unsupported marketplaces

### Phase 6: Testing & Bug Fixes (3 days)

**Goal**: Comprehensive testing and refinement

**Tasks**:
1. Test with real VTEX store (multiple filter combinations)
2. Test with real Shopify store
3. Test edge cases:
   - No categories available
   - No brands available
   - All filters deselected
   - Large number of categories (100+)
   - Special characters in names
4. Performance testing with large catalogs
5. UI/UX refinements based on testing
6. Bug fixes

**Deliverables**:
- ✅ All test cases passing
- ✅ Bug-free operation
- ✅ Performance optimized

### Phase 7: Remove VTEX 30-Product Limit (1 day)

**Goal**: Clean up hardcoded limit now that filtering is available

**Tasks**:
1. Remove hardcoded `30` from VTEX sync
2. Implement proper pagination
3. Update documentation
4. Verify no regressions

**Deliverables**:
- ✅ No product limit in VTEX sync
- ✅ Full catalog sync capability

---

## Detailed Task Breakdown

### Phase 1 Tasks (Backend - Filter Endpoints)

#### Task 1.1: Create VTEX Category Fetcher Service

**File**: `/server/src/modules/marketplaces/services/vtexService.ts` (NEW)

**Estimated Time**: 4 hours

**Implementation**:

```typescript
import axios from 'axios'
import { MarketplaceCategory } from '@/common/types/marketplace'

export class VtexService {
  /**
   * Fetch category tree from VTEX
   * API: GET https://{account}.vtexcommercestable.com.br/api/catalog_system/pvt/category/tree/{levels}
   */
  static async fetchCategories(credentials: {
    account_name: string
    app_key: string
    app_token: string
  }): Promise<MarketplaceCategory[]> {
    try {
      const { account_name, app_key, app_token } = credentials

      // Clean account name
      const cleanAccount = account_name.replace(/^https?:\/\//, '')
        .replace(/\.vtexcommercestable\.com\.br.*$/, '')
        .replace(/\/$/, '')

      // Fetch category tree (3 levels deep)
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/category/tree/3`

      const response = await axios.get(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      })

      // Transform VTEX category tree to flat list
      const categories: MarketplaceCategory[] = []

      function flattenCategories(cats: any[], level = 0, parentId: string | null = null) {
        cats.forEach(cat => {
          categories.push({
            id: cat.id.toString(),
            name: cat.name,
            parentId: parentId,
            level: level
          })

          if (cat.children && cat.children.length > 0) {
            flattenCategories(cat.children, level + 1, cat.id.toString())
          }
        })
      }

      flattenCategories(response.data)

      console.log(`[VTEX] Fetched ${categories.length} categories`)
      return categories

    } catch (error: any) {
      console.error('[VTEX] Error fetching categories:', error.message)
      throw new Error(`Failed to fetch VTEX categories: ${error.message}`)
    }
  }

  /**
   * Fetch brand list from VTEX
   * API: GET https://{account}.vtexcommercestable.com.br/api/catalog_system/pvt/brand/list
   */
  static async fetchBrands(credentials: {
    account_name: string
    app_key: string
    app_token: string
  }): Promise<MarketplaceBrand[]> {
    try {
      const { account_name, app_key, app_token } = credentials

      const cleanAccount = account_name.replace(/^https?:\/\//, '')
        .replace(/\.vtexcommercestable\.com\.br.*$/, '')
        .replace(/\/$/, '')

      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/brand/list`

      const response = await axios.get(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      })

      const brands = response.data
        .filter((brand: any) => brand.isActive) // Only active brands
        .map((brand: any) => ({
          id: brand.id.toString(),
          name: brand.name
        }))

      console.log(`[VTEX] Fetched ${brands.length} brands`)
      return brands

    } catch (error: any) {
      console.error('[VTEX] Error fetching brands:', error.message)
      throw new Error(`Failed to fetch VTEX brands: ${error.message}`)
    }
  }
}
```

**Changes Required**:
- Create new file `/server/src/modules/marketplaces/services/vtexService.ts`
- Add types to `/server/src/common/types/marketplace.ts`

#### Task 1.2: Create Filter Endpoints

**File**: `/server/src/modules/marketplaces/routes/marketplaces.ts`

**Estimated Time**: 3 hours

**Add New Routes**:

```typescript
import { VtexService } from '../services/vtexService'

/**
 * GET /api/marketplaces/:connectionId/categories
 * Fetch available categories from connected marketplace
 */
router.get(
  '/:connectionId/categories',
  requireAuth,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params
      const workspaceId = req.workspace!._id

      // Get store connection
      const connection = await StoreConnection.findOne({
        _id: connectionId,
        workspaceId
      })

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Store connection not found'
        })
      }

      let categories: MarketplaceCategory[] = []

      // Fetch categories based on marketplace type
      switch (connection.marketplaceType) {
        case 'vtex':
          categories = await VtexService.fetchCategories(connection.credentials)
          break

        case 'shopify':
          categories = await ShopifyService.fetchCategories(connection.credentials)
          break

        // Add other marketplaces...

        default:
          return res.status(400).json({
            success: false,
            message: `Category filtering not supported for ${connection.marketplaceType}`
          })
      }

      res.json({
        success: true,
        data: {
          categories,
          totalCount: categories.length
        }
      })

    } catch (error: any) {
      console.error('Error fetching categories:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
)

/**
 * GET /api/marketplaces/:connectionId/brands
 * Fetch available brands from connected marketplace
 */
router.get(
  '/:connectionId/brands',
  requireAuth,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params
      const workspaceId = req.workspace!._id

      const connection = await StoreConnection.findOne({
        _id: connectionId,
        workspaceId
      })

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Store connection not found'
        })
      }

      let brands: MarketplaceBrand[] = []

      switch (connection.marketplaceType) {
        case 'vtex':
          brands = await VtexService.fetchBrands(connection.credentials)
          break

        case 'shopify':
          brands = await ShopifyService.fetchBrands(connection.credentials)
          break

        default:
          return res.status(400).json({
            success: false,
            message: `Brand filtering not supported for ${connection.marketplaceType}`
          })
      }

      res.json({
        success: true,
        data: {
          brands,
          totalCount: brands.length
        }
      })

    } catch (error: any) {
      console.error('Error fetching brands:', error)
      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
)
```

**Changes Required**:
- Modify `/server/src/modules/marketplaces/routes/marketplaces.ts`
- Add routes before export

**Testing**:
```bash
# Test categories endpoint
curl -H "Authorization: Bearer <token>" \
     -H "X-Workspace-Id: <workspace-id>" \
     http://localhost:5000/api/marketplaces/:connectionId/categories

# Test brands endpoint
curl -H "Authorization: Bearer <token>" \
     -H "X-Workspace-Id: <workspace-id>" \
     http://localhost:5000/api/marketplaces/:connectionId/brands
```

---

### Phase 2 Tasks (Backend - Filtered Sync Logic)

#### Task 2.1: Modify fetchVtexProducts with Filters

**File**: `/server/src/modules/products/routes/products.ts`

**Estimated Time**: 4-5 hours

**Current Code** (Lines 734-776):
```typescript
async function fetchVtexProducts(
  accountName: string,
  appKey: string,
  appToken: string,
  limit: number = 30  // ❌ HARDCODED LIMIT
) {
  // Uses public API, no filters, limited to 30 products
}
```

**New Implementation**:

```typescript
import { ProductSyncFilters } from '@/common/types/syncFilters'

async function fetchVtexProducts(
  accountName: string,
  appKey: string,
  appToken: string,
  filters?: ProductSyncFilters,
  limit?: number  // ✅ Optional, no default limit
): Promise<any[]> {
  try {
    const cleanAccount = accountName.replace(/^https?:\/\//, '')
      .replace(/\.vtexcommercestable\.com\.br.*$/, '')
      .replace(/\/$/, '')

    // ✅ Use PRIVATE API with authentication
    const baseUrl = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/products/GetProductAndSkuIds`

    let allProducts: any[] = []
    let page = 1
    const pageSize = 100

    // ✅ Paginate through all products
    while (true) {
      const response = await axios.get(baseUrl, {
        headers: {
          'X-VTEX-API-AppKey': appKey,
          'X-VTEX-API-AppToken': appToken,
          'Content-Type': 'application/json'
        },
        params: {
          page,
          pagesize: pageSize
        },
        timeout: 30000
      })

      const products = response.data.data || []

      if (products.length === 0) {
        break
      }

      allProducts = allProducts.concat(products)

      // Check if we've reached the limit (if provided)
      if (limit && allProducts.length >= limit) {
        allProducts = allProducts.slice(0, limit)
        break
      }

      // If we got less than a full page, we're done
      if (products.length < pageSize) {
        break
      }

      page++

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[VTEX] Fetched ${allProducts.length} product IDs`)

    // ✅ Apply filters if provided
    if (filters) {
      allProducts = await applyVtexFilters(
        allProducts,
        filters,
        { account_name: cleanAccount, app_key: appKey, app_token: appToken }
      )
    }

    return allProducts

  } catch (error: any) {
    console.error('[VTEX] Error fetching products:', error.message)
    throw new Error(`Failed to fetch VTEX products: ${error.message}`)
  }
}

/**
 * Apply filters to VTEX products
 */
async function applyVtexFilters(
  productIds: any[],
  filters: ProductSyncFilters,
  credentials: any
): Promise<any[]> {
  let filteredProducts = [...productIds]

  console.log(`[VTEX] Applying filters to ${filteredProducts.length} products`)
  console.log('[VTEX] Filters:', JSON.stringify(filters))

  // For category and brand filtering, we need to fetch product details
  if (filters.categories?.length || filters.brands?.length || filters.includeInactive === false) {
    const detailedProducts = []

    for (const productData of productIds) {
      const productId = productData.productId

      try {
        // Fetch product details to check category, brand, and active status
        const productDetails = await fetchVtexProductDetails(productId, credentials)

        // Apply category filter
        if (filters.categories?.length) {
          const productCategoryIds = productDetails.CategoryPath?.split('/').filter(Boolean) || []
          const hasMatchingCategory = productCategoryIds.some(catId =>
            filters.categories!.includes(catId)
          )

          if (!hasMatchingCategory) {
            console.log(`[VTEX] Product ${productId} filtered out by category`)
            continue
          }
        }

        // Apply brand filter
        if (filters.brands?.length) {
          const productBrandId = productDetails.BrandId?.toString()
          if (!filters.brands.includes(productBrandId)) {
            console.log(`[VTEX] Product ${productId} filtered out by brand`)
            continue
          }
        }

        // Apply active/inactive filter
        if (filters.includeInactive === false) {
          if (!productDetails.IsActive) {
            console.log(`[VTEX] Product ${productId} filtered out (inactive)`)
            continue
          }
        }

        // Product passed all filters
        detailedProducts.push(productData)

      } catch (error: any) {
        console.error(`[VTEX] Error fetching details for product ${productId}:`, error.message)
        // Continue with other products
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    filteredProducts = detailedProducts
  }

  console.log(`[VTEX] After filtering: ${filteredProducts.length} products`)

  return filteredProducts
}

/**
 * Fetch product details from VTEX
 * REPLACES THE MOCK IMPLEMENTATION
 */
async function fetchVtexProductDetails(productId: string, credentials: any): Promise<any> {
  const { account_name, app_key, app_token } = credentials

  const cleanAccount = account_name.replace(/^https?:\/\//, '')
    .replace(/\.vtexcommercestable\.com\.br.*$/, '')
    .replace(/\/$/, '')

  const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/product/${productId}`

  const response = await axios.get(url, {
    headers: {
      'X-VTEX-API-AppKey': app_key,
      'X-VTEX-API-AppToken': app_token,
      'Content-Type': 'application/json'
    },
    timeout: 10000
  })

  return response.data
}
```

**Changes Required**:
- Replace `fetchVtexProducts()` function
- Add `applyVtexFilters()` helper function
- Replace mock `fetchVtexProductDetails()` with real implementation
- Create `/server/src/common/types/syncFilters.ts` for types

#### Task 2.2: Update Sync Endpoint to Accept Filters

**File**: `/server/src/modules/products/routes/products.ts`

**Estimated Time**: 2-3 hours

**Current Sync Route** (Lines 600-750):
```typescript
router.post('/sync/:connectionId', async (req: Request, res: Response) => {
  const { force } = req.body  // Only accepts force parameter
  // ...
})
```

**Updated Implementation**:

```typescript
router.post(
  '/sync/:connectionId',
  requireAuth,
  requireWorkspace,
  checkSubscriptionStatus,
  checkUsageLimits('stores'),
  checkSyncFrequency,
  trackUsage,
  async (req: Request, res: Response) => {
    try {
      const { connectionId } = req.params
      const { force = false, filters } = req.body  // ✅ Accept filters
      const userId = req.user!._id
      const workspaceId = req.workspace!._id

      console.log(`[SYNC] Starting product sync for connection ${connectionId}`)
      console.log(`[SYNC] Force: ${force}, Filters:`, filters)

      // Get store connection
      const connection = await StoreConnection.findOne({
        _id: connectionId,
        workspaceId
      })

      if (!connection) {
        return res.status(404).json({
          success: false,
          message: 'Store connection not found'
        })
      }

      // If force sync, delete existing products
      if (force) {
        const deleteResult = await Product.deleteMany({
          workspaceId,
          marketplace: connection.marketplaceType,
          storeConnectionId: connection._id
        })
        console.log(`[SYNC] Deleted ${deleteResult.deletedCount} existing products`)
      }

      // Update sync status
      connection.syncStatus = 'syncing'
      connection.lastSync = new Date()
      await connection.save()

      let syncResult: SyncResult = {
        totalProducts: 0,
        newProducts: 0,
        updatedProducts: 0,
        deletedProducts: force ? await Product.countDocuments({
          workspaceId,
          marketplace: connection.marketplaceType,
          storeConnectionId: connection._id
        }) : 0,
        errors: []
      }

      // Sync based on marketplace type
      switch (connection.marketplaceType) {
        case 'vtex':
          syncResult = await syncVtexProducts(
            connection,
            userId,
            workspaceId,
            filters  // ✅ Pass filters
          )
          break

        case 'shopify':
          syncResult = await syncShopifyProducts(
            connection,
            userId,
            workspaceId,
            filters  // ✅ Pass filters
          )
          break

        // Other marketplaces...

        default:
          throw new Error(`Sync not supported for marketplace: ${connection.marketplaceType}`)
      }

      // Update connection status
      connection.syncStatus = 'completed'
      await connection.save()

      res.json({
        success: true,
        message: `Successfully synced ${syncResult.totalProducts} products`,
        data: {
          ...syncResult,
          isForceSync: force,
          appliedFilters: filters || null  // ✅ Include filters in response
        }
      })

    } catch (error: any) {
      console.error('[SYNC] Error:', error)

      // Update connection status to failed
      if (req.params.connectionId) {
        await StoreConnection.findByIdAndUpdate(req.params.connectionId, {
          syncStatus: 'failed'
        })
      }

      res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
)

/**
 * Sync VTEX products with filters
 */
async function syncVtexProducts(
  connection: IStoreConnection,
  userId: Types.ObjectId,
  workspaceId: Types.ObjectId,
  filters?: ProductSyncFilters
): Promise<SyncResult> {
  const { account_name, app_key, app_token } = connection.credentials

  const cleanAccountName = account_name.replace(/^https?:\/\//, '')
    .replace(/\.vtexcommercestable\.com\.br.*$/, '')
    .replace(/\/$/, '')

  // ✅ Fetch products with filters, NO LIMIT
  const vtexProducts = await fetchVtexProducts(
    cleanAccountName,
    app_key,
    app_token,
    filters  // ✅ Pass filters
    // ✅ NO hardcoded limit
  )

  console.log(`[VTEX] Syncing ${vtexProducts.length} products`)

  let newProducts = 0
  let updatedProducts = 0
  const errors: Array<{ productId: string; error: string }> = []

  for (const vtexProduct of vtexProducts) {
    try {
      // Fetch full product details
      const productDetails = await fetchVtexProductDetails(
        vtexProduct.productId,
        connection.credentials
      )

      // Save product
      const existingProduct = await Product.findOne({
        workspaceId,
        marketplace: 'vtex',
        externalId: vtexProduct.productId.toString()
      })

      if (existingProduct) {
        await saveVtexProduct(productDetails, userId, workspaceId, connection._id)
        updatedProducts++
      } else {
        await saveVtexProduct(productDetails, userId, workspaceId, connection._id)
        newProducts++
      }

    } catch (error: any) {
      console.error(`[VTEX] Error syncing product ${vtexProduct.productId}:`, error.message)
      errors.push({
        productId: vtexProduct.productId.toString(),
        error: error.message
      })
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return {
    totalProducts: vtexProducts.length,
    newProducts,
    updatedProducts,
    deletedProducts: 0,
    errors
  }
}
```

**Changes Required**:
- Modify POST `/sync/:connectionId` route handler
- Update `syncVtexProducts()` function signature
- Pass filters through the call chain
- Update response to include applied filters

---

### Phase 3 Tasks (Frontend - Filter Modal Component)

#### Task 3.1: Create SelectiveSyncDialog Component

**File**: `/client/src/components/marketplace/selective-sync-dialog.tsx` (NEW)

**Estimated Time**: 6-8 hours

**Full Implementation**:

```typescript
import React, { useState, useEffect } from 'react'
import { X, Filter, AlertCircle, Loader2, Package } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { marketplacesApi } from '@/api/resources/marketplaces'
import { MarketplaceCategory, MarketplaceBrand } from '@/api/types/marketplace'
import { ProductSyncFilters } from '@/api/types/sync'
import { MultiSelect } from '@/components/ui/multi-select'

interface SelectiveSyncDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (filters: ProductSyncFilters) => void
  connectionId: string
  marketplaceName: string
  isLoading?: boolean
}

export function SelectiveSyncDialog({
  isOpen,
  onClose,
  onConfirm,
  connectionId,
  marketplaceName,
  isLoading = false
}: SelectiveSyncDialogProps) {
  // State
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [categories, setCategories] = useState<MarketplaceCategory[]>([])
  const [brands, setBrands] = useState<MarketplaceBrand[]>([])
  const [error, setError] = useState<string | null>(null)

  // Filter selections
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])

  // Load categories and brands when dialog opens
  useEffect(() => {
    if (isOpen && connectionId) {
      loadFilters()
    }
  }, [isOpen, connectionId])

  const loadFilters = async () => {
    setLoadingFilters(true)
    setError(null)

    try {
      const [categoriesRes, brandsRes] = await Promise.all([
        marketplacesApi.getCategories(connectionId),
        marketplacesApi.getBrands(connectionId)
      ])

      setCategories(categoriesRes.data.categories)
      setBrands(brandsRes.data.brands)
    } catch (err: any) {
      console.error('Error loading filters:', err)
      setError(err.message || 'Failed to load filter options')
    } finally {
      setLoadingFilters(false)
    }
  }

  const handleConfirm = () => {
    const filters: ProductSyncFilters = {
      includeInactive,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      brands: selectedBrands.length > 0 ? selectedBrands : undefined
    }

    onConfirm(filters)
  }

  const hasActiveFilters =
    includeInactive ||
    selectedCategories.length > 0 ||
    selectedBrands.length > 0

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
    level: cat.level
  }))

  const brandOptions = brands.map(brand => ({
    value: brand.id,
    label: brand.name
  }))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Configure Product Sync - {marketplaceName}
          </DialogTitle>
          <DialogDescription>
            Choose which products to sync from your marketplace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Filters help you import only relevant products and exclude incomplete drafts.
              Leave filters empty to sync all products.
            </AlertDescription>
          </Alert>

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loadingFilters ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading filter options...</span>
            </div>
          ) : (
            <>
              {/* Product Status Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Status</label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeInactive"
                    checked={includeInactive}
                    onCheckedChange={(checked) => setIncludeInactive(checked as boolean)}
                  />
                  <label
                    htmlFor="includeInactive"
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Include inactive products
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  By default, only active products are synced
                </p>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Categories
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({categories.length} available)
                  </span>
                </label>

                <MultiSelect
                  options={categoryOptions}
                  selected={selectedCategories}
                  onChange={setSelectedCategories}
                  placeholder="Select categories..."
                  emptyText="No categories found"
                  searchPlaceholder="Search categories..."
                />

                {selectedCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedCategories.map(catId => {
                      const cat = categories.find(c => c.id === catId)
                      return (
                        <Badge key={catId} variant="secondary" className="text-xs">
                          {cat?.name}
                          <button
                            onClick={() => setSelectedCategories(prev =>
                              prev.filter(id => id !== catId)
                            )}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Leave empty to sync from all categories
                </p>
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Brands
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({brands.length} available)
                  </span>
                </label>

                <MultiSelect
                  options={brandOptions}
                  selected={selectedBrands}
                  onChange={setSelectedBrands}
                  placeholder="Select brands..."
                  emptyText="No brands found"
                  searchPlaceholder="Search brands..."
                />

                {selectedBrands.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedBrands.map(brandId => {
                      const brand = brands.find(b => b.id === brandId)
                      return (
                        <Badge key={brandId} variant="secondary" className="text-xs">
                          {brand?.name}
                          <button
                            onClick={() => setSelectedBrands(prev =>
                              prev.filter(id => id !== brandId)
                            )}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      )
                    })}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Leave empty to sync from all brands
                </p>
              </div>

              {/* Filter Summary */}
              {!hasActiveFilters && (
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertDescription>
                    <strong>No filters selected.</strong> This will sync all products from your marketplace.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loadingFilters || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Filter className="mr-2 h-4 w-4" />
                Apply Filters & Sync
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Additional Component Needed**: MultiSelect

**File**: `/client/src/components/ui/multi-select.tsx` (NEW)

```typescript
import React, { useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface MultiSelectOption {
  value: string
  label: string
  level?: number
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select items...',
  emptyText = 'No items found',
  searchPlaceholder = 'Search...'
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayText = selected.length === 0
    ? placeholder
    : `${selected.length} selected`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {displayText}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="p-2">
              {filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent'
                    )}
                    style={{
                      paddingLeft: option.level ? `${(option.level + 1) * 12}px` : '8px'
                    }}
                  >
                    <div className="mr-2 flex h-4 w-4 items-center justify-center">
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    <span>{option.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Changes Required**:
- Create `/client/src/components/marketplace/selective-sync-dialog.tsx`
- Create `/client/src/components/ui/multi-select.tsx`
- Create `/client/src/api/types/sync.ts` for filter types
- Update `/client/src/api/types/marketplace.ts` for category/brand types

---

### Phase 4 Tasks (Frontend - Integration)

#### Task 4.1: Update API Client

**File**: `/client/src/api/resources/marketplaces.ts`

**Estimated Time**: 1 hour

**Add New Methods**:

```typescript
// Add to marketplacesApi object
export const marketplacesApi = {
  // ... existing methods

  /**
   * Get available categories from marketplace
   */
  async getCategories(connectionId: string): Promise<GetCategoriesResponse> {
    return apiGet<GetCategoriesResponse>(
      `/marketplaces/${connectionId}/categories`
    )
  },

  /**
   * Get available brands from marketplace
   */
  async getBrands(connectionId: string): Promise<GetBrandsResponse> {
    return apiGet<GetBrandsResponse>(
      `/marketplaces/${connectionId}/brands`
    )
  },
}
```

**File**: `/client/src/api/resources/products.ts`

**Update syncProducts Method**:

```typescript
/**
 * Sync products from marketplace with optional filters
 */
async syncProducts(
  connectionId: string,
  request: SyncProductsRequest
): Promise<SyncProductsResponse> {
  return apiPost<SyncProductsResponse>(
    ENDPOINTS.PRODUCTS.SYNC(connectionId),
    request  // ✅ Now includes force and filters
  )
}
```

#### Task 4.2: Integrate into Marketplace Pages

**File**: `/client/src/pages/stores/[marketplace].tsx`

**Estimated Time**: 3-4 hours

**Modify ConnectedShopifyDetail Component**:

```typescript
import { SelectiveSyncDialog } from '@/components/marketplace/selective-sync-dialog'
import { ProductSyncFilters } from '@/api/types/sync'

export function ConnectedShopifyDetail({ connection }: Props) {
  // ... existing state

  // NEW: Add selective sync dialog state
  const [showSelectiveSync, setShowSelectiveSync] = useState(false)
  const [showSyncConfirm, setShowSyncConfirm] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<ProductSyncFilters | null>(null)

  /**
   * Handle sync button click - show filter dialog
   */
  const handleSyncClick = async () => {
    try {
      setSyncing(true)

      // Check if products exist
      const productInfo = await productsApi.hasProducts(connection._id)

      if (productInfo.hasProducts) {
        // Products exist - user needs to see both dialogs
        setShowSelectiveSync(true)  // Show filter dialog first
      } else {
        // No products - just show filter dialog
        setShowSelectiveSync(true)
      }

    } catch (error) {
      console.error('Error checking products:', error)
      setShowSelectiveSync(true)  // Show dialog anyway
    } finally {
      setSyncing(false)
    }
  }

  /**
   * Handle filter confirmation from SelectiveSyncDialog
   */
  const handleFiltersConfirmed = async (filters: ProductSyncFilters) => {
    setShowSelectiveSync(false)
    setPendingFilters(filters)

    try {
      // Check if products exist
      const productInfo = await productsApi.hasProducts(connection._id)

      if (productInfo.hasProducts) {
        // Show replacement warning
        setProductCount(productInfo.count)
        setShowSyncConfirm(true)
      } else {
        // No products, sync directly
        await performSync(false, filters)
      }
    } catch (error) {
      console.error('Error checking products:', error)
      // Proceed with sync anyway
      await performSync(false, filters)
    }
  }

  /**
   * Handle final confirmation (replacement warning)
   */
  const handleConfirmedSync = async () => {
    setShowSyncConfirm(false)
    await performSync(true, pendingFilters || undefined)
    setPendingFilters(null)
  }

  /**
   * Perform the actual sync with filters
   */
  const performSync = async (force: boolean, filters?: ProductSyncFilters) => {
    try {
      setSyncing(true)

      await productsApi.syncProducts(connection._id, {
        force,
        filters
      })

      // Refresh connection data
      await loadMarketplace()

      // Show success message
      console.log('Sync completed successfully')

    } catch (error) {
      console.error('Sync error:', error)
      // Show error message to user
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      {/* ... existing UI */}

      {/* NEW: Selective Sync Dialog */}
      <SelectiveSyncDialog
        isOpen={showSelectiveSync}
        onClose={() => {
          setShowSelectiveSync(false)
          setPendingFilters(null)
        }}
        onConfirm={handleFiltersConfirmed}
        connectionId={connection._id}
        marketplaceName={connection.marketplaceType}
        isLoading={syncing}
      />

      {/* EXISTING: Sync Confirmation Dialog (replacement warning) */}
      <SyncConfirmationDialog
        isOpen={showSyncConfirm}
        onClose={() => {
          setShowSyncConfirm(false)
          setPendingFilters(null)
        }}
        onConfirm={handleConfirmedSync}
        marketplaceName={connection.marketplaceType}
        productCount={productCount}
        isLoading={syncing}
      />

      {/* ... rest of component */}
    </div>
  )
}
```

**Repeat for ConnectedMarketplaceDetail** (same pattern)

**Changes Required**:
- Modify `/client/src/pages/stores/[marketplace].tsx`
- Update both `ConnectedShopifyDetail` and `ConnectedMarketplaceDetail`
- Chain modals: SelectiveSyncDialog → SyncConfirmationDialog → Sync

---

## API Specifications

### GET /api/marketplaces/:connectionId/categories

**Description**: Fetch available product categories from the connected marketplace

**Authentication**: Required (Bearer token)

**Workspace**: Required (X-Workspace-Id header)

**Request**:
```http
GET /api/marketplaces/507f1f77bcf86cd799439011/categories HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
X-Workspace-Id: <workspace-id>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "1",
        "name": "Electronics",
        "parentId": null,
        "level": 0
      },
      {
        "id": "2",
        "name": "Smartphones",
        "parentId": "1",
        "level": 1
      },
      {
        "id": "3",
        "name": "Laptops",
        "parentId": "1",
        "level": 1
      }
    ],
    "totalCount": 3
  }
}
```

**Error Responses**:
```json
// 404 - Connection not found
{
  "success": false,
  "message": "Store connection not found"
}

// 400 - Not supported for marketplace
{
  "success": false,
  "message": "Category filtering not supported for shopify"
}

// 500 - API error
{
  "success": false,
  "message": "Failed to fetch VTEX categories: Unauthorized"
}
```

---

### GET /api/marketplaces/:connectionId/brands

**Description**: Fetch available product brands from the connected marketplace

**Authentication**: Required

**Workspace**: Required

**Request**:
```http
GET /api/marketplaces/507f1f77bcf86cd799439011/brands HTTP/1.1
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "brands": [
      {
        "id": "100",
        "name": "Apple"
      },
      {
        "id": "101",
        "name": "Samsung"
      }
    ],
    "totalCount": 2
  }
}
```

---

### POST /api/products/sync/:connectionId (Modified)

**Description**: Sync products from marketplace with optional filters

**Authentication**: Required

**Workspace**: Required

**Request**:
```http
POST /api/products/sync/507f1f77bcf86cd799439011 HTTP/1.1
Content-Type: application/json

{
  "force": true,
  "filters": {
    "includeInactive": false,
    "categories": ["1", "2", "5"],
    "brands": ["100", "105"]
  }
}
```

**Request Body Schema**:
```typescript
{
  force?: boolean           // Delete existing products before sync
  filters?: {
    includeInactive?: boolean   // Include inactive products (default: false)
    categories?: string[]       // Category IDs to filter by (empty = all)
    brands?: string[]          // Brand IDs to filter by (empty = all)
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Successfully synced 145 products from vtex",
  "data": {
    "totalProducts": 145,
    "newProducts": 12,
    "updatedProducts": 133,
    "deletedProducts": 50,
    "isForceSync": true,
    "appliedFilters": {
      "includeInactive": false,
      "categories": ["1", "2", "5"],
      "brands": ["100", "105"]
    }
  }
}
```

---

## Frontend Components

### Component Hierarchy

```
SelectiveSyncDialog
├── DialogHeader
│   └── Title with Filter icon
├── DialogContent
│   ├── Info Alert (explaining filters)
│   ├── Error Alert (if filter loading fails)
│   ├── Loading State (skeleton loaders)
│   └── Filter Controls
│       ├── Checkbox (Include inactive)
│       ├── MultiSelect (Categories)
│       │   └── Badge chips (selected categories)
│       └── MultiSelect (Brands)
│           └── Badge chips (selected brands)
└── DialogFooter
    ├── Cancel Button
    └── Apply & Sync Button

MultiSelect Component
├── PopoverTrigger (Button showing selection)
└── PopoverContent
    ├── Search Input
    └── Option List
        └── Checkbox items (with Check icon)
```

---

## Backend Services

### Service Layer Architecture

```
VtexService
├── fetchCategories(credentials)
│   └── GET /api/catalog_system/pvt/category/tree/3
├── fetchBrands(credentials)
│   └── GET /api/catalog_system/pvt/brand/list
└── (future: fetchProducts, applyFilters)

ShopifyService
├── fetchCollections(credentials)
│   └── GET /admin/api/2024-01/custom_collections.json
├── fetchVendors(credentials)
│   └── Extract unique vendors from products
└── (future: filtered product fetch)

[Other Marketplace Services...]
```

---

## Testing Strategy

### Unit Tests

**Backend**:
```typescript
describe('VtexService', () => {
  describe('fetchCategories', () => {
    it('should fetch and flatten category tree')
    it('should handle empty category tree')
    it('should handle authentication errors')
  })

  describe('fetchBrands', () => {
    it('should fetch active brands only')
    it('should handle empty brand list')
  })
})

describe('applyVtexFilters', () => {
  it('should filter by category')
  it('should filter by brand')
  it('should filter by active status')
  it('should apply multiple filters together')
  it('should return all products when no filters')
})
```

**Frontend**:
```typescript
describe('SelectiveSyncDialog', () => {
  it('should render loading state initially')
  it('should load categories and brands on mount')
  it('should handle filter loading errors')
  it('should allow selecting multiple categories')
  it('should allow selecting multiple brands')
  it('should call onConfirm with selected filters')
  it('should show warning when no filters selected')
})

describe('MultiSelect', () => {
  it('should display placeholder when nothing selected')
  it('should show selected count')
  it('should filter options by search')
  it('should toggle option selection')
})
```

### Integration Tests

**Backend Integration**:
```bash
# Test complete filtered sync flow
POST /api/products/sync/:id
  ✓ With category filter
  ✓ With brand filter
  ✓ With inactive filter
  ✓ With all filters combined
  ✓ Without filters (sync all)
  ✓ Force sync with filters
```

**Frontend Integration**:
- Test complete user flow: Click sync → Select filters → Confirm → See results
- Test chaining of modals
- Test error states and recovery

### E2E Tests (Playwright)

```typescript
test('selective sync flow', async ({ page }) => {
  // Navigate to marketplace page
  await page.goto('/stores/vtex')

  // Click sync button
  await page.click('text=Sync Products')

  // Wait for filter dialog
  await page.waitForSelector('text=Configure Product Sync')

  // Select categories
  await page.click('text=Select categories...')
  await page.click('text=Electronics')
  await page.click('text=Clothing')

  // Select brands
  await page.click('text=Select brands...')
  await page.click('text=Nike')

  // Confirm
  await page.click('text=Apply Filters & Sync')

  // Wait for success
  await page.waitForSelector('text=Successfully synced')
})
```

### Manual Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **No filters selected** | 1. Open dialog<br>2. Click sync without selecting filters | Warning shown: "This will sync all products" |
| **Category filter only** | 1. Select 2 categories<br>2. Sync | Only products from those categories synced |
| **Brand filter only** | 1. Select 2 brands<br>2. Sync | Only products from those brands synced |
| **Multiple filters** | 1. Select categories + brands<br>2. Exclude inactive<br>3. Sync | Products matching ALL filters synced |
| **Large catalog** | 1. Select filters<br>2. Sync VTEX store with 1000+ products | All matching products synced (no 30 limit) |
| **Empty results** | 1. Select very restrictive filters<br>2. Sync | Message: "No products match filters" |
| **Filter loading error** | 1. Disconnect network<br>2. Open dialog | Error message shown, can retry |

---

## Performance Considerations

### API Call Optimization

**Problem**: Fetching categories, brands, and filtering products can be slow for large catalogs.

**Solutions**:

1. **Caching Filter Data**:
   ```typescript
   // Cache categories and brands for 1 hour
   const FILTER_CACHE_TTL = 3600000 // 1 hour

   interface FilterCache {
     categories: MarketplaceCategory[]
     brands: MarketplaceBrand[]
     timestamp: number
   }

   const filterCache = new Map<string, FilterCache>()

   async function getCachedFilters(connectionId: string) {
     const cached = filterCache.get(connectionId)

     if (cached && Date.now() - cached.timestamp < FILTER_CACHE_TTL) {
       return cached
     }

     // Fetch fresh data
     const [categories, brands] = await Promise.all([
       fetchCategories(connectionId),
       fetchBrands(connectionId)
     ])

     filterCache.set(connectionId, {
       categories,
       brands,
       timestamp: Date.now()
     })

     return { categories, brands }
   }
   ```

2. **Parallel API Calls**:
   - Fetch categories and brands in parallel
   - Use `Promise.all()` to minimize wait time

3. **Lazy Loading**:
   - Load filters only when dialog opens
   - Don't preload for every marketplace page

4. **Backend Filtering**:
   - Apply filters in marketplace API calls (when supported)
   - Avoid fetching all products then filtering client-side

### Frontend Performance

1. **Debounced Search**:
   ```typescript
   // In MultiSelect component
   const [searchTerm, setSearchTerm] = useState('')
   const debouncedSearch = useDebouncedValue(searchTerm, 300)
   ```

2. **Virtual Scrolling**:
   - For 100+ categories/brands, use virtual scrolling
   - Only render visible items

3. **Memoization**:
   ```typescript
   const filteredCategories = useMemo(() => {
     return categories.filter(cat =>
       cat.name.toLowerCase().includes(search.toLowerCase())
     )
   }, [categories, search])
   ```

### Marketplace-Specific Considerations

**VTEX**:
- Category tree API can be slow (3-5 seconds)
- Cache aggressively
- Consider background refresh

**Shopify**:
- Collections API is fast (<1 second)
- Vendors extracted from products (may need full product fetch)
- Consider caching vendor list

**Rate Limiting**:
- Respect marketplace API limits
- Add delays between requests (100-200ms)
- Implement retry logic with exponential backoff

---

## References

### VTEX API Documentation

**Categories**:
- https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/category/tree/-categoryLevels-
- Returns hierarchical category tree
- Requires App Key + App Token

**Brands**:
- https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/brand/list
- Returns flat list of brands
- Includes active/inactive status

**Products with Filters**:
- https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/products/GetProductAndSkuIds
- Supports pagination: `?page=1&pagesize=100`
- Does NOT support category/brand filtering directly
- Must filter after fetching

### Shopify API Documentation

**Collections (Categories)**:
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/customcollection
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/smartcollection
- Returns collection metadata

**Products with Filters**:
- https://shopify.dev/docs/api/admin-rest/2024-01/resources/product
- Supports filtering: `?collection_id=X&vendor=Y&status=active`
- Native filter support in API

### Related Documentation

- `/docs/VTEX_INTEGRATION_ANALYSIS.md` - Complete VTEX integration analysis
- `/CLAUDE.md` - Project architecture and guidelines
- `/RACKY_BACKEND_API.md` - Backend API documentation
- `/DEV_SETUP.md` - Development environment setup

---

## Appendix: Code Snippets

### Middleware for Workspace Scoping

```typescript
// Already exists - just for reference
export const requireWorkspace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const workspaceId = req.headers['x-workspace-id'] as string

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: 'Workspace ID required'
    })
  }

  const workspace = await Workspace.findById(workspaceId)

  if (!workspace) {
    return res.status(404).json({
      success: false,
      message: 'Workspace not found'
    })
  }

  req.workspace = workspace
  next()
}
```

### Error Handling Pattern

```typescript
try {
  // Operation
} catch (error: any) {
  console.error('[MODULE] Error:', error)

  if (error.response?.status === 401) {
    throw new Error('Authentication failed. Check credentials.')
  }

  if (error.response?.status === 429) {
    throw new Error('Rate limit exceeded. Try again later.')
  }

  throw new Error(`Failed to complete operation: ${error.message}`)
}
```

---

## Document Control

**Version History**:
- v1.0 (2025-10-24): Initial specification

**Next Review**: After Phase 1 completion

**Stakeholders**:
- Engineering Team
- Product Management
- UX/UI Team

---

**End of Document**
