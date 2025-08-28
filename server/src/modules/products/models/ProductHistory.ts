import mongoose, { Document, Schema, Types } from 'mongoose';

// Types for different action categories
export type ActionType = 
  // Sync operations
  | 'SYNC_FROM_MARKETPLACE'
  | 'SYNC_TO_MARKETPLACE'
  | 'BULK_SYNC'
  
  // AI optimization actions
  | 'AI_OPTIMIZATION_GENERATED'
  | 'AI_OPTIMIZATION_ACCEPTED'
  | 'AI_OPTIMIZATION_REJECTED'
  | 'AI_OPTIMIZATION_APPLIED'
  | 'AI_BULK_SCAN_STARTED'
  | 'AI_BULK_SCAN_COMPLETED'
  
  // Product modifications
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'DESCRIPTION_UPDATED'
  | 'PRICE_UPDATED'
  | 'INVENTORY_UPDATED'
  | 'STATUS_CHANGED'
  
  // Store operations
  | 'MARKETPLACE_CONNECTED'
  | 'MARKETPLACE_DISCONNECTED'
  | 'STORE_CONFIGURATION_CHANGED'
  
  // Error tracking
  | 'SYNC_FAILED'
  | 'API_ERROR'
  | 'VALIDATION_ERROR';

export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type ActionSource = 'USER' | 'SYSTEM' | 'AI_SERVICE' | 'MARKETPLACE_API' | 'BULK_OPERATION';

// Interface for action metadata - flexible structure for different action types
export interface ActionMetadata {
  // Common fields
  marketplace?: string;
  platform?: string;
  jobId?: string;
  batchId?: string;
  
  // Sync-related metadata
  syncDirection?: 'FROM_MARKETPLACE' | 'TO_MARKETPLACE';
  recordsProcessed?: number;
  recordsTotal?: number;
  
  // AI optimization metadata
  aiModel?: string;
  confidence?: number;
  tokensUsed?: number;
  originalContent?: string;
  newContent?: string;
  keywords?: string[];
  
  // Product change metadata
  oldValue?: any;
  newValue?: any;
  fieldChanged?: string;
  
  // Error metadata
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  
  // API call metadata
  apiEndpoint?: string;
  httpStatus?: number;
  responseTime?: number;
  
  // User context
  ipAddress?: string;
  userAgent?: string;
  
  // Custom metadata (extensible)
  [key: string]: any;
}

// Interface for ProductHistory document
export interface IProductHistory extends Document {
  workspaceId: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  storeConnectionId?: Types.ObjectId;
  
  // Action details
  actionType: ActionType;
  actionStatus: ActionStatus;
  actionSource: ActionSource;
  
  // Descriptive information
  title: string;
  description: string;
  
  // Metadata and context
  metadata: ActionMetadata;
  
  // Timing information
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
  
  // Related entities
  relatedJobId?: string;
  relatedBatchId?: string;
  parentHistoryId?: Types.ObjectId; // For nested operations
  
  // Audit trail
  createdAt: Date;
  updatedAt: Date;
}

const ProductHistorySchema = new Schema<IProductHistory>({
  workspaceId: {
    type: Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  storeConnectionId: {
    type: Schema.Types.ObjectId,
    ref: 'StoreConnection',
    index: true
  },
  
  // Action details
  actionType: {
    type: String,
    enum: [
      // Sync operations
      'SYNC_FROM_MARKETPLACE',
      'SYNC_TO_MARKETPLACE', 
      'BULK_SYNC',
      
      // AI optimization actions
      'AI_OPTIMIZATION_GENERATED',
      'AI_OPTIMIZATION_ACCEPTED',
      'AI_OPTIMIZATION_REJECTED',
      'AI_OPTIMIZATION_APPLIED',
      'AI_BULK_SCAN_STARTED',
      'AI_BULK_SCAN_COMPLETED',
      
      // Product modifications
      'PRODUCT_CREATED',
      'PRODUCT_UPDATED',
      'PRODUCT_DELETED',
      'DESCRIPTION_UPDATED',
      'PRICE_UPDATED',
      'INVENTORY_UPDATED',
      'STATUS_CHANGED',
      
      // Store operations
      'MARKETPLACE_CONNECTED',
      'MARKETPLACE_DISCONNECTED',
      'STORE_CONFIGURATION_CHANGED',
      
      // Error tracking
      'SYNC_FAILED',
      'API_ERROR',
      'VALIDATION_ERROR'
    ],
    required: true,
    index: true
  },
  
  actionStatus: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED'],
    required: true,
    default: 'PENDING',
    index: true
  },
  
  actionSource: {
    type: String,
    enum: ['USER', 'SYSTEM', 'AI_SERVICE', 'MARKETPLACE_API', 'BULK_OPERATION'],
    required: true,
    default: 'USER',
    index: true
  },
  
  // Descriptive information
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // Flexible metadata storage
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  
  // Timing information
  startedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  
  completedAt: {
    type: Date,
    index: true
  },
  
  duration: {
    type: Number, // milliseconds
    min: 0
  },
  
  // Related entities
  relatedJobId: {
    type: String,
    index: true
  },
  
  relatedBatchId: {
    type: String,
    index: true
  },
  
  parentHistoryId: {
    type: Schema.Types.ObjectId,
    ref: 'ProductHistory',
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ProductHistorySchema.index({ workspaceId: 1, productId: 1, createdAt: -1 });
ProductHistorySchema.index({ workspaceId: 1, actionType: 1, createdAt: -1 });
ProductHistorySchema.index({ workspaceId: 1, actionStatus: 1, createdAt: -1 });
ProductHistorySchema.index({ userId: 1, createdAt: -1 });
ProductHistorySchema.index({ relatedJobId: 1 });
ProductHistorySchema.index({ relatedBatchId: 1 });

// Pre-save middleware to calculate duration
ProductHistorySchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  }
  next();
});

// Instance methods
ProductHistorySchema.methods.markCompleted = function(status: ActionStatus = 'SUCCESS') {
  this.actionStatus = status;
  this.completedAt = new Date();
  if (this.startedAt) {
    this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  }
  return this.save();
};

ProductHistorySchema.methods.markFailed = function(errorMessage: string, errorCode?: string) {
  this.actionStatus = 'FAILED';
  this.completedAt = new Date();
  this.metadata.errorMessage = errorMessage;
  if (errorCode) {
    this.metadata.errorCode = errorCode;
  }
  if (this.startedAt) {
    this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  }
  return this.save();
};

// Static methods for common queries
ProductHistorySchema.statics.getProductHistory = function(
  productId: string, 
  workspaceId: string,
  options: { 
    limit?: number; 
    offset?: number; 
    actionType?: ActionType[];
    actionStatus?: ActionStatus[];
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const query: any = { productId, workspaceId };
  
  if (options.actionType?.length) {
    query.actionType = { $in: options.actionType };
  }
  
  if (options.actionStatus?.length) {
    query.actionStatus = { $in: options.actionStatus };
  }
  
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) {
      query.createdAt.$gte = options.startDate;
    }
    if (options.endDate) {
      query.createdAt.$lte = options.endDate;
    }
  }
  
  return this.find(query)
    .populate('userId', 'firstName lastName email')
    .populate('storeConnectionId', 'storeName')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

ProductHistorySchema.statics.getWorkspaceActivity = function(
  workspaceId: string,
  options: { 
    limit?: number; 
    offset?: number; 
    actionType?: ActionType[];
    startDate?: Date;
    endDate?: Date;
  } = {}
) {
  const query: any = { workspaceId };
  
  if (options.actionType?.length) {
    query.actionType = { $in: options.actionType };
  }
  
  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) {
      query.createdAt.$gte = options.startDate;
    }
    if (options.endDate) {
      query.createdAt.$lte = options.endDate;
    }
  }
  
  return this.find(query)
    .populate('userId', 'firstName lastName email')
    .populate('productId', 'title marketplace')
    .populate('storeConnectionId', 'storeName')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .skip(options.offset || 0);
};

export default mongoose.model<IProductHistory>('ProductHistory', ProductHistorySchema);