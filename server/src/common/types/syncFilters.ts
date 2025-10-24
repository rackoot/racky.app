/**
 * Product Sync Filter Types
 *
 * Defines interfaces for filtering products during marketplace synchronization.
 * Supports filtering by active status, categories, and brands.
 */

/**
 * Product synchronization filters
 * Applied when fetching products from marketplace APIs
 */
export interface ProductSyncFilters {
  /**
   * Include active products (products available for sale)
   * Default: true
   */
  includeActive: boolean;

  /**
   * Include inactive products (products not currently available)
   * Default: false
   */
  includeInactive: boolean;

  /**
   * Filter by specific category IDs from the marketplace
   * null = fetch all categories
   * [] = fetch no categories (edge case)
   * ['cat1', 'cat2'] = fetch only these categories
   */
  categoryIds: string[] | null;

  /**
   * Filter by specific brand IDs from the marketplace
   * null = fetch all brands
   * [] = fetch no brands (edge case)
   * ['brand1', 'brand2'] = fetch only these brands
   */
  brandIds: string[] | null;
}

/**
 * Request body for POST /api/products/sync/:connectionId
 */
export interface SyncProductsRequest {
  /**
   * Optional filters to apply during product sync
   * If not provided, defaults will be used (active products only, all categories/brands)
   */
  filters?: ProductSyncFilters;

  /**
   * Force full resync (delete existing products and reimport)
   * Default: false (incremental sync)
   */
  forceFullSync?: boolean;
}

/**
 * Response from POST /api/products/sync/:connectionId
 */
export interface SyncProductsResponse {
  success: boolean;
  message: string;
  data: {
    /**
     * Job ID for tracking async sync progress
     */
    jobId: string;

    /**
     * Store connection ID
     */
    storeConnectionId: string;

    /**
     * Marketplace type being synced
     */
    marketplaceType: string;

    /**
     * Applied filters (with defaults filled in)
     */
    appliedFilters: ProductSyncFilters;

    /**
     * Estimated product count (if available from marketplace API)
     */
    estimatedCount?: number;
  };
}

/**
 * Options for fetching products from marketplace APIs
 */
export interface FetchProductsOptions {
  /**
   * Filters to apply when fetching
   */
  filters: ProductSyncFilters;

  /**
   * Page number for pagination (1-indexed)
   */
  page?: number;

  /**
   * Number of products per page
   */
  pageSize?: number;

  /**
   * Maximum total products to fetch (safety limit)
   */
  maxProducts?: number;
}

/**
 * Result from fetching products from marketplace API
 */
export interface FetchProductsResult {
  /**
   * Array of products fetched
   */
  products: any[]; // Will be typed as Product[] after fetch

  /**
   * Total number of products matching filters (if available)
   */
  totalCount?: number;

  /**
   * Whether there are more pages to fetch
   */
  hasMore: boolean;

  /**
   * Next page number (if hasMore is true)
   */
  nextPage?: number;
}

/**
 * Default filter values
 */
export const DEFAULT_SYNC_FILTERS: ProductSyncFilters = {
  includeActive: true,
  includeInactive: false,
  categoryIds: null,
  brandIds: null
};

/**
 * Validates that sync filters are properly formatted
 */
export function validateSyncFilters(filters: Partial<ProductSyncFilters>): ProductSyncFilters {
  return {
    includeActive: filters.includeActive ?? DEFAULT_SYNC_FILTERS.includeActive,
    includeInactive: filters.includeInactive ?? DEFAULT_SYNC_FILTERS.includeInactive,
    categoryIds: Array.isArray(filters.categoryIds) ? filters.categoryIds : null,
    brandIds: Array.isArray(filters.brandIds) ? filters.brandIds : null
  };
}

/**
 * Checks if filters would exclude all products
 */
export function filtersExcludeAll(filters: ProductSyncFilters): boolean {
  // If both active and inactive are false, no products will be fetched
  if (!filters.includeActive && !filters.includeInactive) {
    return true;
  }

  // If categoryIds is an empty array (not null), no products will be fetched
  if (Array.isArray(filters.categoryIds) && filters.categoryIds.length === 0) {
    return true;
  }

  // If brandIds is an empty array (not null), no products will be fetched
  if (Array.isArray(filters.brandIds) && filters.brandIds.length === 0) {
    return true;
  }

  return false;
}
