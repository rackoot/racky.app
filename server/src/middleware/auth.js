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
  generateToken 
};