import express, { Response } from 'express';
import Joi from 'joi';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '@/common/types/express';
import StoreConnection from '@/stores/models/StoreConnection';
import Product from '@/products/models/Product';
import { protect, trackUsage, checkSubscriptionStatus, checkUsageLimits } from '@/common/middleware/auth';
import * as marketplaceService from '../services/marketplaceService';
import { VtexService } from '../services/vtexService';
import { ProductCategory, ProductBrand } from '@/common/types/marketplace';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Interface definitions
interface TestConnectionBody {
  type: 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';
  credentials: Record<string, any>;
}

interface ConnectMarketplaceBody {
  storeConnectionId: string;
  type: 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';
  credentials: Record<string, any>;
}

interface CreateStoreWithMarketplaceBody {
  storeName: string;
  type: 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';
  credentials: Record<string, any>;
}

// Validation schemas
const testConnectionSchema = Joi.object({
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

const connectMarketplaceSchema = Joi.object({
  storeConnectionId: Joi.string().required(),
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

const createStoreWithMarketplaceSchema = Joi.object({
  storeName: Joi.string().required(),
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

// GET /api/marketplaces - List all available marketplaces
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await trackUsage('api_call')(req, res, async () => {
      const { getAvailableMarketplaces } = marketplaceService;
      
      const marketplaces = getAvailableMarketplaces();
      res.json({
        success: true,
        data: marketplaces
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching marketplaces', 
      error: error.message 
    });
  }
});

// GET /api/marketplaces/status - Get user's marketplace connection status
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await trackUsage('api_call')(req, res, async () => {
      const { getWorkspaceMarketplaceStatus } = marketplaceService;
      
      const marketplaceStatus = await getWorkspaceMarketplaceStatus(req.workspace!._id.toString());
      res.json({
        success: true,
        data: marketplaceStatus
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching marketplace status', 
      error: error.message 
    });
  }
});

// POST /api/marketplaces/test - Test marketplace connection
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await checkSubscriptionStatus(req, res, async () => {
      await trackUsage('marketplace_test')(req, res, async () => {
        await trackUsage('api_call')(req, res, async () => {
          const { error } = testConnectionSchema.validate(req.body);
          if (error) {
            return res.status(400).json({ 
              success: false,
              message: error.details[0].message 
            });
          }

          const { type, credentials } = req.body;
          const { testMarketplaceConnection } = marketplaceService;
          const result = await testMarketplaceConnection(type, credentials);
          
          res.json({
            success: result.success,
            message: result.message,
            data: result.data || null
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error testing marketplace connection', 
      error: error.message 
    });
  }
});

// POST /api/marketplaces/connect - Connect marketplace (deprecated - use create-store instead)
router.post('/connect', async (req: AuthenticatedRequest, res: Response) => {
  return res.status(400).json({
    success: false,
    message: 'This endpoint is deprecated. Use /create-store to create a new marketplace connection.'
  });
});

// POST /api/marketplaces/create-store - Create new store with marketplace connection
router.post('/create-store', async (req: AuthenticatedRequest, res: Response) => {
  try {
        await checkSubscriptionStatus(req, res, async () => {
      await checkUsageLimits('stores')(req, res, async () => {
        await trackUsage('store_created')(req, res, async () => {
          await trackUsage('marketplace_connected')(req, res, async () => {
            await trackUsage('api_call')(req, res, async () => {
              const { error } = createStoreWithMarketplaceSchema.validate(req.body);
              if (error) {
                return res.status(400).json({ 
                  success: false,
                  message: error.details[0].message 
                });
              }

              const { storeName, type, credentials } = req.body;
                            
              // Check if user already has an ACTIVE marketplace type connected
              const existingActiveConnection = await StoreConnection.findOne({
                workspaceId: req.workspace!._id,
                marketplaceType: type,
                isActive: true
              });

              if (existingActiveConnection) {
                return res.status(400).json({
                  success: false,
                  message: `You already have an active ${type} marketplace connected. Only one active connection per marketplace type is allowed.`
                });
              }

              // Check for existing inactive connection with products
              const existingInactiveConnection = await StoreConnection.findOne({
                workspaceId: req.workspace!._id,
                marketplaceType: type,
                isActive: false
              });

              // First test the connection
              const { testMarketplaceConnection } = marketplaceService;
              const testResult = await testMarketplaceConnection(type, credentials);
              if (!testResult.success) {
                return res.status(400).json({
                  success: false,
                  message: 'Connection test failed: ' + testResult.message
                });
              }

              // Create new store connection
              const storeConnection = await StoreConnection.create({
                workspaceId: req.workspace!._id,
                storeName,
                marketplaceType: type,
                credentials,
                isActive: true,
                syncStatus: 'pending'
              });

              // If there was an existing inactive connection with products, update those products to reference the new connection
              let updatedProductsCount = 0;
              if (existingInactiveConnection) {
                console.log(`Found existing inactive ${type} connection ${existingInactiveConnection._id}, checking for orphaned products...`);
                
                const orphanedProducts = await Product.find({
                  workspaceId: req.workspace!._id,
                  storeConnectionId: existingInactiveConnection._id,
                  marketplace: type
                });

                if (orphanedProducts.length > 0) {
                  console.log(`Found ${orphanedProducts.length} orphaned products, updating to new connection ${storeConnection._id}`);
                  
                  const updateResult = await Product.updateMany(
                    {
                      workspaceId: req.workspace!._id,
                      storeConnectionId: existingInactiveConnection._id,
                      marketplace: type
                    },
                    {
                      $set: {
                        storeConnectionId: storeConnection._id
                      }
                    }
                  );
                  
                  updatedProductsCount = updateResult.modifiedCount;
                  console.log(`Successfully updated ${updatedProductsCount} products to new connection`);
                }

                // Remove the old inactive connection to avoid confusion
                await StoreConnection.deleteOne({ _id: existingInactiveConnection._id });
                console.log(`Removed old inactive connection ${existingInactiveConnection._id}`);
              }

              const responseMessage = updatedProductsCount > 0 
                ? `Store created and marketplace connected successfully. ${updatedProductsCount} existing products have been reconnected.`
                : 'Store created and marketplace connected successfully';

              res.status(201).json({
                success: true,
                message: responseMessage,
                data: {
                  storeConnection,
                  testResult: testResult.data,
                  reconnectedProducts: updatedProductsCount
                }
              });
            });
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error creating store with marketplace', 
      error: error.message 
    });
  }
});

// PUT /api/marketplaces/:connectionId/test - Test existing marketplace connection
router.put('/:connectionId/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    
    const storeConnection = await StoreConnection.findOne({
      _id: connectionId,
      workspaceId: req.workspace!._id
    });

    if (!storeConnection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    const { testMarketplaceConnection } = marketplaceService;
    const testResult = await testMarketplaceConnection(storeConnection.marketplaceType, storeConnection.credentials);
    
    // Update sync status based on test result
    storeConnection.syncStatus = testResult.success ? 'completed' : 'failed';
    storeConnection.lastSync = new Date();
    await storeConnection.save();

    res.json({
      success: testResult.success,
      message: testResult.message,
      data: {
        ...testResult.data,
        syncStatus: storeConnection.syncStatus,
        lastSync: storeConnection.lastSync
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error testing marketplace connection', 
      error: error.message 
    });
  }
});

// PUT /api/marketplaces/:connectionId/toggle - Toggle marketplace active status
router.put('/:connectionId/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    
    const storeConnection = await StoreConnection.findOne({
      _id: connectionId,
      workspaceId: req.workspace!._id
    });

    if (!storeConnection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    storeConnection.isActive = !storeConnection.isActive;
    storeConnection.syncStatus = storeConnection.isActive ? 'pending' : 'completed';
    await storeConnection.save();

    res.json({
      success: true,
      message: `Marketplace ${storeConnection.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        isActive: storeConnection.isActive,
        syncStatus: storeConnection.syncStatus
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Error toggling marketplace status', 
      error: error.message 
    });
  }
});

// GET /api/marketplaces/:connectionId/categories - Get available categories from marketplace
router.get('/:connectionId/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { includeCount } = req.query;
    const workspaceId = new Types.ObjectId(req.workspace!._id.toString());

    // Find store connection
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      workspaceId
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    // Fetch categories based on marketplace type
    switch (connection.marketplaceType) {
      case 'vtex':
        // Check if product count is requested
        if (includeCount === 'true') {
          // Get categories from VTEX API with cache
          const categoriesWithCount = await VtexService.getCategoriesWithCount(
            connection.credentials as marketplaceService.VtexCredentials,
            new Types.ObjectId(connection._id.toString()),
            workspaceId
          );

          return res.json({
            success: true,
            data: {
              categories: categoriesWithCount,
              totalCount: categoriesWithCount.length,
              includingProductCount: true,
              source: 'cached'  // Data from cache or VTEX API
            }
          });
        } else{
          // Original behavior: fetch without counts
          const categories = await VtexService.fetchCategories(
            connection.credentials as marketplaceService.VtexCredentials
          );

          return res.json({
            success: true,
            data: {
              categories,
              totalCount: categories.length,
              includingProductCount: false
            }
          });
        }

      // Future: Add other marketplaces
      case 'shopify':
        // TODO: Implement Shopify collections fetch
        return res.status(400).json({
          success: false,
          message: 'Category filtering for Shopify coming soon'
        });

      default:
        return res.status(400).json({
          success: false,
          message: `Category filtering not supported for ${connection.marketplaceType}`
        });
    }

  } catch (error: any) {
    console.error('[Marketplaces] Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching categories'
    });
  }
});

// GET /api/marketplaces/:connectionId/brands - Get available brands from marketplace
router.get('/:connectionId/brands', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { connectionId } = req.params;
    const { includeCount } = req.query;
    const workspaceId = new Types.ObjectId(req.workspace!._id.toString());

    // Find store connection
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      workspaceId
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    // Fetch brands based on marketplace type
    switch (connection.marketplaceType) {
      case 'vtex':
        // Check if product count is requested
        if (includeCount === 'true') {
          // Get brands from VTEX API with cache
          const brandsWithCount = await VtexService.getBrandsWithCount(
            connection.credentials as marketplaceService.VtexCredentials,
            new Types.ObjectId(connection._id.toString()),
            workspaceId
          );

          return res.json({
            success: true,
            data: {
              brands: brandsWithCount,
              totalCount: brandsWithCount.length,
              includingProductCount: true,
              source: 'cached'  // Data from cache or VTEX API
            }
          });
        } else {
          // Original behavior: fetch without counts
          const brands = await VtexService.fetchBrands(
            connection.credentials as marketplaceService.VtexCredentials
          );

          return res.json({
            success: true,
            data: {
              brands,
              totalCount: brands.length,
              includingProductCount: false
            }
          });
        }

      // Future: Add other marketplaces
      case 'shopify':
        // TODO: Implement Shopify vendors fetch
        return res.status(400).json({
          success: false,
          message: 'Brand filtering for Shopify coming soon'
        });

      default:
        return res.status(400).json({
          success: false,
          message: `Brand filtering not supported for ${connection.marketplaceType}`
        });
    }

  } catch (error: any) {
    console.error('[Marketplaces] Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching brands'
    });
  }
});

export default router;
