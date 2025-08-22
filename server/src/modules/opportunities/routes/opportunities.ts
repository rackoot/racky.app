import express, { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '@/common/types/express';
import Product from '@/products/models/Product';
import Opportunity from '../models/Opportunity';
import OpportunityCategory from '../models/OpportunityCategory';
import StoreConnection from '@/stores/models/StoreConnection';
import * as aiService from '../services/aiService';
import { protect } from '@/common/middleware/auth';

const router = express.Router();

// Interface definitions are handled inline for better compatibility

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
      const userId = req.user!._id;
      const category = req.query.category as string;


      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, userId });
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
        opportunities = await Opportunity.findByCategory(new mongoose.Types.ObjectId(userId.toString()), new mongoose.Types.ObjectId(productId), category as any);
      } else {
        opportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(userId.toString()), new mongoose.Types.ObjectId(productId));
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
      const userConnections = await StoreConnection.find({ userId, isActive: true });
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
      const userId = req.user!._id;
      const forceRefresh = (req.body as any)?.forceRefresh || false;

      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, userId })
        .populate('storeConnectionId');
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Check if we have recent opportunities (unless force refresh)
      if (!forceRefresh) {
        const existingOpportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(userId.toString()), new mongoose.Types.ObjectId(productId));
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
      const userConnections = await StoreConnection.find({ userId, isActive: true });
      const connectedMarketplaces: string[] = [];
      
      userConnections.forEach((conn: any) => {
        if (conn.marketplaceType) {
          connectedMarketplaces.push(conn.marketplaceType);
        }
      });

      // Remove existing opportunities if force refresh
      if (forceRefresh) {
        await Opportunity.deleteMany({ userId, productId });
      }

      // Generate new opportunities using AI
      console.log(`Generating opportunities for product ${productId} (user: ${userId})`);
      
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
            userId,
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
      const userId = req.user!._id;

      if (!['open', 'in_progress', 'completed', 'dismissed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      
      const opportunity = await Opportunity.findOne({ _id: id, userId });
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
      const userId = req.user!._id;

      // Verify product belongs to user
      const product = await Product.findOne({ _id: productId, userId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const opportunities = await Opportunity.findValidForProduct(new mongoose.Types.ObjectId(userId.toString()), new mongoose.Types.ObjectId(productId));

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

export default router;
