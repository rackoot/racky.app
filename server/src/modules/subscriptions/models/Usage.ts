import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUsage extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Keep for backward compatibility during migration
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
  incrementWorkspaceUsage(workspaceId: string, metric: string, amount?: number): Promise<IUsage>;
  getCurrentMonthUsage(workspaceId: string): Promise<IUsage | null>;
  getWorkspaceUsageHistory(workspaceId: string, months?: number): Promise<IUsage[]>;
  getTotalUsageByPeriod(period: string): Promise<any[]>;
  resetMonthlyUsage(workspaceId: string): Promise<IUsage>;
  // Legacy methods for backward compatibility during migration
  incrementUserUsage(userId: string, metric: string, amount?: number): Promise<IUsage>;
  getUserUsageHistory(userId: string, months?: number): Promise<IUsage[]>;
}

const usageSchema = new Schema<IUsage>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Will be removed after migration
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

// Static method to increment workspace usage (new primary method)
usageSchema.statics.incrementWorkspaceUsage = async function(workspaceId: string, metric: string, amount: number = 1): Promise<IUsage> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Find or create usage record for current month
  const filter = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    billingPeriodStart: startOfMonth
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

  // Create setOnInsert object without the field being incremented to avoid conflict
  const setOnInsert: any = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
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
  };

  // Remove the field being incremented from setOnInsert to avoid conflict
  delete setOnInsert[schemaField];

  const update: any = {
    $inc: { [schemaField]: amount },
    $setOnInsert: setOnInsert
  };

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

// Legacy method for backward compatibility - now delegates to workspace method
usageSchema.statics.incrementUserUsage = async function(userId: string, metric: string, amount: number = 1): Promise<IUsage> {
  // For legacy support, we need to find the user's workspace
  // In practice, this should be replaced with direct workspace calls
  console.warn('incrementUserUsage is deprecated. Use incrementWorkspaceUsage instead.');

  // Try to find a workspace for this user - this is a temporary bridge during migration
  const User = mongoose.model('User');
  const Workspace = mongoose.model('Workspace');
  const WorkspaceUser = mongoose.model('WorkspaceUser');

  const workspaceUser = await WorkspaceUser.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true
  }).populate('workspaceId');

  if (!workspaceUser || !workspaceUser.workspaceId) {
    throw new Error(`No active workspace found for user ${userId}`);
  }

  return await (this as any).incrementWorkspaceUsage(workspaceUser.workspaceId._id.toString(), metric, amount);
};

// Get current month usage for a workspace (new primary method)
usageSchema.statics.getCurrentMonthUsage = async function(workspaceIdOrUserId: string): Promise<IUsage | null> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  // Try to find by workspaceId first (new approach)
  let result = await this.findOne({
    workspaceId: new mongoose.Types.ObjectId(workspaceIdOrUserId),
    billingPeriodStart: startOfMonth
  });

  // If not found and this might be a userId (legacy), try that
  if (!result) {
    result = await this.findOne({
      userId: new mongoose.Types.ObjectId(workspaceIdOrUserId),
      billingPeriodStart: startOfMonth
    });
  }

  return result;
};

// Get workspace usage history (new primary method)
usageSchema.statics.getWorkspaceUsageHistory = async function(workspaceId: string, months: number = 12): Promise<IUsage[]> {
  const currentDate = new Date();
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - months, 1);

  return await this.find({
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    billingPeriodStart: { $gte: startDate }
  }).sort({ billingPeriodStart: -1 });
};

// Get user usage history (legacy method)
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
usageSchema.statics.resetMonthlyUsage = async function(workspaceIdOrUserId: string): Promise<IUsage> {
  const currentDate = new Date();
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  // Try workspace-based approach first
  let result = await this.findOneAndUpdate(
    {
      workspaceId: new mongoose.Types.ObjectId(workspaceIdOrUserId),
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

  // If not found, try legacy userId approach
  if (!result) {
    result = await this.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(workspaceIdOrUserId),
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
  }

  return result;
};

// Indexes for performance
// Update indexes for workspace-based access
usageSchema.index({ workspaceId: 1, billingPeriodStart: 1 }, { unique: true });
// Keep old index for backward compatibility during migration
usageSchema.index({ userId: 1, billingPeriodStart: 1 });
usageSchema.index({ billingPeriodStart: 1 });
usageSchema.index({ createdAt: 1 });

const Usage: IUsageModel = mongoose.model<IUsage, IUsageModel>('Usage', usageSchema);

export default Usage;