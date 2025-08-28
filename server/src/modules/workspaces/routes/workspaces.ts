import express, { Response } from 'express';
import Joi from 'joi';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect, requireWorkspace, requireWorkspacePermission, requireWorkspaceRole } from '@/common/middleware/auth';
import { WorkspaceService } from '../services/workspaceService';
import { ICreateWorkspaceRequest, IUpdateWorkspaceRequest, IWorkspaceInviteRequest } from '../interfaces/workspace';

const router = express.Router();

// Validation schemas
const createWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  slug: Joi.string().regex(/^[a-z0-9-]+$/).max(50).optional(),
  settings: Joi.object({
    timezone: Joi.string().optional(),
    currency: Joi.string().length(3).optional(),
    language: Joi.string().length(2).optional()
  }).optional()
});

const updateWorkspaceSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional().allow(''),
  settings: Joi.object({
    timezone: Joi.string().optional(),
    currency: Joi.string().length(3).optional(),
    language: Joi.string().length(2).optional()
  }).optional(),
  isActive: Joi.boolean().optional()
});

const inviteUserSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid('ADMIN', 'OPERATOR', 'VIEWER').required(),
  message: Joi.string().max(500).optional()
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'OPERATOR', 'VIEWER').required()
});

const updateSubscriptionSchema = Joi.object({
  planName: Joi.string().valid('BASIC', 'PRO', 'ENTERPRISE').required(),
  billingCycle: Joi.string().valid('monthly', 'annual').optional().default('monthly'),
  contributorCount: Joi.number().integer().min(1).max(50).optional().default(1)
});

const subscriptionPreviewSchema = Joi.object({
  planName: Joi.string().valid('BASIC', 'PRO', 'ENTERPRISE').required(),
  billingCycle: Joi.string().valid('monthly', 'annual').optional().default('monthly'),
  contributorCount: Joi.number().integer().min(1).max(50).optional().default(1)
});

// Get all workspaces for authenticated user
router.get('/', protect, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaces = await WorkspaceService.getUserWorkspaces(req.user!._id as Types.ObjectId);
    
    res.json({
      success: true,
      message: 'Workspaces retrieved successfully',
      data: workspaces
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspaces',
      error: (error as Error).message
    });
  }
});

// Create new workspace
router.post('/', protect, async (req: AuthenticatedRequest<ICreateWorkspaceRequest>, res: Response) => {
  try {
    const { error } = createWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    // TODO: Check workspace limits based on user's plan
    // For now, allow unlimited workspaces for all users

    const workspace = await WorkspaceService.createWorkspace(req.user!._id as Types.ObjectId, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating workspace',
      error: (error as Error).message
    });
  }
});

// Get specific workspace
router.get('/:workspaceId', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const workspace = await WorkspaceService.getWorkspaceById(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace retrieved successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace',
      error: (error as Error).message
    });
  }
});

// Update workspace
router.put('/:workspaceId', protect, requireWorkspace, requireWorkspacePermission('workspace:update'), async (req: AuthenticatedRequest<IUpdateWorkspaceRequest>, res: Response) => {
  try {
    const { error } = updateWorkspaceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const workspace = await WorkspaceService.updateWorkspace(workspaceId, req.user!._id as Types.ObjectId, req.body);
    
    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace updated successfully',
      data: workspace
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating workspace',
      error: (error as Error).message
    });
  }
});

// Delete workspace
router.delete('/:workspaceId', protect, requireWorkspace, requireWorkspaceRole('OWNER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const deleted = await WorkspaceService.deleteWorkspace(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found'
      });
    }

    res.json({
      success: true,
      message: 'Workspace deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting workspace',
      error: (error as Error).message
    });
  }
});

// Get workspace members
router.get('/:workspaceId/members', protect, requireWorkspace, requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const members = await WorkspaceService.getWorkspaceMembers(workspaceId);
    
    res.json({
      success: true,
      message: 'Workspace members retrieved successfully',
      data: members
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace members',
      error: (error as Error).message
    });
  }
});

// Invite user to workspace
router.post('/:workspaceId/invite', protect, requireWorkspace, requireWorkspacePermission('workspace:invite'), async (req: AuthenticatedRequest<IWorkspaceInviteRequest>, res: Response) => {
  try {
    const { error } = inviteUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const member = await WorkspaceService.inviteUser(workspaceId, req.user!._id as Types.ObjectId, req.body);
    
    res.status(201).json({
      success: true,
      message: 'User invited successfully',
      data: member
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error inviting user',
      error: (error as Error).message
    });
  }
});

// Update member role
router.put('/:workspaceId/members/:userId/role', protect, requireWorkspace, requireWorkspacePermission('workspace:invite'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = updateRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    
    const member = await WorkspaceService.updateMemberRole(
      workspaceId,
      req.user!._id as Types.ObjectId,
      targetUserId,
      req.body.role
    );
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: member
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating member role',
      error: (error as Error).message
    });
  }
});

// Remove member from workspace
router.delete('/:workspaceId/members/:userId', protect, requireWorkspace, requireWorkspacePermission('workspace:remove_users'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const targetUserId = new Types.ObjectId(req.params.userId);
    
    const removed = await WorkspaceService.removeMember(workspaceId, req.user!._id as Types.ObjectId, targetUserId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or cannot be removed'
      });
    }

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error removing member',
      error: (error as Error).message
    });
  }
});

// Transfer ownership
router.post('/:workspaceId/transfer-ownership', protect, requireWorkspace, requireWorkspaceRole('OWNER'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { newOwnerId } = req.body;
    
    if (!newOwnerId) {
      return res.status(400).json({
        success: false,
        message: 'New owner ID is required'
      });
    }

    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const newOwnerObjectId = new Types.ObjectId(newOwnerId);
    
    const transferred = await WorkspaceService.transferOwnership(
      workspaceId,
      req.user!._id as Types.ObjectId,
      newOwnerObjectId
    );
    
    if (!transferred) {
      return res.status(400).json({
        success: false,
        message: 'Could not transfer ownership'
      });
    }

    res.json({
      success: true,
      message: 'Ownership transferred successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error transferring ownership',
      error: (error as Error).message
    });
  }
});

// Leave workspace
router.post('/:workspaceId/leave', protect, requireWorkspace, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = new Types.ObjectId(req.params.workspaceId);
    const left = await WorkspaceService.leaveWorkspace(workspaceId, req.user!._id as Types.ObjectId);
    
    if (!left) {
      return res.status(400).json({
        success: false,
        message: 'Could not leave workspace'
      });
    }

    res.json({
      success: true,
      message: 'Left workspace successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error leaving workspace',
      error: (error as Error).message
    });
  }
});

// ====== WORKSPACE SUBSCRIPTION MANAGEMENT ======

// Get workspace subscription info
router.get('/:workspaceId/subscription', protect, requireWorkspace, requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptionInfo = await req.workspace!.getSubscriptionInfo();
    const currentPlan = await req.workspace!.getCurrentPlan();
    const hasActiveSubscription = await req.workspace!.hasActiveSubscription();
    
    // Get current subscription for contributor info
    const { default: Subscription } = await import('../../subscriptions/models/Subscription');
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
});

// Preview subscription changes with pricing
router.post('/:workspaceId/subscription/preview', protect, requireWorkspace, requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = subscriptionPreviewSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const { planName, billingCycle, contributorCount } = req.body;
    
    // Find the new plan
    const { default: Plan } = await import('../../subscriptions/models/Plan');
    const newPlan = await Plan.findByName(planName);
    
    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    if (contributorCount > newPlan.maxContributorsPerWorkspace) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${newPlan.maxContributorsPerWorkspace} contributors allowed for ${planName} plan`
      });
    }

    // Get current subscription
    const { default: Subscription } = await import('../../subscriptions/models/Subscription');
    const currentSubscription = await Subscription.findOne({
      workspaceId: req.workspace!._id,
      status: 'ACTIVE'
    }).populate('planId');

    const currentPlan = currentSubscription?.planId as any;
    const currentContributorCount = currentSubscription?.contributorCount || 1;
    const currentBillingCycle = currentSubscription?.interval === 'year' ? 'annual' : 'monthly';
    
    // Calculate pricing
    const newMonthlyPrice = billingCycle === 'annual' ? 
      (newPlan.getTotalYearlyPrice(contributorCount) / 100 / 12) :
      (newPlan.getTotalMonthlyPrice(contributorCount) / 100);
    
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
    const newTotalActions = newPlan.getTotalActionsPerMonth(contributorCount);
    const currentTotalActions = currentPlan ? currentPlan.getTotalActionsPerMonth(currentContributorCount) : 0;
    
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
              'No price change required'
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
});

// Update/Create workspace subscription
router.put('/:workspaceId/subscription', protect, requireWorkspace, requireWorkspacePermission('workspace:manage_subscription'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = updateSubscriptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.details[0].message
      });
    }

    const { planName, billingCycle, contributorCount } = req.body;
    
    // Find the plan
    const { default: Plan } = await import('../../subscriptions/models/Plan');
    const plan = await Plan.findByName(planName);
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    if (contributorCount > plan.maxContributorsPerWorkspace) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${plan.maxContributorsPerWorkspace} contributors allowed for ${planName} plan`
      });
    }

    // Create or update subscription
    const { default: Subscription } = await import('../../subscriptions/models/Subscription');
    
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + (billingCycle === 'annual' ? 12 : 1));
    
    // Calculate pricing and actions
    const totalAmount = billingCycle === 'annual' ? 
      plan.getTotalYearlyPrice(contributorCount) : 
      plan.getTotalMonthlyPrice(contributorCount);
    const totalMonthlyActions = plan.getTotalActionsPerMonth(contributorCount);
    
    const subscription = await Subscription.findOneAndUpdate(
      { workspaceId: req.workspace!._id },
      {
        workspaceId: req.workspace!._id,
        planId: plan._id,
        status: 'ACTIVE',
        contributorCount,
        totalMonthlyActions,
        amount: totalAmount,
        currency: plan.currency,
        interval: billingCycle === 'annual' ? 'year' : 'month',
        startsAt: new Date(),
        endsAt: subscriptionEndDate,
        nextBillingDate: subscriptionEndDate,
        metadata: {
          contributorCount,
          totalMonthlyActions,
          updatedBy: req.user!._id
        }
      },
      { upsert: true, new: true }
    ).populate('planId');
    
    res.json({
      success: true,
      message: `Workspace subscription updated to ${planName} plan with ${contributorCount} contributor${contributorCount > 1 ? 's' : ''}`,
      data: {
        workspaceId: req.workspace!._id,
        subscription: subscription,
        plan: plan,
        contributorCount,
        totalMonthlyActions,
        monthlyPrice: billingCycle === 'annual' ? 
          (totalAmount / 100 / 12) : 
          (totalAmount / 100),
        endsAt: subscriptionEndDate
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating workspace subscription',
      error: (error as Error).message
    });
  }
});

// Cancel workspace subscription
router.delete('/:workspaceId/subscription', protect, requireWorkspace, requireWorkspacePermission('workspace:manage_subscription'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { default: Subscription } = await import('../../subscriptions/models/Subscription');
    
    const subscription = await Subscription.findOneAndUpdate(
      { workspaceId: req.workspace!._id, status: 'ACTIVE' },
      { 
        status: 'CANCELLED',
        cancelledAt: new Date()
      },
      { new: true }
    ).populate('planId');
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found for this workspace'
      });
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
});

// Get workspace usage statistics
router.get('/:workspaceId/usage', protect, requireWorkspace, requireWorkspacePermission('workspace:read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get current month usage
    const { default: Usage } = await import('../../subscriptions/models/Usage');
    const { default: StoreConnection } = await import('../../stores/models/StoreConnection');
    const { default: Product } = await import('../../products/models/Product');
    
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [currentUsage, storeCount, productCount] = await Promise.all([
      Usage.findOne({
        workspaceId: req.workspace!._id,
        date: {
          $gte: startOfMonth,
          $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
        }
      }),
      StoreConnection.countDocuments({ workspaceId: req.workspace!._id, isActive: true }),
      Product.countDocuments({ workspaceId: req.workspace!._id })
    ]);

    const currentPlan = await req.workspace!.getCurrentPlan();
    
    const usageData = {
      workspaceId: req.workspace!._id,
      workspaceName: req.workspace!.name,
      currentPeriod: {
        month: currentDate.toISOString().slice(0, 7), // YYYY-MM format
        apiCalls: currentUsage?.apiCalls || 0,
        productSyncs: currentUsage?.productSyncs || 0,
        storesConnected: storeCount,
        totalProducts: productCount,
        features: {
          aiSuggestions: currentUsage?.aiSuggestions || 0,
          opportunityScans: currentUsage?.opportunityScans || 0,
          bulkOperations: currentUsage?.bulkOperations || 0
        }
      },
      limits: currentPlan ? {
        maxStores: currentPlan.limits.maxStores,
        maxProducts: currentPlan.limits.maxProducts,
        maxMarketplaces: currentPlan.limits.maxMarketplaces,
        apiCallsPerMonth: currentPlan.limits.apiCallsPerMonth
      } : null,
      percentageUsed: currentPlan ? {
        stores: Math.round((storeCount / currentPlan.limits.maxStores) * 100),
        products: Math.round((productCount / currentPlan.limits.maxProducts) * 100),
        apiCalls: Math.round(((currentUsage?.apiCalls || 0) / currentPlan.limits.apiCallsPerMonth) * 100)
      } : null
    };
    
    res.json({
      success: true,
      message: 'Workspace usage retrieved successfully',
      data: usageData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving workspace usage',
      error: (error as Error).message
    });
  }
});

export default router;