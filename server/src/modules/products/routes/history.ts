import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect, requireWorkspace } from '@/common/middleware/auth';
import ProductHistoryService from '../services/ProductHistoryService';
import { ActionType, ActionStatus } from '../models/ProductHistory';

const router = express.Router();

// Validation schemas
const getHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
  actionType: Joi.array().items(Joi.string().valid(
    'SYNC_FROM_MARKETPLACE', 'SYNC_TO_MARKETPLACE', 'BULK_SYNC',
    'AI_OPTIMIZATION_GENERATED', 'AI_OPTIMIZATION_ACCEPTED', 'AI_OPTIMIZATION_REJECTED', 'AI_OPTIMIZATION_APPLIED',
    'AI_BULK_SCAN_STARTED', 'AI_BULK_SCAN_COMPLETED',
    'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED',
    'DESCRIPTION_UPDATED', 'PRICE_UPDATED', 'INVENTORY_UPDATED', 'STATUS_CHANGED',
    'MARKETPLACE_CONNECTED', 'MARKETPLACE_DISCONNECTED', 'STORE_CONFIGURATION_CHANGED',
    'SYNC_FAILED', 'API_ERROR', 'VALIDATION_ERROR'
  )).optional(),
  actionStatus: Joi.array().items(Joi.string().valid(
    'PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED'
  )).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

interface GetHistoryQuery {
  limit?: number;
  offset?: number;
  actionType?: ActionType[];
  actionStatus?: ActionStatus[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * GET /api/products/:id/history
 * Get history for a specific product
 */
router.get('/:id/history', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: productId } = req.params;
    const workspaceId = req.workspace!._id.toString();
    
    // Validate query parameters
    const { error, value } = getHistorySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const options: GetHistoryQuery = value;

    // Get product history
    const history = await ProductHistoryService.getProductHistory(
      productId,
      workspaceId,
      options
    );

    res.json({
      success: true,
      data: {
        history: history.map(h => ({
          id: h._id,
          actionType: h.actionType,
          actionStatus: h.actionStatus,
          actionSource: h.actionSource,
          title: h.title,
          description: h.description,
          metadata: h.metadata,
          startedAt: h.startedAt,
          completedAt: h.completedAt,
          duration: h.duration,
          relatedJobId: h.relatedJobId,
          relatedBatchId: h.relatedBatchId,
          parentHistoryId: h.parentHistoryId,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
          // Populate user info if available
          user: h.userId ? {
            id: h.userId,
            // Add user fields if populated
          } : null,
          // Populate store connection info if available
          storeConnection: h.storeConnectionId ? {
            id: h.storeConnectionId,
            // Add store connection fields if populated
          } : null
        })),
        pagination: {
          limit: options.limit || 50,
          offset: options.offset || 0,
          total: history.length
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching product history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product history',
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id/history/stats
 * Get history statistics for a product
 */
router.get('/:id/history/stats', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: productId } = req.params;
    const workspaceId = req.workspace!._id.toString();

    // Get all history for stats
    const allHistory = await ProductHistoryService.getProductHistory(productId, workspaceId, { limit: 1000 });

    // Calculate statistics
    const stats = {
      total: allHistory.length,
      byActionType: {} as Record<string, number>,
      byActionStatus: {} as Record<string, number>,
      byActionSource: {} as Record<string, number>,
      recentActivity: allHistory.slice(0, 5).map(h => ({
        id: h._id,
        actionType: h.actionType,
        title: h.title,
        actionStatus: h.actionStatus,
        createdAt: h.createdAt
      })),
      lastSync: null as Date | null,
      lastAIOptimization: null as Date | null,
      failureRate: 0
    };

    // Calculate counts by category
    let failureCount = 0;
    allHistory.forEach(h => {
      // Count by action type
      stats.byActionType[h.actionType] = (stats.byActionType[h.actionType] || 0) + 1;
      
      // Count by status
      stats.byActionStatus[h.actionStatus] = (stats.byActionStatus[h.actionStatus] || 0) + 1;
      
      // Count by source
      stats.byActionSource[h.actionSource] = (stats.byActionSource[h.actionSource] || 0) + 1;

      // Track failures
      if (h.actionStatus === 'FAILED') {
        failureCount++;
      }

      // Track last sync
      if (h.actionType.includes('SYNC') && (!stats.lastSync || h.createdAt > stats.lastSync)) {
        stats.lastSync = h.createdAt;
      }

      // Track last AI optimization
      if (h.actionType.includes('AI_OPTIMIZATION') && (!stats.lastAIOptimization || h.createdAt > stats.lastAIOptimization)) {
        stats.lastAIOptimization = h.createdAt;
      }
    });

    // Calculate failure rate
    stats.failureRate = stats.total > 0 ? Math.round((failureCount / stats.total) * 100) : 0;

    res.json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Error fetching product history stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product history statistics',
      error: error.message
    });
  }
});

/**
 * GET /api/products/history/workspace
 * Get workspace-wide activity history
 */
router.get('/history/workspace', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = req.workspace!._id.toString();
    
    // Validate query parameters
    const { error, value } = getHistorySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const options: GetHistoryQuery = value;

    // Get workspace activity using direct query instead of static method
    const query: any = { workspaceId };
    
    if (options.actionType?.length) {
      query.actionType = { $in: options.actionType };
    }
    
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        query.createdAt.$lte = options.endDate;
      }
    }
    
    const ProductHistory = (await import('../models/ProductHistory')).default;
    
    const history = await ProductHistory.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('productId', 'title marketplace')
      .populate('storeConnectionId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(options.limit || 100)
      .skip(options.offset || 0);

    res.json({
      success: true,
      data: {
        history: history.map(h => ({
          id: h._id,
          actionType: h.actionType,
          actionStatus: h.actionStatus,
          actionSource: h.actionSource,
          title: h.title,
          description: h.description,
          metadata: h.metadata,
          startedAt: h.startedAt,
          completedAt: h.completedAt,
          duration: h.duration,
          relatedJobId: h.relatedJobId,
          relatedBatchId: h.relatedBatchId,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
          // Include populated data if available
          user: h.userId,
          product: h.productId,
          storeConnection: h.storeConnectionId
        })),
        pagination: {
          limit: options.limit || 100,
          offset: options.offset || 0,
          total: history.length
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching workspace history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace history',
      error: error.message
    });
  }
});

export default router;