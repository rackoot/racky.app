import { Response } from 'express';
import { AuthenticatedRequest } from '@/common/types/express';
import { UpdateSubscriptionDto, SubscriptionPreviewDto, updateSubscriptionSchema, subscriptionPreviewSchema } from '../dtos/subscriptionDto';
import { 
  updateSubscriptionImmediate, 
  scheduleSubscriptionDowngrade, 
  calculateProration,
  isStripeConfigured,
  cancelExistingSchedule,
  checkSubscriptionScheduleIsCompleted
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

      // Check for scheduled downgrade information
      let scheduledDowngrade = null;
      if (currentSubscription?.stripeScheduleId) {
        try {
          // Get schedule details from Stripe to get the future plan information
          const { getStripeInstance } = await import('@/common/services/stripeService');
          const stripeInstance = getStripeInstance();
          const schedule = await stripeInstance.subscriptionSchedules.retrieve(currentSubscription.stripeScheduleId);
          
          // The second phase contains the downgrade info
          const downgradePhase = schedule.phases?.[1];
          if (downgradePhase && downgradePhase.items?.[0]) {
            const newPriceId = downgradePhase.items[0].price as string;
            const newQuantity = downgradePhase.items[0].quantity || 1;
            
            // Find the plan that matches the new price ID
            const allPlans = await Plan.find({});
            const targetPlan = allPlans.find(plan => 
              plan.stripeMonthlyPriceId === newPriceId || plan.stripeYearlyPriceId === newPriceId
            );
            
            if (targetPlan) {
              scheduledDowngrade = {
                planName: targetPlan.name,
                planDisplayName: targetPlan.displayName,
                contributorCount: newQuantity,
                effectiveDate: new Date(downgradePhase.start_date * 1000).toISOString(),
                scheduleId: currentSubscription.stripeScheduleId
              };
            }
          }
        } catch (error: any) {
          console.warn('Error fetching schedule details:', error.message);
          // If schedule no longer exists, clear it from our database
          if (error.code === 'resource_missing') {
            currentSubscription.stripeScheduleId = undefined;
            await currentSubscription.save();
          }
        }
      }

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
          features: currentPlan ? currentPlan.features : null,
          scheduledDowngrade
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

      // Check if the plan requires contacting sales (Executive plan)
      if (newPlan.isContactSalesOnly) {
        res.status(400).json({
          success: false,
          message: 'This plan requires contacting sales',
          requiresContactSales: true,
          contactFormUrl: 'https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1'
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

      // Check if the plan requires contacting sales (Executive plan)
      if (plan.isContactSalesOnly) {
        res.status(400).json({
          success: false,
          message: 'This plan requires contacting sales',
          requiresContactSales: true,
          contactFormUrl: 'https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1'
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

      // Check and cancel existing schedule if one exists
      if (currentSubscription.stripeScheduleId) {
        console.log('Found existing schedule, checking if completed:', currentSubscription.stripeScheduleId);
        try {
          const scheduleCompleted = await checkSubscriptionScheduleIsCompleted(currentSubscription.stripeScheduleId);
          if (scheduleCompleted) {
            // Schedule is completed, clear the ID
            currentSubscription.stripeScheduleId = undefined;
            await currentSubscription.save();
            console.log('Schedule was completed, cleared from subscription');
          } else {
            // Schedule is still active, cancel it
            console.log('Schedule is active, cancelling before new update');
            await cancelExistingSchedule(currentSubscription.stripeScheduleId);
            currentSubscription.stripeScheduleId = undefined;
            await currentSubscription.save();
            console.log('Existing schedule cancelled successfully');
          }
        } catch (error: any) {
          console.warn('Error handling existing schedule:', error.message);
          // Clear the schedule ID if it's invalid
          currentSubscription.stripeScheduleId = undefined;
          await currentSubscription.save();
        }
      }

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
          
          // Save schedule ID to subscription for tracking
          currentSubscription.stripeScheduleId = schedule.id;
          await currentSubscription.save();
          console.log('Schedule ID saved to subscription:', schedule.id);
          
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
          // Clear any schedule ID since we're processing immediately
          if (currentSubscription.stripeScheduleId && !isDowngrade) {
            currentSubscription.stripeScheduleId = undefined;
          }
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
   * DELETE /api/subscription/:workspaceId/downgrade - Cancel scheduled downgrade
   */
  async cancelWorkspaceSubscriptionDowngrade(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Find the active subscription with a scheduled downgrade
      const activeSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id, 
        status: 'ACTIVE'
      });
      
      if (!activeSubscription) {
        res.status(404).json({
          success: false,
          message: 'No active subscription found for this workspace'
        });
        return;
      }

      if (!activeSubscription.stripeScheduleId) {
        res.status(404).json({
          success: false,
          message: 'No scheduled downgrade found for this workspace'
        });
        return;
      }

      console.log('Cancelling scheduled downgrade:', activeSubscription.stripeScheduleId);

      try {
        // Cancel the scheduled downgrade in Stripe
        await cancelExistingSchedule(activeSubscription.stripeScheduleId);
        
        // Clear the schedule ID from our database
        activeSubscription.stripeScheduleId = undefined;
        await activeSubscription.save();
        
        console.log('Scheduled downgrade cancelled successfully');

        res.json({
          success: true,
          message: 'Scheduled downgrade cancelled successfully',
          data: {
            workspaceId: req.workspace!._id,
            scheduleCancelled: true
          }
        });
      } catch (stripeError: any) {
        console.error('Error cancelling schedule in Stripe:', stripeError);
        
        // If schedule doesn't exist in Stripe, clean up our database
        if (stripeError.message?.includes('resource_missing') || stripeError.code === 'resource_missing') {
          activeSubscription.stripeScheduleId = undefined;
          await activeSubscription.save();
          
          res.json({
            success: true,
            message: 'Scheduled downgrade was already cancelled or completed',
            data: {
              workspaceId: req.workspace!._id,
              scheduleCancelled: true
            }
          });
        } else {
          throw stripeError;
        }
      }
    } catch (error) {
      console.error('Error cancelling workspace subscription downgrade:', error);
      res.status(500).json({
        success: false,
        message: 'Error cancelling scheduled downgrade',
        error: (error as Error).message
      });
    }
  }

  /**
   * DELETE /api/subscription/:workspaceId - Cancel workspace subscription
   */
  async cancelWorkspaceSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // First find the active subscription to check for pending schedules
      const activeSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id, 
        status: 'ACTIVE'
      });
      
      if (!activeSubscription) {
        res.status(404).json({
          success: false,
          message: 'No active subscription found for this workspace'
        });
        return;
      }

      // Cancel any pending schedule before cancelling subscription
      if (activeSubscription.stripeScheduleId) {
        console.log('Cancelling pending schedule before subscription cancellation:', activeSubscription.stripeScheduleId);
        try {
          await cancelExistingSchedule(activeSubscription.stripeScheduleId);
          console.log('Pending schedule cancelled successfully');
        } catch (error: any) {
          console.warn('Error cancelling pending schedule:', error.message);
          // Continue with subscription cancellation even if schedule cancellation fails
        }
      }
      
      const subscription = await Subscription.findOneAndUpdate(
        { workspaceId: req.workspace!._id, status: 'ACTIVE' },
        { 
          status: 'CANCELLED',
          cancelledAt: new Date(),
          stripeScheduleId: undefined // Clear any schedule reference
        },
        { new: true }
      ).populate('planId');
      
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

  /**
   * POST /api/subscription/:workspaceId/reactivate - Reactivate workspace subscription
   */
  async reactivateWorkspaceSubscription(req: AuthenticatedRequest<UpdateSubscriptionDto>, res: Response): Promise<void> {
    try {
      const { error } = updateSubscriptionSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          error: error.details[0].message
        });
        return;
      }

      // Check if workspace has a cancelled subscription
      const cancelledSubscription = await Subscription.findOne({
        workspaceId: req.workspace!._id,
        status: 'CANCELLED'
      });

      if (!cancelledSubscription) {
        res.status(400).json({
          success: false,
          message: 'No cancelled subscription found. Use regular subscription update instead.'
        });
        return;
      }

      // Get the requested plan
      const plan = await Plan.findOne({ name: req.body.planName });
      if (!plan) {
        res.status(404).json({
          success: false,
          message: 'Plan not found'
        });
        return;
      }

      // Validate contributor count
      const contributorCount = req.body.contributorCount || 1;
      if (contributorCount > plan.maxContributorsPerWorkspace) {
        res.status(400).json({
          success: false,
          message: `Maximum ${plan.maxContributorsPerWorkspace} contributors allowed for this plan`
        });
        return;
      }

      // Calculate new subscription details
      const billingCycle = req.body.billingCycle || 'monthly';
      const amount = billingCycle === 'annual' ? 
        plan.getTotalYearlyPrice(contributorCount) : 
        plan.getTotalMonthlyPrice(contributorCount);
      const totalMonthlyActions = plan.getTotalActionsPerMonth(contributorCount);
      
      // Set end date (1 month or 1 year from now)
      const endsAt = new Date();
      if (billingCycle === 'annual') {
        endsAt.setFullYear(endsAt.getFullYear() + 1);
      } else {
        endsAt.setMonth(endsAt.getMonth() + 1);
      }

      // Create new subscription (reactivation)
      const newSubscription = new Subscription({
        workspaceId: req.workspace!._id,
        planId: plan._id,
        contributorCount,
        totalMonthlyActions,
        amount,
        currency: 'usd',
        interval: billingCycle === 'annual' ? 'year' : 'month',
        startsAt: new Date(),
        endsAt,
        nextBillingDate: endsAt,
        status: 'ACTIVE'
      });

      await newSubscription.save();
      await newSubscription.populate('planId');

      // Update the old cancelled subscription to mark it as replaced
      await Subscription.findByIdAndUpdate(cancelledSubscription._id, {
        metadata: { 
          ...cancelledSubscription.metadata,
          reactivatedAt: new Date(),
          reactivatedBy: req.user!._id,
          replacedBySubscription: newSubscription._id
        }
      });

      res.status(201).json({
        success: true,
        message: 'Workspace subscription reactivated successfully',
        data: {
          workspaceId: req.workspace!._id,
          subscription: newSubscription,
          planName: plan.name,
          planDisplayName: plan.displayName,
          contributorCount,
          totalMonthlyActions,
          monthlyPrice: billingCycle === 'annual' ? amount / 100 / 12 : amount / 100,
          billingCycle: billingCycle
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error reactivating workspace subscription',
        error: (error as Error).message
      });
    }
  }
}

export const subscriptionController = new SubscriptionController();