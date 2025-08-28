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

/**
 * Update subscription immediately with proration (for upgrades)
 */
export const updateSubscriptionImmediate = async (
  subscriptionId: string,
  newPriceId: string,
  newQuantity: number,
  metadata: Record<string, string>
): Promise<Stripe.Subscription> => {
  const stripeInstance = getStripeInstance();
  
  try {
    console.log('Updating subscription immediately:', {
      subscriptionId,
      newPriceId,
      newQuantity,
      metadata
    });

    // Get current subscription details
    const currentSubscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
    const currentItem = currentSubscription.items.data[0];

    // Update the subscription item with immediate proration
    const updatedSubscription = await stripeInstance.subscriptions.update(subscriptionId, {
      items: [{
        id: currentItem.id,
        price: newPriceId,
        quantity: newQuantity,
      }],
      proration_behavior: 'always_invoice', // Create invoice immediately for proration
      metadata: metadata,
    });

    console.log('Subscription updated successfully:', {
      id: updatedSubscription.id,
      status: updatedSubscription.status,
      current_period_end: (updatedSubscription as any).current_period_end,
      items: updatedSubscription.items.data.length
    });
    return updatedSubscription;
    
  } catch (error: any) {
    console.error('Error updating subscription immediately:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
};

/**
 * Schedule subscription downgrade for next billing period
 */
export const scheduleSubscriptionDowngrade = async (
  subscriptionId: string,
  newPriceId: string,
  newQuantity: number,
  metadata: Record<string, string>
): Promise<Stripe.SubscriptionSchedule> => {
  const stripeInstance = getStripeInstance();
  
  try {
    console.log('Scheduling subscription downgrade:', {
      subscriptionId,
      newPriceId,
      newQuantity,
      metadata
    });

    // Get current subscription to determine the next billing date
    const currentSubscription = await stripeInstance.subscriptions.retrieve(subscriptionId) as any;
    const nextBillingDate = currentSubscription.current_period_end;

    console.log('Retrieved current subscription for schedule:', {
      id: currentSubscription.id,
      status: currentSubscription.status,
      current_period_start: currentSubscription.current_period_start,
      current_period_end: currentSubscription.current_period_end,
      items: currentSubscription.items.data.length
    });

    if (!nextBillingDate || !currentSubscription.current_period_start) {
      throw new Error('Invalid subscription period dates - cannot create schedule');
    }

    // Create a subscription schedule for the downgrade
    const schedule = await stripeInstance.subscriptionSchedules.create({
      from_subscription: subscriptionId,
      phases: [
        {
          // Current phase - keep existing subscription until next billing
          start_date: currentSubscription.current_period_start,
          end_date: nextBillingDate,
          items: currentSubscription.items.data.map((item: any) => ({
            price: item.price.id,
            quantity: item.quantity || 1,
          })),
        },
        {
          // New phase - start the downgraded plan from next billing period  
          start_date: nextBillingDate,
          items: [{
            price: newPriceId,
            quantity: newQuantity,
          }],
          metadata: metadata,
        }
      ],
    } as any);

    console.log('Subscription schedule created successfully:', {
      id: schedule.id,
      status: schedule.status,
      phases: schedule.phases?.length,
      subscription: schedule.subscription,
      nextPhaseDate: schedule.phases?.[1]?.start_date
    });
    return schedule;
    
  } catch (error: any) {
    console.error('Error scheduling subscription downgrade:', error);
    throw new Error(`Failed to schedule subscription downgrade: ${error.message}`);
  }
};

/**
 * Calculate proration amount for subscription change preview
 */
export const calculateProration = async (
  subscriptionId: string,
  newPriceId: string,
  newQuantity: number
): Promise<{
  proratedAmount: number;
  currency: string;
  immediateCharge: boolean;
}> => {
  const stripeInstance = getStripeInstance();
  
  try {
    console.log('Calculating proration for:', {
      subscriptionId,
      newPriceId,
      newQuantity
    });

    // Get current subscription
    const currentSubscription = await stripeInstance.subscriptions.retrieve(subscriptionId) as any;
    const currentItem = currentSubscription.items.data[0];

    // Create an invoice preview to see the proration
    const preview = await (stripeInstance.invoices as any).retrieveUpcoming({
      subscription: subscriptionId,
      subscription_items: [{
        id: currentItem.id,
        price: newPriceId,
        quantity: newQuantity,
      }],
      subscription_proration_behavior: 'always_invoice',
    });

    // Calculate the proration amount
    let proratedAmount = 0;
    let immediateCharge = false;

    // Sum all line items to get the total proration
    preview.lines.data.forEach(line => {
      if (line.type === 'subscription') {
        proratedAmount += line.amount;
      }
    });

    // If proration amount is positive, it's an immediate charge (upgrade)
    immediateCharge = proratedAmount > 0;

    console.log('Proration calculated:', {
      proratedAmount,
      currency: currentSubscription.currency,
      immediateCharge
    });

    return {
      proratedAmount: Math.abs(proratedAmount), // Always return positive amount
      currency: currentSubscription.currency,
      immediateCharge,
    };
    
  } catch (error: any) {
    console.error('Error calculating proration:', error);
    throw new Error(`Failed to calculate proration: ${error.message}`);
  }
};

export { getStripeInstance };