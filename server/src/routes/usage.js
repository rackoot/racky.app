const express = require('express');
const { protect, checkSubscriptionStatus, trackUsage } = require('../middleware/auth');
const Usage = require('../models/Usage');
const User = require('../models/User');
const StoreConnection = require('../models/StoreConnection');
const Product = require('../models/Product');

const router = express.Router();

router.use(protect);

// GET /api/usage/current - Get current usage statistics
router.get('/current', trackUsage('api_call'), async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Get current month's usage
    const currentUsage = await Usage.findOne({
      userId,
      date: {
        $gte: startOfMonth,
        $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
      }
    });

    // Get actual counts from database
    const [storeCount, productCount] = await Promise.all([
      StoreConnection.countDocuments({ userId, isActive: true }),
      Product.countDocuments({ userId })
    ]);

    // Calculate storage usage (mock calculation)
    const storageUsed = Math.floor(productCount * 0.5); // Estimate 0.5MB per product

    // Get user plan limits
    const userPlan = await req.user.getCurrentPlan();

    const usageData = {
      currentPeriod: {
        apiCalls: currentUsage?.apiCalls || 0,
        productsSync: productCount,
        storesConnected: storeCount,
        storageUsed,
        features: {
          aiSuggestions: currentUsage?.aiSuggestions || 0,
          opportunityScans: currentUsage?.opportunityScans || 0,
          bulkOperations: currentUsage?.bulkOperations || 0
        }
      },
      limits: userPlan ? {
        maxStores: userPlan.limits.maxStores,
        maxProducts: userPlan.limits.maxProducts,
        maxMarketplaces: userPlan.limits.maxMarketplaces,
        apiCallsPerMonth: userPlan.limits.apiCallsPerMonth
      } : {
        maxStores: 1,
        maxProducts: 100,
        maxMarketplaces: 1,
        apiCallsPerMonth: 1000
      }
    };

    res.json({
      success: true,
      data: usageData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage data',
      error: error.message
    });
  }
});

// GET /api/usage/history - Get usage history
router.get('/history', trackUsage('api_call'), async (req, res) => {
  try {
    const userId = req.user._id;
    const days = parseInt(req.query.days) || 30;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usageHistory = await Usage.find({
      userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    // Fill in missing days with zero values
    const filledHistory = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existingUsage = usageHistory.find(u => 
        u.date.toISOString().split('T')[0] === dateStr
      );

      filledHistory.push({
        date: dateStr,
        apiCalls: existingUsage?.apiCalls || 0,
        productsSync: existingUsage?.productsSync || 0,
        storageUsed: existingUsage?.storageUsed || 0,
        features: {
          aiSuggestions: existingUsage?.aiSuggestions || 0,
          opportunityScans: existingUsage?.opportunityScans || 0,
          bulkOperations: existingUsage?.bulkOperations || 0
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: filledHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage history',
      error: error.message
    });
  }
});

// GET /api/usage/trends - Get usage trends and growth
router.get('/trends', trackUsage('api_call'), async (req, res) => {
  try {
    const userId = req.user._id;
    const currentDate = new Date();
    
    // Current month
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    
    // Previous month
    const previousMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    const [currentMonth, previousMonth] = await Promise.all([
      Usage.aggregate([
        {
          $match: {
            userId,
            date: { $gte: currentMonthStart, $lt: currentMonthEnd }
          }
        },
        {
          $group: {
            _id: null,
            apiCalls: { $sum: '$apiCalls' },
            productsSync: { $sum: '$productsSync' },
            storageUsed: { $sum: '$storageUsed' },
            aiSuggestions: { $sum: '$aiSuggestions' },
            opportunityScans: { $sum: '$opportunityScans' },
            bulkOperations: { $sum: '$bulkOperations' }
          }
        }
      ]),
      Usage.aggregate([
        {
          $match: {
            userId,
            date: { $gte: previousMonthStart, $lt: previousMonthEnd }
          }
        },
        {
          $group: {
            _id: null,
            apiCalls: { $sum: '$apiCalls' },
            productsSync: { $sum: '$productsSync' },
            storageUsed: { $sum: '$storageUsed' },
            aiSuggestions: { $sum: '$aiSuggestions' },
            opportunityScans: { $sum: '$opportunityScans' },
            bulkOperations: { $sum: '$bulkOperations' }
          }
        }
      ])
    ]);

    const current = currentMonth[0] || {};
    const previous = previousMonth[0] || {};

    const calculateGrowth = (current, previous) => {
      if (!previous || previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const trends = {
      apiCallsGrowth: calculateGrowth(current.apiCalls || 0, previous.apiCalls || 0),
      productsSyncGrowth: calculateGrowth(current.productsSync || 0, previous.productsSync || 0),
      storageGrowth: calculateGrowth(current.storageUsed || 0, previous.storageUsed || 0),
      featuresGrowth: {
        aiSuggestions: calculateGrowth(current.aiSuggestions || 0, previous.aiSuggestions || 0),
        opportunityScans: calculateGrowth(current.opportunityScans || 0, previous.opportunityScans || 0),
        bulkOperations: calculateGrowth(current.bulkOperations || 0, previous.bulkOperations || 0)
      }
    };

    res.json({
      success: true,
      data: {
        trends,
        currentMonth: current,
        previousMonth: previous
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage trends',
      error: error.message
    });
  }
});

// GET /api/usage/limits - Get current usage vs limits
router.get('/limits', trackUsage('api_call'), async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get current counts
    const [storeCount, productCount] = await Promise.all([
      StoreConnection.countDocuments({ userId, isActive: true }),
      Product.countDocuments({ userId })
    ]);

    // Get current month API usage
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentUsage = await Usage.findOne({
      userId,
      date: {
        $gte: startOfMonth,
        $lt: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)
      }
    });

    // Get user plan
    const userPlan = await req.user.getCurrentPlan();
    const limits = userPlan ? userPlan.limits : {
      maxStores: 1,
      maxProducts: 100,
      maxMarketplaces: 1,
      apiCallsPerMonth: 1000
    };

    const usageLimits = {
      stores: {
        current: storeCount,
        limit: limits.maxStores,
        percentage: Math.round((storeCount / limits.maxStores) * 100),
        remaining: Math.max(0, limits.maxStores - storeCount)
      },
      products: {
        current: productCount,
        limit: limits.maxProducts,
        percentage: Math.round((productCount / limits.maxProducts) * 100),
        remaining: Math.max(0, limits.maxProducts - productCount)
      },
      apiCalls: {
        current: currentUsage?.apiCalls || 0,
        limit: limits.apiCallsPerMonth,
        percentage: Math.round(((currentUsage?.apiCalls || 0) / limits.apiCallsPerMonth) * 100),
        remaining: Math.max(0, limits.apiCallsPerMonth - (currentUsage?.apiCalls || 0))
      }
    };

    res.json({
      success: true,
      data: usageLimits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching usage limits',
      error: error.message
    });
  }
});

// POST /api/usage/track - Manual usage tracking (for testing)
router.post('/track', trackUsage('api_call'), async (req, res) => {
  try {
    const { metric, value = 1 } = req.body;
    
    if (!metric) {
      return res.status(400).json({
        success: false,
        message: 'Metric is required'
      });
    }

    await Usage.incrementUserUsage(req.user._id, metric, value);

    res.json({
      success: true,
      message: `Successfully tracked ${value} ${metric}(s)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error tracking usage',
      error: error.message
    });
  }
});

module.exports = router;