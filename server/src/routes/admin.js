const express = require('express');
const Joi = require('joi');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Usage = require('../models/Usage');
const StoreConnection = require('../models/StoreConnection');
const Product = require('../models/Product');
const { protect, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and admin requirement to all routes
router.use(protect);
router.use(requireSuperAdmin);

// Validation schemas
const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});

const updateUserSubscriptionSchema = Joi.object({
  subscriptionStatus: Joi.string().valid('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED').required(),
  subscriptionPlan: Joi.string().valid('BASIC', 'PRO', 'ENTERPRISE').optional(),
  trialEndsAt: Joi.date().optional(),
  subscriptionEndsAt: Joi.date().optional()
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('USER', 'SUPERADMIN').required()
});

// GET /api/admin/users - List all users with pagination and filtering
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      subscriptionStatus = '',
      subscriptionPlan = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.role = role;
    }
    
    if (subscriptionStatus) {
      filter.subscriptionStatus = subscriptionStatus;
    }
    
    if (subscriptionPlan) {
      filter.subscriptionPlan = subscriptionPlan;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users with pagination
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Get user stats
    const userStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          trialUsers: { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'TRIAL'] }, 1, 0] } },
          activeSubscriptions: { $sum: { $cond: [{ $eq: ['$subscriptionStatus', 'ACTIVE'] }, 1, 0] } },
          superAdmins: { $sum: { $cond: [{ $eq: ['$role', 'SUPERADMIN'] }, 1, 0] } }
        }
      }
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    // Enhance user data with additional info
    const enhancedUsers = await Promise.all(
      users.map(async (user) => {
        const [storeCount, productCount, usage] = await Promise.all([
          StoreConnection.countDocuments({ userId: user._id, isActive: true }),
          Product.countDocuments({ userId: user._id }),
          Usage.getCurrentMonthUsage(user._id)
        ]);

        return {
          ...user.toObject(),
          stats: {
            storeCount,
            productCount,
            currentUsage: usage?.getCurrentUsage() || {}
          },
          subscriptionInfo: user.getSubscriptionInfo()
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        stats: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          trialUsers: 0,
          activeSubscriptions: 0,
          superAdmins: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// GET /api/admin/users/:id - Get specific user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get detailed user information
    const [storeConnections, products, usageHistory, subscription] = await Promise.all([
      StoreConnection.find({ userId: id }).sort({ createdAt: -1 }),
      Product.find({ userId: id }).limit(10).sort({ createdAt: -1 }),
      Usage.getUserUsageHistory(id, 6),
      Subscription.findOne({ userId: id }).sort({ createdAt: -1 })
    ]);

    const userDetails = {
      ...user.toObject(),
      storeConnections,
      recentProducts: products,
      usageHistory,
      subscription,
      subscriptionInfo: user.getSubscriptionInfo()
    };

    res.json({
      success: true,
      data: userDetails
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:id/status - Activate/deactivate user account
router.put('/users/:id/status', async (req, res) => {
  try {
    const { error } = updateUserStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deactivating the last super admin
    if (!isActive && user.role === 'SUPERADMIN') {
      const superAdminCount = await User.countDocuments({ role: 'SUPERADMIN', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last super admin'
        });
      }
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        userId: user._id,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { error } = updateUserRoleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent removing the last super admin
    if (user.role === 'SUPERADMIN' && role === 'USER') {
      const superAdminCount = await User.countDocuments({ role: 'SUPERADMIN', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last super admin'
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role} successfully`,
      data: {
        userId: user._id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:id/subscription - Update user subscription
router.put('/users/:id/subscription', async (req, res) => {
  try {
    const { error } = updateUserSubscriptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { id } = req.params;
    const { subscriptionStatus, subscriptionPlan, trialEndsAt, subscriptionEndsAt } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update subscription fields
    user.subscriptionStatus = subscriptionStatus;
    
    if (subscriptionPlan) {
      user.subscriptionPlan = subscriptionPlan;
    }
    
    if (trialEndsAt) {
      user.trialEndsAt = new Date(trialEndsAt);
    }
    
    if (subscriptionEndsAt) {
      user.subscriptionEndsAt = new Date(subscriptionEndsAt);
    }

    await user.save();

    res.json({
      success: true,
      message: 'User subscription updated successfully',
      data: {
        userId: user._id,
        email: user.email,
        subscriptionInfo: user.getSubscriptionInfo()
      }
    });
  } catch (error) {
    console.error('Error updating user subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user subscription',
      error: error.message
    });
  }
});

// DELETE /api/admin/users/:id - Delete user account (with cascading)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting the last super admin
    if (user.role === 'SUPERADMIN') {
      const superAdminCount = await User.countDocuments({ role: 'SUPERADMIN' });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last super admin'
        });
      }
    }

    // Check if user has data and require force flag
    if (!force) {
      const [storeCount, productCount] = await Promise.all([
        StoreConnection.countDocuments({ userId: id }),
        Product.countDocuments({ userId: id })
      ]);

      if (storeCount > 0 || productCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'User has associated data. Use force=true to delete all user data.',
          data: {
            storeCount,
            productCount
          }
        });
      }
    }

    // Delete user and all associated data
    const deletionResults = await Promise.allSettled([
      StoreConnection.deleteMany({ userId: id }),
      Product.deleteMany({ userId: id }),
      Usage.deleteMany({ userId: id }),
      Subscription.deleteMany({ userId: id }),
      User.deleteOne({ _id: id })
    ]);

    // Count successful deletions
    const deletedCounts = {
      storeConnections: deletionResults[0].status === 'fulfilled' ? deletionResults[0].value.deletedCount : 0,
      products: deletionResults[1].status === 'fulfilled' ? deletionResults[1].value.deletedCount : 0,
      usage: deletionResults[2].status === 'fulfilled' ? deletionResults[2].value.deletedCount : 0,
      subscriptions: deletionResults[3].status === 'fulfilled' ? deletionResults[3].value.deletedCount : 0,
      user: deletionResults[4].status === 'fulfilled' ? 1 : 0
    };

    res.json({
      success: true,
      message: 'User and all associated data deleted successfully',
      data: {
        userId: id,
        email: user.email,
        deletedCounts
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// GET /api/admin/subscriptions - List all subscriptions with filtering
router.get('/subscriptions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      plan = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    const filter = {};
    
    // Join with User collection for search functionality
    const pipeline = [
      // Join with users collection
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      }
    ];

    // Add match stages for filtering
    const matchStages = [];
    
    if (search) {
      matchStages.push({
        $or: [
          { 'user.email': { $regex: search, $options: 'i' } },
          { 'user.firstName': { $regex: search, $options: 'i' } },
          { 'user.lastName': { $regex: search, $options: 'i' } }
        ]
      });
    }
    
    if (status) {
      matchStages.push({ 'user.subscriptionStatus': status });
    }
    
    if (plan) {
      matchStages.push({ 'user.subscriptionPlan': plan });
    }

    if (matchStages.length > 0) {
      pipeline.push({
        $match: {
          $and: matchStages
        }
      });
    }

    // Add sorting
    const sortStage = {};
    if (sortBy === 'email') {
      sortStage['user.email'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'status') {
      sortStage['user.subscriptionStatus'] = sortOrder === 'desc' ? -1 : 1;
    } else if (sortBy === 'plan') {
      sortStage['user.subscriptionPlan'] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }
    
    pipeline.push({ $sort: sortStage });

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Subscription.aggregate(countPipeline);
    const totalCount = totalResult[0]?.total || 0;

    // Add pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Project the final shape
    pipeline.push({
      $project: {
        _id: 1,
        userId: 1,
        planName: 1,
        status: 1,
        startDate: 1,
        endDate: 1,
        trialEndDate: 1,
        amount: 1,
        currency: 1,
        paymentMethod: 1,
        createdAt: 1,
        updatedAt: 1,
        user: {
          _id: '$user._id',
          email: '$user.email',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          subscriptionStatus: '$user.subscriptionStatus',
          subscriptionPlan: '$user.subscriptionPlan',
          trialEndsAt: '$user.trialEndsAt',
          subscriptionEndsAt: '$user.subscriptionEndsAt',
          isActive: '$user.isActive'
        }
      }
    });

    // Execute the aggregation
    const subscriptions = await Subscription.aggregate(pipeline);

    // Get subscription statistics from actual Subscription records
    const stats = await Subscription.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: { $sum: { $cond: [{ $eq: ['$user.subscriptionStatus', 'ACTIVE'] }, 1, 0] } },
          trialSubscriptions: { $sum: { $cond: [{ $eq: ['$user.subscriptionStatus', 'TRIAL'] }, 1, 0] } },
          suspendedSubscriptions: { $sum: { $cond: [{ $eq: ['$user.subscriptionStatus', 'SUSPENDED'] }, 1, 0] } },
          cancelledSubscriptions: { $sum: { $cond: [{ $eq: ['$user.subscriptionStatus', 'CANCELLED'] }, 1, 0] } },
          basicPlan: { $sum: { $cond: [{ $eq: ['$user.subscriptionPlan', 'BASIC'] }, 1, 0] } },
          proPlan: { $sum: { $cond: [{ $eq: ['$user.subscriptionPlan', 'PRO'] }, 1, 0] } },
          enterprisePlan: { $sum: { $cond: [{ $eq: ['$user.subscriptionPlan', 'ENTERPRISE'] }, 1, 0] } }
        }
      }
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        stats: stats[0] || {
          totalSubscriptions: 0,
          activeSubscriptions: 0,
          trialSubscriptions: 0,
          suspendedSubscriptions: 0,
          cancelledSubscriptions: 0,
          basicPlan: 0,
          proPlan: 0,
          enterprisePlan: 0
        }
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
});

// GET /api/admin/analytics - Platform usage analytics
router.get('/analytics', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get analytics data
    const [
      totalUsage,
      userGrowth,
      subscriptionBreakdown,
      revenueData,
      totalProducts,
      totalStoreConnections
    ] = await Promise.all([
      // Total platform usage
      Usage.getTotalUsageByPeriod(startDate, now),
      
      // User growth over time
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            newUsers: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),

      // Subscription status breakdown
      User.aggregate([
        {
          $group: {
            _id: '$subscriptionStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      // Revenue data - get actual subscription plan distribution
      User.aggregate([
        {
          $match: {
            subscriptionStatus: 'ACTIVE'
          }
        },
        {
          $group: {
            _id: '$subscriptionPlan',
            count: { $sum: 1 }
          }
        }
      ]),

      // Total products count
      Product.countDocuments(),

      // Total store connections count
      StoreConnection.countDocuments({ isActive: true })
    ]);

    const analytics = {
      period,
      totalUsage: {
        // Use real data when available, fallback to 0
        totalApiCalls: totalUsage[0]?.totalApiCalls || 0,
        totalProductsSync: totalUsage[0]?.totalProductsSync || 0,
        totalStorageUsed: totalUsage[0]?.totalStorageUsed || 0,
        totalUsers: totalUsage[0]?.totalUsers || 0,
        // Add real product and store counts
        totalProducts: totalProducts,
        totalStoreConnections: totalStoreConnections
      },
      userGrowth,
      subscriptionBreakdown,
      revenueData,
      generatedAt: new Date()
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;