import express, { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import axios from 'axios';
import { Types } from 'mongoose';
import { PlatformType } from '../models/Product';
import Product from '../models/Product';
import StoreConnection from '@/stores/models/StoreConnection';
import { protect, trackUsage, checkSubscriptionStatus, checkUsageLimits, checkSyncFrequency, requireFeature } from '@/common/middleware/auth';
import syncRoutes from './sync';
import historyRoutes from './history';
import ProductHistoryService from '../services/ProductHistoryService';
import { VtexService, VtexCompleteProduct } from '@/marketplaces/services/vtexService';
import { VtexCredentials } from '@/marketplaces/services/marketplaceService';
import { ProductSyncFilters, FetchProductsOptions, FetchProductsResult } from '@/common/types/syncFilters';
import { applyVtexFilters } from '@/common/utils/vtexFilters';
import MarketplaceCatalogCache from '@/common/models/MarketplaceCatalogCache';

const router = express.Router();

// Mount sync routes BEFORE dynamic :connectionId route to avoid routing conflicts
// This ensures /sync/start, /sync/health, etc. are matched before /sync/:connectionId
router.use('/sync', syncRoutes);

// Helper function to generate marketplace URLs
function generateMarketplaceUrl(product: any): string | null {
  if (!product.marketplace || !product.externalId) return null;
  
  const marketplace = product.marketplace.toLowerCase();
  const storeConnectionId = product.storeConnectionId;
  
  switch (marketplace) {
    case 'shopify':
      // For Shopify, we need the shop domain from credentials
      if (storeConnectionId?.credentials?.shop_url) {
        const shopUrl = storeConnectionId.credentials.shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const productId = product.externalId.replace('gid://shopify/Product/', '');
        return `https://${shopUrl}/admin/products/${productId}`;
      }
      return null;
    case 'amazon':
      // Amazon product URLs are complex and require marketplace-specific domains
      return `https://sellercentral.amazon.com/inventory`;
    case 'vtex':
      if (storeConnectionId?.credentials?.account_name) {
        const productId = product.externalId;
        return `https://${storeConnectionId.credentials.account_name}.vtexcommercestable.com.br/admin/Site/ProdutoForm.aspx?IdProduto=${productId}`;
      }
      return null;
    case 'mercadolibre':
      return `https://listado.mercadolibre.com.ar/administracion/mis-publicaciones/article/${product.externalId}`;
    case 'facebook_shop':
      return `https://business.facebook.com/commerce/`;
    case 'google_shopping':
      return `https://merchants.google.com/mc/products/`;
    case 'woocommerce':
      if (storeConnectionId?.credentials?.site_url) {
        const siteUrl = storeConnectionId.credentials.site_url.replace(/\/$/, '');
        return `${siteUrl}/wp-admin/post.php?post=${product.externalId}&action=edit`;
      }
      return null;
    default:
      return null;
  }
}

// Interface definitions
interface ProductQuery {
  page?: string;
  limit?: string;
  search?: string;
  marketplace?: string;
  store?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
}

interface SyncProductsBody {
  force?: boolean;
}

interface UpdateDescriptionBody {
  description: string;
}

interface ApplyDescriptionBody {
  description: string;
  marketplace: string;
}

// Get all products for a user with pagination, filtering, and sorting
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      await trackUsage('api_call')(req, res, async () => {
        const {
          page = '1',
          limit = '20',
          search = '',
          marketplace = '',
          store = '',
          sortBy = 'createdAt',
          sortOrder = 'desc',
          status = ''
        } = req.query as any;

        
        // Build query filter
        const filter: any = { workspaceId: req.workspace!._id };
        
        if (search) {
          filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { sku: { $regex: search, $options: 'i' } },
            { handle: { $regex: search, $options: 'i' } }
          ];
        }
        
        if (marketplace) {
          filter.marketplace = marketplace;
        }
        
        if (store) {
          filter.storeConnectionId = store;
        }
        
        if (status) {
          filter.status = { $regex: status, $options: 'i' };
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get products with pagination
        const [products, totalCount] = await Promise.all([
          Product.find(filter)
            .populate('storeConnectionId', 'storeName marketplaceType isActive credentials')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit)),
          Product.countDocuments(filter)
        ]);

        // Get marketplace statistics
        const marketplaceStats = await Product.aggregate([
          { $match: { workspaceId: req.workspace!._id } },
          {
            $group: {
              _id: '$marketplace',
              count: { $sum: 1 }
            }
          }
        ]);

        const totalPages = Math.ceil(totalCount / parseInt(limit));

        // Ensure products have both _id and id fields for frontend compatibility
        const formattedProducts = products.map((product: any) => {
          const productObj = product.toObject ? product.toObject() : product;
          return {
            ...productObj,
            id: productObj._id.toString(),
            _id: productObj._id.toString(),
            isMarketplaceConnected: productObj.storeConnectionId?.isActive || false,
            marketplaceUrl: productObj.marketplaceUrl || generateMarketplaceUrl(productObj)
          };
        });

        res.json({
          success: true,
          data: {
            products: formattedProducts,
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalCount,
              limit: parseInt(limit),
              hasNext: parseInt(page) < totalPages,
              hasPrev: parseInt(page) > 1
            },
            filters: {
              marketplaces: marketplaceStats.map((stat: any) => ({
                marketplace: stat._id,
                count: stat.count
              }))
            }
          }
        });
      });
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

// Get products for a specific store connection
router.get('/store/:connectionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      await trackUsage('api_call')(req, res, async () => {
        const { connectionId } = req.params;
        
                        
        // Verify user owns the store connection
        const connection = await StoreConnection.findOne({
          _id: connectionId,
          workspaceId: req.workspace!._id
        });

        if (!connection) {
          return res.status(404).json({
            success: false,
            message: 'Store connection not found'
          });
        }

        const products = await Product.find({ 
          workspaceId: req.workspace!._id,
          storeConnectionId: connectionId
        }).sort({ createdAt: -1 });

        res.json({
          success: true,
          data: products
        });
      });
    });
  } catch (error: any) {
    console.error('Error fetching store products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store products',
      error: error.message
    });
  }
});

// Get product count for a specific store connection
router.get('/store/:connectionId/count', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      await trackUsage('api_call')(req, res, async () => {
        const { connectionId } = req.params;
        
                        
        // Verify user owns the store connection
        const connection = await StoreConnection.findOne({
          _id: connectionId,
          workspaceId: req.workspace!._id
        });

        if (!connection) {
          return res.status(404).json({
            success: false,
            message: 'Store connection not found'
          });
        }

        const count = await Product.countDocuments({ 
          workspaceId: req.workspace!._id,
          storeConnectionId: connectionId
        });

        res.json({
          success: true,
          data: {
            hasProducts: count > 0,
            count: count
          }
        });
      });
    });
  } catch (error: any) {
    console.error('Error getting store product count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get store product count',
      error: error.message
    });
  }
});

// Sync products from a marketplace
router.post('/sync/:connectionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      await checkSubscriptionStatus(req, res, async () => {
        await checkSyncFrequency()(req, res, async () => {
          await trackUsage('products_sync')(req, res, async () => {
            await trackUsage('api_call')(req, res, async () => {
              const { connectionId } = req.params;
              const { force = false, filters } = req.body;

              // Verify user owns the store connection
              const connection = await StoreConnection.findOne({
                _id: connectionId,
                workspaceId: req.workspace!._id
              });

              if (!connection) {
                return res.status(404).json({
                  success: false,
                  message: 'Store connection not found'
                });
              }

              let deletedProducts = 0;

              // If force sync, delete all existing products for this connection first
              if (force) {
                const deleteResult = await Product.deleteMany({
                  workspaceId: req.workspace!._id,
                  storeConnectionId: connectionId
                });
                deletedProducts = deleteResult.deletedCount;
                console.log(`Force sync: Deleted ${deletedProducts} existing products for connection ${connectionId}`);
              }

              // Sync products based on marketplace type
              const result = await syncProductsFromMarketplace(
                connection.marketplaceType,
                connection.credentials,
                req.user!._id.toString(),
                req.workspace!._id.toString(),
                connectionId,
                filters,
                force
              );

              // Update connection metadata
              connection.lastSync = new Date();
              connection.syncStatus = 'completed';
              await connection.save();

              // Invalidate category/brand cache after successful sync
              // This ensures next fetch will show updated data
              await MarketplaceCatalogCache.invalidateAll(new Types.ObjectId(connection._id.toString()));
              console.log(`[Product Sync] Invalidated catalog cache for connection ${connectionId}`);

              const responseMessage = force
                ? `Successfully replaced ${deletedProducts} products with ${result.totalProducts} fresh products from ${connection.marketplaceType}`
                : `Successfully synced ${result.totalProducts} products from ${connection.marketplaceType}`;

              res.json({
                success: true,
                message: responseMessage,
                data: {
                  totalProducts: result.totalProducts,
                  newProducts: result.newProducts,
                  updatedProducts: result.updatedProducts,
                  deletedProducts: force ? deletedProducts : 0,
                  isForceSync: force
                }
              });
            });
          });
        });
      });
    });
  } catch (error: any) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync products',
      error: error.message
    });
  }
});

// Helper functions for product sync
async function syncProductsFromMarketplace(
  type: string,
  credentials: any,
  userId: string,
  workspaceId: string,
  connectionId: string,
  filters?: ProductSyncFilters,
  force: boolean = false
) {
  switch (type) {
    case 'shopify':
      // Shopify sync doesn't support filters yet, pass undefined
      return await syncShopifyProducts(credentials, userId, workspaceId, connectionId, force);
    case 'vtex':
      return await syncVtexProducts(credentials, userId, workspaceId, connectionId, filters, force);
    default:
      throw new Error(`Product sync not implemented for ${type}`);
  }
}

async function syncShopifyProducts(
  credentials: any, 
  userId: string,
  workspaceId: string,
  connectionId: string, 
  force: boolean = false
) {
  const { shop_url, access_token } = credentials;
  
  if (!shop_url || !access_token) {
    throw new Error('Shop URL and access token are required for Shopify sync');
  }

  // Extract store name from shop_url
  let storeName = shop_url;
  
  // Remove protocol if present
  storeName = storeName.replace(/^https?:\/\//, '');
  
  // Remove trailing slash if present
  storeName = storeName.replace(/\/$/, '');
  
  // Remove .myshopify.com if present
  storeName = storeName.replace(/\.myshopify\.com$/, '');
  
  console.log('Processed shop_url:', shop_url, '-> storeName:', storeName);

  try {
    let hasNextPage = true;
    let cursor = null;
    let totalProducts = 0;
    let newProducts = 0;
    let updatedProducts = 0;
    const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

    console.log('Starting Shopify sync for user:', userId, 'store:', storeName);

    while (hasNextPage) {
      const response = await queryShopifyGraphQL(apiUrl, access_token, cursor);
      const products = (response as any).data.products.edges;
      
      console.log(`Retrieved ${products.length} products from Shopify`);
      
      for (const productEdge of products) {
        // Log product status for debugging
        console.log(`Product: ${productEdge.node.title}, Status: ${productEdge.node.status}`);

        // Skip draft products - only sync active products
        // Shopify status values are: ACTIVE, ARCHIVED, DRAFT
        if (productEdge.node.status === 'DRAFT' || productEdge.node.status === 'ARCHIVED') {
          console.log(`Skipping non-active product: ${productEdge.node.title} (Status: ${productEdge.node.status})`);
          continue;
        }

        const syncResult = await saveShopifyProduct(productEdge.node, userId, workspaceId, connectionId);
        totalProducts++;
        if (syncResult.isNew) {
          newProducts++;
        } else {
          updatedProducts++;
        }
      }

      hasNextPage = (response as any).data.products.pageInfo.hasNextPage;
      cursor = (response as any).data.products.pageInfo.endCursor;
      
      console.log(`Synced ${totalProducts} products so far...`);
    }

    // Clean up any draft products that may have been synced previously
    const draftCleanup = await Product.deleteMany({
      workspaceId,
      storeConnectionId: connectionId,
      'platforms.platform': 'shopify',
      'platforms.platformStatus': { $in: ['DRAFT', 'ARCHIVED'] }
    });

    if (draftCleanup.deletedCount > 0) {
      console.log(`Cleaned up ${draftCleanup.deletedCount} draft/archived products from database`);
    }

    console.log(`Shopify sync completed. Total: ${totalProducts}, New: ${newProducts}, Updated: ${updatedProducts}`);
    return { success: true, totalProducts, newProducts, updatedProducts };
  } catch (error) {
    console.error('Error syncing Shopify products:', error);
    throw error;
  }
}

async function queryShopifyGraphQL(apiUrl: string, accessToken: string, cursor: string | null) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges {
          node {
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
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const variables = {
    first: 50,
    after: cursor
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Shopify API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  if ((data as any).errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify((data as any).errors)}`);
  }

  return data;
}

async function saveShopifyProduct(shopifyProduct: any, userId: string, workspaceId: string, connectionId: string) {
    
  try {
    // Find existing product by Shopify ID or title
    const existingProduct = await Product.findOne({
      workspaceId: workspaceId,
      $or: [
        { shopifyId: shopifyProduct.id },
        { 'platforms.platformId': shopifyProduct.id },
        { title: shopifyProduct.title, storeConnectionId: connectionId }
      ]
    });

    const shopifyPlatform = {
      platform: 'shopify' as PlatformType,
      platformId: shopifyProduct.id,
      platformSku: shopifyProduct.handle,
      platformPrice: shopifyProduct.variants.edges[0]?.node.price ? parseFloat(shopifyProduct.variants.edges[0].node.price) : undefined,
      platformInventory: shopifyProduct.variants.edges.reduce((sum: number, edge: any) => sum + (edge.node.inventoryQuantity || 0), 0),
      platformStatus: shopifyProduct.status,
      lastSyncAt: new Date()
    };

    let isNew = false;

    if (existingProduct) {
      // Update existing product with ALL data from Shopify
      const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'shopify');

      if (platformIndex >= 0) {
        existingProduct.platforms[platformIndex] = shopifyPlatform;
      } else {
        existingProduct.platforms.push(shopifyPlatform);
      }

      // Always update ALL fields from Shopify (source of truth)
      existingProduct.title = shopifyProduct.title;
      existingProduct.description = shopifyProduct.description || '';
      existingProduct.price = shopifyProduct.variants.edges[0]?.node.price ? parseFloat(shopifyProduct.variants.edges[0].node.price) : 0;
      existingProduct.compareAtPrice = shopifyProduct.variants.edges[0]?.node.compareAtPrice ? parseFloat(shopifyProduct.variants.edges[0].node.compareAtPrice) : undefined;
      existingProduct.sku = shopifyProduct.handle;
      existingProduct.inventory = shopifyProduct.variants.edges.reduce((sum: number, edge: any) => sum + (edge.node.inventoryQuantity || 0), 0);
      existingProduct.vendor = shopifyProduct.vendor || '';
      existingProduct.productType = shopifyProduct.productType || '';
      existingProduct.tags = shopifyProduct.tags || [];

      // Always update images from Shopify
      existingProduct.images = shopifyProduct.images.edges.map((edge: any) => ({
        shopifyId: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText || ''
      }));

      // Always update variants from Shopify
      existingProduct.variants = shopifyProduct.variants.edges.map((edge: any) => ({
        id: edge.node.id,
        shopifyId: edge.node.id,
        title: edge.node.title,
        price: edge.node.price || '0',
        compareAtPrice: edge.node.compareAtPrice || undefined,
        sku: edge.node.sku || '',
        inventory: edge.node.inventoryQuantity || 0,
        inventoryQuantity: edge.node.inventoryQuantity || 0
      }));

      // Update status based on Shopify status
      existingProduct.status = shopifyProduct.status === 'ACTIVE' ? 'active' : 'archived';

      // Update Shopify-specific fields
      existingProduct.shopifyId = shopifyProduct.id;
      existingProduct.handle = shopifyProduct.handle;
      existingProduct.shopifyUpdatedAt = new Date(shopifyProduct.updatedAt);
      existingProduct.lastSyncedAt = new Date();

      await existingProduct.save();
    } else {
      // Create new product
      isNew = true;
      const newProduct = new Product({
        workspaceId,
        userId,
        storeConnectionId: connectionId,
        title: shopifyProduct.title,
        description: shopifyProduct.description || '',
        price: shopifyProduct.variants.edges[0]?.node.price ? parseFloat(shopifyProduct.variants.edges[0].node.price) : 0,
        compareAtPrice: shopifyProduct.variants.edges[0]?.node.compareAtPrice ? parseFloat(shopifyProduct.variants.edges[0].node.compareAtPrice) : undefined,
        sku: shopifyProduct.handle,
        inventory: shopifyProduct.variants.edges.reduce((sum: number, edge: any) => sum + (edge.node.inventoryQuantity || 0), 0),
        vendor: shopifyProduct.vendor || '',
        productType: shopifyProduct.productType || '',
        tags: shopifyProduct.tags || [],
        images: shopifyProduct.images.edges.map((edge: any) => ({
          shopifyId: edge.node.id,
          url: edge.node.url,
          altText: edge.node.altText || ''
        })),
        variants: shopifyProduct.variants.edges.map((edge: any) => ({
          id: edge.node.id,
          shopifyId: edge.node.id,
          title: edge.node.title,
          price: edge.node.price || '0',
          compareAtPrice: edge.node.compareAtPrice || undefined,
          sku: edge.node.sku || '',
          inventory: edge.node.inventoryQuantity || 0,
          inventoryQuantity: edge.node.inventoryQuantity || 0
        })),
        platforms: [shopifyPlatform],
        status: 'active',
        shopifyId: shopifyProduct.id,
        handle: shopifyProduct.handle,
        shopifyCreatedAt: new Date(shopifyProduct.createdAt),
        shopifyUpdatedAt: new Date(shopifyProduct.updatedAt),
        // Legacy fields for backward compatibility
        marketplace: 'shopify',
        externalId: shopifyProduct.id,
        stock: shopifyProduct.variants.edges.reduce((sum: number, edge: any) => sum + (edge.node.inventoryQuantity || 0), 0),
        lastSyncedAt: new Date()
      });

      await newProduct.save();
    }

    console.log(`${isNew ? 'Created' : 'Updated'} product: ${shopifyProduct.title}`);
    return { isNew };
  } catch (error) {
    console.error(`Error saving product ${shopifyProduct.title}:`, error);
    throw error;
  }
}

/**
 * VTEX product synchronization with filter support
 *
 * Syncs products from VTEX using private APIs with complete data including:
 * - Product metadata and descriptions
 * - Pricing (list price, cost, sale price)
 * - Inventory levels across warehouses
 * - Images and specifications
 *
 * NOTE: Uses POST-FILTER approach - fetches all products via GetProductAndSkuIds
 * API (which doesn't support filters) and applies filters in memory. This means
 * it needs to scan through products to find matches. Current limit: 10,000 products.
 * For catalogs >10K with narrow filters, consider using Search API instead.
 *
 * @param credentials VTEX account credentials
 * @param userId User ID
 * @param workspaceId Workspace ID
 * @param connectionId Store connection ID
 * @param filters Optional filters to apply (active status, categories, brands)
 * @param force Force full resync
 * @returns Sync statistics
 */
async function syncVtexProducts(
  credentials: VtexCredentials,
  userId: string,
  workspaceId: string,
  connectionId: string,
  filters?: ProductSyncFilters,
  force: boolean = false
) {
  const { account_name, app_key, app_token } = credentials;

  if (!account_name || !app_key || !app_token) {
    throw new Error('Account name, app key, and app token are required for VTEX sync');
  }

  try {
    let totalProducts = 0;
    let newProducts = 0;
    let updatedProducts = 0;

    console.log(`[VTEX Sync] Starting sync for workspace: ${workspaceId}`);
    console.log(`[VTEX Sync] Filters:`, JSON.stringify(filters, null, 2));

    // Prepare fetch options with filters
    const fetchOptions: FetchProductsOptions = {
      filters: filters || {
        includeActive: true,
        includeInactive: false,
        categoryIds: null,
        brandIds: null
      },
      page: 1,
      pageSize: 50,
      maxProducts: 10000 // Increased limit to handle filtered syncs better
    };

    // Fetch products with pagination
    let hasMore = true;
    let currentPage = 1;

    while (hasMore && totalProducts < (fetchOptions.maxProducts || 10000)) {
      fetchOptions.page = currentPage;

      const result = await fetchVtexProducts(credentials, fetchOptions);

      console.log(`[VTEX Sync] Page ${currentPage}: Fetched ${result.products.length} filtered products`);

      for (const vtexProduct of result.products) {
        const syncResult = await saveVtexCompleteProduct(
          vtexProduct,
          userId,
          workspaceId,
          connectionId
        );

        totalProducts++;
        if (syncResult.isNew) {
          newProducts++;
        } else {
          updatedProducts++;
        }
      }

      hasMore = result.hasMore;
      currentPage = result.nextPage || currentPage + 1;

      // Avoid infinite loops - allow up to 200 pages (for 10000 products with pageSize=50)
      if (currentPage > 200) {
        console.warn('[VTEX Sync] Reached max page limit (200), stopping sync');
        break;
      }
    }

    console.log(`[VTEX Sync] Completed. Total: ${totalProducts}, New: ${newProducts}, Updated: ${updatedProducts}`);
    return { success: true, totalProducts, newProducts, updatedProducts };

  } catch (error) {
    console.error('[VTEX Sync] Error syncing VTEX products:', error);
    throw error;
  }
}

// Note: applyVtexFilters() is now imported from @/common/utils/vtexFilters

/**
 * Fetch VTEX products using private API with pagination and filters
 *
 * Uses the authenticated VTEX Catalog API to fetch complete product data including:
 * - Product and SKU metadata
 * - Pricing information
 * - Inventory levels
 * - Images and specifications
 *
 * @param credentials VTEX account credentials
 * @param options Fetch options including filters and pagination
 * @returns Paginated product results
 */
async function fetchVtexProducts(
  credentials: VtexCredentials,
  options: FetchProductsOptions
): Promise<FetchProductsResult> {
  try {
    const { filters, page = 1, pageSize = 50, maxProducts = 10000 } = options;

    console.log(`[VTEX] Fetching products - Page ${page}, Size ${pageSize}`);
    console.log(`[VTEX] Filters:`, JSON.stringify(filters, null, 2));

    // Step 1: Fetch product and SKU IDs using private API
    const productIdsResponse = await VtexService.fetchProductAndSkuIds(
      credentials,
      page,
      Math.min(pageSize, 100) // VTEX API max is 100
    );

    // Ensure productIdsResponse.data is always an array (handle null/undefined from VTEX API)
    const productIds = Array.isArray(productIdsResponse.data) ? productIdsResponse.data : [];

    if (productIds.length === 0) {
      console.log('[VTEX] No products found');
      return {
        products: [],
        totalCount: productIdsResponse.range?.total || 0,
        hasMore: false
      };
    }

    console.log(`[VTEX] Fetched ${productIds.length} product IDs (Total: ${productIdsResponse.range.total})`);

    // Step 2: Fetch complete data for each product
    const completeProducts: VtexCompleteProduct[] = [];

    for (const item of productIds) {
      // Each product may have multiple SKUs, we'll use the first one
      const primarySkuId = item.skuIds[0];

      if (!primarySkuId) {
        console.warn(`[VTEX] Product ${item.productId} has no SKUs, skipping`);
        continue;
      }

      try {
        const productData = await VtexService.fetchCompleteProductData(
          credentials,
          item.productId,
          primarySkuId
        );

        completeProducts.push(productData);

        // Respect maxProducts limit
        if (completeProducts.length >= maxProducts) {
          console.log(`[VTEX] Reached max products limit (${maxProducts})`);
          break;
        }
      } catch (error: any) {
        console.error(`[VTEX] Error fetching product ${item.productId}:`, error.message);
        // Continue with other products
      }
    }

    console.log(`[VTEX] Successfully fetched ${completeProducts.length} complete products`);

    // Step 3: Apply filters
    const filteredProducts = applyVtexFilters(completeProducts, filters);

    // Calculate pagination
    const currentPage = productIdsResponse.range.from / pageSize + 1;
    const totalPages = Math.ceil(productIdsResponse.range.total / pageSize);
    const hasMore = currentPage < totalPages;

    console.log(`[VTEX] Pagination: Page ${currentPage}/${totalPages}, Has more: ${hasMore}`);

    return {
      products: filteredProducts,
      totalCount: productIdsResponse.range.total,
      hasMore,
      nextPage: hasMore ? page + 1 : undefined
    };

  } catch (error: any) {
    console.error('[VTEX] Error fetching products:', error.message);
    throw new Error(`Failed to fetch VTEX products: ${error.message}`);
  }
}

/**
 * Save VTEX product with complete data (new private API format)
 *
 * Handles complete product data including pricing and inventory
 *
 * @param vtexProduct Complete VTEX product data
 * @param userId User ID
 * @param workspaceId Workspace ID
 * @param connectionId Store connection ID
 * @returns Sync result with isNew flag
 */
async function saveVtexCompleteProduct(
  vtexProduct: VtexCompleteProduct,
  userId: string,
  workspaceId: string,
  connectionId: string
) {
  try {
    const { product, sku, pricing, inventory } = vtexProduct;

    // Extract product data
    const productId = product.Id.toString();
    const skuId = sku.Id.toString();
    const productName = product.Name || sku.ProductName;
    const productReference = sku.AlternateIds?.RefId || product.RefId || '';

    // Calculate price from pricing data
    let price = 0;
    let compareAtPrice = 0;
    let cost = 0;

    if (pricing) {
      // Use fixed price if available, otherwise base price
      if (pricing.fixedPrices && pricing.fixedPrices.length > 0) {
        price = pricing.fixedPrices[0].value;
        compareAtPrice = pricing.fixedPrices[0].listPrice || pricing.listPrice || 0;
      } else {
        price = pricing.basePrice;
        compareAtPrice = pricing.listPrice || 0;
      }
      cost = pricing.costPrice || 0;
    }

    // Calculate inventory from warehouse data
    let totalInventory = 0;
    if (inventory && inventory.balance) {
      totalInventory = inventory.balance.reduce((total, warehouse) => {
        if (warehouse.hasUnlimitedQuantity) {
          return 999999; // Represent unlimited as large number
        }
        return total + (warehouse.availableQuantity || warehouse.totalQuantity || 0);
      }, 0);
    }

    // Extract images and map to IProductImage format
    const images = (sku.Images?.map(img => ({
      url: img.ImageUrl,
      altText: img.ImageName || undefined
    })) || []).filter(img => img.url);

    // If no images in array, try the single ImageUrl field
    if (images.length === 0 && sku.ImageUrl) {
      images.push({
        url: sku.ImageUrl,
        altText: sku.NameComplete || undefined
      });
    }

    // Determine product status
    const status = (product.IsActive && sku.IsActive) ? 'ACTIVE' : 'DRAFT';

    // Find existing product by VTEX product ID
    const existingProduct = await Product.findOne({
      workspaceId: workspaceId,
      'platforms.platformId': productId
    });

    const vtexPlatform = {
      platform: 'vtex' as PlatformType,
      platformId: productId,
      platformSku: skuId,
      platformPrice: price,
      platformInventory: totalInventory,
      platformStatus: status.toLowerCase(),
      lastSyncAt: new Date()
    };

    let isNew = false;

    if (existingProduct) {
      // Update existing product
      const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'vtex');

      if (platformIndex >= 0) {
        existingProduct.platforms[platformIndex] = vtexPlatform;
      } else {
        existingProduct.platforms.push(vtexPlatform);
      }

      // Update product fields with latest data
      existingProduct.title = productName;
      existingProduct.description = product.Description || product.DescriptionShort || '';
      existingProduct.price = price;
      existingProduct.sku = productReference;
      existingProduct.inventory = totalInventory;
      existingProduct.vendor = sku.BrandName || '';
      existingProduct.images = images;
      existingProduct.status = status;
      existingProduct.stock = totalInventory;
      existingProduct.lastSyncedAt = new Date();

      await existingProduct.save();

    } else {
      // Create new product
      isNew = true;

      await Product.create({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        storeConnectionId: new Types.ObjectId(connectionId),
        title: productName,
        description: product.Description || product.DescriptionShort || '',
        price: price,
        sku: productReference,
        inventory: totalInventory,
        vendor: sku.BrandName || '',
        productType: sku.Categories?.[0] || '',
        tags: product.KeyWords?.split(',').map(k => k.trim()).filter(Boolean) || [],
        images: images,
        variants: [], // VTEX variants would need separate handling
        platforms: [vtexPlatform],
        status: status,
        marketplace: 'vtex',
        externalId: productId,
        currency: 'BRL', // Default for VTEX Brazil
        stock: totalInventory,
        lastSyncedAt: new Date(),
        cachedDescriptions: []
      });
    }

    return { isNew };

  } catch (error: any) {
    console.error(`[VTEX Sync] Error saving product ${vtexProduct.product.Name}:`, error.message);
    throw error;
  }
}

/**
 * Save VTEX product (legacy public API format)
 * DEPRECATED: Use saveVtexCompleteProduct for new implementations
 */
async function saveVtexProduct(vtexProduct: any, userId: string, workspaceId: string, connectionId: string) {
  try {
    // Map fields from VTEX public API response format
    const productId = vtexProduct.productId;
    const productName = vtexProduct.productName;
    const productReference = vtexProduct.productReference;

    // Find existing product by VTEX ID or title
    const existingProduct = await Product.findOne({
      workspaceId: workspaceId,
      $or: [
        { 'platforms.platformId': productId },
        { title: productName, storeConnectionId: connectionId }
      ]
    });

    const vtexPlatform = {
      platform: 'vtex' as PlatformType,
      platformId: productId || '',
      platformSku: productReference || '',
      platformPrice: undefined, // Public API doesn't include price in basic response
      platformInventory: 0, // Public API doesn't include inventory in basic response
      platformStatus: 'active', // Public API only returns active products
      lastSyncAt: new Date()
    };

    let isNew = false;

    if (existingProduct) {
      // Update existing product
      const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'vtex');

      if (platformIndex >= 0) {
        existingProduct.platforms[platformIndex] = vtexPlatform;
      } else {
        existingProduct.platforms.push(vtexPlatform);
      }

      // Update fields if not already set
      if (!existingProduct.description && vtexProduct.metaTagDescription) {
        existingProduct.description = vtexProduct.metaTagDescription;
      }

      existingProduct.lastSyncedAt = new Date();
      await existingProduct.save();

    } else {
      // Create new product
      isNew = true;

      // Extract category from categoryId if available
      const category = vtexProduct.categories ? vtexProduct.categories[0] : '';

      await Product.create({
        workspaceId: new Types.ObjectId(workspaceId),
        userId: new Types.ObjectId(userId),
        storeConnectionId: new Types.ObjectId(connectionId),
        title: productName || 'Untitled Product',
        description: vtexProduct.metaTagDescription || '',
        price: 0, // Public API doesn't provide price
        sku: productReference || '',
        inventory: 0, // Public API doesn't provide inventory
        vendor: vtexProduct.brand || '',
        productType: category || '',
        tags: [], // No tags in basic public API response
        images: [], // Would need additional API call for images
        variants: [], // Would need additional API call for variants
        platforms: [vtexPlatform],
        status: 'ACTIVE',
        marketplace: 'vtex',
        externalId: productId || '',
        currency: 'BRL', // Default for VTEX Brazil
        stock: 0,
        lastSyncedAt: new Date(),
        cachedDescriptions: []
      });
    }

    return { isNew };
  } catch (error) {
    console.error(`Error saving VTEX product ${vtexProduct.productName || vtexProduct.productId}:`, error);
    throw error;
  }
}

// Get single product by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      await trackUsage('api_call')(req, res, async () => {
        const { id } = req.params;
        
                
        const product = await Product.findOne({
          _id: id,
          workspaceId: req.workspace!._id
        }).populate('storeConnectionId', 'storeName marketplaceType credentials');

        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }

        // Generate platform availability data based on marketplace
        const platformData: any = {
          [product.marketplace]: {
            platformId: product.externalId,
            platformSku: product.sku,
            platformPrice: product.price,
            platformInventory: product.inventory,
            platformStatus: product.status,
            lastSyncAt: product.lastSyncedAt || product.updatedAt
          }
        };

        // Enhanced product object with additional fields for detail view
        const enhancedProduct = {
          ...product.toObject(),
          platforms: platformData,
          variants: product.variants || [],
          tags: product.tags || [],
          images: product.images || []
        };

        res.json({
          success: true,
          data: enhancedProduct
        });
      });
    });
  } catch (error: any) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
});

// PATCH /products/:id/description - Update product description
router.patch('/:id/description', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await protect(req, res, async () => {
      const { id } = req.params;
      const { description } = req.body;
      
            
      const product = await Product.findOne({
        _id: id,
        workspaceId: req.workspace!._id
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Track description update in history
      await ProductHistoryService.createProductUpdateHistory({
        workspaceId: req.workspace!._id.toString(),
        userId: req.user!._id.toString(),
        productId: id,
        actionType: 'DESCRIPTION_UPDATED',
        fieldChanged: 'description',
        oldValue: product.description,
        newValue: description
      });

      // Update the description
      product.description = description;
      await product.save();

      res.json({
        success: true,
        message: 'Product description updated successfully',
        data: {
          description: product.description
        }
      });
    });
  } catch (error: any) {
    console.error('Error updating product description:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product description',
      error: error.message
    });
  }
});

// POST /products/:id/resync - Resync a single product from its marketplace
router.post('/:id/resync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      await trackUsage('product_resync')(req, res, async () => {
        const { id } = req.params;

        // Find the product
        const product = await Product.findOne({
          _id: id,
          workspaceId: req.workspace!._id
        }).populate('storeConnectionId');

        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Product not found'
          });
        }

        const connection = product.storeConnectionId as any;
        if (!connection || !connection.credentials) {
          return res.status(400).json({
            success: false,
            message: 'Store connection not found or invalid'
          });
        }

        const marketplace = product.platforms?.[0]?.platform || connection.marketplaceType;
        if (!marketplace) {
          return res.status(400).json({
            success: false,
            message: 'Product marketplace not found'
          });
        }

        let syncedProduct;

        // Resync based on marketplace type
        switch (marketplace) {
          case 'shopify':
            // For Shopify, fetch single product by ID
            const { shop_url, access_token } = connection.credentials;
            if (!shop_url || !access_token) {
              return res.status(400).json({
                success: false,
                message: 'Invalid Shopify credentials'
              });
            }

            // Extract the numeric ID from the Shopify GID
            const shopifyId = product.platforms?.[0]?.platformId || product.shopifyId || product.externalId;
            if (!shopifyId) {
              return res.status(400).json({
                success: false,
                message: 'Shopify product ID not found'
              });
            }

            // Query for single product
            const storeName = shop_url
              .replace(/^https?:\/\//, '')
              .replace(/\/$/, '')
              .replace(/\.myshopify\.com$/, '');

            const apiUrl = `https://${storeName}.myshopify.com/admin/api/2023-10/graphql.json`;

            // Use the GID directly in the GraphQL query
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
              id: shopifyId
            };

            try {
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

              const data = await response.json() as any;

              if (data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
              }

              const shopifyProduct = data.data.product;

              if (!shopifyProduct) {
                return res.status(404).json({
                  success: false,
                  message: 'Product not found in Shopify'
                });
              }

              // Check if product is DRAFT or ARCHIVED
              if (shopifyProduct.status === 'DRAFT' || shopifyProduct.status === 'ARCHIVED') {
                // Delete the local product if it's no longer active
                await Product.findByIdAndDelete(id);

                return res.json({
                  success: true,
                  message: `Product removed locally as it is ${shopifyProduct.status.toLowerCase()} in Shopify`,
                  data: null
                });
              }

              // Update the product with new data from Shopify
              syncedProduct = await saveShopifyProduct(
                shopifyProduct,
                req.user!._id.toString(),
                req.workspace!._id.toString(),
                connection._id.toString()
              );
            } catch (error) {
              console.error('Shopify resync error:', error);
              return res.status(500).json({
                success: false,
                message: 'Failed to resync from Shopify',
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
            break;

          default:
            return res.status(400).json({
              success: false,
              message: `Resync not implemented for marketplace: ${marketplace}`
            });
        }

        // Reload the product with all populated fields
        const updatedProduct = await Product.findById(syncedProduct.productId || id)
          .populate('storeConnectionId')
          .populate('opportunityCount');

        res.json({
          success: true,
          message: 'Product resynced successfully',
          data: updatedProduct
        });
      });
    });
  } catch (error: any) {
    console.error('Error resyncing product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resync product',
      error: error.message
    });
  }
});

// POST /products/:id/description/apply-to-marketplace - Apply description to marketplace
router.post('/:id/description/apply-to-marketplace', async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
        await protect(req, res, async () => {
      await checkSubscriptionStatus(req, res, async () => {
        await requireFeature('AI Suggestions')(req, res, async () => {
          await trackUsage('ai_suggestion')(req, res, async () => {
            await trackUsage('api_call')(req, res, async () => {
              const { id } = req.params;
              const { description, marketplace } = req.body;
              
                            
              const product = await Product.findOne({
                _id: id,
                workspaceId: req.workspace!._id
              }).populate('storeConnectionId');

              if (!product) {
                return res.status(404).json({
                  success: false,
                  message: 'Product not found'
                });
              }

              if (!product.storeConnectionId) {
                return res.status(400).json({
                  success: false,
                  message: 'No store connection found for this product'
                });
              }

              if ((product.storeConnectionId as any).marketplaceType !== marketplace) {
                return res.status(400).json({
                  success: false,
                  message: `Product is connected to ${(product.storeConnectionId as any).marketplaceType}, not ${marketplace}`
                });
              }

              // Apply description to marketplace
              let updateResult;
              try {
                updateResult = await updateProductDescriptionInMarketplace(
                  marketplace,
                  product,
                  description,
                  product.storeConnectionId
                );

                // Track the result in history
                if (updateResult.success) {
                  await ProductHistoryService.createProductUpdateHistory({
                    workspaceId: req.workspace!._id.toString(),
                    userId: req.user!._id.toString(),
                    productId: id,
                    actionType: 'DESCRIPTION_UPDATED',
                    fieldChanged: 'description',
                    oldValue: product.description,
                    newValue: description,
                    marketplace
                  });

                  // Also update local description
                  product.description = description;
                  await product.save();
                } else {
                  await ProductHistoryService.createErrorHistory({
                    workspaceId: req.workspace!._id.toString(),
                    userId: req.user!._id.toString(),
                    productId: id,
                    actionType: 'SYNC_FAILED',
                    errorMessage: updateResult.message,
                    marketplace
                  });
                }
              } catch (error: any) {
                console.error('Marketplace update failed:', error);
                updateResult = {
                  success: false,
                  message: error.message || 'Failed to update marketplace'
                };

                // Track the error in history
                await ProductHistoryService.createErrorHistory({
                  workspaceId: req.workspace!._id.toString(),
                  userId: req.user!._id.toString(),
                  productId: id,
                  actionType: 'SYNC_FAILED',
                  errorMessage: error.message || 'Failed to update marketplace',
                  marketplace
                });
              }

              res.json({
                success: true,
                data: updateResult
              });
            });
          });
        });
      });
    });
  } catch (error: any) {
    console.error('Error applying description to marketplace:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply description to marketplace',
      error: error.message
    });
  }
});

// Helper function to update product description in marketplace
async function updateProductDescriptionInMarketplace(
  marketplace: string, 
  product: any, 
  description: string, 
  storeConnection: any
) {
  const { credentials } = storeConnection;
  
  switch (marketplace) {
    case 'shopify':
      return await updateShopifyProductDescriptionDirect(product, description, credentials);
    case 'woocommerce':
      return await updateWooCommerceProductDescriptionDirect(product, description, credentials);
    case 'vtex':
      return await updateVtexProductDescriptionDirect(product, description, credentials);
    case 'mercadolibre':
      return await updateMercadoLibreProductDescriptionDirect(product, description, credentials);
    case 'facebook_shop':
      return await updateFacebookShopProductDescriptionDirect(product, description, credentials);
    default:
      return {
        success: false,
        message: `Marketplace updates not yet implemented for ${marketplace}`
      };
  }
}

// Shopify direct description update
async function updateShopifyProductDescriptionDirect(
  product: any, 
  description: string, 
  credentials: any
) {
  try {
    const { shop_url, access_token } = credentials;
    const cleanShopUrl = shop_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Extract numeric ID from GraphQL ID
    let productId = product.externalId || product.shopifyId;
    if (productId && productId.includes('gid://shopify/Product/')) {
      productId = productId.replace('gid://shopify/Product/', '');
    }
    
    console.log(`Updating Shopify product ${productId} with manual description`);
    
    const response = await axios.put(
      `https://${cleanShopUrl}/admin/api/2023-10/products/${productId}.json`,
      {
        product: {
          body_html: description
        }
      },
      {
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'Shopify product description updated successfully'
    };
  } catch (error: any) {
    console.error('Shopify update error:', error.response?.data || error.message);
    return {
      success: false,
      message: `Shopify update failed: ${error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message}`
    };
  }
}

// WooCommerce direct description update
async function updateWooCommerceProductDescriptionDirect(
  product: any, 
  description: string, 
  credentials: any
) {
  try {
    const { site_url, consumer_key, consumer_secret } = credentials;
    const cleanUrl = site_url.replace(/\/$/, '');
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `${cleanUrl}/wp-json/wc/v3/products/${productId}`,
      {
        description: description
      },
      {
        auth: {
          username: consumer_key,
          password: consumer_secret
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'WooCommerce product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `WooCommerce update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// VTEX direct description update
async function updateVtexProductDescriptionDirect(
  product: any, 
  description: string, 
  credentials: any
) {
  try {
    const { account_name, app_key, app_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `https://${account_name}.vtexcommercestable.com.br/api/catalog/pvt/product/${productId}`,
      {
        Description: description
      },
      {
        headers: {
          'X-VTEX-API-AppKey': app_key,
          'X-VTEX-API-AppToken': app_token,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'VTEX product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `VTEX update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// MercadoLibre direct description update
async function updateMercadoLibreProductDescriptionDirect(
  product: any, 
  description: string, 
  credentials: any
) {
  try {
    const { access_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.put(
      `https://api.mercadolibre.com/items/${productId}`,
      {
        description: {
          plain_text: description
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'MercadoLibre product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `MercadoLibre update failed: ${error.response?.data?.message || error.message}`
    };
  }
}

// Facebook Shop direct description update
async function updateFacebookShopProductDescriptionDirect(
  product: any, 
  description: string, 
  credentials: any
) {
  try {
    const { page_id, access_token } = credentials;
    
    let productId = product.externalId;
    
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${productId}`,
      {
        description: description,
        access_token: access_token
      },
      {
        timeout: 10000
      }
    );

    return {
      success: true,
      message: 'Facebook Shop product description updated successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Facebook Shop update failed: ${error.response?.data?.error?.message || error.message}`
    };
  }
}

/**
 * PUT /api/products/:productId/description
 * Update product description (accept AI suggestion)
 */
router.put('/:productId/description', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Update product description
    const updatedProduct = await Product.findOneAndUpdate(
      {
        _id: productId,
        workspaceId: req.workspace!._id
      },
      {
        $set: {
          description: description,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Create history entry for accepted AI suggestion
    await ProductHistoryService.createAIOptimizationHistory({
      workspaceId: req.workspace!._id.toString(),
      userId: req.user!._id.toString(),
      productId: productId,
      actionType: 'AI_OPTIMIZATION_APPLIED',
      marketplace: updatedProduct.marketplace,
      aiModel: 'gpt-3.5-turbo',
      originalContent: '', // We could track the old description if needed
      newContent: description,
      confidence: 0.9
    });

    res.json({
      success: true,
      message: 'Product description updated successfully',
      data: {
        productId,
        description: updatedProduct.description
      }
    });

  } catch (error: any) {
    console.error('Error updating product description:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product description',
      error: error.message
    });
  }
});

/**
 * POST /api/products/:productId/description/accept
 * Accept AI suggestion and queue for marketplace update
 */
router.post('/:productId/description/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      await checkSubscriptionStatus(req, res, async () => {
        await requireFeature('AI Suggestions')(req, res, async () => {
          await trackUsage('ai_suggestion')(req, res, async () => {
            await trackUsage('api_call')(req, res, async () => {
              const { productId } = req.params;
              const { description, marketplace } = req.body;

              if (!description) {
                return res.status(400).json({
                  success: false,
                  message: 'Description is required'
                });
              }

              const product = await Product.findOne({
                _id: productId,
                workspaceId: req.workspace!._id
              }).populate('storeConnectionId');

              if (!product) {
                return res.status(404).json({
                  success: false,
                  message: 'Product not found'
                });
              }

              // Update local description
              product.description = description;
              product.updateStatus = 'pending';
              product.updateError = undefined;
              product.lastUpdateAttempt = new Date();
              await product.save();

              // Queue marketplace update using RabbitMQ
              const RabbitMQService = require('@/common/services/rabbitMQService').default;
              const rabbitMQService = new RabbitMQService();
              
              await rabbitMQService.addJob('marketplace-update', {
                userId: req.user!._id.toString(),
                workspaceId: req.workspace!._id.toString(),
                productId: productId,
                description: description,
                marketplace: marketplace || product.marketplace,
                connectionId: product.storeConnectionId,
                priority: 0
              });

              // Create history entry
              await ProductHistoryService.createAIOptimizationHistory({
                workspaceId: req.workspace!._id.toString(),
                userId: req.user!._id.toString(),
                productId: productId,
                actionType: 'AI_OPTIMIZATION_APPLIED',
                marketplace: marketplace || product.marketplace,
                aiModel: 'gpt-3.5-turbo',
                originalContent: '',
                newContent: description,
                confidence: 0.9
              });

              res.json({
                success: true,
                message: 'Description accepted and queued for marketplace update',
                data: {
                  productId,
                  description: product.description,
                  status: 'pending'
                }
              });
            });
          });
        });
      });
    });
  } catch (error: any) {
    console.error('Error accepting product description:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept product description',
      error: error.message
    });
  }
});

/**
 * POST /api/products/accept-all-descriptions
 * Accept multiple AI suggestions and queue for marketplace update
 */
router.post('/accept-all-descriptions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      await checkSubscriptionStatus(req, res, async () => {
        await requireFeature('AI Suggestions')(req, res, async () => {
          await trackUsage('api_call')(req, res, async () => {
            const { products } = req.body;

            if (!products || !Array.isArray(products) || products.length === 0) {
              return res.status(400).json({
                success: false,
                message: 'Products array is required and must not be empty'
              });
            }

            const results = [];
            const RabbitMQService = require('@/common/services/rabbitMQService').default;
            const rabbitMQService = new RabbitMQService();

            for (const productData of products) {
              const { productId, description, marketplace } = productData;

              if (!productId || !description) {
                results.push({
                  productId,
                  success: false,
                  message: 'Product ID and description are required'
                });
                continue;
              }

              try {
                const product = await Product.findOne({
                  _id: productId,
                  workspaceId: req.workspace!._id
                }).populate('storeConnectionId');

                if (!product) {
                  results.push({
                    productId,
                    success: false,
                    message: 'Product not found'
                  });
                  continue;
                }

                // Update local description
                product.description = description;
                product.updateStatus = 'pending';
                product.updateError = undefined;
                product.lastUpdateAttempt = new Date();
                await product.save();

                // Queue marketplace update
                await rabbitMQService.addJob('marketplace-update', {
                  userId: req.user!._id.toString(),
                  workspaceId: req.workspace!._id.toString(),
                  productId: productId,
                  description: description,
                  marketplace: marketplace || product.marketplace,
                  connectionId: product.storeConnectionId,
                  priority: 0
                });

                // Create history entry
                await ProductHistoryService.createAIOptimizationHistory({
                  workspaceId: req.workspace!._id.toString(),
                  userId: req.user!._id.toString(),
                  productId: productId,
                  actionType: 'AI_OPTIMIZATION_APPLIED',
                  marketplace: marketplace || product.marketplace,
                  aiModel: 'gpt-3.5-turbo',
                  originalContent: '',
                  newContent: description,
                  confidence: 0.9
                });

                // Track usage for each processed product
                await trackUsage('ai_suggestion')(req, res, async () => {});

                results.push({
                  productId,
                  success: true,
                  message: 'Description accepted and queued for marketplace update'
                });
              } catch (productError: any) {
                results.push({
                  productId,
                  success: false,
                  message: productError.message
                });
              }
            }

            const successCount = results.filter(r => r.success).length;
            
            res.json({
              success: true,
              message: `Successfully queued ${successCount} of ${products.length} products for marketplace update`,
              data: {
                results,
                successCount,
                totalCount: products.length
              }
            });
          });
        });
      });
    });
  } catch (error: any) {
    console.error('Error accepting all product descriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept product descriptions',
      error: error.message
    });
  }
});

// Add history routes
router.use(historyRoutes);

export default router;
