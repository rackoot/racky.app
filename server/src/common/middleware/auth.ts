import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest, JWTPayload } from '../types/express';
import getEnv from '../config/env';
import User from '../../modules/auth/models/User';
import Usage from '../../modules/subscriptions/models/Usage';
import Workspace from '../../modules/workspaces/models/Workspace';
import WorkspaceUser from '../../modules/workspaces/models/WorkspaceUser';
// Note: This import may cause circular dependencies and should be handled carefully
// import StoreConnection from '../../modules/stores/models/StoreConnection';

const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, getEnv().JWT_SECRET) as JWTPayload;
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ 
          success: false,
          message: 'Account is deactivated' 
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, token failed' 
      });
    }
  } else {
    return res.status(401).json({ 
      success: false,
      message: 'Not authorized, no token' 
    });
  }
};

const requireSuperAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.isSuperAdmin()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. SUPERADMIN role required.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking admin privileges',
      error: (error as Error).message
    });
  }
};

const checkSubscriptionStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.user || !req.workspace) {
      return res.status(401).json({
        success: false,
        message: 'Authentication and workspace context required'
      });
    }

    // Skip subscription check for SUPERADMIN
    if (req.user.isSuperAdmin()) {
      return next();
    }

    // Check if workspace has active subscription
    const hasActiveSubscription = await req.workspace.hasActiveSubscription();
    if (!hasActiveSubscription) {
      const subscriptionInfo = await req.workspace.getSubscriptionInfo();
      return res.status(402).json({
        success: false,
        message: 'Active subscription required for this workspace. Please subscribe to access this feature.',
        subscriptionInfo
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
      error: (error as Error).message
    });
  }
};

const checkUsageLimits = (limitType: 'stores' | 'products') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user || !req.workspace) {
        return res.status(401).json({
          success: false,
          message: 'Authentication and workspace context required'
        });
      }

      // Skip limits for SUPERADMIN
      if (req.user.isSuperAdmin()) {
        return next();
      }

      // Get current plan
      const currentPlan = await req.workspace.getCurrentPlan();
      if (!currentPlan) {
        return res.status(402).json({
          success: false,
          message: 'Active subscription required to access this feature'
        });
      }

      let hasReachedLimit = false;
      let limitMessage = '';

      switch (limitType) {
        case 'stores':
          hasReachedLimit = await req.workspace.hasReachedStoreLimit();
          limitMessage = `Store limit reached (${currentPlan.limits.maxStores} stores maximum for ${currentPlan.name} plan)`;
          break;
        case 'products':
          hasReachedLimit = await req.workspace.hasReachedProductLimit();
          limitMessage = `Product limit reached (${currentPlan.limits.maxProducts} products maximum for ${currentPlan.name} plan)`;
          break;
        default:
          return next();
      }

      if (hasReachedLimit) {
        const subscriptionInfo = await req.workspace.getSubscriptionInfo();
        return res.status(429).json({
          success: false,
          message: limitMessage,
          subscriptionInfo
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking usage limits',
        error: (error as Error).message
      });
    }
  };
};

const trackUsage = (metric: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (req.user && !req.user.isSuperAdmin()) {
        // Track usage in background (don't block request)
        Usage.incrementUserUsage(req.user._id.toString(), metric).catch((err: any) => {
          console.error('Error tracking usage:', err);
        });
      }
      next();
    } catch (error) {
      // Don't block the request if usage tracking fails
      console.error('Error in trackUsage middleware:', error);
      next();
    }
  };
};

const requireFeature = (featureName: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Skip feature check for SUPERADMIN
      if (req.user.isSuperAdmin()) {
        return next();
      }

      // This middleware should only be used with workspace context now
      if (!req.workspace) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context required for feature access'
        });
      }

      // Get workspace's current plan
      const workspacePlan = await req.workspace.getCurrentPlan();
      if (!workspacePlan) {
        return res.status(402).json({
          success: false,
          message: 'No active subscription plan found for this workspace'
        });
      }

      // Check if feature is enabled in current plan
      const feature = workspacePlan.features.find((f: any) => f.name === featureName);
      if (!feature || !feature.enabled) {
        return res.status(403).json({
          success: false,
          message: `Feature '${featureName}' is not available in your current plan`,
          requiredPlan: getMinimumPlanForFeature(featureName)
          // subscriptionInfo now handled at workspace level
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking feature access',
        error: (error as Error).message
      });
    }
  };
};

const getMinimumPlanForFeature = (featureName: string): string => {
  const featurePlanMap: { [key: string]: string } = {
    'AI Suggestions': 'PRO',
    'Advanced Analytics': 'PRO',
    'Bulk Operations': 'PRO',
    'Priority Support': 'PRO',
    'Custom Integrations': 'ENTERPRISE',
    'Dedicated Manager': 'ENTERPRISE'
  };
  
  return featurePlanMap[featureName] || 'PRO';
};

const checkApiRateLimit = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user || req.user.isSuperAdmin()) {
        return next();
      }

      if (!req.workspace) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context required'
        });
      }

      // Get current month usage
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const currentUsage = await Usage.findOne({
        workspaceId: req.workspace._id,
        date: {
          $gte: startOfMonth,
          $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
        }
      });

      const apiCallsThisMonth = currentUsage?.apiCalls || 0;
      const workspacePlan = await req.workspace.getCurrentPlan();
      
      if (!workspacePlan) {
        return res.status(402).json({
          success: false,
          message: 'Active subscription required to access API'
        });
      }
      
      const monthlyLimit = workspacePlan.limits.apiCallsPerMonth;

      if (apiCallsThisMonth >= monthlyLimit) {
        const subscriptionInfo = await req.workspace.getSubscriptionInfo();
        return res.status(429).json({
          success: false,
          message: `Monthly API limit exceeded (${monthlyLimit} calls)`,
          usage: {
            current: apiCallsThisMonth,
            limit: monthlyLimit
          },
          subscriptionInfo
        });
      }

      // Add usage info to request for tracking
      req.apiUsage = {
        current: apiCallsThisMonth,
        limit: monthlyLimit,
        remaining: monthlyLimit - apiCallsThisMonth
      };

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking API rate limit',
        error: (error as Error).message
      });
    }
  };
};

const checkSyncFrequency = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user || req.user.isSuperAdmin()) {
        return next();
      }

      if (!req.workspace) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context required for sync operations'
        });
      }

      const workspacePlan = await req.workspace.getCurrentPlan();
      if (!workspacePlan) {
        return res.status(402).json({
          success: false,
          message: 'Active subscription required to sync data'
        });
      }
      
      const minSyncInterval = workspacePlan.limits.maxSyncFrequency; // hours

      // Check last sync time for this connection
      const connectionId = req.params.connectionId;
      if (connectionId) {
        // Dynamic import to avoid circular dependency
        const { default: StoreConnection } = await import('../../modules/stores/models/StoreConnection');
        const connection = await StoreConnection.findOne({
          _id: connectionId,
          userId: req.user._id
        });

        if (connection && connection.lastSync) {
          const timeSinceLastSync = (Date.now() - connection.lastSync.getTime()) / (1000 * 60 * 60); // hours
          
          // Check if force sync is enabled (bypasses frequency limits)
          const force = req.body.force === true;
          
          if (timeSinceLastSync < minSyncInterval && !force) {
            const hoursRemaining = Math.ceil(minSyncInterval - timeSinceLastSync);
            return res.status(429).json({
              success: false,
              message: `Sync frequency limit exceeded. Next sync available in ${hoursRemaining} hours`,
              syncLimits: {
                minInterval: minSyncInterval,
                hoursRemaining
              }
              // subscriptionInfo now handled at workspace level
            });
          }
        }
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking sync frequency',
        error: (error as Error).message
      });
    }
  };
};

// New workspace-aware middleware
const requireWorkspace = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get workspace ID from header, query param, or route param
    let workspaceId = req.headers['x-workspace-id'] as string || 
                     req.query.workspaceId as string || 
                     req.params.workspaceId;

    // If no workspace ID provided, get user's default workspace
    if (!workspaceId) {
      const userWorkspaces = await WorkspaceUser.findUserWorkspaces(req.user._id as Types.ObjectId);
      if (userWorkspaces.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No workspace found. Please create or join a workspace.'
        });
      }
      // Use the most recently joined workspace as default
      workspaceId = userWorkspaces[0].workspaceId._id.toString();
    }

    // Find workspace and user membership
    const [workspace, workspaceUser] = await Promise.all([
      Workspace.findById(workspaceId),
      WorkspaceUser.findUserWorkspaceRole(req.user._id as Types.ObjectId, workspaceId as unknown as Types.ObjectId)
    ]);

    if (!workspace || !workspace.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found or inactive'
      });
    }

    if (!workspaceUser || !workspaceUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this workspace.'
      });
    }

    // Add workspace context to request
    req.workspace = workspace;
    req.workspaceUser = workspaceUser;
    req.workspaceRole = workspaceUser.role;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error validating workspace access',
      error: (error as Error).message
    });
  }
};

const requireWorkspacePermission = (permission: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.workspaceUser) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context required'
        });
      }

      // Skip permission check for SUPERADMIN
      if (req.user?.isSuperAdmin()) {
        return next();
      }

      if (!req.workspaceUser.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`,
          userRole: req.workspaceUser.role
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking workspace permissions',
        error: (error as Error).message
      });
    }
  };
};

const requireWorkspaceRole = (minimumRole: string) => {
  const roleHierarchy = ['VIEWER', 'OPERATOR', 'ADMIN', 'OWNER'];
  
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.workspaceUser) {
        return res.status(401).json({
          success: false,
          message: 'Workspace context required'
        });
      }

      // Skip role check for SUPERADMIN
      if (req.user?.isSuperAdmin()) {
        return next();
      }

      const userRoleIndex = roleHierarchy.indexOf(req.workspaceUser.role);
      const requiredRoleIndex = roleHierarchy.indexOf(minimumRole);

      if (userRoleIndex < requiredRoleIndex) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${minimumRole} or higher`,
          userRole: req.workspaceUser.role
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking workspace role',
        error: (error as Error).message
      });
    }
  };
};

const generateToken = (id: string, workspaceId?: string, role?: string): string => {
  const env = getEnv();
  const payload: JWTPayload = { id };
  
  if (workspaceId) {
    payload.workspaceId = workspaceId;
  }
  
  if (role) {
    payload.role = role as any;
  }

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  } as jwt.SignOptions);
};

export { 
  protect, 
  requireSuperAdmin, 
  checkSubscriptionStatus, 
  checkUsageLimits,
  trackUsage,
  requireFeature,
  checkApiRateLimit,
  checkSyncFrequency,
  requireWorkspace,
  requireWorkspacePermission,
  requireWorkspaceRole,
  generateToken 
};