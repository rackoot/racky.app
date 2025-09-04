import express, { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '@/common/types/express';
import Product from '@/products/models/Product';
import Opportunity from '../models/Opportunity';
import OpportunityCategory from '../models/OpportunityCategory';
import StoreConnection from '@/stores/models/StoreConnection';
import * as aiService from '../services/aiService';
import { protect } from '@/common/middleware/auth';
import Joi from 'joi';

const router = express.Router();

// Interface definitions are handled inline for better compatibility

// GET /api/opportunities - List opportunities with filtering and pagination
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();
    
    // Parse query parameters
    const {
      search,
      status,
      priority,
      category,
      marketplace,
      limit = 25,
      offset = 0,
    } = req.query;

    // Build query
    const query: any = {
      userId,
      workspaceId,
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { actionRequired: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (marketplace) query.marketplace = marketplace;

    // Count total for pagination
    const total = await Opportunity.countDocuments(query);

    // Get opportunities with pagination
    const opportunities = await Opportunity.find(query)
      .populate('productId', 'title price')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .lean();

    res.json({
      success: true,
      data: {
        opportunities,
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
      }
    });

  } catch (error: any) {
    console.error('Error listing opportunities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load opportunities',
      error: error.message
    });
  }
});

// GET /api/opportunities/categories - Get all available categories
router.get('/categories', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await protect(req, res, async () => {
      
      // Initialize categories if they don't exist
      await OpportunityCategory.initializeDefaultCategories();
      
      const categories = await OpportunityCategory.getActiveCategories();
      
      res.json({
        success: true,
        data: categories
      });
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// GET /api/opportunities/products/:id - Get cached opportunities for a product
router.get('/products/:id', async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { id: productId } = req.params;
      const workspaceId = req.workspace!._id;
      const category = req.query.category as string;


      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Clean up expired opportunities first
      await Opportunity.cleanupExpired();

      // Get opportunities (filtered by category if specified)
      let opportunities: any[];
      if (category) {
        opportunities = await Opportunity.findByCategory(new mongoose.Types.ObjectId(workspaceId.toString()), new mongoose.Types.ObjectId(productId), category as any);
      } else {
        opportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(workspaceId.toString()), new mongoose.Types.ObjectId(productId));
      }

      // Group opportunities by category for easier frontend handling
      const groupedOpportunities: Record<string, any[]> = {};
      opportunities.forEach((opp: any) => {
        if (!groupedOpportunities[opp.category]) {
          groupedOpportunities[opp.category] = [];
        }
        groupedOpportunities[opp.category].push(opp);
      });

      // Get category counts
      const categoryCounts: Record<string, number> = {};
      opportunities.forEach((opp: any) => {
        categoryCounts[opp.category] = (categoryCounts[opp.category] || 0) + 1;
      });

      // Determine available tabs (current marketplace + connected + suggested)
      const userConnections = await StoreConnection.find({ workspaceId, isActive: true });
      const connectedMarketplaces = new Set<string>();
      
      userConnections.forEach((conn: any) => {
        if (conn.marketplaceType) {
          connectedMarketplaces.add(conn.marketplaceType);
        }
      });

      // Add current product marketplace
      connectedMarketplaces.add(product.marketplace);

      // Add marketplaces mentioned in opportunities
      opportunities.forEach((opp: any) => {
        if (opp.marketplace) {
          connectedMarketplaces.add(opp.marketplace);
        }
      });

      const availableMarketplaceTabs = Array.from(connectedMarketplaces);

      res.json({
        success: true,
        data: {
          opportunities: groupedOpportunities,
          categoryCounts,
          availableMarketplaceTabs,
          totalCount: opportunities.length,
          productMarketplace: product.marketplace,
          cached: opportunities.length > 0,
          lastGenerated: opportunities.length > 0 ? opportunities[0].cachedAt : null
        }
      });
    });
  } catch (error: any) {
    console.error('Get product opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunities'
    });
  }
});

// POST /api/opportunities/products/:id/generate - Generate new AI suggestions
router.post('/products/:id/generate', async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { id: productId } = req.params;
      const workspaceId = req.workspace!._id;
      const forceRefresh = (req.body as any)?.forceRefresh || false;

      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, workspaceId })
        .populate('storeConnectionId');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if we have recent opportunities (unless force refresh)
      if (!forceRefresh) {
        const existingOpportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(workspaceId.toString()), new mongoose.Types.ObjectId(productId));
        if (existingOpportunities.length > 0) {
          return res.json({
            success: true,
            data: {
              opportunities: existingOpportunities,
              cached: true,
              message: 'Using cached opportunities. Use forceRefresh=true to regenerate.'
            }
          });
        }
      }

      // Get user's connected marketplaces for context
      const userConnections = await StoreConnection.find({ workspaceId, isActive: true });
      const connectedMarketplaces: string[] = [];
      
      userConnections.forEach((conn: any) => {
        if (conn.marketplaceType) {
          connectedMarketplaces.push(conn.marketplaceType);
        }
      });

      // Remove existing opportunities if force refresh
      if (forceRefresh) {
        await Opportunity.deleteMany({ workspaceId, productId });
      }

      // Generate new opportunities using AI
      console.log(`Generating opportunities for product ${productId} (user: ${workspaceId})`);
      
      const generatedOpportunities = await aiService.default.generateProductOpportunities(
        product.toObject() as any, 
        connectedMarketplaces
      );

      // Save opportunities to database
      const savedOpportunities = await Promise.all(
        generatedOpportunities.map(async (oppData: any) => {
          // Validate opportunity data
          const validation = aiService.default.validateOpportunity(oppData);
          if (!validation.valid) {
            console.warn('Invalid opportunity data:', validation.error, oppData);
            return null;
          }

          const opportunity = new Opportunity({
            workspaceId,
            productId,
            category: oppData.category,
            marketplace: oppData.marketplace || null,
            title: oppData.title,
            description: oppData.description,
            priority: oppData.priority,
            potentialImpact: oppData.potentialImpact || { revenue: 0, percentage: 0 },
            actionRequired: oppData.actionRequired,
            aiMetadata: oppData.aiMetadata
          });

          return await opportunity.save();
        })
      );

      // Filter out null values (invalid opportunities)
      const validOpportunities = savedOpportunities.filter((opp: any) => opp !== null);

      console.log(`Generated ${validOpportunities.length} opportunities for product ${productId}`);

      // Group by category for response
      const groupedOpportunities: Record<string, any[]> = {};
      validOpportunities.forEach((opp: any) => {
        if (!groupedOpportunities[opp.category]) {
          groupedOpportunities[opp.category] = [];
        }
        groupedOpportunities[opp.category].push(opp);
      });

      // Get category counts
      const categoryCounts: Record<string, number> = {};
      validOpportunities.forEach((opp: any) => {
        categoryCounts[opp.category] = (categoryCounts[opp.category] || 0) + 1;
      });

      res.json({
        success: true,
        data: {
          opportunities: groupedOpportunities,
          categoryCounts,
          totalCount: validOpportunities.length,
          cached: false,
          generatedAt: new Date().toISOString(),
          message: `Generated ${validOpportunities.length} new opportunities`
        }
      });
    });
  } catch (error: any) {
    console.error('Generate opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate opportunities'
    });
  }
});

// PATCH /api/opportunities/:id/status - Update opportunity status
router.patch('/:id/status', async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { id } = req.params;
      const status = (req.body as any)?.status;
      const workspaceId = req.workspace!._id;

      if (!['open', 'in_progress', 'completed', 'dismissed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      
      const opportunity = await Opportunity.findOne({ _id: id, workspaceId });
      if (!opportunity) {
        return res.status(404).json({
          success: false,
          message: 'Opportunity not found'
        });
      }

      opportunity.status = status;
      await opportunity.save();

      res.json({
        success: true,
        data: {
          opportunity,
          message: `Opportunity marked as ${status}`
        }
      });
    });
  } catch (error: any) {
    console.error('Update opportunity status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update opportunity status'
    });
  }
});

// GET /api/opportunities/products/:id/summary - Get opportunity summary
router.get('/products/:id/summary', async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
  try {
    await protect(req, res, async () => {
      const { id: productId } = req.params;
      const workspaceId = req.workspace!._id;

      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const opportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(workspaceId.toString()), new mongoose.Types.ObjectId(productId));

      // Calculate summary stats
      const stats = {
        total: opportunities.length,
        byPriority: {
          critical: opportunities.filter((o: any) => o.priority === 'critical').length,
          high: opportunities.filter((o: any) => o.priority === 'high').length,
          medium: opportunities.filter((o: any) => o.priority === 'medium').length,
          low: opportunities.filter((o: any) => o.priority === 'low').length
        },
        byStatus: {
          open: opportunities.filter((o: any) => o.status === 'open').length,
          in_progress: opportunities.filter((o: any) => o.status === 'in_progress').length,
          completed: opportunities.filter((o: any) => o.status === 'completed').length
        },
        totalPotentialImpact: opportunities.reduce((sum: number, o: any) => 
          sum + (o.potentialImpact?.percentage || 0), 0
        )
      };

      res.json({
        success: true,
        data: stats
      });
    });
  } catch (error: any) {
    console.error('Get opportunity summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch opportunity summary'
    });
  }
});

// Validation schema for bulk actions
const bulkActionSchema = Joi.object({
  opportunityIds: Joi.array().items(Joi.string().required()).min(1).required(),
  action: Joi.string().valid('complete', 'dismiss', 'delete').required(),
});

// POST /api/opportunities/bulk-action - Perform bulk actions on opportunities
router.post('/bulk-action', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = bulkActionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { opportunityIds, action } = req.body;
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    let updateData: any = {
      updatedAt: new Date(),
    };

    switch (action) {
      case 'complete':
        updateData.status = 'completed';
        break;
      case 'dismiss':
        updateData.status = 'dismissed';
        break;
      case 'delete':
        // For delete, we'll actually remove the opportunities
        const deleteResult = await Opportunity.deleteMany({
          _id: { $in: opportunityIds },
          userId,
          workspaceId,
        });

        return res.json({
          success: true,
          message: `Deleted ${deleteResult.deletedCount} opportunities`,
          data: {
            affectedCount: deleteResult.deletedCount,
            action: 'delete',
          }
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Update opportunities for complete and dismiss actions
    const updateResult = await Opportunity.updateMany(
      {
        _id: { $in: opportunityIds },
        userId,
        workspaceId,
      },
      updateData
    );

    res.json({
      success: true,
      message: `${action === 'complete' ? 'Completed' : 'Dismissed'} ${updateResult.modifiedCount} opportunities`,
      data: {
        affectedCount: updateResult.modifiedCount,
        action,
      }
    });

  } catch (error: any) {
    console.error('Bulk action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action',
      error: error.message
    });
  }
});

export default router;
