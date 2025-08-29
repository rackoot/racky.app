import express, { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect } from '@/common/middleware/auth';
import Plan from '../models/Plan';
import Subscription from '../models/Subscription';
import { 
  createEmbeddedCheckoutSession, 
  createCheckoutSession, 
  verifyWebhookSignature, 
  handleSuccessfulPayment,
  isStripeConfigured 
} from '@/common/services/stripeService';
import { getEnv } from '@/common/config/env';
import Stripe from 'stripe';

const router = express.Router();

// Exported Stripe webhook handler (used in main app routing to avoid auth middleware)
export const stripeWebhookHandler = async (req: express.Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      console.log('Stripe not configured, webhook ignored');
      return res.status(200).send('Webhook acknowledged - Stripe not configured');
    }

    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      console.error('No Stripe signature found');
      return res.status(400).send('No signature found');
    }

    // Verify webhook signature
    const event = verifyWebhookSignature(req.body, signature);
    
    console.log('Received Stripe webhook:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Checkout session completed:', event.data.object.id);
        // The subscription is created automatically by Stripe
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription event:', subscription.id, subscription.status);
        await handleSuccessfulPayment(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', deletedSubscription.id);
        
        // Mark subscription as cancelled in our database
        const existingSubscription = await Subscription.findByStripeId(deletedSubscription.id);
        if (existingSubscription) {
          existingSubscription.status = 'CANCELLED';
          await existingSubscription.save();
        }
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded for invoice:', invoice.id);
        break;
        
      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', failedInvoice.id);
        break;
        
      default:
        console.log('Unhandled event type:', event.type);
    }

    res.status(200).send('Webhook processed successfully');
    
  } catch (error: any) {
    console.error('Webhook error:', error);
    
    if (error.message.includes('signature')) {
      return res.status(400).send('Invalid signature');
    }
    
    return res.status(500).send('Webhook processing failed');
  }
};

// POST /api/billing/create-checkout-session - Create checkout session for contributor-based plans
router.post('/create-checkout-session', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planName, contributorCount = 1, billingCycle = 'monthly', embedded = true } = req.body;

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

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      const env = getEnv();
      
      // Only allow demo/mock checkout in development environment
      if (env.NODE_ENV !== 'development') {
        return res.status(503).json({
          success: false,
          message: 'Payment system temporarily unavailable',
          error: 'Stripe payment gateway is not configured for this environment'
        });
      }
      
      // Fallback to mock for development/testing
      const plan = await Plan.findByName(planName);
      if (!plan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
      }

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

      const count = Math.max(1, Math.min(contributorCount, plan.maxContributorsPerWorkspace));
      const totalAmount = billingCycle === 'yearly' ? 
        plan.getTotalYearlyPrice(count) : 
        plan.getTotalMonthlyPrice(count);
      const totalActions = plan.getTotalActionsPerMonth(count);

      return res.json({
        success: true,
        message: 'Checkout session created (mock mode)',
        data: {
          sessionId: 'mock_session_id',
          url: `/subscription?plan=${planName}&contributors=${count}&cycle=${billingCycle}`,
          planName: plan.name,
          planDisplayName: plan.displayName,
          contributorType: plan.contributorType,
          contributorCount: count,
          totalAmount,
          totalActions: totalActions === -1 ? 'Unlimited' : totalActions,
          billingCycle,
          pricePerContributor: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice,
          isProduction: false
        }
      });
    }

    // Create real Stripe checkout session
    const checkoutParams = {
      planName,
      contributorCount,
      billingCycle,
      workspace: req.workspace,
      userId: req.user._id.toString()
    };

    const checkoutResult = embedded 
      ? await createEmbeddedCheckoutSession(checkoutParams)
      : await createCheckoutSession(checkoutParams);

    res.json({
      success: true,
      message: 'Checkout session created successfully',
      data: {
        sessionId: checkoutResult.sessionId,
        clientSecret: checkoutResult.clientSecret,
        url: checkoutResult.url,
        embedded: embedded,
        isProduction: true
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

// Note: Stripe webhook handler moved to main app routing to avoid JWT auth middleware

export default router;