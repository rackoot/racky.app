import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUsage extends Document {
  userId: mongoose.Types.ObjectId;
  date: Date;
  apiCalls: number;
  productSyncs: number;
  storeConnections: number;
  storageUsed: number;
  aiSuggestions: number;
  opportunityScans: number;
  bulkOperations: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  monthlyLimits: {
    apiCalls: number;
    productSyncs: number;
    storeConnections: number;
    storageGB: number;
  };
  metadata: {
    features: string[];
    plan: string;
    trackingVersion: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IUsageModel extends Model<IUsage> {
  incrementUserUsage(userId: string, metric: string, amount?: number): Promise<IUsage>;
  getCurrentMonthUsage(userId: string): Promise<IUsage | null>;
  getUserUsageHistory(userId: string, months?: number): Promise<IUsage[]>;
  getTotalUsageByPeriod(period: string): Promise<any[]>;
  resetMonthlyUsage(userId: string): Promise<IUsage>;
}

const usageSchema = new Schema<IUsage>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  apiCalls: {
    type: Number,
    default: 0,
    min: 0
  },
  productSyncs: {
    type: Number,
    default: 0,
    min: 0
  },
  storeConnections: {
    type: Number,
    default: 0,
    min: 0
  },
  storageUsed: {
    type: Number,
    default: 0,
    min: 0
  },
  aiSuggestions: {
    type: Number,
    default: 0,
    min: 0
  },
  opportunityScans: {
    type: Number,
    default: 0,
    min: 0
  },
  bulkOperations: {
    type: Number,
    default: 0,
    min: 0
  },
  billingPeriodStart: {
    type: Date,
    required: true
  },
  billingPeriodEnd: {
    type: Date,
    required: true
  },
  monthlyLimits: {
    apiCalls: {
      type: Number,
      default: 1000
    },
    productSyncs: {
      type: Number,
      default: 100
    },
    storeConnections: {
      type: Number,
      default: 1
    },
    storageGB: {
      type: Number,
      default: 1
    }
  },
  metadata: {
    features: [{
      type: String
    }],
    plan: {
      type: String,
      enum: ['BASIC', 'PRO', 'ENTERPRISE'],
      default: 'BASIC'
    },
    trackingVersion: {
      type: String,
      default: '1.0'
    }
  }
}, {
  timestamps: true
});

// Static method to increment user usage
usageSchema.statics.incrementUserUsage = async function(userId: string, metric: string, amount: number = 1): Promise<IUsage> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Find or create usage record for current month
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    billingPeriodStart: startOfMonth
  };

  const update: any = {
    $inc: {},
    $setOnInsert: {
      userId: new mongoose.Types.ObjectId(userId),
      date: currentDate,
      billingPeriodStart: startOfMonth,
      billingPeriodEnd: endOfMonth,
      apiCalls: 0,
      productSyncs: 0,
      storeConnections: 0,
      storageUsed: 0,
      aiSuggestions: 0,
      opportunityScans: 0,
      bulkOperations: 0
    }
  };

  // Map metric names to schema fields
  const metricMap: { [key: string]: string } = {
    'api_call': 'apiCalls',
    'api_calls': 'apiCalls',
    'product_sync': 'productSyncs',
    'product_syncs': 'productSyncs',
    'products_sync': 'productSyncs',
    'store_connection': 'storeConnections',
    'store_connections': 'storeConnections',
    'store_created': 'storeConnections',
    'marketplace_connected': 'storeConnections',
    'storage': 'storageUsed',
    'ai_suggestion': 'aiSuggestions',
    'ai_suggestions': 'aiSuggestions',
    'opportunity_scan': 'opportunityScans',
    'opportunity_scans': 'opportunityScans',
    'bulk_operation': 'bulkOperations',
    'bulk_operations': 'bulkOperations'
  };

  const schemaField = metricMap[metric] || metric;
  if (!schemaField) {
    console.warn(`Unknown metric: ${metric}`);
    return await this.findOne(filter) || await this.create({
      ...filter,
      date: currentDate,
      billingPeriodEnd: endOfMonth,
      apiCalls: 0,
      productSyncs: 0,
      storeConnections: 0,
      storageUsed: 0,
      aiSuggestions: 0,
      opportunityScans: 0,
      bulkOperations: 0
    });
  }

  update.$inc[schemaField] = amount;

  try {
    return await this.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    });
  } catch (error: any) {
    // Handle duplicate key error by trying to find existing record
    if (error.code === 11000) {
      console.warn('Duplicate key error, attempting to update existing record');
      const existing = await this.findOne(filter);
      if (existing) {
        return await this.findByIdAndUpdate(existing._id, { $inc: update.$inc }, { new: true });
      }
    }
    throw error;
  }
};

// Get current month usage for a user
usageSchema.statics.getCurrentMonthUsage = async function(userId: string): Promise<IUsage | null> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  return await this.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    billingPeriodStart: startOfMonth
  });
};

// Get user usage history
usageSchema.statics.getUserUsageHistory = async function(userId: string, months: number = 12): Promise<IUsage[]> {
  const currentDate = new Date();
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - months, 1);
  
  return await this.find({
    userId: new mongoose.Types.ObjectId(userId),
    billingPeriodStart: { $gte: startDate }
  }).sort({ billingPeriodStart: -1 });
};

// Get total usage by period for analytics
usageSchema.statics.getTotalUsageByPeriod = async function(period: string = '30d'): Promise<any[]> {
  const currentDate = new Date();
  let startDate: Date;
  
  switch (period) {
    case '7d':
      startDate = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return await this.aggregate([
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
        totalApiCalls: { $sum: '$apiCalls' },
        totalProductSyncs: { $sum: '$productSyncs' },
        totalUsers: { $addToSet: '$userId' },
        avgStorageUsed: { $avg: '$storageUsed' }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalApiCalls: 1,
        totalProductSyncs: 1,
        uniqueUsers: { $size: '$totalUsers' },
        avgStorageUsed: { $round: ['$avgStorageUsed', 2] }
      }
    },
    {
      $sort: { date: 1 }
    }
  ]);
};

// Reset monthly usage (typically called at billing cycle)
usageSchema.statics.resetMonthlyUsage = async function(userId: string): Promise<IUsage> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  return await this.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(userId),
      billingPeriodStart: startOfMonth
    },
    {
      apiCalls: 0,
      productSyncs: 0,
      storeConnections: 0,
      storageUsed: 0,
      date: currentDate,
      billingPeriodStart: startOfMonth,
      billingPeriodEnd: endOfMonth
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

// Indexes for performance
usageSchema.index({ userId: 1, billingPeriodStart: 1 }, { unique: true });
usageSchema.index({ billingPeriodStart: 1 });
usageSchema.index({ createdAt: 1 });

const Usage: IUsageModel = mongoose.model<IUsage, IUsageModel>('Usage', usageSchema);

export default Usage;