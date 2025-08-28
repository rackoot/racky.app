import express, { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import axios from 'axios';
import { Types } from 'mongoose';
import { PlatformType } from '../models/Product';
import Product from '../models/Product';
import StoreConnection from '@/stores/models/StoreConnection';
import { protect, trackUsage, checkSubscriptionStatus, checkUsageLimits, checkSyncFrequency, requireFeature } from '@/common/middleware/auth';
import syncRoutes from './sync';

const router = express.Router();

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
              const { force = false } = req.body;
              
                                          
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
                force
              );

              // Update connection metadata
              connection.lastSync = new Date();
              connection.syncStatus = 'completed';
              await connection.save();

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
  force: boolean = false
) {
  switch (type) {
    case 'shopify':
      return await syncShopifyProducts(credentials, userId, workspaceId, connectionId, force);
    case 'vtex':
      return await syncVtexProducts(credentials, userId, workspaceId, connectionId, force);
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
      userId: userId,
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
      // Update existing product
      const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'shopify');
      
      if (platformIndex >= 0) {
        existingProduct.platforms[platformIndex] = shopifyPlatform;
      } else {
        existingProduct.platforms.push(shopifyPlatform);
      }

      // Update other fields
      if (!existingProduct.description && shopifyProduct.description) {
        existingProduct.description = shopifyProduct.description;
      }
      
      if (shopifyProduct.images.edges.length > 0 && existingProduct.images.length === 0) {
        existingProduct.images = shopifyProduct.images.edges.map((edge: any) => ({
          shopifyId: edge.node.id,
          url: edge.node.url,
          altText: edge.node.altText || ''
        }));
      }

      existingProduct.shopifyId = shopifyProduct.id;
      existingProduct.handle = shopifyProduct.handle;
      existingProduct.shopifyUpdatedAt = new Date(shopifyProduct.updatedAt);
      existingProduct.lastSyncedAt = new Date();

      await existingProduct.save();
    } else {
      // Create new product
      isNew = true;
      const newProduct = new Product({
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

// VTEX product synchronization
async function syncVtexProducts(
  credentials: any,
  userId: string,
  workspaceId: string,
  connectionId: string,
  force: boolean = false
) {
  const { account_name, app_key, app_token } = credentials;

  if (!account_name || !app_key || !app_token) {
    throw new Error('Account name, app key, and app token are required for VTEX sync');
  }

  // Clean account name (same logic as in marketplace service)
  let cleanAccountName = account_name.trim();
  cleanAccountName = cleanAccountName.replace(/^https?:\/\//, '');
  
  if (cleanAccountName.includes('.vtexcommercestable.com.br') || 
      cleanAccountName.includes('.vtex.com.br') ||
      cleanAccountName.includes('.vtexcommerce.com.br')) {
    cleanAccountName = cleanAccountName.split('.')[0];
  }
  
  cleanAccountName = cleanAccountName.replace(/\//g, '').trim();

  try {
    let totalProducts = 0;
    let newProducts = 0;
    let updatedProducts = 0;

    console.log(`Starting VTEX sync for user: ${userId}, account: ${cleanAccountName}`);

    // Fetch products from VTEX with limit of 30
    const vtexProducts = await fetchVtexProducts(cleanAccountName, app_key, app_token, 30);
    
    console.log(`Retrieved ${vtexProducts.length} products from VTEX`);

    for (const vtexProduct of vtexProducts) {
      const syncResult = await saveVtexProduct(vtexProduct, userId, workspaceId, connectionId);
      totalProducts++;
      if (syncResult.isNew) {
        newProducts++;
      } else {
        updatedProducts++;
      }
    }

    console.log(`VTEX sync completed. Total: ${totalProducts}, New: ${newProducts}, Updated: ${updatedProducts}`);
    return { success: true, totalProducts, newProducts, updatedProducts };
  } catch (error) {
    console.error('Error syncing VTEX products:', error);
    throw error;
  }
}

async function fetchVtexProducts(accountName: string, appKey: string, appToken: string, limit: number = 30) {
  try {
    const axios = require('axios');
    
    // Use VTEX public search API which works without authentication issues
    const apiUrl = `https://${accountName}.vtexcommercestable.com.br/api/catalog_system/pub/products/search`;
    
    console.log(`[VTEX] Fetching products from: ${apiUrl}`);
    
    // Fetch products using public API with pagination
    const response = await axios.get(apiUrl, {
      params: {
        '_from': 0,
        '_to': limit - 1
      },
      timeout: 30000
    });

    const products = response.data;
    console.log(`[VTEX] Found ${Array.isArray(products) ? products.length : 0} products`);

    if (!Array.isArray(products)) {
      console.warn('[VTEX] Invalid response format - expected array of products');
      return [];
    }

    if (products.length === 0) {
      console.warn('[VTEX] No products found in catalog');
      return [];
    }

    // The public search API returns complete product data, so we don't need additional calls
    console.log(`[VTEX] Successfully retrieved ${products.length} products`);
    return products.slice(0, limit); // Ensure we don't exceed the limit
    
  } catch (error: any) {
    console.error('[VTEX] Error fetching products:', error.message);
    if (error.response?.status === 401) {
      console.error('[VTEX] Authentication failed - using public API instead');
    }
    throw new Error(`Failed to fetch VTEX products: ${error.message}`);
  }
}

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
              } catch (error: any) {
                console.error('Marketplace update failed:', error);
                updateResult = {
                  success: false,
                  message: error.message || 'Failed to update marketplace'
                };
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

// Add sync routes
router.use('/sync', syncRoutes);

export default router;
