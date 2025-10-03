import Stripe from "stripe";
import { getEnv } from "@/common/config/env";
import Plan from "../../modules/subscriptions/models/Plan";
import Subscription from "../../modules/subscriptions/models/Subscription";
import { IWorkspace } from "../../modules/workspaces/models/Workspace";
import Workspace from "../../modules/workspaces/models/Workspace";
import { SubscriptionStatus, ISubscription } from "../../modules/subscriptions/models/Subscription";

const env = getEnv();

function sleep(ms: number): Promise<void> {
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
  workspace: IWorkspace;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
  couponCode?: string; // Optional coupon code
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
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing?checkout=cancelled`,
    couponCode,
  } = params;

  // Validate coupon/promotion code if provided
  let validatedPromotionCodeId: string | undefined;
  if (couponCode) {
    // Check if couponCode is already a validated Stripe ID (promo_ or looks like a Stripe coupon ID)
    // If it starts with 'promo_', it's already a validated promotion code ID from the frontend
    if (couponCode.startsWith('promo_')) {
      validatedPromotionCodeId = couponCode;
      console.log('Using pre-validated promotion code ID:', validatedPromotionCodeId);
    } else {
      // Otherwise, validate it (could be a user-entered code or direct coupon ID)
      const validation = await validateStripeCoupon(couponCode);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid promotion code');
      }
      // Store the promotion code ID if it's a promotion code, otherwise use the coupon code
      validatedPromotionCodeId = validation.promotionCodeId || couponCode;
    }
  }

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
  let customerId = workspace.stripeCustomerId;
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
    workspace.stripeCustomerId = customerId;
    await workspace.save();
  }

  // Build checkout session options
  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
    ui_mode: "embedded", // This enables embedded checkout
    customer: customerId,
    line_items: [
      {
        price: plan.stripeMonthlyPriceId,
        quantity: validContributorCount,
      },
    ],
    mode: "subscription",
    subscription_data: {
      metadata: {
        workspaceId: workspace._id.toString(),
        contributorType: plan.contributorType,
        contributorCount: validContributorCount.toString(),
      },
    },
    return_url: successUrl,
    metadata: {
      workspaceId: workspace._id.toString(),
      contributorType: plan.contributorType,
      contributorCount: validContributorCount.toString(),
      userId: userId,
    },
  };

  // Apply promotion code or coupon if provided
  if (validatedPromotionCodeId) {
    // Check if it's a promotion code ID (starts with 'promo_') or a direct coupon
    if (validatedPromotionCodeId.startsWith('promo_')) {
      sessionOptions.discounts = [{
        promotion_code: validatedPromotionCodeId
      }];
      console.log('Applied promotion code to checkout session:', validatedPromotionCodeId);
    } else {
      sessionOptions.discounts = [{
        coupon: validatedPromotionCodeId
      }];
      console.log('Applied coupon to checkout session:', validatedPromotionCodeId);
    }
  }

  // Create checkout session for embedded checkout
  const session = await stripeInstance.checkout.sessions.create(sessionOptions);

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
    workspace,
    userId,
    successUrl = `${env.CLIENT_URL}/dashboard?checkout=success`,
    cancelUrl = `${env.CLIENT_URL}/pricing?checkout=cancelled`,
    couponCode,
  } = params;

  // Validate coupon/promotion code if provided
  let validatedPromotionCodeId: string | undefined;
  if (couponCode) {
    // Check if couponCode is already a validated Stripe ID (promo_ or looks like a Stripe coupon ID)
    // If it starts with 'promo_', it's already a validated promotion code ID from the frontend
    if (couponCode.startsWith('promo_')) {
      validatedPromotionCodeId = couponCode;
      console.log('Using pre-validated promotion code ID:', validatedPromotionCodeId);
    } else {
      // Otherwise, validate it (could be a user-entered code or direct coupon ID)
      const validation = await validateStripeCoupon(couponCode);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid promotion code');
      }
      // Store the promotion code ID if it's a promotion code, otherwise use the coupon code
      validatedPromotionCodeId = validation.promotionCodeId || couponCode;
    }
  }

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
  let customerId = workspace.stripeCustomerId;
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
    workspace.stripeCustomerId = customerId;
    await workspace.save();
  }

  // Build checkout session options
  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: plan.stripeMonthlyPriceId,
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
      },
    },
    metadata: {
      workspaceId: workspace._id.toString(),
      contributorType: plan.contributorType,
      contributorCount: validContributorCount.toString(),
      userId: userId,
    },
  };

  // Apply promotion code or coupon if provided
  if (validatedPromotionCodeId) {
    // Check if it's a promotion code ID (starts with 'promo_') or a direct coupon
    if (validatedPromotionCodeId.startsWith('promo_')) {
      sessionOptions.discounts = [{
        promotion_code: validatedPromotionCodeId
      }];
      console.log('Applied promotion code to checkout session:', validatedPromotionCodeId);
    } else {
      sessionOptions.discounts = [{
        coupon: validatedPromotionCodeId
      }];
      console.log('Applied coupon to checkout session:', validatedPromotionCodeId);
    }
  }

  // Create checkout session
  const session = await stripeInstance.checkout.sessions.create(sessionOptions);

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

    // Extract coupon data if applied
    let couponData: any = null;
    const discounts = stripeSubscription.discounts;
    const discount = discounts && discounts.length > 0 && typeof discounts[0] !== 'string'
      ? discounts[0]
      : null;

    if (discount && discount.coupon && typeof discount.coupon !== 'string') {
      const stripeCoupon = discount.coupon;
      const appliedAt = new Date();

      // Calculate endsAt for repeating coupons
      let endsAt: Date | undefined;
      if (stripeCoupon.duration === 'repeating' && stripeCoupon.duration_in_months) {
        endsAt = new Date(appliedAt);
        endsAt.setMonth(endsAt.getMonth() + stripeCoupon.duration_in_months);
      }

      couponData = {
        id: stripeCoupon.id,
        type: stripeCoupon.percent_off ? 'percent' : 'amount',
        value: stripeCoupon.percent_off || stripeCoupon.amount_off || 0,
        duration: stripeCoupon.duration as 'once' | 'repeating' | 'forever',
        durationInMonths: stripeCoupon.duration_in_months,
        appliedAt,
        endsAt
      };

      console.log('Extracted coupon data from Stripe subscription:', couponData);
    }

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
        } catch (scheduleError: unknown) {
          const message = scheduleError instanceof Error ? scheduleError.message : 'Unknown error';
          console.error(
            "Error getting schedule data, falling back to metadata:",
            message
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

      // Update coupon data
      if (couponData) {
        existingSubscription.hasCoupon = true;
        existingSubscription.coupon = couponData;
      } else {
        existingSubscription.hasCoupon = false;
        existingSubscription.coupon = undefined;
      }

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
        hasCoupon: !!couponData,
        coupon: couponData || undefined,
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
  subscription: ISubscription
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
  } catch (error: unknown) {
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
const findPlanByPriceId = async (priceId: string) => {
  const allPlans = await Plan.find({});
  return allPlans.find(
    (plan) => plan.stripeMonthlyPriceId === priceId
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
 * Validate a Stripe promotion code or coupon
 */
export const validateStripeCoupon = async (
  code: string
): Promise<{
  valid: boolean;
  promotionCodeId?: string;
  promotionCode?: string;
  coupon?: Stripe.Coupon;
  error?: string;
}> => {
  const stripeInstance = getStripeInstance();

  try {
    console.log('Validating Stripe code:', code);

    // First, try to retrieve as a Promotion Code (this is what users typically enter)
    try {
      const promotionCodes = await stripeInstance.promotionCodes.list({
        code: code.toUpperCase(),
        limit: 1
      });

      if (promotionCodes.data.length > 0) {
        const promotionCode = promotionCodes.data[0];
        console.log('Found promotion code:', {
          id: promotionCode.id,
          code: promotionCode.code,
          active: promotionCode.active,
          coupon: promotionCode.coupon
        });

        // Check if promotion code is active
        if (!promotionCode.active) {
          return {
            valid: false,
            error: 'This promotion code is no longer active'
          };
        }

        // Check if promotion code has expired
        if (promotionCode.expires_at && promotionCode.expires_at < Math.floor(Date.now() / 1000)) {
          return {
            valid: false,
            error: 'This promotion code has expired'
          };
        }

        // Check promotion code redemption limits
        if (promotionCode.max_redemptions && promotionCode.times_redeemed &&
            promotionCode.times_redeemed >= promotionCode.max_redemptions) {
          return {
            valid: false,
            error: 'This promotion code has reached its maximum number of redemptions'
          };
        }

        // Get the associated coupon
        const coupon = typeof promotionCode.coupon === 'string'
          ? await stripeInstance.coupons.retrieve(promotionCode.coupon)
          : promotionCode.coupon;

        // Validate the coupon itself
        if (!coupon.valid) {
          return {
            valid: false,
            error: 'The coupon associated with this promotion code is no longer valid'
          };
        }

        // Check if coupon has expired (redeem_by date)
        if (coupon.redeem_by && coupon.redeem_by < Math.floor(Date.now() / 1000)) {
          return {
            valid: false,
            error: 'This promotion code has expired'
          };
        }

        console.log('Promotion code is valid:', {
          promotionCodeId: promotionCode.id,
          code: promotionCode.code,
          couponId: coupon.id,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off,
          duration: coupon.duration,
          duration_in_months: coupon.duration_in_months
        });

        return {
          valid: true,
          promotionCodeId: promotionCode.id,
          promotionCode: promotionCode.code,
          coupon
        };
      }
    } catch (promoError) {
      console.log('Not a promotion code, trying as direct coupon ID...');
    }

    // Fallback: Try to retrieve as a direct coupon ID (for backward compatibility)
    const coupon = await stripeInstance.coupons.retrieve(code);

    console.log('Found direct coupon:', { coupon });

    // Check if coupon is valid
    if (!coupon.valid) {
      return {
        valid: false,
        error: 'This coupon is no longer valid'
      };
    }

    // Check if coupon has expired (redeem_by date)
    if (coupon.redeem_by && coupon.redeem_by < Math.floor(Date.now() / 1000)) {
      return {
        valid: false,
        error: 'This coupon has expired'
      };
    }

    // Check if coupon has reached max redemptions
    if (coupon.max_redemptions && coupon.times_redeemed &&
        coupon.times_redeemed >= coupon.max_redemptions) {
      return {
        valid: false,
        error: 'This coupon has reached its maximum number of redemptions'
      };
    }

    console.log('Direct coupon is valid:', {
      id: coupon.id,
      percent_off: coupon.percent_off,
      amount_off: coupon.amount_off,
      duration: coupon.duration,
      duration_in_months: coupon.duration_in_months
    });

    return {
      valid: true,
      coupon
    };
  } catch (error: unknown) {
    console.error('Error validating code:', error);

    // Handle specific Stripe errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'resource_missing') {
        return {
          valid: false,
          error: 'Invalid promotion code or coupon'
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: `Failed to validate code: ${message}`
    };
  }
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
  } catch (error: unknown) {
    console.error("Error updating subscription immediately:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to update subscription: ${message}`);
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
  } catch (error: unknown) {
    console.error("Error scheduling subscription downgrade:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to schedule subscription downgrade: ${message}`
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
    const currentSubscription = await stripeInstance.subscriptions.retrieve(
      subscriptionId
    );
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
  } catch (error: unknown) {
    console.error("Error calculating proration:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to calculate proration: ${message}`);
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
  } catch (error: unknown) {
    console.error("Error releasing subscription schedule:", error);
    // If schedule doesn't exist or is already released, we can continue
    if (
      error && typeof error === 'object' && 'code' in error &&
      (error.code === "resource_missing" ||
      (error instanceof Error && error.message.includes("already been")))
    ) {
      console.log("Schedule was already released or missing, continuing...");
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to release subscription schedule: ${message}`
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
  } catch (error: unknown) {
    console.error("Error checking subscription schedule completion:", error);
    // If schedule doesn't exist, consider it completed
    if (error && typeof error === 'object' && 'code' in error && error.code === "resource_missing") {
      return true;
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to check subscription schedule completion: ${message}`
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
  } catch (error: unknown) {
    console.error("Error cancelling Stripe subscription:", error);

    // Handle specific Stripe errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "resource_missing") {
        throw new Error(`Subscription not found in Stripe: ${subscriptionId}`);
      }

      if (error.code === "subscription_canceled") {
        console.log("Subscription was already cancelled, fetching current state");
        return await stripeInstance.subscriptions.retrieve(subscriptionId);
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to cancel subscription in Stripe: ${message}`
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
      cancel_at_period_end: (reactivatedSubscription as any).cancel_at_period_end,
      current_period_end: (reactivatedSubscription as any).current_period_end,
    });

    return reactivatedSubscription;
  } catch (error: unknown) {
    console.error("Error reactivating Stripe subscription:", error);

    // Handle specific Stripe errors
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === "resource_missing") {
        throw new Error(`Subscription not found in Stripe: ${subscriptionId}`);
      }

      if (error.code === "subscription_canceled") {
        throw new Error(
          `Subscription is already fully cancelled and cannot be reactivated: ${subscriptionId}`
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Failed to reactivate subscription in Stripe: ${message}`
    );
  }
};

export { getStripeInstance };
