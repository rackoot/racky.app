import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect } from '@/common/middleware/auth';
import Plan from '../models/Plan';
import Subscription from '../models/Subscription';

const router = express.Router();

// POST /api/billing/create-checkout-session - Create checkout session for contributor-based plans
router.post('/create-checkout-session', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planName, contributorCount = 1, billingCycle = 'monthly' } = req.body;

    if (!planName) {
      return res.status(400).json({
        success: false,
        message: 'Plan name is required'
      });
    }

    if (!req.workspace) {
      return res.status(400).json({
        success: false,
        message: 'Workspace context required'
      });
    }

    // Find the plan
    const plan = await Plan.findByName(planName);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if Executive plan (contact sales only)
    if (plan.isContactSalesOnly) {
      return res.status(400).json({
        success: false,
        message: 'This plan requires contacting sales',
        data: {
          contactFormUrl: 'https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1',
          planType: plan.displayName
        }
      });
    }

    // Validate contributor count
    const count = Math.max(1, Math.min(contributorCount, plan.maxContributorsPerWorkspace));
    
    // Calculate pricing
    const totalAmount = billingCycle === 'yearly' ? 
      plan.getTotalYearlyPrice(count) : 
      plan.getTotalMonthlyPrice(count);

    const totalActions = plan.getTotalActionsPerMonth(count);

    // For now, return pricing information instead of actual Stripe session
    // This would be replaced with actual Stripe integration
    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        // Mock checkout URL - replace with actual Stripe session URL
        url: `/subscription?plan=${planName}&contributors=${count}&cycle=${billingCycle}`,
        planName: plan.name,
        planDisplayName: plan.displayName,
        contributorType: plan.contributorType,
        contributorCount: count,
        totalAmount,
        totalActions: totalActions === -1 ? 'Unlimited' : totalActions,
        billingCycle,
        pricePerContributor: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
      }
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
});

// POST /api/billing/update-contributors - Update contributor count for existing subscription
router.post('/update-contributors', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { contributorCount } = req.body;

    if (!req.workspace) {
      return res.status(400).json({
        success: false,
        message: 'Workspace context required'
      });
    }

    if (!contributorCount || contributorCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid contributor count is required'
      });
    }

    // Find active subscription for the workspace
    const subscription = await req.workspace.getActiveSubscription();
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found for this workspace'
      });
    }

    // Update contributor count
    await subscription.updateContributorCount(contributorCount);
    await subscription.populate('planId');

    res.json({
      success: true,
      message: 'Contributor count updated successfully',
      data: {
        contributorCount: subscription.contributorCount,
        totalMonthlyActions: subscription.totalMonthlyActions,
        newAmount: subscription.amount,
        planDisplayName: (subscription.planId as any).displayName
      }
    });

  } catch (error: any) {
    console.error('Error updating contributor count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contributor count',
      error: error.message
    });
  }
});

router.post('/stripe/webhook', (req: express.Request, res: Response) => {
  // Acknowledge webhook but don't process during migration
  res.status(200).send('Webhook acknowledged - system under maintenance');
});

router.get('/subscription', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Subscription information temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED'
    }
  });
});

router.post('/cancel-subscription', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Subscription management temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED',
      alternativeAction: 'Please contact support for cancellation requests'
    }
  });
});

router.get('/invoices', (req: AuthenticatedRequest, res: Response) => {
  res.status(503).json({
    success: false,
    message: 'Invoice access temporarily unavailable',
    maintenanceInfo: {
      reason: 'Migration to workspace-based subscriptions in progress',
      status: 'TEMPORARILY_DISABLED'
    }
  });
});

export default router;