import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import Plan from '@/subscriptions/models/Plan';
import { protect } from '@/common/middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Interface definitions
interface UpgradeSubscriptionBody {
  planName: string;
  billingCycle?: 'monthly' | 'yearly';
}

// POST /api/demo/upgrade-subscription - Demo subscription upgrade
router.post('/upgrade-subscription', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planName, billingCycle = 'monthly' } = req.body;
    
    if (!planName) {
      return res.status(400).json({
        success: false,
        message: 'Plan name is required'
      });
    }

    
    // Get the plan details to validate it exists
    const plan = await Plan.findByName(planName);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    console.log(`Demo: Upgrading user ${req.user!.email} to ${planName} plan`);
    
    // Update user subscription directly (demo mode)
    req.user!.subscriptionPlan = planName as any;
    req.user!.subscriptionStatus = 'ACTIVE';
    
    // Set subscription end date (30 days from now)
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    req.user!.subscriptionEndsAt = subscriptionEndDate;
    
    await req.user!.save();
    
    res.json({
      success: true,
      message: `Successfully upgraded to ${planName} plan (demo mode)`,
      data: {
        plan: planName,
        status: 'ACTIVE',
        endsAt: subscriptionEndDate
      }
    });

  } catch (error: any) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

export default router;
