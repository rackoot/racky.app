import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../common/types/express';
import { OrdersService, OrderQuery } from '../services/ordersService';

const router = Router();

/**
 * GET /api/orders
 * Get all orders for the current workspace
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    const query: OrderQuery = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      status: req.query.status as string,
      marketplace: req.query.marketplace as string,
      storeConnectionId: req.query.storeConnectionId as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as any || 'orderDate',
      sortOrder: req.query.sortOrder as any || 'desc'
    };

    const result = await OrdersService.getOrders(workspaceId, query);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    });
  }
});

/**
 * GET /api/orders/:id
 * Get a single order by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);
    const { id } = req.params;

    const order = await OrdersService.getOrderById(workspaceId, id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    });
  }
});

/**
 * POST /api/orders/sync
 * Sync orders from all connected stores
 */
router.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    const result = await OrdersService.syncAllStoresOrders(workspaceId);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedOrders: result.syncedOrders,
        newOrders: result.newOrders,
        updatedOrders: result.updatedOrders,
        errors: result.errors
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync orders'
    });
  }
});

/**
 * POST /api/orders/sync/:storeConnectionId
 * Sync orders from a specific store
 */
router.post('/sync/:storeConnectionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);
    const { storeConnectionId } = req.params;

    const result = await OrdersService.syncStoreOrders(workspaceId, storeConnectionId);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedOrders: result.syncedOrders,
        newOrders: result.newOrders,
        updatedOrders: result.updatedOrders,
        errors: result.errors
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync orders from store'
    });
  }
});

/**
 * GET /api/orders/stats/summary
 * Get orders summary statistics
 */
router.get('/stats/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    // Get basic stats for the current month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [
      totalOrders,
      monthlyOrders,
      pendingOrders,
      recentOrders
    ] = await Promise.all([
      // Total orders count
      (await OrdersService.getOrders(workspaceId, { limit: 1 })).pagination.total,

      // This month's orders
      (await OrdersService.getOrders(workspaceId, { limit: 1 })).pagination.total, // TODO: Add date filtering

      // Pending orders
      (await OrdersService.getOrders(workspaceId, { status: 'pending', limit: 1 })).pagination.total,

      // Recent orders (last 10)
      (await OrdersService.getOrders(workspaceId, { limit: 10, sortBy: 'orderDate', sortOrder: 'desc' })).orders
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        monthlyOrders,
        pendingOrders,
        recentOrders: recentOrders.slice(0, 5) // Just return 5 most recent
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order statistics'
    });
  }
});

export default router;