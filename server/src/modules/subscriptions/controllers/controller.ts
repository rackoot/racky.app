import { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { UpdateSubscriptionDto, SubscriptionPreviewDto, updateSubscriptionSchema, subscriptionPreviewSchema } from '../dtos/subscriptionDto';
import { 
  updateSubscriptionImmediate, 
  scheduleSubscriptionDowngrade, 
  calculateProration,
  isStripeConfigured 
} from '@/common/services/stripeService';
import Subscription from '../models/Subscription';
import Plan from '../models/Plan';

export class SubscriptionController {
  /**
   * GET /api/subscription/:workspaceId - Get workspace subscription info
   */
  async getWorkspaceSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const subscriptionInfo = await req.workspace!.getSubscriptionInfo();
      const currentPlan = await req.workspace!.getCurrentPlan();
      const hasActiveSubscription = await req.workspace!.hasActiveSubscription();
      
      // Get current subscription for contributor info
      const currentSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id,
        status: 'ACTIVE'
      }).populate('planId');

      const contributorCount = currentSubscription?.contributorCount || 1;
      const totalMonthlyActions = currentSubscription?.totalMonthlyActions || 0;
      const currentMonthlyPrice = currentSubscription && currentPlan ? (
        currentSubscription.interval === 'year' ? 
          (currentSubscription.amount / 100 / 12) :
          (currentSubscription.amount / 100)
      ) : 0;

      res.json({
        success: true,
        message: 'Workspace subscription retrieved successfully',
        data: {
          workspaceId: req.workspace!._id,
          workspaceName: req.workspace!.name,
          subscription: subscriptionInfo,
          currentPlan,
          hasActiveSubscription,
          contributorCount,
          totalMonthlyActions,
          currentMonthlyPrice,
          billingCycle: currentSubscription?.interval === 'year' ? 'annual' : 'monthly',
          limits: currentPlan ? currentPlan.limits : null,
          features: currentPlan ? currentPlan.features : null
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving workspace subscription',
        error: (error as Error).message
      });
    }
  }

  /**
   * POST /api/subscription/:workspaceId/preview - Preview subscription changes with pricing
   */
  async previewSubscriptionChanges(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error } = subscriptionPreviewSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details[0].message
        });
        return;
      }
      const { planName, billingCycle, contributorCount }: SubscriptionPreviewDto = req.body;
      
      // Find the new plan
      const newPlan = await Plan.findByName(planName);
      
      if (!newPlan) {
        res.status(404).json({
          success: false,
          message: 'Subscription plan not found'
        });
        return;
      }

      if (contributorCount! > newPlan.maxContributorsPerWorkspace) {
        res.status(400).json({
          success: false,
          message: `Maximum ${newPlan.maxContributorsPerWorkspace} contributors allowed for ${planName} plan`
        });
        return;
      }

      // Get current subscription
      const currentSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id,
        status: 'ACTIVE'
      }).populate('planId');

      const currentPlan = currentSubscription?.planId as any;
      const currentContributorCount = currentSubscription?.contributorCount || 1;
      const currentBillingCycle = currentSubscription?.interval === 'year' ? 'annual' : 'monthly';
      
      // Calculate pricing
      const newMonthlyPrice = billingCycle === 'annual' ? 
        (newPlan.getTotalYearlyPrice(contributorCount!) / 100 / 12) :
        (newPlan.getTotalMonthlyPrice(contributorCount!) / 100);
      
      const currentMonthlyPrice = currentPlan ? (
        currentBillingCycle === 'annual' ? 
          (currentPlan.getTotalYearlyPrice(currentContributorCount) / 100 / 12) :
          (currentPlan.getTotalMonthlyPrice(currentContributorCount) / 100)
      ) : 0;

      const priceDifference = newMonthlyPrice - currentMonthlyPrice;
      const isUpgrade = priceDifference > 0;
      const isDowngrade = priceDifference < 0;
      const isPlanChange = !currentPlan || currentPlan.name !== planName;
      const isContributorChange = currentContributorCount !== contributorCount;
      const isBillingCycleChange = currentBillingCycle !== billingCycle;
      
      // Calculate total actions
      const newTotalActions = newPlan.getTotalActionsPerMonth(contributorCount!);
      const currentTotalActions = currentPlan ? currentPlan.getTotalActionsPerMonth(currentContributorCount) : 0;
      
      // For real Stripe calculations, we need the Stripe price ID and subscription ID
      let realProration = null;
      let stripeError = null;
      
      if (currentSubscription?.stripeSubscriptionId && isStripeConfigured()) {
        try {
          const newPriceId = billingCycle === 'annual' ? newPlan.stripeYearlyPriceId : newPlan.stripeMonthlyPriceId;
          
          const prorationResult = await calculateProration(
            currentSubscription.stripeSubscriptionId,
            newPriceId,
            contributorCount!
          );
          
          realProration = {
            amount: prorationResult.proratedAmount / 100, // Convert cents to dollars
            currency: prorationResult.currency,
            immediateCharge: prorationResult.immediateCharge,
            formattedAmount: `$${(prorationResult.proratedAmount / 100).toFixed(2)}`
          };
        } catch (error) {
          console.warn('Could not calculate Stripe proration:', error);
          stripeError = (error as Error).message;
        }
      }
      
      res.json({
        success: true,
        message: 'Subscription preview calculated',
        data: {
          workspaceId: req.workspace!._id,
          changes: {
            planChange: isPlanChange,
            contributorChange: isContributorChange,
            billingCycleChange: isBillingCycleChange
          },
          current: {
            planName: currentPlan?.name || 'None',
            contributorCount: currentContributorCount,
            billingCycle: currentBillingCycle,
            monthlyPrice: currentMonthlyPrice,
            totalActions: currentTotalActions
          },
          new: {
            planName,
            contributorCount,
            billingCycle,
            monthlyPrice: newMonthlyPrice,
            totalActions: newTotalActions
          },
          pricing: {
            priceDifference: Math.abs(priceDifference),
            isUpgrade,
            isDowngrade,
            changeType: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'no_change',
            timing: isUpgrade ? 'immediate' : 'next_billing_period',
            message: isUpgrade ? 
              'Upgrade will be charged immediately with prorated amount' :
              isDowngrade ? 
                'Downgrade will be applied at the next billing period' :
                'No price change required',
            realProration,
            stripeConfigured: isStripeConfigured(),
            stripeError
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error calculating subscription preview',
        error: (error as Error).message
      });
    }
  }

  /**
   * PUT /api/subscription/:workspaceId - Update/Create workspace subscription
   */
  async updateWorkspaceSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error } = updateSubscriptionSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details[0].message
        });
        return;
      }
      const { planName, billingCycle, contributorCount }: UpdateSubscriptionDto = req.body;
      
      // Find the plan
      const plan = await Plan.findByName(planName);
      
      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Subscription plan not found'
        });
        return;
      }

      if (contributorCount! > plan.maxContributorsPerWorkspace) {
        res.status(400).json({
          success: false,
          message: `Maximum ${plan.maxContributorsPerWorkspace} contributors allowed for ${planName} plan`
        });
        return;
      }

      // Get current subscription to determine if it's an upgrade or downgrade
      const currentSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id,
        status: 'ACTIVE'
      }).populate('planId');

      if (!currentSubscription?.stripeSubscriptionId) {
        res.status(400).json({
          success: false,
          message: 'No active Stripe subscription found. Please create a subscription through the billing system first.',
          requiresNewSubscription: true
        });
        return;
      }

      if (!isStripeConfigured()) {
        res.status(503).json({
          success: false,
          message: 'Payment system is not configured. Cannot update subscription.',
          error: 'Stripe is not properly configured'
        });
        return;
      }

      const currentPlan = currentSubscription.planId as any;
      const currentContributorCount = currentSubscription.contributorCount;
      const currentBillingCycle = currentSubscription.interval === 'year' ? 'annual' : 'monthly';
      
      // Calculate pricing to determine upgrade vs downgrade
      const newMonthlyPrice = billingCycle === 'annual' ? 
        (plan.getTotalYearlyPrice(contributorCount!) / 100 / 12) :
        (plan.getTotalMonthlyPrice(contributorCount!) / 100);
      
      const currentMonthlyPrice = currentBillingCycle === 'annual' ? 
        (currentPlan.getTotalYearlyPrice(currentContributorCount) / 100 / 12) :
        (currentPlan.getTotalMonthlyPrice(currentContributorCount) / 100);

      const priceDifference = newMonthlyPrice - currentMonthlyPrice;
      const isUpgrade = priceDifference > 0;
      const isDowngrade = priceDifference < 0;

      // Get the new Stripe price ID
      const newPriceId = billingCycle === 'annual' ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;
      
      // Metadata for Stripe
      const stripeMetadata = {
        workspaceId: req.workspace!._id.toString(),
        planName: plan.name,
        contributorCount: contributorCount!.toString(),
        contributorType: plan.contributorType,
        billingCycle: billingCycle!,
        updatedBy: req.user!._id.toString()
      };

      let result;
      let stripeSubscription;

      console.log('Starting Stripe subscription update:', {
        subscriptionId: currentSubscription.stripeSubscriptionId,
        changeType: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'no_change',
        newPriceId,
        contributorCount,
        priceDifference
      });

      try {
        if (isUpgrade) {
          console.log('Processing immediate upgrade with proration');
          stripeSubscription = await updateSubscriptionImmediate(
            currentSubscription.stripeSubscriptionId,
            newPriceId,
            contributorCount!,
            stripeMetadata
          );
          console.log('Upgrade completed successfully:', {
            subscriptionId: (stripeSubscription as any)?.id,
            status: (stripeSubscription as any)?.status,
            current_period_end: (stripeSubscription as any)?.current_period_end
          });
          result = { type: 'upgrade', timing: 'immediate' };
        } else if (isDowngrade) {
          console.log('Scheduling downgrade for next billing period');
          const schedule = await scheduleSubscriptionDowngrade(
            currentSubscription.stripeSubscriptionId,
            newPriceId,
            contributorCount!,
            stripeMetadata
          );
          console.log('Downgrade scheduled successfully:', {
            scheduleId: schedule.id,
            phases: schedule.phases?.length
          });
          result = { type: 'downgrade', timing: 'scheduled', scheduleId: schedule.id };
          // For downgrades, we keep the current subscription active until the schedule takes effect
          stripeSubscription = null; // We don't update immediately
        } else {
          console.log('Processing change with no price difference');
          stripeSubscription = await updateSubscriptionImmediate(
            currentSubscription.stripeSubscriptionId,
            newPriceId,
            contributorCount!,
            stripeMetadata
          );
          console.log('No-price-change update completed:', {
            subscriptionId: (stripeSubscription as any)?.id,
            status: (stripeSubscription as any)?.status
          });
          result = { type: 'no_price_change', timing: 'immediate' };
        }

        // Update our database subscription record
        const totalAmount = billingCycle === 'annual' ? 
          plan.getTotalYearlyPrice(contributorCount!) : 
          plan.getTotalMonthlyPrice(contributorCount!);
        const totalMonthlyActions = plan.getTotalActionsPerMonth(contributorCount!);

        // For downgrades, we only update the database when the schedule takes effect
        // For upgrades and no-change scenarios, we update immediately
        if (!isDowngrade) {
          console.log('Updating subscription in database for:', result.type, {
            stripeSubscriptionExists: !!stripeSubscription,
            planId: plan._id,
            contributorCount,
            totalMonthlyActions,
            amount: totalAmount
          });

          (currentSubscription as any).planId = plan._id;
          currentSubscription.contributorCount = contributorCount!;
          currentSubscription.totalMonthlyActions = totalMonthlyActions;
          currentSubscription.amount = totalAmount;
          currentSubscription.interval = billingCycle === 'annual' ? 'year' : 'month';
          
          // Only update dates if we have a valid Stripe subscription response
          if (stripeSubscription && (stripeSubscription as any).current_period_end) {
            const endTimestamp = (stripeSubscription as any).current_period_end;
            
            // Validate the timestamp is a valid number and reasonable date
            if (typeof endTimestamp === 'number' && endTimestamp > 0) {
              const endDate = new Date(endTimestamp * 1000);
              
              // Additional validation: ensure the date is not invalid and is in the future
              if (!isNaN(endDate.getTime()) && endDate > new Date()) {
                console.log('Updating subscription dates from Stripe:', {
                  endTimestamp,
                  endDate: endDate.toISOString()
                });
                
                currentSubscription.endsAt = endDate;
                currentSubscription.nextBillingDate = endDate;
              } else {
                console.warn('Invalid date from Stripe timestamp, keeping existing dates:', {
                  timestamp: endTimestamp,
                  computedDate: endDate.toISOString()
                });
              }
            } else {
              console.warn('Invalid timestamp format from Stripe:', endTimestamp);
            }
          } else {
            console.warn('No valid Stripe subscription response, keeping existing dates');
          }

          // Final defensive check: ensure endsAt is always valid
          if (!currentSubscription.endsAt || isNaN(currentSubscription.endsAt.getTime())) {
            // If no valid end date exists, set it based on billing cycle
            const fallbackDays = billingCycle === 'annual' ? 365 : 30;
            currentSubscription.endsAt = new Date(Date.now() + (fallbackDays * 24 * 60 * 60 * 1000));
            console.log(`Set fallback endsAt date for ${billingCycle} cycle:`, currentSubscription.endsAt.toISOString());
          }
          
          currentSubscription.metadata = {
            ...currentSubscription.metadata,
            contributorCount,
            totalMonthlyActions,
            updatedBy: req.user!._id,
            lastStripeUpdate: new Date().toISOString(),
            changeType: result.type
          };

          await currentSubscription.save();
          console.log('Subscription updated in database successfully');
        } else {
          console.log('Skipping database update for downgrade - will be handled by Stripe schedule');
        }

        await currentSubscription.populate('planId');

        res.json({
          success: true,
          message: isDowngrade ? 
            `Downgrade to ${planName} scheduled for next billing period` :
            `Workspace subscription updated to ${planName} plan with ${contributorCount} contributor${contributorCount! > 1 ? 's' : ''}`,
          data: {
            workspaceId: req.workspace!._id,
            subscription: currentSubscription,
            plan: plan,
            contributorCount,
            totalMonthlyActions,
            changeResult: result,
            pricing: {
              currentMonthlyPrice,
              newMonthlyPrice,
              priceDifference: Math.abs(priceDifference),
              isUpgrade,
              isDowngrade
            },
            stripeSubscriptionId: currentSubscription.stripeSubscriptionId,
            timing: result.timing
          }
        });
        
      } catch (stripeError: any) {
        console.error('Stripe subscription update failed:', {
          error: stripeError,
          message: stripeError.message,
          type: stripeError.type,
          code: stripeError.code,
          subscriptionId: currentSubscription?.stripeSubscriptionId,
          changeType: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'no_change'
        });
        
        // Handle specific Stripe errors
        let errorMessage = 'Failed to update subscription in payment system';
        let statusCode = 500;
        
        if (stripeError.message && stripeError.message.includes('No such subscription')) {
          errorMessage = 'Subscription not found in payment system. Please contact support.';
          statusCode = 404;
        } else if (stripeError.message && stripeError.message.includes('No such price')) {
          errorMessage = 'Subscription plan pricing not configured. Please contact support.';
          statusCode = 400;
        } else if (stripeError.message && stripeError.message.includes('invoice')) {
          errorMessage = 'Unable to process payment for upgrade. Please check your payment method.';
          statusCode = 402;
        } else if (stripeError.message && stripeError.message.includes('schedule')) {
          errorMessage = 'Unable to schedule subscription change. Please try again later.';
          statusCode = 400;
        } else if (stripeError.message && stripeError.message.includes('Invalid Date')) {
          errorMessage = 'Subscription date validation failed. Please contact support.';
          statusCode = 500;
        }

        res.status(statusCode).json({
          success: false,
          message: errorMessage,
          error: stripeError.message || 'Unknown Stripe error',
          stripeError: true,
          currentSubscriptionId: currentSubscription?.stripeSubscriptionId,
          errorDetails: {
            type: stripeError.type,
            code: stripeError.code,
            changeType: isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'no_change'
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating workspace subscription',
        error: (error as Error).message
      });
    }
  }

  /**
   * DELETE /api/subscription/:workspaceId - Cancel workspace subscription
   */
  async cancelWorkspaceSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      
      const subscription = await Subscription.findOneAndUpdate(
        { workspaceId: req.workspace!._id, status: 'ACTIVE' },
        { 
          status: 'CANCELLED',
          cancelledAt: new Date()
        },
        { new: true }
      ).populate('planId');
      
      if (!subscription) {
        res.status(404).json({
          success: false,
          message: 'No active subscription found for this workspace'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Workspace subscription cancelled successfully',
        data: {
          workspaceId: req.workspace!._id,
          subscription: subscription,
          cancelledAt: subscription.cancelledAt,
          validUntil: subscription.endsAt
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error cancelling workspace subscription',
        error: (error as Error).message
      });
    }
  }
}

export const subscriptionController = new SubscriptionController();