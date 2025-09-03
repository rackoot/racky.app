import express, { Request, Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import Plan from '../models/Plan';
import { protect } from '@/common/middleware/auth';

const router = express.Router();

// GET /api/plans - Get all public subscription plans
router.get('/', async (req: Request, res: Response) => {
  try {
        const plans = await Plan.findPublicPlans();
    
    res.json({
      success: true,
      data: plans
    });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription plans',
      error: error.message
    });
  }
});

// GET /api/plans/:name - Get specific plan details
router.get('/:name', async (req: Request<{ name: string }>, res: Response) => {
  try {
    const { name } = req.params;
        const plan = await Plan.findByContributorType(name);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    console.error('Error fetching plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch plan details',
      error: error.message
    });
  }
});

// GET /api/plans/user/current - Get current workspace's plan (requires auth and workspace)
router.get('/user/current', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.workspace) {
      return res.status(400).json({
        success: false,
        message: 'Workspace context required'
      });
    }

    const subscription = await req.workspace.getActiveSubscription();
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found for this workspace'
      });
    }

    res.json({
      success: true,
      data: {
        plan: subscription.planId,
        userSubscription: await req.workspace.getSubscriptionInfo()
      }
    });
  } catch (error: any) {
    console.error('Error fetching workspace plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user plan',
      error: error.message
    });
  }
});

export default router;
