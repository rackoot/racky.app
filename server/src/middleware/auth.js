const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Usage = require('../models/Usage');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

// Middleware to require SUPERADMIN role
const requireSuperAdmin = async (req, res, next) => {
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
      error: error.message
    });
  }
};

// Middleware to check subscription status
const checkSubscriptionStatus = async (req, res, next) => {
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
    if (!req.user.hasActiveSubscription()) {
      return res.status(402).json({
        success: false,
        message: 'Active subscription required',
        subscriptionInfo: req.user.getSubscriptionInfo()
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
      error: error.message
    });
  }
};

// Middleware to check usage limits
const checkUsageLimits = (limitType) => {
  return async (req, res, next) => {
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

      let hasReachedLimit = false;
      let limitMessage = '';

      switch (limitType) {
        case 'stores':
          hasReachedLimit = await req.user.hasReachedStoreLimit();
          limitMessage = `Store limit reached (${req.user.maxStores} stores maximum for ${req.user.subscriptionPlan} plan)`;
          break;
        case 'products':
          hasReachedLimit = await req.user.hasReachedProductLimit();
          limitMessage = `Product limit reached (${req.user.maxProducts} products maximum for ${req.user.subscriptionPlan} plan)`;
          break;
        default:
          return next();
      }

      if (hasReachedLimit) {
        return res.status(429).json({
          success: false,
          message: limitMessage,
          subscriptionInfo: req.user.getSubscriptionInfo()
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking usage limits',
        error: error.message
      });
    }
  };
};

// Middleware to track API usage
const trackUsage = (metric) => {
  return async (req, res, next) => {
    try {
      if (req.user && !req.user.isSuperAdmin()) {
        // Track usage in background (don't block request)
        Usage.incrementUserUsage(req.user._id, metric).catch(err => {
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

// Middleware to check plan-based feature access
const requireFeature = (featureName) => {
  return async (req, res, next) => {
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
      const feature = userPlan.features.find(f => f.name === featureName);
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
        error: error.message
      });
    }
  };
};

// Helper function to determine minimum plan required for a feature
const getMinimumPlanForFeature = (featureName) => {
  const featurePlanMap = {
    'AI Suggestions': 'PRO',
    'Advanced Analytics': 'PRO',
    'Bulk Operations': 'PRO',
    'Priority Support': 'PRO',
    'Custom Integrations': 'ENTERPRISE',
    'Dedicated Manager': 'ENTERPRISE'
  };
  
  return featurePlanMap[featureName] || 'PRO';
};

// Middleware to check API rate limits based on plan
const checkApiRateLimit = () => {
  return async (req, res, next) => {
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
      const monthlyLimit = userPlan?.limits?.apiCallsPerMonth || 1000;

      if (apiCallsThisMonth >= monthlyLimit) {
        return res.status(429).json({
          success: false,
          message: `Monthly API limit exceeded (${monthlyLimit} calls)`,
          usage: {
            current: apiCallsThisMonth,
            limit: monthlyLimit
          },
          subscriptionInfo: req.user.getSubscriptionInfo()
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
        error: error.message
      });
    }
  };
};

// Middleware to enforce sync frequency limits
const checkSyncFrequency = () => {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.isSuperAdmin()) {
        return next();
      }

      const userPlan = await req.user.getCurrentPlan();
      const minSyncInterval = userPlan?.limits?.maxSyncFrequency || 24; // hours

      // Check last sync time for this connection
      const connectionId = req.params.connectionId;
      if (connectionId) {
        const StoreConnection = require('../models/StoreConnection');
        const connection = await StoreConnection.findOne({
          _id: connectionId,
          userId: req.user._id
        });

        if (connection && connection.lastSyncAt) {
          const timeSinceLastSync = (Date.now() - connection.lastSyncAt.getTime()) / (1000 * 60 * 60); // hours
          
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
        error: error.message
      });
    }
  };
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = { 
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