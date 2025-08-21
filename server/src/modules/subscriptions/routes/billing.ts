import express, { Response, Request } from 'express';
import Stripe from 'stripe';
import { AuthenticatedRequest } from '../../../_common/types/express';

const router = express.Router();

// Dynamic imports to avoid circular dependencies
const getPlanModel = async () => (await import('../models/Plan')).default;
const getUserModel = async () => (await import('../../auth/models/User')).default;
const getSubscriptionModel = async () => (await import('../models/Subscription')).default;
const getAuthMiddleware = async () => (await import('../../../_common/middleware/auth')).protect;

// Initialize Stripe only if API key is provided
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-07-30.basil'
  });
}

// Apply authentication to all routes except webhook
router.use('/webhook', (req, res, next) => next()); // Webhook needs raw body
router.use(async (req: AuthenticatedRequest, res: Response, next) => {
  const protect = await getAuthMiddleware();
  protect(req, res, next);
});

interface CreateCheckoutSessionBody {
  planName: string;
  billingCycle?: 'monthly' | 'yearly';
}

// POST /api/billing/create-checkout-session
router.post('/create-checkout-session', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planName, billingCycle = 'monthly' } = req.body;
    
    if (!planName) {
      return res.status(400).json({
        success: false,
        message: 'Plan name is required'
      });
    }

    // Get the plan details
    const Plan = await getPlanModel();
    const plan = await Plan.findByName(planName);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key_here') {
      // For demo purposes, just redirect to a demo checkout page
      console.log(`Demo mode: Would create checkout session for ${planName} for user ${req.user!.email}`);
      
      return res.json({
        success: true,
        data: {
          sessionId: 'demo_session_' + Date.now(),
          url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/demo-checkout?plan=${planName}&billing=${billingCycle}`
        }
      });
    }

    // Get the correct Stripe price ID
    const priceId = billingCycle === 'yearly' 
      ? plan.stripeYearlyPriceId 
      : plan.stripeMonthlyPriceId;

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: req.user!.email,
      client_reference_id: req.user!._id.toString(),
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing?canceled=true`,
      metadata: {
        userId: req.user!._id.toString(),
        planName: planName,
        billingCycle: billingCycle
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
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

// POST /api/billing/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body as Stripe.Event;
    }
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

// Helper functions for webhook handlers
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.client_reference_id;
  if (!userId) return;

  const User = await getUserModel();
  const Plan = await getPlanModel();
  const Subscription = await getSubscriptionModel();

  const user = await User.findById(userId);
  
  if (!user) {
    console.error('User not found for checkout session:', userId);
    return;
  }

  // Update user with Stripe customer info
  user.stripeCustomerId = session.customer as string;
  user.stripeSubscriptionId = session.subscription as string;
  user.subscriptionStatus = 'ACTIVE';
  user.subscriptionPlan = session.metadata?.planName as any;
  
  // Set subscription end date (30 days from now for example)
  const subscriptionEndDate = new Date();
  subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
  user.subscriptionEndsAt = subscriptionEndDate;

  await user.save();

  // Create subscription record
  const plan = await Plan.findByName(session.metadata?.planName || '');
  if (plan) {
    await Subscription.create({
      userId: user._id,
      planId: plan._id,
      stripeSubscriptionId: session.subscription,
      stripeCustomerId: session.customer,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: subscriptionEndDate
    });
  }

  console.log('Subscription activated for user:', user.email);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const User = await getUserModel();
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (user) {
    user.subscriptionStatus = subscription.status === 'active' ? 'ACTIVE' : 'SUSPENDED';
    await user.save();
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const User = await getUserModel();
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (user) {
    user.subscriptionStatus = 'CANCELLED';
    await user.save();
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log('Payment succeeded for invoice:', invoice.id);
  // Update subscription end date, etc.
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log('Payment failed for invoice:', invoice.id);
  // Handle failed payment - send email, suspend account, etc.
}

// GET /api/billing/portal - Create customer portal session
router.post('/portal', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key_here') {
      // For demo purposes, redirect to pricing page
      return res.json({
        success: true,
        data: {
          url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing?demo=true`
        }
      });
    }

    if (!req.user!.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found for this user'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: req.user!.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/subscription`,
    });

    res.json({
      success: true,
      data: {
        url: session.url
      }
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create portal session',
      error: error.message
    });
  }
});

export default router;
