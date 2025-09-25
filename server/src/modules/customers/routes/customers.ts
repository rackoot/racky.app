import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../../../common/types/express';
import { CustomersService, CustomerQuery } from '../services/customersService';

const router = Router();

/**
 * GET /api/customers
 * Get all customers for the current workspace
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    const query: CustomerQuery = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      marketplace: req.query.marketplace as string,
      storeConnectionId: req.query.storeConnectionId as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as any || 'createdDate',
      sortOrder: req.query.sortOrder as any || 'desc'
    };

    const result = await CustomersService.getCustomers(workspaceId, query);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch customers'
    });
  }
});

/**
 * GET /api/customers/:id
 * Get a single customer by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);
    const { id } = req.params;

    const customer = await CustomersService.getCustomerById(workspaceId, id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch customer'
    });
  }
});

/**
 * POST /api/customers/sync
 * Sync customers from all connected stores
 */
router.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    const result = await CustomersService.syncAllStoresCustomers(workspaceId);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedCustomers: result.syncedCustomers,
        newCustomers: result.newCustomers,
        updatedCustomers: result.updatedCustomers,
        errors: result.errors
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync customers'
    });
  }
});

/**
 * POST /api/customers/sync/:storeConnectionId
 * Sync customers from a specific store
 */
router.post('/sync/:storeConnectionId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);
    const { storeConnectionId } = req.params;

    const result = await CustomersService.syncStoreCustomers(workspaceId, storeConnectionId);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        syncedCustomers: result.syncedCustomers,
        newCustomers: result.newCustomers,
        updatedCustomers: result.updatedCustomers,
        errors: result.errors
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync customers from store'
    });
  }
});

/**
 * GET /api/customers/stats/summary
 * Get customers summary statistics
 */
router.get('/stats/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = String(req.workspace!._id);

    // Get basic stats for the current month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [
      totalCustomers,
      monthlyCustomers,
      activeCustomers,
      recentCustomers
    ] = await Promise.all([
      // Total customers count
      (await CustomersService.getCustomers(workspaceId, { limit: 1 })).pagination.total,

      // This month's customers
      (await CustomersService.getCustomers(workspaceId, { limit: 1 })).pagination.total, // TODO: Add date filtering

      // Active customers
      (await CustomersService.getCustomers(workspaceId, { limit: 1 })).pagination.total, // All are active by default

      // Recent customers (last 10)
      (await CustomersService.getCustomers(workspaceId, { limit: 10, sortBy: 'createdDate', sortOrder: 'desc' })).customers
    ]);

    res.json({
      success: true,
      data: {
        totalCustomers,
        monthlyCustomers,
        activeCustomers,
        recentCustomers: recentCustomers.slice(0, 5) // Just return 5 most recent
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch customer statistics'
    });
  }
});

export default router;