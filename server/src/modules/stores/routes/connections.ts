import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import StoreConnection from '../models/StoreConnection';
import Product from '@/products/models/Product';
import { protect, trackUsage, checkSubscriptionStatus, checkUsageLimits } from '@/common/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Interface definitions
interface MarketplaceData {
  type: 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';
  credentials: Record<string, any>;
  isActive?: boolean;
}

interface CreateConnectionBody {
  storeName: string;
  marketplaces: MarketplaceData[];
}

interface UpdateConnectionBody {
  storeName?: string;
  marketplaces?: MarketplaceData[];
  isActive?: boolean;
}

interface AddMarketplaceBody {
  type: 'shopify' | 'vtex' | 'mercadolibre' | 'amazon' | 'facebook_shop' | 'google_shopping' | 'woocommerce';
  credentials: Record<string, any>;
}

interface DeleteConnectionQuery {
  deleteProducts?: string;
}

// Validation schemas
const createConnectionSchema = Joi.object({
  storeName: Joi.string().required(),
  marketplaces: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
      credentials: Joi.object().required()
    })
  ).min(1).required()
});

const updateConnectionSchema = Joi.object({
  storeName: Joi.string(),
  marketplaces: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
      credentials: Joi.object().required(),
      isActive: Joi.boolean()
    })
  ),
  isActive: Joi.boolean()
});

const marketplaceSchema = Joi.object({
  type: Joi.string().valid('shopify', 'vtex', 'mercadolibre', 'amazon', 'facebook_shop', 'google_shopping', 'woocommerce').required(),
  credentials: Joi.object().required()
});

// GET /api/connections - Get all connections for user
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      
      const connections = await StoreConnection.find({ userId: req.user!._id })
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        data: connections
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// GET /api/connections/:id - Get specific connection
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      
      const connection = await StoreConnection.findOne({
        _id: req.params.id,
        userId: req.user!._id
      });

      if (!connection) {
        return res.status(404).json({ 
          success: false,
          message: 'Connection not found' 
        });
      }

      res.json({
        success: true,
        data: connection
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// POST /api/connections - Create new connection
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await checkSubscriptionStatus(req, res, async () => {
      await checkUsageLimits('stores')(req, res, async () => {
        await trackUsage('store_created')(req, res, async () => {
          await trackUsage('api_call')(req, res, async () => {
            const { error } = createConnectionSchema.validate(req.body);
            if (error) {
              return res.status(400).json({ 
                success: false,
                message: error.details[0].message 
              });
            }
            
            const connection = await StoreConnection.create({
              userId: req.user!._id,
              ...req.body
            });

            res.status(201).json({
              success: true,
              data: connection
            });
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// PUT /api/connections/:id - Update connection
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await checkSubscriptionStatus(req, res, async () => {
      await trackUsage('store_updated')(req, res, async () => {
        await trackUsage('api_call')(req, res, async () => {
          const { error } = updateConnectionSchema.validate(req.body);
          if (error) {
            return res.status(400).json({ 
              success: false,
              message: error.details[0].message 
            });
          }
          
          const connection = await StoreConnection.findOneAndUpdate(
            { _id: req.params.id, userId: req.user!._id },
            req.body,
            { new: true, runValidators: true }
          );

          if (!connection) {
            return res.status(404).json({ 
              success: false,
              message: 'Connection not found' 
            });
          }

          res.json({
            success: true,
            data: connection
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// POST /api/connections/:id/marketplace - Add marketplace to connection
router.post('/:id/marketplace', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await checkSubscriptionStatus(req, res, async () => {
      await trackUsage('marketplace_connected')(req, res, async () => {
        await trackUsage('api_call')(req, res, async () => {
          const { error } = marketplaceSchema.validate(req.body);
          if (error) {
            return res.status(400).json({ 
              success: false,
              message: error.details[0].message 
            });
          }
          
          const connection = await StoreConnection.findOne({
            _id: req.params.id,
            userId: req.user!._id
          });

          if (!connection) {
            return res.status(404).json({ 
              success: false,
              message: 'Connection not found' 
            });
          }

          // Check if this marketplace type is already connected for this user
          const existingConnection = await StoreConnection.findOne({
            userId: req.user!._id,
            marketplaceType: (req.body as any).type
          });
          
          if (existingConnection) {
            return res.status(400).json({ 
              success: false,
              message: 'Marketplace already connected' 
            });
          }

          // This route should actually create a new store connection instead of modifying existing one
          const newConnection = await StoreConnection.create({
            userId: req.user!._id,
            storeName: connection.storeName + ` - ${(req.body as any).type}`,
            marketplaceType: (req.body as any).type,
            credentials: (req.body as any).credentials,
            isActive: true
          });
          await connection.save();

          res.status(201).json({
            success: true,
            data: connection
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// DELETE /api/connections/:id - Delete entire marketplace connection
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await checkSubscriptionStatus(req, res, async () => {
      await trackUsage('store_deleted')(req, res, async () => {
        await trackUsage('api_call')(req, res, async () => {
          const deleteProducts = req.query.deleteProducts === 'true';
          
          const connection = await StoreConnection.findOne({
            _id: req.params.id,
            userId: req.user!._id
          });

          if (!connection) {
            return res.status(404).json({ 
              success: false,
              message: 'Connection not found' 
            });
          }

          let deletedProductsCount = 0;

          // If deleteProducts is true, delete all associated products
          if (deleteProducts) {
            const deleteResult = await Product.deleteMany({
              userId: req.user!._id,
              storeConnectionId: req.params.id
            });
            deletedProductsCount = deleteResult.deletedCount;
          } else {
            // Mark connection as inactive without deleting products
            connection.isActive = false;
            await connection.save();
            
            return res.json({ 
              success: true,
              message: 'Marketplace connection disconnected successfully',
              data: { 
                connection,
                deletedProductsCount: 0,
                productsPreserved: true
              }
            });
          }

          // Delete the connection
          await StoreConnection.findOneAndDelete({
            _id: req.params.id,
            userId: req.user!._id
          });

          res.json({ 
            success: true,
            message: `Marketplace connection deleted successfully. ${deletedProductsCount} products removed.`,
            data: { 
              connection,
              deletedProductsCount,
              productsPreserved: false
            }
          });
        });
      });
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

export default router;
