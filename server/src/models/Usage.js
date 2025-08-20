const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Time period this usage record covers
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true, // 1-12
    min: 1,
    max: 12
  },
  // Usage metrics
  apiCalls: {
    type: Number,
    default: 0
  },
  productsSync: {
    type: Number,
    default: 0
  },
  storesConnected: {
    type: Number,
    default: 0
  },
  storageUsed: {
    type: Number,
    default: 0 // In MB
  },
  // Feature usage
  features: {
    aiSuggestions: {
      type: Number,
      default: 0
    },
    opportunityScans: {
      type: Number,
      default: 0
    },
    bulkOperations: {
      type: Number,
      default: 0
    }
  },
  // Billing period tracking
  billingPeriodStart: {
    type: Date,
    required: true
  },
  billingPeriodEnd: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Methods
usageSchema.methods.getCurrentUsage = function() {
  return {
    apiCalls: this.apiCalls,
    productsSync: this.productsSync,
    storesConnected: this.storesConnected,
    storageUsed: this.storageUsed,
    features: this.features
  };
};

usageSchema.methods.incrementUsage = function(metric, amount = 1) {
  if (this[metric] !== undefined) {
    this[metric] += amount;
  } else if (this.features[metric] !== undefined) {
    this.features[metric] += amount;
  }
  return this.save();
};

// Statics
usageSchema.statics.getCurrentMonthUsage = function(userId) {
  const now = new Date();
  return this.findOne({
    userId,
    year: now.getFullYear(),
    month: now.getMonth() + 1
  });
};

usageSchema.statics.createCurrentMonthUsage = function(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // Calculate billing period (typically month start to month end)
  const billingPeriodStart = new Date(year, month - 1, 1);
  const billingPeriodEnd = new Date(year, month, 0, 23, 59, 59);
  
  return this.create({
    userId,
    year,
    month,
    billingPeriodStart,
    billingPeriodEnd
  });
};

usageSchema.statics.getOrCreateCurrentUsage = async function(userId) {
  let usage = await this.getCurrentMonthUsage(userId);
  if (!usage) {
    usage = await this.createCurrentMonthUsage(userId);
  }
  return usage;
};

usageSchema.statics.getUserUsageHistory = function(userId, limit = 12) {
  return this.find({ userId })
    .sort({ year: -1, month: -1 })
    .limit(limit);
};

usageSchema.statics.incrementUserUsage = async function(userId, metric, amount = 1) {
  const usage = await this.getOrCreateCurrentUsage(userId);
  return usage.incrementUsage(metric, amount);
};

// Usage aggregation methods
usageSchema.statics.getTotalUsageByPeriod = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        billingPeriodStart: { $gte: startDate },
        billingPeriodEnd: { $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalApiCalls: { $sum: '$apiCalls' },
        totalProductsSync: { $sum: '$productsSync' },
        totalStorageUsed: { $sum: '$storageUsed' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        totalUsers: { $size: '$uniqueUsers' }
      }
    }
  ]);
};

// Indexes for efficient querying
usageSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });
usageSchema.index({ billingPeriodStart: 1, billingPeriodEnd: 1 });
usageSchema.index({ year: -1, month: -1 });

module.exports = mongoose.model('Usage', usageSchema);