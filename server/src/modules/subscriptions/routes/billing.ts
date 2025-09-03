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
        console.log('Subscription deleted webhook received:', {
          subscriptionId: deletedSubscription.id,
          status: deletedSubscription.status,
          canceled_at: deletedSubscription.canceled_at,
          cancel_at_period_end: (deletedSubscription as any).cancel_at_period_end
        });
        
        // Find and update subscription as cancelled in our database
        const existingSubscription = await Subscription.findByStripeId(deletedSubscription.id);
        if (existingSubscription) {
          console.log('Updating subscription status to CANCELLED:', {
            dbSubscriptionId: existingSubscription._id,
            currentStatus: existingSubscription.status,
            stripeSubscriptionId: deletedSubscription.id
          });
          
          // Update subscription with cancellation details
          existingSubscription.status = 'CANCELLED';
          
          // Only set cancelledAt if not already set (avoid overriding API cancellation timestamp)
          if (!existingSubscription.cancelledAt) {
            existingSubscription.cancelledAt = deletedSubscription.canceled_at 
              ? new Date(deletedSubscription.canceled_at * 1000) 
              : new Date();
          }
          
          // Clear any pending schedule since subscription is now cancelled
          if (existingSubscription.stripeScheduleId) {
            console.log('Clearing schedule ID from cancelled subscription:', existingSubscription.stripeScheduleId);
            existingSubscription.stripeScheduleId = undefined;
          }
          
          await existingSubscription.save();
          console.log('Subscription successfully marked as cancelled via webhook');
        } else {
          console.warn('Webhook received for subscription not found in database:', deletedSubscription.id);
        }
        break;

      case 'subscription_schedule.completed':
        const completedSchedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log('Subscription schedule completed:', completedSchedule.id);
        
        // Find subscription with this schedule ID and clear it
        const subscriptionWithSchedule = await Subscription.findOne({ 
          stripeScheduleId: completedSchedule.id 
        });
        
        if (subscriptionWithSchedule) {
          console.log('Clearing completed schedule ID from subscription:', subscriptionWithSchedule._id);
          subscriptionWithSchedule.stripeScheduleId = undefined;
          await subscriptionWithSchedule.save();
        }
        break;

      case 'subscription_schedule.canceled':
        const cancelledSchedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log('Subscription schedule cancelled:', cancelledSchedule.id);
        
        // Find subscription with this schedule ID and clear it
        const subscriptionWithCancelledSchedule = await Subscription.findOne({ 
          stripeScheduleId: cancelledSchedule.id 
        });
        
        if (subscriptionWithCancelledSchedule) {
          console.log('Clearing cancelled schedule ID from subscription:', subscriptionWithCancelledSchedule._id);
          subscriptionWithCancelledSchedule.stripeScheduleId = undefined;
          await subscriptionWithCancelledSchedule.save();
        }
        break;

      case 'subscription_schedule.released':
        const releasedSchedule = event.data.object as Stripe.SubscriptionSchedule;
        console.log('Subscription schedule released:', releasedSchedule.id);
        
        // Find subscription with this schedule ID and clear it
        const subscriptionWithReleasedSchedule = await Subscription.findOne({ 
          stripeScheduleId: releasedSchedule.id 
        });
        
        if (subscriptionWithReleasedSchedule) {
          console.log('Clearing released schedule ID from subscription:', subscriptionWithReleasedSchedule._id);
          subscriptionWithReleasedSchedule.stripeScheduleId = undefined;
          await subscriptionWithReleasedSchedule.save();
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
    const { contributorType, contributorCount = 1, billingCycle = 'monthly', embedded = true } = req.body;

    if (!contributorType) {
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
      const plan = await Plan.findByContributorType(contributorType);
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
          url: `/subscription?plan=${contributorType}&contributors=${count}&cycle=${billingCycle}`,
          contributorType: plan.contributorType,
          planDisplayName: plan.displayName,
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
      contributorType,
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