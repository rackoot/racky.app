import Stripe from "stripe";
import { getEnv } from "@/common/config/env";
import Plan from "../../modules/subscriptions/models/Plan";
import Subscription from "../../modules/subscriptions/models/Subscription";
import { IWorkspace } from "../../modules/workspaces/models/Workspace";
import Workspace from "../../modules/workspaces/models/Workspace";
import { SubscriptionStatus } from "../../modules/subscriptions/models/Subscription";

const env = getEnv();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stripe: Stripe | null = null;

// Initialize Stripe only if API key is configured
const getStripeInstance = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
    );
  }

  if (!stripe) {
    stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
    });
  }

  return stripe;
};

/**
 * Convert Stripe subscription status to our database enum format
 */
const mapStripeStatusToDbStatus = (
  stripeStatus: string
): SubscriptionStatus => {
  switch (stripeStatus.toLowerCase()) {
    case "active":
      return "ACTIVE";
    case "canceled":
    case "cancelled":
      return "CANCELLED";
    case "past_due":
    case "unpaid":
      return "SUSPENDED";
    case "incomplete":
    case "incomplete_expired":
    case "trialing":
    default:
      // For any other status, we default to ACTIVE for new subscriptions
      // or keep the existing status for updates
      return "ACTIVE";
  }
};

export interface CreateCheckoutSessionParams {
  contributorType: string;
  contributorCount: number;
  billingCycle: "monthly" | "yearly";
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
export const createEmbeddedCheckoutSession = async (
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> => {
  const stripeInstance = getStripeInstance();

  const {
    contributorType,
    contributorCount,
    billingCycle,
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing-internal?checkout=cancelled`,
  } = params;

  // Get the plan details
  const plan = await Plan.findByContributorType(contributorType);
  if (!plan) {
    throw new Error(`Plan ${contributorType} not found`);
  }

  if (plan.isContactSalesOnly) {
    throw new Error(`Plan ${contributorType} requires contacting sales`);
  }

  // Validate contributor count
  const validContributorCount = Math.max(
    1,
    Math.min(contributorCount, plan.maxContributorsPerWorkspace)
  );

  // Create or get Stripe customer
  let customerId = (workspace as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripeInstance.customers.create({
      email: workspace.slug + "@workspace.racky.app", // Use workspace slug as identifier (URL-safe)
      metadata: {
        workspaceId: workspace._id.toString(),
        userId: userId,
        contributorType: plan.contributorType,
      },
    });
    customerId = customer.id;

    // Save customer ID to workspace
    (workspace as any).stripeCustomerId = customerId;
    await workspace.save();
  }

  // Create checkout session for embedded checkout
  const session = await stripeInstance.checkout.sessions.create({
    ui_mode: "embedded", // This enables embedded checkout
    customer: customerId,
    line_items: [
      {
        price:
          billingCycle === "yearly"
            ? plan.stripeYearlyPriceId
            : plan.stripeMonthlyPriceId,
        quantity: validContributorCount,
      },
    ],
    mode: "subscription",
    subscription_data: {
      metadata: {
        workspaceId: workspace._id.toString(),
        contributorType: plan.contributorType,
        contributorCount: validContributorCount.toString(),
        billingCycle: billingCycle,
      },
    },
    return_url: successUrl,
    metadata: {
      workspaceId: workspace._id.toString(),
      contributorType: plan.contributorType,
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
export const createCheckoutSession = async (
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> => {
  const stripeInstance = getStripeInstance();

  const {
    contributorType,
    contributorCount,
    billingCycle,
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing-internal?checkout=cancelled`,
  } = params;

  // Get the plan details
  const plan = await Plan.findByContributorType(contributorType);
  if (!plan) {
    throw new Error(`Plan ${contributorType} not found`);
  }

  if (plan.isContactSalesOnly) {
    throw new Error(`Plan ${contributorType} requires contacting sales`);
  }

  // Validate contributor count
  const validContributorCount = Math.max(
    1,
    Math.min(contributorCount, plan.maxContributorsPerWorkspace)
  );

  // Create or get Stripe customer
  let customerId = (workspace as any).stripeCustomerId;
  if (!customerId) {
    const customer = await stripeInstance.customers.create({
      email: workspace.slug + "@workspace.racky.app", // Use workspace slug as identifier (URL-safe)
      metadata: {
        workspaceId: workspace._id.toString(),
        userId: userId,
        contributorType: plan.contributorType,
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
    payment_method_types: ["card"],
    line_items: [
      {
        price:
          billingCycle === "yearly"
            ? plan.stripeYearlyPriceId
            : plan.stripeMonthlyPriceId,
        quantity: validContributorCount,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        workspaceId: workspace._id.toString(),
        contributorType: plan.contributorType,
        contributorCount: validContributorCount.toString(),
        billingCycle: billingCycle,
      },
    },
    metadata: {
      workspaceId: workspace._id.toString(),
      contributorType: plan.contributorType,
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
export const handleSuccessfulPayment = async (
  stripeSubscription: Stripe.Subscription
): Promise<void> => {
  try {
    const metadata = stripeSubscription.metadata;
    let workspaceId = metadata.workspaceId;
    let contributorType = metadata.contributorType;
    let contributorCount = parseInt(metadata.contributorCount) || 1;

    console.log("Processing subscription:", {
      subscriptionId: stripeSubscription.id,
      workspaceId,
      contributorType,
      contributorCount,
      status: stripeSubscription.status,
      allMetadata: metadata, // Log all metadata for debugging
    });

    if (!workspaceId || !contributorType) {
      console.error("Missing required metadata:", {
        subscriptionId: stripeSubscription.id,
        availableMetadata: Object.keys(metadata),
        workspaceId,
        contributorType,
        fullMetadata: metadata,
      });
      throw new Error(
        `Missing required metadata - workspaceId: ${workspaceId}, contributorType: ${contributorType}`
      );
    }

    // Validate workspace exists
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`);
    }

    // Get plan details
    let plan = await Plan.findByContributorType(contributorType);
    if (!plan) {
      throw new Error(`Plan not found: ${contributorType}`);
    }

    // Check if subscription already exists
    const existingSubscription = await Subscription.findByStripeId(
      stripeSubscription.id
    );

    if (existingSubscription) {
      // Check if subscription has active schedule and update data accordingly
      if (existingSubscription?.stripeScheduleId) {
        console.log(
          "Subscription has active schedule, getting real data from schedule:",
          existingSubscription.stripeScheduleId
        );

        try {
          const stripeInstance = getStripeInstance();
          const schedule = await stripeInstance.subscriptionSchedules.retrieve(
            existingSubscription.stripeScheduleId
          );

          const currentPhase = schedule.current_phase;
          const lastPhase = schedule.phases[schedule.phases.length - 1];

          const isLastPhase = currentPhase.end_date === lastPhase.end_date;

          if (isLastPhase) {
            const currentPriceId = lastPhase.items[0].price as string;
            const currentQuantity = lastPhase.items[0].quantity || 1;

            // Find the actual plan based on the current price ID
            const actualPlan = await findPlanByPriceId(currentPriceId);

            if (actualPlan) {
              // Override metadata with real schedule data
              contributorType = actualPlan.contributorType;
              contributorCount = currentQuantity;
              plan = actualPlan; // Update plan reference too

              console.log("Updated subscription data from schedule:", {
                originalContributorType: metadata.contributorType,
                actualContributorType: contributorType,
                originalContributorCount:
                  parseInt(metadata.contributorCount) || 1,
                actualContributorCount: contributorCount,
                priceId: currentPriceId,
                scheduleId: existingSubscription.stripeScheduleId,
              });

              // Update Stripe subscription metadata with current values
              const updatedMetadata = {
                ...metadata, // Preserve existing metadata
                contributorType: actualPlan.contributorType,
                contributorCount: currentQuantity.toString(),
              };
              if (stripeSubscription.test_clock) {
                console.log("Test clock in action, sleep 10 seconds");
                await sleep(10 * 1000);
              }

              console.log(
                "Updating Stripe subscription metadata:",
                updatedMetadata
              );

              await stripeInstance.subscriptions.update(stripeSubscription.id, {
                metadata: updatedMetadata,
              });
            } else {
              console.warn(
                "Could not find plan for price ID from schedule:",
                currentPriceId
              );
            }
          }
        } catch (scheduleError: any) {
          console.error(
            "Error getting schedule data, falling back to metadata:",
            scheduleError.message
          );
          // Continue with original metadata if schedule fetch fails
        }
      }

      // Update existing subscription (whether it has schedule or not)
      console.log("Updating existing subscription:", existingSubscription._id);

      existingSubscription.status = mapStripeStatusToDbStatus(
        stripeSubscription.status
      );
      existingSubscription.contributorCount = contributorCount;
      existingSubscription.amount =
        stripeSubscription.items.data[0].price.unit_amount || 0;
      existingSubscription.planId = plan._id as any;
      existingSubscription.totalMonthlyActions =
        plan.getTotalActionsPerMonth(contributorCount);
      existingSubscription.currency = stripeSubscription.currency || "usd";
      existingSubscription.interval =
        stripeSubscription.items.data[0].price.recurring?.interval === "year"
          ? "year"
          : "month";
      existingSubscription.startsAt = new Date(
        (stripeSubscription as any).current_period_start * 1000
      );
      existingSubscription.endsAt = new Date(
        (stripeSubscription as any).current_period_end * 1000
      );

      await existingSubscription.save();
      console.log(
        "Successfully updated subscription:",
        existingSubscription._id
      );

      // Check if subscription has a completed schedule and release it if so

      await checkAndReleaseScheduleIfCompleted(existingSubscription);
    } else {
      // Create new subscription
      console.log("Creating new subscription for workspace:", workspaceId);

      const newSubscription = new Subscription({
        workspaceId: workspaceId,
        planId: plan._id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        status: mapStripeStatusToDbStatus(stripeSubscription.status),
        contributorCount: contributorCount,
        amount: stripeSubscription.items.data[0].price.unit_amount || 0,
        currency: stripeSubscription.currency || "usd",
        interval:
          stripeSubscription.items.data[0].price.recurring?.interval === "year"
            ? "year"
            : "month",
        totalMonthlyActions: plan.getTotalActionsPerMonth(contributorCount),
        startsAt: new Date(
          (stripeSubscription as any).current_period_start * 1000
        ),
        endsAt: new Date((stripeSubscription as any).current_period_end * 1000),
      });

      await newSubscription.save();
      console.log(
        "Successfully created new subscription:",
        newSubscription._id
      );
    }
  } catch (error) {
    console.error("Error in handleSuccessfulPayment:", error);
    // Re-throw the error so the webhook handler can respond with appropriate status
    throw error;
  }
};

/**
 * Check if subscription has a completed schedule and release it if so
 */
const checkAndReleaseScheduleIfCompleted = async (
  subscription: any
): Promise<void> => {
  if (!subscription.stripeScheduleId) {
    return; // No hay schedule asociado
  }

  try {
    console.log(
      "Checking if schedule is completed:",
      subscription.stripeScheduleId
    );

    const isCompleted = await checkSubscriptionScheduleIsCompleted(
      subscription.stripeScheduleId
    );

    if (isCompleted) {
      console.log(
        "Schedule is in final phase, releasing:",
        subscription.stripeScheduleId
      );

      await cancelExistingSchedule(subscription.stripeScheduleId);

      subscription.stripeScheduleId = undefined;
      await subscription.save();

      console.log("Schedule released and cleared from subscription");
    } else {
      console.log("Schedule is not yet completed, keeping it active");
    }
  } catch (error: any) {
    console.error("Error checking/releasing schedule:", error);
    // Si hay error, limpiar el scheduleId por precaución
    console.log("Clearing scheduleId due to error");
    subscription.stripeScheduleId = undefined;
    await subscription.save();
  }
};

/**
 * Find plan by Stripe price ID (monthly or yearly)
 */
const findPlanByPriceId = async (priceId: string): Promise<any> => {
  const allPlans = await Plan.find({});
  return allPlans.find(
    (plan) =>
      plan.stripeMonthlyPriceId === priceId ||
      plan.stripeYearlyPriceId === priceId
  );
};

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string
): Stripe.Event => {
  const stripeInstance = getStripeInstance();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured");
  }

  return stripeInstance.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
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
    console.log("Updating subscription immediately:", {
      subscriptionId,
      newPriceId,
      newQuantity,
      metadata,
    });

    // Get current subscription details
    const currentSubscription = await stripeInstance.subscriptions.retrieve(
      subscriptionId
    );
    const currentItem = currentSubscription.items.data[0];

    // Update the subscription item with immediate proration
    const updatedSubscription = await stripeInstance.subscriptions.update(
      subscriptionId,
      {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
            quantity: newQuantity,
          },
        ],
        proration_behavior: "always_invoice", // Create invoice immediately for proration
        metadata: metadata,
      }
    );

    console.log("Subscription updated successfully:", {
      id: updatedSubscription.id,
      status: updatedSubscription.status,
      current_period_end: (updatedSubscription as any).current_period_end,
      items: updatedSubscription.items.data.length,
    });
    return updatedSubscription;
  } catch (error: any) {
    console.error("Error updating subscription immediately:", error);
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
    console.log("Scheduling subscription downgrade:", {
      subscriptionId,
      newPriceId,
      newQuantity,
      metadata,
    });

    // Create subscription schedule from existing subscription
    const schedule = await stripeInstance.subscriptionSchedules.create({
      from_subscription: subscriptionId,
    });

    console.log("Created initial schedule from subscription:", {
      scheduleId: schedule.id,
      subscription: schedule.subscription,
      currentPhases: schedule.phases?.length,
    });

    // Update the schedule with proper phases
    const updatedSchedule = await stripeInstance.subscriptionSchedules.update(
      schedule.id,
      {
        phases: [
          {
            // Current phase - preserve existing subscription until end of period
            items: [
              {
                price: schedule.phases[0].items[0].price as string,
                quantity: schedule.phases[0].items[0].quantity,
              },
            ],
            start_date: schedule.phases[0].start_date,
            end_date: schedule.phases[0].end_date,
          },
          {
            // New phase - downgraded plan starts at next billing period
            items: [
              {
                price: newPriceId,
                quantity: newQuantity,
              },
            ],
            iterations: 1,
          },
        ],
        metadata: metadata,
      }
    );

    console.log("Subscription schedule updated successfully:", {
      id: updatedSchedule.id,
      status: updatedSchedule.status,
      phases: updatedSchedule.phases?.length,
      subscription: updatedSchedule.subscription,
    });

    return updatedSchedule;
  } catch (error: any) {
    console.error("Error scheduling subscription downgrade:", error);
    throw new Error(
      `Failed to schedule subscription downgrade: ${error.message}`
    );
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
    console.log("Calculating proration for:", {
      subscriptionId,
      newPriceId,
      newQuantity,
    });

    // Get current subscription
    const currentSubscription = (await stripeInstance.subscriptions.retrieve(
      subscriptionId
    )) as any;
    const currentItem = currentSubscription.items.data[0];

    // Create an invoice preview to see the proration
    const preview = await (stripeInstance.invoices as any).retrieveUpcoming({
      subscription: subscriptionId,
      subscription_items: [
        {
          id: currentItem.id,
          price: newPriceId,
          quantity: newQuantity,
        },
      ],
      subscription_proration_behavior: "always_invoice",
    });

    // Calculate the proration amount
    let proratedAmount = 0;
    let immediateCharge = false;

    // Sum all line items to get the total proration
    preview.lines.data.forEach((line) => {
      if (line.type === "subscription") {
        proratedAmount += line.amount;
      }
    });

    // If proration amount is positive, it's an immediate charge (upgrade)
    immediateCharge = proratedAmount > 0;

    console.log("Proration calculated:", {
      proratedAmount,
      currency: currentSubscription.currency,
      immediateCharge,
    });

    return {
      proratedAmount: Math.abs(proratedAmount), // Always return positive amount
      currency: currentSubscription.currency,
      immediateCharge,
    };
  } catch (error: any) {
    console.error("Error calculating proration:", error);
    throw new Error(`Failed to calculate proration: ${error.message}`);
  }
};

/**
 * Release existing subscription schedule (removes schedule while keeping subscription active)
 */
export const cancelExistingSchedule = async (
  stripeScheduleId: string
): Promise<void> => {
  const stripeInstance = getStripeInstance();

  try {
    console.log("Releasing existing subscription schedule:", stripeScheduleId);

    // Release the existing schedule (removes schedule but keeps subscription active)
    await stripeInstance.subscriptionSchedules.release(stripeScheduleId);

    console.log("Schedule released successfully:", stripeScheduleId);
  } catch (error: any) {
    console.error("Error releasing subscription schedule:", error);
    // If schedule doesn't exist or is already released, we can continue
    if (
      error.code === "resource_missing" ||
      error.message.includes("already been")
    ) {
      console.log("Schedule was already released or missing, continuing...");
      return;
    }
    throw new Error(
      `Failed to release subscription schedule: ${error.message}`
    );
  }
};

/**
 * Check if subscription schedule is completed
 */
export const checkSubscriptionScheduleIsCompleted = async (
  stripeScheduleId: string
): Promise<boolean> => {
  const stripeInstance = getStripeInstance();

  try {
    const stripeSchedule = await stripeInstance.subscriptionSchedules.retrieve(
      stripeScheduleId
    );
    const scheduleLastPhaseEndDate =
      stripeSchedule.phases[stripeSchedule.phases.length - 1].end_date;
    const scheduleCurrentPhaseEndDate = stripeSchedule.current_phase?.end_date;

    return scheduleLastPhaseEndDate === scheduleCurrentPhaseEndDate;
  } catch (error: any) {
    console.error("Error checking subscription schedule completion:", error);
    // If schedule doesn't exist, consider it completed
    if (error.code === "resource_missing") {
      return true;
    }
    throw new Error(
      `Failed to check subscription schedule completion: ${error.message}`
    );
  }
};

/**
 * Cancel a Stripe subscription
 */
export const cancelStripeSubscription = async (
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> => {
  const stripeInstance = getStripeInstance();

  try {
    console.log("Cancelling Stripe subscription:", {
      subscriptionId,
      cancelAtPeriodEnd,
    });

    // Get current subscription to check status
    const currentSubscription = await stripeInstance.subscriptions.retrieve(
      subscriptionId
    );

    // Check if subscription is already cancelled
    if (currentSubscription.status === "canceled") {
      console.log("Subscription already cancelled:", subscriptionId);
      return currentSubscription;
    }

    // Cancel the subscription in Stripe
    const cancelledSubscription = await stripeInstance.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: cancelAtPeriodEnd,
        ...(cancelAtPeriodEnd
          ? {}
          : {
              // For immediate cancellation, we actually cancel the subscription
              proration_behavior: "none",
            }),
      }
    );

    // If immediate cancellation, actually delete the subscription
    if (!cancelAtPeriodEnd) {
      const deletedSubscription = await stripeInstance.subscriptions.cancel(
        subscriptionId,
        {
          prorate: false, // Don't prorate charges for immediate cancellation
        }
      );
      console.log("Subscription cancelled immediately:", {
        id: deletedSubscription.id,
        status: deletedSubscription.status,
        canceled_at: deletedSubscription.canceled_at,
      });
      return deletedSubscription;
    }

    console.log("Subscription scheduled for cancellation at period end:", {
      id: cancelledSubscription.id,
      status: cancelledSubscription.status,
      cancel_at_period_end: (cancelledSubscription as any).cancel_at_period_end,
      current_period_end: (cancelledSubscription as any).current_period_end,
    });

    return cancelledSubscription;
  } catch (error: any) {
    console.error("Error cancelling Stripe subscription:", error);

    // Handle specific Stripe errors
    if (error.code === "resource_missing") {
      throw new Error(`Subscription not found in Stripe: ${subscriptionId}`);
    }

    if (error.code === "subscription_canceled") {
      console.log("Subscription was already cancelled, fetching current state");
      return await stripeInstance.subscriptions.retrieve(subscriptionId);
    }

    throw new Error(
      `Failed to cancel subscription in Stripe: ${error.message}`
    );
  }
};

/**
 * Reactivate a cancelled Stripe subscription (remove cancel_at_period_end flag)
 */
export const reactivateStripeSubscription = async (
  subscriptionId: string
): Promise<Stripe.Subscription> => {
  const stripeInstance = getStripeInstance();

  try {
    console.log("Reactivating Stripe subscription:", { subscriptionId });

    // Get current subscription to check status
    const currentSubscription = await stripeInstance.subscriptions.retrieve(
      subscriptionId
    );

    // Check if subscription is actually scheduled for cancellation
    if (!(currentSubscription as any).cancel_at_period_end) {
      console.log(
        "Subscription is not scheduled for cancellation:",
        subscriptionId
      );
      return currentSubscription;
    }

    // Remove the cancellation by updating cancel_at_period_end to false
    const reactivatedSubscription = await stripeInstance.subscriptions.update(
      subscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    console.log("Subscription reactivated successfully:", {
      id: reactivatedSubscription.id,
      status: reactivatedSubscription.status,
      cancel_at_period_end: (reactivatedSubscription as any)
        .cancel_at_period_end,
      current_period_end: (reactivatedSubscription as any).current_period_end,
    });

    return reactivatedSubscription;
  } catch (error: any) {
    console.error("Error reactivating Stripe subscription:", error);

    // Handle specific Stripe errors
    if (error.code === "resource_missing") {
      throw new Error(`Subscription not found in Stripe: ${subscriptionId}`);
    }

    if (error.code === "subscription_canceled") {
      throw new Error(
        `Subscription is already fully cancelled and cannot be reactivated: ${subscriptionId}`
      );
    }

    throw new Error(
      `Failed to reactivate subscription in Stripe: ${error.message}`
    );
  }
};

export { getStripeInstance };
