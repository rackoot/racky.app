import axios from 'axios';
import { Types } from 'mongoose';
import { ProductCategory, ProductBrand } from '@/common/types/marketplace';
import { VtexCredentials } from './marketplaceService';
import MarketplaceCatalogCache, { ICatalogCacheItem } from '@/common/models/MarketplaceCatalogCache';

/**
 * VTEX API Response Types
 * These match the structure returned by VTEX Catalog API
 */
interface VtexCategoryNode {
  id?: number;
  Id?: number;
  name?: string;
  Name?: string;
  children?: VtexCategoryNode[];
  Children?: VtexCategoryNode[];
}

interface VtexBrandResponse {
  id?: number;
  Id?: number;
  name?: string;
  Name?: string;
  isActive?: boolean;
  IsActive?: boolean;
}

/**
 * VTEX Product and SKU ID Response (Raw from API)
 * From GET /api/catalog_system/pvt/products/GetProductAndSkuIds
 *
 * Real structure from VTEX:
 * {
 *   "data": {
 *     "1": [1, 123456, 310118449],  // key = productId, value = array of skuIds
 *     "2": [3, 310118450]
 *   },
 *   "range": { "total": 12, "from": 1, "to": 20 }
 * }
 */
interface VtexProductAndSkuIdsRawResponse {
  data: {
    [productId: string]: number[];  // Object with productId keys mapping to SKU ID arrays
  };
  range: {
    total: number;
    from: number;
    to: number;
  };
}

/**
 * VTEX Product and SKU ID Response (Transformed)
 * Internal format after transformation for easier consumption
 */
interface VtexProductAndSkuIdsResponse {
  data: Array<{
    productId: number;
    skuIds: number[];
  }>;
  range: {
    total: number;
    from: number;
    to: number;
  };
}

/**
 * VTEX Product Details Response
 * From GET /api/catalog_system/pvt/product/{productId}
 */
interface VtexProductDetailsResponse {
  Id: number;
  Name: string;
  DepartmentId: number | null;
  CategoryId: number | null;
  BrandId: number | null;
  LinkId: string;
  RefId: string;
  IsVisible: boolean;
  Description: string;
  DescriptionShort: string;
  ReleaseDate: string | null;
  KeyWords: string;
  Title: string;
  IsActive: boolean;
  MetaTagDescription: string;
  ShowWithoutStock: boolean;
  Score: number | null;
}

/**
 * VTEX SKU Details Response
 * From GET /api/catalog_system/pvt/sku/stockkeepingunitbyid/{skuId}
 */
interface VtexSkuDetailsResponse {
  Id: number;
  ProductId: number;
  NameComplete: string;
  ProductName: string;
  ProductDescription: string;
  TaxCode: string;
  SkuName: string;
  IsActive: boolean;
  IsTransported: boolean;
  IsInventoried: boolean;
  IsGiftCardRecharge: boolean;
  ImageUrl: string;
  DetailUrl: string;
  CSCIdentification: string | null;
  BrandId: string;
  BrandName: string;
  Dimension: {
    cubicweight: number;
    height: number;
    length: number;
    weight: number;
    width: number;
  };
  RealDimension: {
    realCubicWeight: number;
    realHeight: number;
    realLength: number;
    realWeight: number;
    realWidth: number;
  };
  ManufacturerCode: string;
  IsKit: boolean;
  KitItems: any[];
  Services: any[];
  Categories: string[];
  CategoriesFullPath: string[];
  Attachments: any[];
  Collections: any[];
  SkuSellers: Array<{
    SellerId: string;
    StockKeepingUnitId: number;
    SellerStockKeepingUnitId: string;
    IsActive: boolean;
    FreightCommissionPercentage: number;
    ProductCommissionPercentage: number;
  }>;
  SalesChannels: number[];
  Images: Array<{
    ImageUrl: string;
    ImageName: string;
    FileId: number;
  }>;
  SkuSpecifications: Array<{
    FieldId: number;
    FieldName: string;
    FieldValueIds: number[];
    FieldValues: string[];
  }>;
  ProductSpecifications: Array<{
    FieldId: number;
    FieldName: string;
    FieldValueIds: number[];
    FieldValues: string[];
  }>;
  ProductClustersIds: string;
  ProductCategoryIds: string;
  ProductGlobalCategoryId: number | null;
  ProductCategories: Record<string, string>;
  CommercialConditionId: number;
  RewardValue: number;
  AlternateIds: {
    Ean: string;
    RefId: string;
  };
  AlternateIdValues: string[];
  EstimatedDateArrival: string | null;
  MeasurementUnit: string;
  UnitMultiplier: number;
  InformationSource: string;
  ModalType: string | null;
}

/**
 * VTEX Pricing Response
 * From GET /api/pricing/prices/{skuId}
 */
interface VtexPricingResponse {
  itemId: string;
  listPrice: number | null;
  costPrice: number | null;
  markup: number;
  basePrice: number;
  fixedPrices: Array<{
    tradePolicyId: string;
    value: number;
    listPrice: number | null;
    minQuantity: number;
    dateRange?: {
      from: string;
      to: string;
    };
  }>;
}

/**
 * VTEX Inventory Response
 * From GET /api/logistics/pvt/inventory/skus/{skuId}
 */
interface VtexInventoryResponse {
  skuId: string;
  balance: Array<{
    warehouseId: string;
    warehouseName: string;
    totalQuantity: number;
    reservedQuantity: number;
    hasUnlimitedQuantity: boolean;
    availableQuantity?: number;
  }>;
}

/**
 * Complete VTEX Product Data
 * Combines product, SKU, pricing, and inventory data
 */
export interface VtexCompleteProduct {
  product: VtexProductDetailsResponse;
  sku: VtexSkuDetailsResponse;
  pricing: VtexPricingResponse | null;
  inventory: VtexInventoryResponse | null;
}

/**
 * VTEX Marketplace Service
 * Handles VTEX-specific API integrations
 */
export class VtexService {
  /**
   * Clean VTEX account name from various URL formats
   */
  private static cleanAccountName(accountName: string): string {
    return accountName
      .replace(/^https?:\/\//, '')
      .replace(/\.vtexcommercestable\.com\.br.*$/, '')
      .replace(/\.vtex\.com\.br.*$/, '')
      .replace(/\.vtexcommerce\.com\.br.*$/, '')
      .replace(/\/$/, '');
  }

  /**
   * Fetch category tree from VTEX Catalog API
   *
   * API Endpoint: GET /api/catalog_system/pvt/category/tree/{levels}
   * Documentation: https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/category/tree/-categoryLevels-
   *
   * @param credentials VTEX account credentials
   * @returns Flattened array of categories with hierarchy
   */
  static async fetchCategories(credentials: VtexCredentials): Promise<ProductCategory[]> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials: account_name, app_key, or app_token');
      }

      const cleanAccount = this.cleanAccountName(account_name);

      // Fetch category tree (3 levels deep to capture most hierarchies)
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/category/tree/3`;

      console.log(`[VTEX Service] Fetching categories from: ${cleanAccount}`);

      const response = await axios.get<VtexCategoryNode[]>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      // VTEX returns hierarchical tree, flatten it for easier frontend use
      const categories: ProductCategory[] = [];

      /**
       * Recursively flatten category tree
       * @param cats Array of category nodes
       * @param level Current depth level
       * @param parentId Parent category ID
       */
      function flattenCategories(
        cats: VtexCategoryNode[],
        level: number = 0,
        parentId: string | null = null
      ): void {
        if (!Array.isArray(cats)) {
          return;
        }

        cats.forEach(cat => {
          // Add current category
          categories.push({
            id: cat.id?.toString() || cat.Id?.toString(),
            name: cat.name || cat.Name || 'Unnamed Category',
            parentId: parentId,
            level: level
          });

          // Process children recursively
          const children = cat.children || cat.Children || [];
          if (children.length > 0) {
            flattenCategories(
              children,
              level + 1,
              cat.id?.toString() || cat.Id?.toString()
            );
          }
        });
      }

      flattenCategories(response.data);

      console.log(`[VTEX Service] Successfully fetched ${categories.length} categories`);

      return categories;

    } catch (error: any) {
      console.error('[VTEX Service] Error fetching categories:', error.message);

      if (error.response?.status === 401) {
        throw new Error('VTEX authentication failed. Please check your App Key and App Token.');
      }

      if (error.response?.status === 403) {
        throw new Error('VTEX access denied. Ensure your App Key has catalog read permissions.');
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('VTEX API request timed out. Please try again.');
      }

      throw new Error(`Failed to fetch VTEX categories: ${error.message}`);
    }
  }

  /**
   * Fetch brand list from VTEX Catalog API
   *
   * API Endpoint: GET /api/catalog_system/pvt/brand/list
   * Documentation: https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/brand/list
   *
   * @param credentials VTEX account credentials
   * @returns Array of active brands
   */
  static async fetchBrands(credentials: VtexCredentials): Promise<ProductBrand[]> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials: account_name, app_key, or app_token');
      }

      const cleanAccount = this.cleanAccountName(account_name);

      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/brand/list`;

      console.log(`[VTEX Service] Fetching brands from: ${cleanAccount}`);

      const response = await axios.get<VtexBrandResponse[]>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      if (!Array.isArray(response.data)) {
        console.warn('[VTEX Service] Unexpected brand list format');
        return [];
      }

      // Filter only active brands and map to our interface
      const brands: ProductBrand[] = response.data
        .filter((brand: VtexBrandResponse) => brand.isActive !== false && brand.IsActive !== false)
        .map((brand: VtexBrandResponse): ProductBrand => ({
          id: brand.id?.toString() || brand.Id?.toString() || '',
          name: brand.name || brand.Name || 'Unnamed Brand'
        }))
        .filter((brand: ProductBrand) => brand.id && brand.name); // Remove any invalid entries

      console.log(`[VTEX Service] Successfully fetched ${brands.length} active brands`);

      return brands;

    } catch (error: any) {
      console.error('[VTEX Service] Error fetching brands:', error.message);

      if (error.response?.status === 401) {
        throw new Error('VTEX authentication failed. Please check your App Key and App Token.');
      }

      if (error.response?.status === 403) {
        throw new Error('VTEX access denied. Ensure your App Key has catalog read permissions.');
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('VTEX API request timed out. Please try again.');
      }

      throw new Error(`Failed to fetch VTEX brands: ${error.message}`);
    }
  }

  /**
   * Get estimated total product count from VTEX
   * Makes a minimal API call to get pagination headers
   *
   * @param credentials VTEX account credentials
   * @returns Estimated total product count
   */
  static async getEstimatedProductCount(
    credentials: VtexCredentials
  ): Promise<number> {
    try {
      // Make a minimal API call (just fetch 1 product) to get total count from headers
      const response = await this.fetchProductAndSkuIds(credentials, 1, 1);
      return response.range?.total || 0;
    } catch (error: any) {
      console.error('[VTEX Service] Error getting estimated product count:', error.message);
      throw error;
    }
  }

  /**
   * Fetch paginated list of product and SKU IDs
   *
   * API Endpoint: GET /api/catalog_system/pvt/products/GetProductAndSkuIds
   * Documentation: https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/products/GetProductAndSkuIds
   *
   * @param credentials VTEX account credentials
   * @param page Page number (1-based)
   * @param pageSize Number of products per page (max 100)
   * @returns Product and SKU IDs with pagination info
   */
  static async fetchProductAndSkuIds(
    credentials: VtexCredentials,
    page: number = 1,
    pageSize: number = 100
  ): Promise<VtexProductAndSkuIdsResponse> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials: account_name, app_key, or app_token');
      }

      const cleanAccount = this.cleanAccountName(account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/products/GetProductAndSkuIds`;

      // Calculate _from and _to for VTEX pagination (1-indexed)
      const from = (page - 1) * pageSize + 1;
      const to = page * pageSize;

      console.log(`[VTEX Service] Fetching product IDs - Page ${page} (_from=${from}, _to=${to})`);

      const response = await axios.get<VtexProductAndSkuIdsRawResponse>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        params: {
          _from: from,
          _to: to
        },
        timeout: 30000
      });

      // Transform VTEX object response to array format
      // VTEX returns: { data: { "1": [skuIds], "2": [skuIds] }, range: {...} }
      // We transform to: { data: [{ productId, skuIds }], range: {...} }
      const transformedData = Object.entries(response.data.data || {}).map(([productId, skuIds]) => ({
        productId: parseInt(productId),
        skuIds: skuIds
      }));

      console.log(`[VTEX Service] Fetched ${transformedData.length} product IDs (Total: ${response.data.range?.total || 0})`);

      return {
        data: transformedData,
        range: response.data.range
      };

    } catch (error: any) {
      console.error('[VTEX Service] Error fetching product IDs:', error.message);

      if (error.response?.status === 401) {
        throw new Error('VTEX authentication failed. Please check your App Key and App Token.');
      }

      if (error.response?.status === 403) {
        throw new Error('VTEX access denied. Ensure your App Key has catalog read permissions.');
      }

      throw new Error(`Failed to fetch VTEX product IDs: ${error.message}`);
    }
  }

  /**
   * Fetch product details by product ID
   *
   * API Endpoint: GET /api/catalog_system/pvt/products/ProductGet/{productId}
   * Documentation: https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/products/ProductGet/-productId-
   *
   * @param credentials VTEX account credentials
   * @param productId VTEX product ID
   * @returns Product metadata
   */
  static async fetchProductDetails(
    credentials: VtexCredentials,
    productId: number
  ): Promise<VtexProductDetailsResponse> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials');
      }

      const cleanAccount = this.cleanAccountName(account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/products/ProductGet/${productId}`;

      const response = await axios.get<VtexProductDetailsResponse>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;

    } catch (error: any) {
      console.error(`[VTEX Service] Error fetching product ${productId}:`, error.message);
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }
  }

  /**
   * Fetch SKU details by SKU ID
   *
   * API Endpoint: GET /api/catalog_system/pvt/sku/stockkeepingunitbyid/{skuId}
   * Documentation: https://developers.vtex.com/docs/api-reference/catalog-api#get-/api/catalog_system/pvt/sku/stockkeepingunitbyid/-skuId-
   *
   * @param credentials VTEX account credentials
   * @param skuId VTEX SKU ID
   * @returns Complete SKU details
   */
  static async fetchSkuDetails(
    credentials: VtexCredentials,
    skuId: number
  ): Promise<VtexSkuDetailsResponse> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials');
      }

      const cleanAccount = this.cleanAccountName(account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pvt/sku/stockkeepingunitbyid/${skuId}`;

      const response = await axios.get<VtexSkuDetailsResponse>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;

    } catch (error: any) {
      console.error(`[VTEX Service] Error fetching SKU ${skuId}:`, error.message);
      throw new Error(`Failed to fetch SKU ${skuId}: ${error.message}`);
    }
  }

  /**
   * Fetch pricing for a SKU
   *
   * API Endpoint: GET /api/pricing/prices/{skuId}
   * Documentation: https://developers.vtex.com/docs/api-reference/pricing-api#get-/prices/-itemId-
   *
   * @param credentials VTEX account credentials
   * @param skuId VTEX SKU ID
   * @returns Pricing information (may be null if no pricing configured)
   */
  static async fetchPricing(
    credentials: VtexCredentials,
    skuId: number
  ): Promise<VtexPricingResponse | null> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials');
      }

      const cleanAccount = this.cleanAccountName(account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/pricing/prices/${skuId}`;

      const response = await axios.get<VtexPricingResponse>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;

    } catch (error: any) {
      // Pricing may not be configured for all SKUs, don't throw error
      if (error.response?.status === 404) {
        console.warn(`[VTEX Service] No pricing found for SKU ${skuId}`);
        return null;
      }

      console.error(`[VTEX Service] Error fetching pricing for SKU ${skuId}:`, error.message);
      return null; // Return null instead of throwing to allow sync to continue
    }
  }

  /**
   * Fetch inventory for a SKU
   *
   * API Endpoint: GET /api/logistics/pvt/inventory/skus/{skuId}
   * Documentation: https://developers.vtex.com/docs/api-reference/logistics-api#get-/api/logistics/pvt/inventory/skus/-skuId-
   *
   * @param credentials VTEX account credentials
   * @param skuId VTEX SKU ID
   * @returns Inventory information (may be null if no inventory configured)
   */
  static async fetchInventory(
    credentials: VtexCredentials,
    skuId: number
  ): Promise<VtexInventoryResponse | null> {
    try {
      const { account_name, app_key, app_token } = credentials;

      if (!account_name || !app_key || !app_token) {
        throw new Error('Missing required VTEX credentials');
      }

      const cleanAccount = this.cleanAccountName(account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/logistics/pvt/inventory/skus/${skuId}`;

      const response = await axios.get<VtexInventoryResponse>(url, {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      return response.data;

    } catch (error: any) {
      // Inventory may not be configured for all SKUs, don't throw error
      if (error.response?.status === 404) {
        console.warn(`[VTEX Service] No inventory found for SKU ${skuId}`);
        return null;
      }

      console.error(`[VTEX Service] Error fetching inventory for SKU ${skuId}:`, error.message);
      return null; // Return null instead of throwing to allow sync to continue
    }
  }

  /**
   * Fetch complete product data including pricing and inventory
   *
   * Orchestrates multiple API calls to get complete product information:
   * 1. Product details (metadata, categories, brand)
   * 2. SKU details (images, specifications, dimensions)
   * 3. Pricing (list price, cost, sale price)
   * 4. Inventory (stock levels across warehouses)
   *
   * @param credentials VTEX account credentials
   * @param productId VTEX product ID
   * @param skuId VTEX SKU ID (primary SKU)
   * @returns Complete product data
   */
  static async fetchCompleteProductData(
    credentials: VtexCredentials,
    productId: number,
    skuId: number
  ): Promise<VtexCompleteProduct> {
    try {
      console.log(`[VTEX Service] Fetching complete data for product ${productId}, SKU ${skuId}`);

      // Fetch all data in parallel for better performance
      const [product, sku, pricing, inventory] = await Promise.all([
        this.fetchProductDetails(credentials, productId),
        this.fetchSkuDetails(credentials, skuId),
        this.fetchPricing(credentials, skuId),
        this.fetchInventory(credentials, skuId)
      ]);

      return {
        product,
        sku,
        pricing,
        inventory
      };

    } catch (error: any) {
      console.error(`[VTEX Service] Error fetching complete product data:`, error.message);
      throw new Error(`Failed to fetch complete product data: ${error.message}`);
    }
  }

  /**
   * Check if category has at least one product in VTEX
   *
   * Uses VTEX's public search endpoint to verify if a category has products.
   * Returns 1 if category has products, 0 if empty.
   *
   * @param credentials VTEX account credentials
   * @param categoryId Category ID to check
   * @returns 1 if has products, 0 if empty
   */
  static async fetchCategoryProductCount(
    credentials: VtexCredentials,
    categoryId: string
  ): Promise<number> {
    try {
      const cleanAccount = this.cleanAccountName(credentials.account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pub/products/search`;

      const response = await axios.get(url, {
        params: {
          fq: `C:/${categoryId}/`,
          '_from': 0,
          '_to': 0  // Only need to check existence
        },
        headers: {
          'Accept': 'application/json',
          'REST-Range': 'resources=0-0'
        },
        timeout: 10000
      });

      // Return 1 if has products, 0 if empty
      const hasProducts = Array.isArray(response.data) && response.data.length > 0;
      return hasProducts ? 1 : 0;

    } catch (error: any) {
      if (error.response?.status === 404) {
        return 0;
      }
      console.error(`[VTEX Service] Error checking category ${categoryId}:`, error.message);
      return 0;
    }
  }

  /**
   * Check if brand has at least one product in VTEX
   *
   * Uses VTEX's public search endpoint to verify if a brand has products.
   * Returns 1 if brand has products, 0 if empty.
   *
   * @param credentials VTEX account credentials
   * @param brandId Brand ID to check
   * @returns 1 if has products, 0 if empty
   */
  static async fetchBrandProductCount(
    credentials: VtexCredentials,
    brandId: string
  ): Promise<number> {
    try {
      const cleanAccount = this.cleanAccountName(credentials.account_name);
      const url = `https://${cleanAccount}.vtexcommercestable.com.br/api/catalog_system/pub/products/search`;

      const response = await axios.get(url, {
        params: {
          fq: `B:/${brandId}/`,
          '_from': 0,
          '_to': 0  // Only need to check existence
        },
        headers: {
          'Accept': 'application/json',
          'REST-Range': 'resources=0-0'
        },
        timeout: 10000
      });

      // Return 1 if has products, 0 if empty
      const hasProducts = Array.isArray(response.data) && response.data.length > 0;
      return hasProducts ? 1 : 0;

    } catch (error: any) {
      if (error.response?.status === 404) {
        return 0;
      }
      console.error(`[VTEX Service] Error checking brand ${brandId}:`, error.message);
      return 0;
    }
  }

  /**
   * Get categories with product counts (uses cache)
   *
   * Fetches categories and their product counts, using cached data when available.
   * Cache expires after 24 hours or can be manually invalidated.
   *
   * @param credentials VTEX account credentials
   * @param storeConnectionId Store connection ID for cache key
   * @param workspaceId Workspace ID
   * @param forceRefresh Force refresh cache even if valid
   * @returns Categories with product counts
   */
  static async getCategoriesWithCount(
    credentials: VtexCredentials,
    storeConnectionId: Types.ObjectId,
    workspaceId: Types.ObjectId,
    forceRefresh: boolean = false
  ): Promise<ICatalogCacheItem[]> {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await MarketplaceCatalogCache.findValidCache(storeConnectionId, 'category');

        if (cachedData && !cachedData.isExpired()) {
          const categoriesWithProducts = cachedData.items.filter(item => item.productCount > 0);
          console.log(`[VTEX Service] Using cached category counts (${categoriesWithProducts.length} categories with products)`);
          return categoriesWithProducts;
        }
      }

      console.log(`[VTEX Service] Fetching fresh category counts...`);

      // Fetch all categories (without counts)
      const categories = await this.fetchCategories(credentials);

      console.log(`[VTEX Service] Fetched ${categories.length} categories, counting products...`);

      // Fetch product counts for each category (in parallel with limit)
      const BATCH_SIZE = 5; // Process 5 at a time to avoid overwhelming the API
      const categoriesWithCount: ICatalogCacheItem[] = [];

      for (let i = 0; i < categories.length; i += BATCH_SIZE) {
        const batch = categories.slice(i, i + BATCH_SIZE);

        const countsPromises = batch.map(async (category) => {
          const count = await this.fetchCategoryProductCount(credentials, category.id);
          return {
            id: category.id,
            name: category.name,
            productCount: count,
            parentId: category.parentId,
            level: category.level
          };
        });

        const batchResults = await Promise.all(countsPromises);
        categoriesWithCount.push(...batchResults);

        console.log(`[VTEX Service] Processed ${categoriesWithCount.length}/${categories.length} categories`);
      }

      // Filter out categories with 0 products
      const categoriesWithProducts = categoriesWithCount.filter(c => c.productCount > 0);
      const filteredCount = categoriesWithCount.length - categoriesWithProducts.length;

      console.log(`[VTEX Service] Filtered to ${categoriesWithProducts.length} categories with products (excluded ${filteredCount} empty categories)`);

      // Save to cache (TTL 24 hours) - only categories with products
      await MarketplaceCatalogCache.createOrUpdate(
        storeConnectionId,
        workspaceId,
        'vtex',
        'category',
        categoriesWithProducts,
        24 // 24 hours TTL
      );

      console.log(`[VTEX Service] Cached ${categoriesWithProducts.length} categories with counts`);

      return categoriesWithProducts;

    } catch (error: any) {
      console.error('[VTEX Service] Error getting categories with count:', error.message);
      throw new Error(`Failed to get categories with count: ${error.message}`);
    }
  }

  /**
   * Get brands with product counts (uses cache)
   *
   * Fetches brands and their product counts, using cached data when available.
   *
   * @param credentials VTEX account credentials
   * @param storeConnectionId Store connection ID for cache key
   * @param workspaceId Workspace ID
   * @param forceRefresh Force refresh cache even if valid
   * @returns Brands with product counts
   */
  static async getBrandsWithCount(
    credentials: VtexCredentials,
    storeConnectionId: Types.ObjectId,
    workspaceId: Types.ObjectId,
    forceRefresh: boolean = false
  ): Promise<ICatalogCacheItem[]> {
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await MarketplaceCatalogCache.findValidCache(storeConnectionId, 'brand');

        if (cachedData && !cachedData.isExpired()) {
          const brandsWithProducts = cachedData.items.filter(item => item.productCount > 0);
          console.log(`[VTEX Service] Using cached brand counts (${brandsWithProducts.length} brands with products)`);
          return brandsWithProducts;
        }
      }

      console.log(`[VTEX Service] Fetching fresh brand counts...`);

      // Fetch all brands (without counts)
      const brands = await this.fetchBrands(credentials);

      console.log(`[VTEX Service] Fetched ${brands.length} brands, counting products...`);

      // Fetch product counts for each brand (in parallel with limit)
      const BATCH_SIZE = 5; // Process 5 at a time
      const brandsWithCount: ICatalogCacheItem[] = [];

      for (let i = 0; i < brands.length; i += BATCH_SIZE) {
        const batch = brands.slice(i, i + BATCH_SIZE);

        const countsPromises = batch.map(async (brand) => {
          const count = await this.fetchBrandProductCount(credentials, brand.id);
          return {
            id: brand.id,
            name: brand.name,
            productCount: count
          };
        });

        const batchResults = await Promise.all(countsPromises);
        brandsWithCount.push(...batchResults);

        console.log(`[VTEX Service] Processed ${brandsWithCount.length}/${brands.length} brands`);
      }

      // Filter out brands with 0 products
      const brandsWithProducts = brandsWithCount.filter(b => b.productCount > 0);
      const filteredCount = brandsWithCount.length - brandsWithProducts.length;

      console.log(`[VTEX Service] Filtered to ${brandsWithProducts.length} brands with products (excluded ${filteredCount} empty brands)`);

      // Save to cache (TTL 24 hours) - only brands with products
      await MarketplaceCatalogCache.createOrUpdate(
        storeConnectionId,
        workspaceId,
        'vtex',
        'brand',
        brandsWithProducts,
        24 // 24 hours TTL
      );

      console.log(`[VTEX Service] Cached ${brandsWithProducts.length} brands with counts`);

      return brandsWithProducts;

    } catch (error: any) {
      console.error('[VTEX Service] Error getting brands with count:', error.message);
      throw new Error(`Failed to get brands with count: ${error.message}`);
    }
  }

}
