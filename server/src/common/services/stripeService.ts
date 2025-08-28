import Stripe from 'stripe';
import { getEnv } from '@/common/config/env';
import Plan from '../../modules/subscriptions/models/Plan';
import Subscription from '../../modules/subscriptions/models/Subscription';
import { IWorkspace } from '../../modules/workspaces/models/Workspace';
import Workspace from '../../modules/workspaces/models/Workspace';
import { SubscriptionStatus } from '../../modules/subscriptions/models/Subscription';

const env = getEnv();

let stripe: Stripe | null = null;

// Initialize Stripe only if API key is configured
const getStripeInstance = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
  }
  
  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    });
  }
  
  return stripe;
};

/**
 * Convert Stripe subscription status to our database enum format
 */
const mapStripeStatusToDbStatus = (stripeStatus: string): SubscriptionStatus => {
  switch (stripeStatus.toLowerCase()) {
    case 'active':
      return 'ACTIVE';
    case 'canceled':
    case 'cancelled':
      return 'CANCELLED';
    case 'past_due':
    case 'unpaid':
      return 'SUSPENDED';
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
    default:
      // For any other status, we default to ACTIVE for new subscriptions
      // or keep the existing status for updates
      return 'ACTIVE';
  }
};

export interface CreateCheckoutSessionParams {
  planName: string;
  contributorCount: number;
  billingCycle: 'monthly' | 'yearly';
  workspace: IWorkspace;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  clientSecret?: string;
  url?: string;
}

/**
 * Create a Stripe Checkout Session for embedded checkout
 */
export const createEmbeddedCheckoutSession = async (params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> => {
  const stripeInstance = getStripeInstance();
  
  const {
    planName,
    contributorCount,
    billingCycle,
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing-internal?checkout=cancelled`
  } = params;

  // Get the plan details
  const plan = await Plan.findByName(planName);
  if (!plan) {
    throw new Error(`Plan ${planName} not found`);
  }

  if (plan.isContactSalesOnly) {
    throw new Error(`Plan ${planName} requires contacting sales`);
  }

  // Validate contributor count
  const validContributorCount = Math.max(1, Math.min(contributorCount, plan.maxContributorsPerWorkspace));

  // Create or get Stripe customer
  let customerId = (workspace as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripeInstance.customers.create({
      email: workspace.slug + '@workspace.racky.app', // Use workspace slug as identifier (URL-safe)
      metadata: {
        workspaceId: workspace._id.toString(),
        userId: userId,
        planName: plan.name,
      },
    });
    customerId = customer.id;
    
    // Save customer ID to workspace
    (workspace as any).stripeCustomerId = customerId;
    await workspace.save();
  }

  // Create checkout session for embedded checkout
  const session = await stripeInstance.checkout.sessions.create({
    ui_mode: 'embedded', // This enables embedded checkout
    customer: customerId,
    line_items: [
      {
        price: billingCycle === 'yearly' ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId,
        quantity: validContributorCount,
      },
    ],
    mode: 'subscription',
    subscription_data: {
      metadata: {
        workspaceId: workspace._id.toString(),
        planName: plan.name,
        contributorCount: validContributorCount.toString(),
        contributorType: plan.contributorType,
        billingCycle: billingCycle,
      },
    },
    return_url: successUrl,
    metadata: {
      workspaceId: workspace._id.toString(),
      planName: plan.name,
      contributorCount: validContributorCount.toString(),
      userId: userId,
    },
  });

  return {
    sessionId: session.id,
    clientSecret: session.client_secret!,
    url: session.url || undefined,
  };
};

/**
 * Create a standard Stripe Checkout Session (redirect-based)
 */
export const createCheckoutSession = async (params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> => {
  const stripeInstance = getStripeInstance();
  
  const {
    planName,
    contributorCount,
    billingCycle,
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing-internal?checkout=cancelled`
  } = params;

  // Get the plan details
  const plan = await Plan.findByName(planName);
  if (!plan) {
    throw new Error(`Plan ${planName} not found`);
  }

  if (plan.isContactSalesOnly) {
    throw new Error(`Plan ${planName} requires contacting sales`);
  }

  // Validate contributor count
  const validContributorCount = Math.max(1, Math.min(contributorCount, plan.maxContributorsPerWorkspace));

  // Create or get Stripe customer
  let customerId = (workspace as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripeInstance.customers.create({
      email: workspace.slug + '@workspace.racky.app', // Use workspace slug as identifier (URL-safe)
      metadata: {
        workspaceId: workspace._id.toString(),
        userId: userId,
        planName: plan.name,
      },
    });
    customerId = customer.id;
    
    // Save customer ID to workspace
    (workspace as any).stripeCustomerId = customerId;
    await workspace.save();
  }

  // Create checkout session
  const session = await stripeInstance.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: billingCycle === 'yearly' ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId,
        quantity: validContributorCount,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        workspaceId: workspace._id.toString(),
        planName: plan.name,
        contributorCount: validContributorCount.toString(),
        contributorType: plan.contributorType,
        billingCycle: billingCycle,
      },
    },
    metadata: {
      workspaceId: workspace._id.toString(),
      planName: plan.name,
      contributorCount: validContributorCount.toString(),
      userId: userId,
    },
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
};

/**
 * Handle subscription creation/update after successful payment
 */
export const handleSuccessfulPayment = async (stripeSubscription: Stripe.Subscription): Promise<void> => {
  try {
    const metadata = stripeSubscription.metadata;
    const workspaceId = metadata.workspaceId;
    const planName = metadata.planName;
    const contributorCount = parseInt(metadata.contributorCount) || 1;

    console.log('Processing subscription:', {
      subscriptionId: stripeSubscription.id,
      workspaceId,
      planName,
      contributorCount,
      status: stripeSubscription.status
    });

    if (!workspaceId || !planName) {
      throw new Error(`Missing required metadata - workspaceId: ${workspaceId}, planName: ${planName}`);
    }

    // Validate workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Get plan details
    const plan = await Plan.findByName(planName);
    if (!plan) {
      throw new Error(`Plan not found: ${planName}`);
    }

    // Check if subscription already exists
    const existingSubscription = await Subscription.findByStripeId(stripeSubscription.id);
    
    if (existingSubscription) {
      // Update existing subscription
      console.log('Updating existing subscription:', existingSubscription._id);
      
      existingSubscription.status = mapStripeStatusToDbStatus(stripeSubscription.status);
      existingSubscription.contributorCount = contributorCount;
      existingSubscription.amount = stripeSubscription.items.data[0].price.unit_amount || 0;
      existingSubscription.totalMonthlyActions = plan.getTotalActionsPerMonth(contributorCount);
      existingSubscription.endsAt = new Date((stripeSubscription as any).current_period_end * 1000);
      
      await existingSubscription.save();
      console.log('Successfully updated subscription:', existingSubscription._id);
    } else {
      // Create new subscription
      console.log('Creating new subscription for workspace:', workspaceId);
      
      const newSubscription = new Subscription({
        workspaceId: workspaceId,
        planId: plan._id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        status: mapStripeStatusToDbStatus(stripeSubscription.status),
        contributorCount: contributorCount,
        amount: stripeSubscription.items.data[0].price.unit_amount || 0,
        currency: stripeSubscription.currency || 'usd',
        interval: stripeSubscription.items.data[0].price.recurring?.interval === 'year' ? 'year' : 'month',
        totalMonthlyActions: plan.getTotalActionsPerMonth(contributorCount),
        startsAt: new Date((stripeSubscription as any).current_period_start * 1000),
        endsAt: new Date((stripeSubscription as any).current_period_end * 1000),
      });

      await newSubscription.save();
      console.log('Successfully created new subscription:', newSubscription._id);
    }
  } catch (error) {
    console.error('Error in handleSuccessfulPayment:', error);
    // Re-throw the error so the webhook handler can respond with appropriate status
    throw error;
  }
};

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (payload: string, signature: string): Stripe.Event => {
  const stripeInstance = getStripeInstance();
  
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret is not configured');
  }

  return stripeInstance.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
};

/**
 * Check if Stripe is configured
 */
export const isStripeConfigured = (): boolean => {
  return !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
};

export { getStripeInstance };