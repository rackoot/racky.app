import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';
import User from '../../modules/auth/models/User';
import Usage from '../../modules/subscriptions/models/Usage';

const protect = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<any> => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
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
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Skip subscription check for SUPERADMIN
    if (req.user.isSuperAdmin()) {
      return next();
    }

    // Check if user has active subscription
    const hasActiveSubscription = await req.user.hasActiveSubscription();
    if (!hasActiveSubscription) {
      const subscriptionInfo = await req.user.getSubscriptionInfo();
      return res.status(402).json({
        success: false,
        message: 'Active subscription required. Please subscribe to access this feature.',
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
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Skip limits for SUPERADMIN
      if (req.user.isSuperAdmin()) {
        return next();
      }

      // Get current plan
      const currentPlan = await req.user.getCurrentPlan();
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
          hasReachedLimit = await req.user.hasReachedStoreLimit();
          limitMessage = `Store limit reached (${currentPlan.limits.maxStores} stores maximum for ${currentPlan.name} plan)`;
          break;
        case 'products':
          hasReachedLimit = await req.user.hasReachedProductLimit();
          limitMessage = `Product limit reached (${currentPlan.limits.maxProducts} products maximum for ${currentPlan.name} plan)`;
          break;
        default:
          return next();
      }

      if (hasReachedLimit) {
        const subscriptionInfo = await req.user.getSubscriptionInfo();
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

      // Get user's current plan
      const userPlan = await req.user.getCurrentPlan();
      if (!userPlan) {
        return res.status(402).json({
          success: false,
          message: 'No active subscription plan found',
          subscriptionInfo: req.user.getSubscriptionInfo()
        });
      }

      // Check if feature is enabled in current plan
      const feature = userPlan.features.find((f: any) => f.name === featureName);
      if (!feature || !feature.enabled) {
        return res.status(403).json({
          success: false,
          message: `Feature '${featureName}' is not available in your current plan`,
          requiredPlan: getMinimumPlanForFeature(featureName),
          subscriptionInfo: req.user.getSubscriptionInfo()
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

      // Get current month usage
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const currentUsage = await Usage.findOne({
        userId: req.user._id,
        date: {
          $gte: startOfMonth,
          $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
        }
      });

      const apiCallsThisMonth = currentUsage?.apiCalls || 0;
      const userPlan = await req.user.getCurrentPlan();
      
      if (!userPlan) {
        return res.status(402).json({
          success: false,
          message: 'Active subscription required to access API'
        });
      }
      
      const monthlyLimit = userPlan.limits.apiCallsPerMonth;

      if (apiCallsThisMonth >= monthlyLimit) {
        const subscriptionInfo = await req.user.getSubscriptionInfo();
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

      const userPlan = await req.user.getCurrentPlan();
      if (!userPlan) {
        return res.status(402).json({
          success: false,
          message: 'Active subscription required to sync data'
        });
      }
      
      const minSyncInterval = userPlan.limits.maxSyncFrequency; // hours

      // Check last sync time for this connection
      const connectionId = req.params.connectionId;
      if (connectionId) {
        const StoreConnection = (await import('../../modules/stores/models/StoreConnection')).default;
        const connection = await StoreConnection.findOne({
          _id: connectionId,
          userId: req.user._id
        });

        if (connection && connection.lastSync) {
          const timeSinceLastSync = (Date.now() - connection.lastSync.getTime()) / (1000 * 60 * 60); // hours
          
          if (timeSinceLastSync < minSyncInterval) {
            const hoursRemaining = Math.ceil(minSyncInterval - timeSinceLastSync);
            return res.status(429).json({
              success: false,
              message: `Sync frequency limit exceeded. Next sync available in ${hoursRemaining} hours`,
              syncLimits: {
                minInterval: minSyncInterval,
                hoursRemaining
              },
              subscriptionInfo: req.user.getSubscriptionInfo()
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

const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
  generateToken 
};