import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { asString } from '@/common/utils/queryParams';
import { protect, trackUsage, requireWorkspace, requireWorkspacePermission } from '@/common/middleware/auth';
import Usage from '../models/Usage';
import User from '@/auth/models/User';
import StoreConnection from '@/stores/models/StoreConnection';
import Product from '@/products/models/Product';

const router = express.Router();

router.use(protect);
router.use(requireWorkspace);

interface TrackUsageBody {
  metric: string;
  value?: number;
}

interface UsageHistoryQuery {
  days?: string;
}

// GET /api/usage/current - Get current usage statistics
router.get('/current', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      const workspaceId = req.workspace!._id;
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      // Get current month's usage using workspace-based approach
      const currentUsage = await Usage.getCurrentMonthUsage(workspaceId.toString());

      // Get actual counts from database using workspace
      const [storeCount, productCount] = await Promise.all([
        StoreConnection.countDocuments({ workspaceId, isActive: true }),
        Product.countDocuments({ workspaceId })
      ]);

      // Calculate storage usage based on actual data
      const storageUsed = Math.floor(productCount * 0.5); // Estimate 0.5MB per product

      // Get workspace plan limits
      const workspacePlan = await req.workspace!.getCurrentPlan();

      const usageData = {
        currentPeriod: {
          apiCalls: currentUsage?.apiCalls || 0,
          productSyncs: currentUsage?.productSyncs || 0,
          storesConnected: storeCount,
          storageUsed,
          features: {
            aiSuggestions: currentUsage?.aiSuggestions || 0,
            opportunityScans: currentUsage?.opportunityScans || 0,
            bulkOperations: currentUsage?.bulkOperations || 0
          }
        },
        limits: workspacePlan ? {
          maxStores: workspacePlan.limits.maxStores,
          maxProducts: workspacePlan.limits.maxProducts,
          maxMarketplaces: workspacePlan.limits.maxMarketplaces,
          apiCallsPerMonth: workspacePlan.limits.apiCallsPerMonth
        } : {
          maxStores: 1,
          maxProducts: 100,
          maxMarketplaces: 1,
          apiCallsPerMonth: 1000
        }
      };

      res.json({
        success: true,
        data: usageData
      });
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage data',
      error: error.message
    });
  }
});

// GET /api/usage/history - Get usage history
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      const workspaceId = req.workspace!._id;
      const days = parseInt(asString(req.query.days, '7')); // Default to 7 days for better performance
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get usage history using workspace-based approach
      const usageHistory = await Usage.find({
        workspaceId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1 });

      // Fill in missing days with zero values
      const filledHistory: any[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const existingUsage = usageHistory.find((u: any) =>
          u.date.toISOString().split('T')[0] === dateStr
        );

        filledHistory.push({
          date: dateStr,
          apiCalls: existingUsage?.apiCalls || 0,
          productSyncs: existingUsage?.productSyncs || 0,
          storageUsed: existingUsage?.storageUsed || 0
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        success: true,
        data: filledHistory
      });
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage history',
      error: error.message
    });
  }
});

// GET /api/usage/trends - Get usage trends and growth
router.get('/trends', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      const workspaceId = req.workspace!._id;
      const currentDate = new Date();

      // Current month
      const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      // Previous month
      const previousMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const previousMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

      const [currentMonth, previousMonth] = await Promise.all([
        Usage.aggregate([
          {
            $match: {
              workspaceId,
              date: { $gte: currentMonthStart, $lt: currentMonthEnd }
            }
          },
          {
            $group: {
              _id: null,
              apiCalls: { $sum: '$apiCalls' },
              productSyncs: { $sum: '$productSyncs' },
              storageUsed: { $sum: '$storageUsed' },
              aiSuggestions: { $sum: '$aiSuggestions' },
              opportunityScans: { $sum: '$opportunityScans' },
              bulkOperations: { $sum: '$bulkOperations' }
            }
          }
        ]),
        Usage.aggregate([
          {
            $match: {
              workspaceId,
              date: { $gte: previousMonthStart, $lt: previousMonthEnd }
            }
          },
          {
            $group: {
              _id: null,
              apiCalls: { $sum: '$apiCalls' },
              productSyncs: { $sum: '$productSyncs' },
              storageUsed: { $sum: '$storageUsed' },
              aiSuggestions: { $sum: '$aiSuggestions' },
              opportunityScans: { $sum: '$opportunityScans' },
              bulkOperations: { $sum: '$bulkOperations' }
            }
          }
        ])
      ]);

      const current = currentMonth[0] || {};
      const previous = previousMonth[0] || {};

      const calculateGrowth = (current: number, previous: number): number => {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      const trends = {
        apiCallsGrowth: calculateGrowth(current.apiCalls || 0, previous.apiCalls || 0),
        productsSyncGrowth: calculateGrowth(current.productSyncs || 0, previous.productSyncs || 0),
        storageGrowth: calculateGrowth(current.storageUsed || 0, previous.storageUsed || 0)
      };

      res.json({
        success: true,
        data: trends
      });
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage trends',
      error: error.message
    });
  }
});

// GET /api/usage/limits - Get current usage vs limits
router.get('/limits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      const workspaceId = req.workspace!._id;

      // Get current counts using workspace
      const [storeCount, productCount] = await Promise.all([
        StoreConnection.countDocuments({ workspaceId, isActive: true }),
        Product.countDocuments({ workspaceId })
      ]);

      // Get current month API usage using workspace
      const currentUsage = await Usage.getCurrentMonthUsage(workspaceId.toString());

      // Get workspace plan
      const workspacePlan = await req.workspace!.getCurrentPlan();
      const limits = workspacePlan ? workspacePlan.limits : {
        maxStores: 1,
        maxProducts: 100,
        maxMarketplaces: 1,
        apiCallsPerMonth: 1000
      };

      const usageLimits = {
        stores: {
          current: storeCount,
          limit: limits.maxStores,
          percentage: Math.round((storeCount / limits.maxStores) * 100),
          remaining: Math.max(0, limits.maxStores - storeCount)
        },
        products: {
          current: productCount,
          limit: limits.maxProducts,
          percentage: Math.round((productCount / limits.maxProducts) * 100),
          remaining: Math.max(0, limits.maxProducts - productCount)
        },
        apiCalls: {
          current: currentUsage?.apiCalls || 0,
          limit: limits.apiCallsPerMonth,
          percentage: Math.round(((currentUsage?.apiCalls || 0) / limits.apiCallsPerMonth) * 100),
          remaining: Math.max(0, limits.apiCallsPerMonth - (currentUsage?.apiCalls || 0))
        }
      };

      res.json({
        success: true,
        data: usageLimits
      });
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage limits',
      error: error.message
    });
  }
});

// POST /api/usage/track - Manual usage tracking (for testing)
router.post('/track', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await trackUsage('api_call')(req, res, async () => {
      const { metric, value = 1 } = req.body;

      if (!metric) {
        return res.status(400).json({
          success: false,
          message: 'Metric is required'
        });
      }

      const workspaceId = req.workspace!._id;
      await Usage.incrementWorkspaceUsage(workspaceId.toString(), metric, value);

      res.json({
        success: true,
        message: `Successfully tracked ${value} ${metric}(s)`
      });
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error tracking usage',
      error: error.message
    });
  }
});

// GET /api/usage/:workspaceId - Get workspace usage statistics
router.get('/:workspaceId', requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get current month usage
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [currentUsage, storeCount, productCount] = await Promise.all([
      Usage.findOne({
        workspaceId: req.workspace!._id,
        date: {
          $gte: startOfMonth,
          $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
        }
      }),
      StoreConnection.countDocuments({ workspaceId: req.workspace!._id, isActive: true }),
      Product.countDocuments({ workspaceId: req.workspace!._id })
    ]);

    const currentPlan = await req.workspace!.getCurrentPlan();
    
    const usageData = {
      workspaceId: req.workspace!._id,
      workspaceName: req.workspace!.name,
      currentPeriod: {
        month: currentDate.toISOString().slice(0, 7), // YYYY-MM format
        apiCalls: currentUsage?.apiCalls || 0,
        productSyncs: currentUsage?.productSyncs || 0,
        storesConnected: storeCount,
        totalProducts: productCount,
        features: {
          aiSuggestions: currentUsage?.aiSuggestions || 0,
          opportunityScans: currentUsage?.opportunityScans || 0,
          bulkOperations: currentUsage?.bulkOperations || 0
        }
      },
      limits: currentPlan ? {
        maxStores: currentPlan.limits.maxStores,
        maxProducts: currentPlan.limits.maxProducts,
        maxMarketplaces: currentPlan.limits.maxMarketplaces,
        apiCallsPerMonth: currentPlan.limits.apiCallsPerMonth
      } : null,
      percentageUsed: currentPlan ? {
        stores: Math.round((storeCount / currentPlan.limits.maxStores) * 100),
        products: Math.round((productCount / currentPlan.limits.maxProducts) * 100),
        apiCalls: Math.round(((currentUsage?.apiCalls || 0) / currentPlan.limits.apiCallsPerMonth) * 100)
      } : null
    };
    
    res.json({
      success: true,
      message: 'Workspace usage retrieved successfully',
      data: usageData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace usage',
      error: (error as Error).message
    });
  }
});

export default router;
