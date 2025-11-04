import { ShopifyCredentials } from './marketplaceService';
import { ProductSyncFilters } from '@/common/types/syncFilters';
import MarketplaceCatalogCache from '@/common/models/MarketplaceCatalogCache';
import { Types } from 'mongoose';

/**
 * Shopify Complete Product Interface
 * Represents full product data from Shopify GraphQL API
 */
export interface ShopifyCompleteProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  productType: string;
  vendor: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  images: Array<{
    id: string;
    url: string;
    altText: string | null;
  }>;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    compareAtPrice: string | null;
    sku: string;
    inventoryQuantity: number;
    taxable: boolean;
  }>;
}

/**
 * Shopify Service
 *
 * Handles all Shopify API interactions for product sync
 * Uses GraphQL Admin API with query parameter for efficient filtering
 */
export class ShopifyService {
  /**
   * Build Shopify GraphQL query filter string from ProductSyncFilters
   *
   * Shopify query syntax:
   * - status:active - Active products only
   * - status:archived OR status:draft - Inactive products
   * - vendor:Nike - Products from Nike
   * - product_type:Shoes - Products of type Shoes
   * - Combine with AND (implicit) or OR (explicit)
   *
   * @param filters ProductSyncFilters object
   * @returns Shopify query string (e.g., "status:active vendor:Nike OR vendor:Adidas")
   */
  static buildQueryFilter(filters?: ProductSyncFilters): string {
    if (!filters) {
      return '';
    }

    const queryParts: string[] = [];

    // 1. Status filter (active/inactive)
    if (filters.includeActive && !filters.includeInactive) {
      queryParts.push('status:active');
    } else if (!filters.includeActive && filters.includeInactive) {
      // Shopify inactive statuses: ARCHIVED and DRAFT
      queryParts.push('(status:archived OR status:draft)');
    }
    // If both true or both false, don't add status filter (fetch all)

    // 2. Vendor filter (brand names in Shopify)
    // Note: In Shopify, vendors are string names, not IDs like VTEX
    if (filters.brandIds && filters.brandIds.length > 0) {
      const vendorFilters = filters.brandIds
        .map(vendor => `vendor:"${vendor}"`)
        .join(' OR ');

      // Wrap in parentheses if multiple vendors
      if (filters.brandIds.length > 1) {
        queryParts.push(`(${vendorFilters})`);
      } else {
        queryParts.push(vendorFilters);
      }
    }

    // 3. Product type filter (category/type names in Shopify)
    // Note: In Shopify, productTypes are string names, not IDs like VTEX
    if (filters.categoryIds && filters.categoryIds.length > 0) {
      const typeFilters = filters.categoryIds
        .map(type => `product_type:"${type}"`)
        .join(' OR ');

      // Wrap in parentheses if multiple types
      if (filters.categoryIds.length > 1) {
        queryParts.push(`(${typeFilters})`);
      } else {
        queryParts.push(typeFilters);
      }
    }

    // Join all parts with space (implicit AND in Shopify)
    return queryParts.join(' ');
  }

  /**
   * Get estimated total product count from Shopify
   * Makes a minimal API call to get count estimate
   *
   * Note: Shopify GraphQL doesn't provide exact counts, so we estimate from first page
   *
   * @param credentials Shopify credentials
   * @param filters Optional filters to apply
   * @returns Estimated total product count (rough estimate)
   */
  static async getEstimatedProductCount(
    credentials: ShopifyCredentials,
    filters?: ProductSyncFilters
  ): Promise<number> {
    try {
      const { shop_url, access_token } = credentials;

      if (!shop_url || !access_token) {
        throw new Error('Shop URL and access token are required for Shopify');
      }

      // Extract store name from shop_url
      let storeName = shop_url
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/\.myshopify\.com$/, '');

      const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

      // Build query filter string
      const queryFilter = this.buildQueryFilter(filters);

      // GraphQL query to get first page
      const query = `
        query GetProducts($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `;

      const variables = {
        first: 50, // Get first page
        query: queryFilter || null
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const firstPageCount = data.data.products.edges.length;
      const hasNextPage = data.data.products.pageInfo.hasNextPage;

      // Estimate: if there's a next page, assume at least 2x first page
      // Otherwise, return exact count from first page
      const estimate = hasNextPage ? firstPageCount * 2 : firstPageCount;

      console.log(`[Shopify Service] Estimated product count: ~${estimate} (First page: ${firstPageCount}, Has more: ${hasNextPage})`);

      return estimate;

    } catch (error: any) {
      console.error('[Shopify Service] Error getting estimated product count:', error.message);
      throw error;
    }
  }

  /**
   * Fetch product IDs from Shopify with API-level filtering
   *
   * Uses GraphQL query parameter to filter products at the API level,
   * avoiding the need to fetch all products and filter locally.
   *
   * This is more efficient than VTEX which requires post-filtering.
   *
   * @param credentials Shopify credentials (shop_url, access_token)
   * @param filters Optional filters (status, vendor, productType)
   * @returns Array of product IDs matching the filters
   */
  static async fetchProductIds(
    credentials: ShopifyCredentials,
    filters?: ProductSyncFilters
  ): Promise<Array<{ externalId: string }>> {
    const { shop_url, access_token } = credentials;

    if (!shop_url || !access_token) {
      throw new Error('Shop URL and access token are required for Shopify');
    }

    // Extract store name from shop_url
    let storeName = shop_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\.myshopify\.com$/, '');

    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    // Build query filter string
    const queryFilter = this.buildQueryFilter(filters);
    console.log('[Shopify Service] Query filter:', queryFilter || '(no filters)');

    // GraphQL query
    const query = `
      query GetProducts($first: Int!, $after: String, $query: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Fetch products with pagination
    const productIds: Array<{ externalId: string }> = [];
    let cursor: string | null = null;
    let hasMore = true;
    const pageSize = 50;
    let page = 1;

    while (hasMore) {
      const variables = {
        first: pageSize,
        after: cursor,
        query: queryFilter || null  // null if no filters
      };

      console.log(`[Shopify Service] Fetching page ${page}...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      // Extract product IDs
      const products = data.data.products.edges;
      products.forEach((edge: any) => {
        productIds.push({ externalId: edge.node.id });
      });

      console.log(`[Shopify Service] Page ${page}: Fetched ${products.length} products (Total so far: ${productIds.length})`);

      // Check pagination
      hasMore = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      page++;

      // Safety limit to avoid infinite loops
      if (page > 200) {
        console.warn('[Shopify Service] Reached max page limit (200)');
        break;
      }
    }

    console.log(`[Shopify Service] Total products fetched: ${productIds.length}`);
    return productIds;
  }

  /**
   * Fetch complete product data for a single product
   *
   * Used by async processor to get full product details after fetching IDs
   *
   * @param credentials Shopify credentials
   * @param productId Shopify product ID (GID format)
   * @returns Complete product data
   */
  static async fetchCompleteProductData(
    credentials: ShopifyCredentials,
    productId: string
  ): Promise<ShopifyCompleteProduct> {
    const { shop_url, access_token } = credentials;

    if (!shop_url || !access_token) {
      throw new Error('Shop URL and access token are required for Shopify');
    }

    // Extract store name from shop_url
    let storeName = shop_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\.myshopify\.com$/, '');

    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    // GraphQL query for single product
    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          handle
          description
          productType
          vendor
          tags
          status
          createdAt
          updatedAt
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                inventoryQuantity
                taxable
              }
            }
          }
        }
      }
    `;

    const variables = {
      id: productId
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify API request failed: ${response.statusText}`);
    }

    const data: any = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (!data.data.product) {
      throw new Error(`Product ${productId} not found`);
    }

    const product = data.data.product;

    // Transform to ShopifyCompleteProduct interface
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.description || '',
      productType: product.productType || '',
      vendor: product.vendor || '',
      tags: product.tags || [],
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      images: product.images.edges.map((edge: any) => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText
      })),
      variants: product.variants.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        compareAtPrice: edge.node.compareAtPrice,
        sku: edge.node.sku,
        inventoryQuantity: edge.node.inventoryQuantity || 0,
        taxable: edge.node.taxable
      }))
    };
  }

  /**
   * Fetch all unique vendors (brands) from Shopify with product counts
   * Fetches ALL products from Shopify API and aggregates vendors in memory
   *
   * @param credentials Shopify credentials
   * @returns Array of vendors with product counts
   */
  static async fetchAllVendors(
    credentials: ShopifyCredentials
  ): Promise<Array<{ name: string; productCount: number }>> {
    const { shop_url, access_token } = credentials;

    if (!shop_url || !access_token) {
      throw new Error('Shop URL and access token are required for Shopify');
    }

    // Extract store name from shop_url
    let storeName = shop_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\.myshopify\.com$/, '');

    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    console.log('[Shopify Service] Fetching all vendors from Shopify API...');

    // GraphQL query to fetch products with vendor
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, query: "status:ACTIVE") {
          edges {
            node {
              id
              vendor
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Paginate and aggregate vendors
    const vendorCounts = new Map<string, number>();
    let cursor: string | null = null;
    let hasMore = true;
    let page = 1;

    while (hasMore) {
      console.log(`[Shopify Service] Fetching vendors page ${page}...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables: { first: 250, after: cursor }
        })
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const products = data.data.products.edges;

      // Count vendors
      products.forEach(({ node }: any) => {
        if (node.vendor && node.vendor.trim() !== '') {
          const vendor = node.vendor.trim();
          vendorCounts.set(vendor, (vendorCounts.get(vendor) || 0) + 1);
        }
      });

      hasMore = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      page++;

      // Safety limit
      if (page > 200) {
        console.warn('[Shopify Service] Reached max page limit (200)');
        break;
      }
    }

    console.log(`[Shopify Service] Found ${vendorCounts.size} unique vendors`);

    // Convert to array and sort by product count descending
    return Array.from(vendorCounts.entries())
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => b.productCount - a.productCount);
  }

  /**
   * Fetch all unique product types (categories) from Shopify with product counts
   * Fetches ALL products from Shopify API and aggregates product types in memory
   *
   * @param credentials Shopify credentials
   * @returns Array of product types with product counts
   */
  static async fetchAllProductTypes(
    credentials: ShopifyCredentials
  ): Promise<Array<{ name: string; productCount: number }>> {
    const { shop_url, access_token } = credentials;

    if (!shop_url || !access_token) {
      throw new Error('Shop URL and access token are required for Shopify');
    }

    // Extract store name from shop_url
    let storeName = shop_url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/\.myshopify\.com$/, '');

    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    console.log('[Shopify Service] Fetching all product types from Shopify API...');

    // GraphQL query to fetch products with productType
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, query: "status:ACTIVE") {
          edges {
            node {
              id
              productType
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Paginate and aggregate product types
    const productTypeCounts = new Map<string, number>();
    let cursor: string | null = null;
    let hasMore = true;
    let page = 1;

    while (hasMore) {
      console.log(`[Shopify Service] Fetching product types page ${page}...`);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables: { first: 250, after: cursor }
        })
      });

      if (!response.ok) {
        throw new Error(`Shopify API request failed: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      const products = data.data.products.edges;

      // Count product types
      products.forEach(({ node }: any) => {
        if (node.productType && node.productType.trim() !== '') {
          const productType = node.productType.trim();
          productTypeCounts.set(productType, (productTypeCounts.get(productType) || 0) + 1);
        }
      });

      hasMore = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
      page++;

      // Safety limit
      if (page > 200) {
        console.warn('[Shopify Service] Reached max page limit (200)');
        break;
      }
    }

    console.log(`[Shopify Service] Found ${productTypeCounts.size} unique product types`);

    // Convert to array and sort by product count descending
    return Array.from(productTypeCounts.entries())
      .map(([name, productCount]) => ({ name, productCount }))
      .sort((a, b) => b.productCount - a.productCount);
  }

  /**
   * Get vendors with product counts (with 24h cache)
   *
   * @param connectionId Store connection ID
   * @param workspaceId Workspace ID
   * @param credentials Shopify credentials
   * @returns Array of vendors with counts and cache info
   */
  static async getVendorsWithCount(
    connectionId: string,
    workspaceId: Types.ObjectId,
    credentials: ShopifyCredentials
  ): Promise<{
    vendors: Array<{ name: string; productCount: number }>;
    totalCount: number;
    source: 'cache' | 'api';
  }> {
    console.log('[Shopify Service] Getting vendors with count for connection:', connectionId);

    const storeConnectionId = new Types.ObjectId(connectionId);

    // Check cache first
    const cachedData = await MarketplaceCatalogCache.findValidCache(storeConnectionId, 'brand');

    if (cachedData && !cachedData.isExpired()) {
      console.log('[Shopify Service] Returning vendors from cache');
      const vendors = cachedData.items.map(item => ({
        name: item.name,
        productCount: item.productCount
      }));
      return {
        vendors,
        totalCount: vendors.length,
        source: 'cache'
      };
    }

    // Cache expired or doesn't exist, fetch from API
    console.log('[Shopify Service] Cache expired or not found, fetching from Shopify API...');
    const vendors = await this.fetchAllVendors(credentials);

    // Transform to ICatalogCacheItem format (id, name, productCount)
    const cacheItems = vendors.map(vendor => ({
      id: vendor.name, // Use name as ID for Shopify vendors
      name: vendor.name,
      productCount: vendor.productCount
    }));

    // Save to cache with 24h TTL using createOrUpdate method
    await MarketplaceCatalogCache.createOrUpdate(
      storeConnectionId,
      workspaceId,
      'shopify',
      'brand',
      cacheItems,
      24 // 24 hours TTL
    );

    console.log(`[Shopify Service] Cached ${vendors.length} vendors for 24 hours`);

    return {
      vendors,
      totalCount: vendors.length,
      source: 'api'
    };
  }

  /**
   * Get product types with product counts (with 24h cache)
   *
   * @param connectionId Store connection ID
   * @param workspaceId Workspace ID
   * @param credentials Shopify credentials
   * @returns Array of product types with counts and cache info
   */
  static async getProductTypesWithCount(
    connectionId: string,
    workspaceId: Types.ObjectId,
    credentials: ShopifyCredentials
  ): Promise<{
    productTypes: Array<{ name: string; productCount: number }>;
    totalCount: number;
    source: 'cache' | 'api';
  }> {
    console.log('[Shopify Service] Getting product types with count for connection:', connectionId);

    const storeConnectionId = new Types.ObjectId(connectionId);

    // Check cache first
    const cachedData = await MarketplaceCatalogCache.findValidCache(storeConnectionId, 'category');

    if (cachedData && !cachedData.isExpired()) {
      console.log('[Shopify Service] Returning product types from cache');
      const productTypes = cachedData.items.map(item => ({
        name: item.name,
        productCount: item.productCount
      }));
      return {
        productTypes,
        totalCount: productTypes.length,
        source: 'cache'
      };
    }

    // Cache expired or doesn't exist, fetch from API
    console.log('[Shopify Service] Cache expired or not found, fetching from Shopify API...');
    const productTypes = await this.fetchAllProductTypes(credentials);

    // Transform to ICatalogCacheItem format (id, name, productCount)
    const cacheItems = productTypes.map(type => ({
      id: type.name, // Use name as ID for Shopify product types
      name: type.name,
      productCount: type.productCount
    }));

    // Save to cache with 24h TTL using createOrUpdate method
    await MarketplaceCatalogCache.createOrUpdate(
      storeConnectionId,
      workspaceId,
      'shopify',
      'category',
      cacheItems,
      24 // 24 hours TTL
    );

    console.log(`[Shopify Service] Cached ${productTypes.length} product types for 24 hours`);

    return {
      productTypes,
      totalCount: productTypes.length,
      source: 'api'
    };
  }
}
