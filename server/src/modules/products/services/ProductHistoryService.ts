import { Types } from 'mongoose';
import ProductHistory, { 
  IProductHistory, 
  ActionType, 
  ActionStatus, 
  ActionSource, 
  ActionMetadata 
} from '../models/ProductHistory';

export interface CreateHistoryParams {
  workspaceId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  productId: string | Types.ObjectId;
  storeConnectionId?: string | Types.ObjectId;
  actionType: ActionType;
  actionSource: ActionSource;
  title: string;
  description: string;
  metadata?: ActionMetadata;
  relatedJobId?: string;
  relatedBatchId?: string;
  parentHistoryId?: string | Types.ObjectId;
}

export interface UpdateHistoryParams {
  actionStatus?: ActionStatus;
  metadata?: Partial<ActionMetadata>;
  completedAt?: Date;
}

export class ProductHistoryService {
  static async createHistory(params: CreateHistoryParams): Promise<IProductHistory> {
    const history = new ProductHistory({
      workspaceId: new Types.ObjectId(params.workspaceId),
      userId: new Types.ObjectId(params.userId),
      productId: new Types.ObjectId(params.productId),
      storeConnectionId: params.storeConnectionId ? new Types.ObjectId(params.storeConnectionId) : undefined,
      actionType: params.actionType,
      actionSource: params.actionSource,
      title: params.title,
      description: params.description,
      metadata: params.metadata || {},
      relatedJobId: params.relatedJobId,
      relatedBatchId: params.relatedBatchId,
      parentHistoryId: params.parentHistoryId ? new Types.ObjectId(params.parentHistoryId) : undefined,
      startedAt: new Date(),
      actionStatus: 'PENDING'
    });

    return await history.save();
  }

  static async updateHistory(
    historyId: string | Types.ObjectId, 
    updates: UpdateHistoryParams
  ): Promise<IProductHistory | null> {
    const updateData: any = { ...updates };
    
    if (updates.actionStatus && updates.actionStatus !== 'PENDING' && updates.actionStatus !== 'IN_PROGRESS') {
      updateData.completedAt = updates.completedAt || new Date();
    }

    return await ProductHistory.findByIdAndUpdate(
      historyId,
      { $set: updateData },
      { new: true }
    );
  }

  static async markCompleted(
    historyId: string | Types.ObjectId,
    status: ActionStatus = 'SUCCESS',
    metadata?: Partial<ActionMetadata>
  ): Promise<IProductHistory | null> {
    const history = await ProductHistory.findById(historyId);
    if (!history) return null;

    if (metadata) {
      history.metadata = { ...history.metadata, ...metadata };
    }

    // Update status and completion fields
    history.actionStatus = status;
    history.completedAt = new Date();
    if (history.startedAt) {
      history.duration = history.completedAt.getTime() - history.startedAt.getTime();
    }
    
    return await history.save();
  }

  static async markFailed(
    historyId: string | Types.ObjectId,
    errorMessage: string,
    errorCode?: string,
    metadata?: Partial<ActionMetadata>
  ): Promise<IProductHistory | null> {
    const history = await ProductHistory.findById(historyId);
    if (!history) return null;

    if (metadata) {
      history.metadata = { ...history.metadata, ...metadata };
    }

    // Update status and completion fields
    history.actionStatus = 'FAILED';
    history.completedAt = new Date();
    history.metadata.errorMessage = errorMessage;
    if (errorCode) {
      history.metadata.errorCode = errorCode;
    }
    if (history.startedAt) {
      history.duration = history.completedAt.getTime() - history.startedAt.getTime();
    }
    
    return await history.save();
  }

  static async getProductHistory(
    productId: string | Types.ObjectId,
    workspaceId: string | Types.ObjectId,
    options: {
      limit?: number;
      offset?: number;
      actionType?: ActionType[];
      actionStatus?: ActionStatus[];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<IProductHistory[]> {
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
    
    return await ProductHistory.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('storeConnectionId', 'storeName')
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.offset || 0);
  }

  // AI scan limit checking
  static async checkProductScanLimit(
    productId: string | Types.ObjectId,
    workspaceId: string | Types.ObjectId,
    hoursWindow: number = 24,
    maxScans: number = 2
  ): Promise<{ canScan: boolean; scansInWindow: number; nextAvailableAt?: Date }> {
    const windowStart = new Date(Date.now() - (hoursWindow * 60 * 60 * 1000));
    
    // Count successful AI optimization scans in the time window
    const scansInWindow = await ProductHistory.countDocuments({
      productId: new Types.ObjectId(productId),
      workspaceId: new Types.ObjectId(workspaceId),
      actionType: 'AI_OPTIMIZATION_GENERATED',
      actionStatus: 'SUCCESS',
      createdAt: { $gte: windowStart }
    });
    
    const canScan = scansInWindow < maxScans;
    
    // If at limit, find when the oldest scan in window expires
    let nextAvailableAt: Date | undefined;
    if (!canScan) {
      const oldestScan = await ProductHistory.findOne({
        productId: new Types.ObjectId(productId),
        workspaceId: new Types.ObjectId(workspaceId),
        actionType: 'AI_OPTIMIZATION_GENERATED',
        actionStatus: 'SUCCESS',
        createdAt: { $gte: windowStart }
      })
      .sort({ createdAt: 1 })
      .select('createdAt');
      
      if (oldestScan) {
        nextAvailableAt = new Date(oldestScan.createdAt.getTime() + (hoursWindow * 60 * 60 * 1000));
      }
    }
    
    return {
      canScan,
      scansInWindow,
      nextAvailableAt
    };
  }

  static async getProductsWithinScanLimit(
    productIds: (string | Types.ObjectId)[],
    workspaceId: string | Types.ObjectId,
    hoursWindow: number = 24,
    maxScans: number = 2
  ): Promise<{
    availableProducts: string[];
    blockedProducts: Array<{
      productId: string;
      scansInWindow: number;
      nextAvailableAt?: Date;
    }>;
  }> {
    const availableProducts: string[] = [];
    const blockedProducts: Array<{
      productId: string;
      scansInWindow: number;
      nextAvailableAt?: Date;
    }> = [];
    
    // Check each product's scan limit
    for (const productId of productIds) {
      const limitCheck = await this.checkProductScanLimit(
        productId,
        workspaceId,
        hoursWindow,
        maxScans
      );
      
      if (limitCheck.canScan) {
        availableProducts.push(productId.toString());
      } else {
        blockedProducts.push({
          productId: productId.toString(),
          scansInWindow: limitCheck.scansInWindow,
          nextAvailableAt: limitCheck.nextAvailableAt
        });
      }
    }
    
    return {
      availableProducts,
      blockedProducts
    };
  }

  // AI Optimization specific helpers
  static async createAIOptimizationHistory(params: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    productId: string | Types.ObjectId;
    actionType: 'AI_OPTIMIZATION_GENERATED' | 'AI_OPTIMIZATION_ACCEPTED' | 'AI_OPTIMIZATION_REJECTED' | 'AI_OPTIMIZATION_APPLIED';
    marketplace: string;
    aiModel?: string;
    confidence?: number;
    originalContent?: string;
    newContent?: string;
    jobId?: string;
  }): Promise<IProductHistory> {
    const actionTitles = {
      'AI_OPTIMIZATION_GENERATED': 'AI Description Generated',
      'AI_OPTIMIZATION_ACCEPTED': 'AI Description Accepted',
      'AI_OPTIMIZATION_REJECTED': 'AI Description Rejected',
      'AI_OPTIMIZATION_APPLIED': 'AI Description Applied'
    };

    const actionDescriptions = {
      'AI_OPTIMIZATION_GENERATED': `AI-generated optimized description for ${params.marketplace}`,
      'AI_OPTIMIZATION_ACCEPTED': `User accepted AI-generated description for ${params.marketplace}`,
      'AI_OPTIMIZATION_REJECTED': `User rejected AI-generated description for ${params.marketplace}`,
      'AI_OPTIMIZATION_APPLIED': `AI-optimized description applied to ${params.marketplace}`
    };

    return await this.createHistory({
      workspaceId: params.workspaceId,
      userId: params.userId,
      productId: params.productId,
      actionType: params.actionType,
      actionSource: 'AI_SERVICE',
      title: actionTitles[params.actionType],
      description: actionDescriptions[params.actionType],
      metadata: {
        marketplace: params.marketplace,
        aiModel: params.aiModel,
        confidence: params.confidence,
        originalContent: params.originalContent,
        newContent: params.newContent
      },
      relatedJobId: params.jobId
    });
  }

  // Product sync specific helpers
  static async createSyncHistory(params: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    productId: string | Types.ObjectId;
    storeConnectionId: string | Types.ObjectId;
    actionType: 'SYNC_FROM_MARKETPLACE' | 'SYNC_TO_MARKETPLACE';
    marketplace: string;
    syncDirection: 'FROM_MARKETPLACE' | 'TO_MARKETPLACE';
    jobId?: string;
    batchId?: string;
  }): Promise<IProductHistory> {
    const title = params.actionType === 'SYNC_FROM_MARKETPLACE' 
      ? `Synced from ${params.marketplace}`
      : `Synced to ${params.marketplace}`;
    
    const description = params.actionType === 'SYNC_FROM_MARKETPLACE'
      ? `Product data synchronized from ${params.marketplace}`
      : `Product data synchronized to ${params.marketplace}`;

    return await this.createHistory({
      workspaceId: params.workspaceId,
      userId: params.userId,
      productId: params.productId,
      storeConnectionId: params.storeConnectionId,
      actionType: params.actionType,
      actionSource: 'MARKETPLACE_API',
      title,
      description,
      metadata: {
        marketplace: params.marketplace,
        syncDirection: params.syncDirection
      },
      relatedJobId: params.jobId,
      relatedBatchId: params.batchId
    });
  }

  // Product modification helpers
  static async createProductUpdateHistory(params: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    productId: string | Types.ObjectId;
    actionType: 'PRODUCT_UPDATED' | 'DESCRIPTION_UPDATED' | 'PRICE_UPDATED' | 'INVENTORY_UPDATED' | 'STATUS_CHANGED';
    fieldChanged: string;
    oldValue: any;
    newValue: any;
    marketplace?: string;
  }): Promise<IProductHistory> {
    const actionTitles = {
      'PRODUCT_UPDATED': 'Product Updated',
      'DESCRIPTION_UPDATED': 'Description Updated',
      'PRICE_UPDATED': 'Price Updated',
      'INVENTORY_UPDATED': 'Inventory Updated',
      'STATUS_CHANGED': 'Status Changed'
    };

    const description = params.marketplace 
      ? `${params.fieldChanged} updated for ${params.marketplace}`
      : `${params.fieldChanged} updated`;

    return await this.createHistory({
      workspaceId: params.workspaceId,
      userId: params.userId,
      productId: params.productId,
      actionType: params.actionType,
      actionSource: 'USER',
      title: actionTitles[params.actionType],
      description,
      metadata: {
        fieldChanged: params.fieldChanged,
        oldValue: params.oldValue,
        newValue: params.newValue,
        marketplace: params.marketplace
      }
    });
  }

  // Error tracking helpers
  static async createErrorHistory(params: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    productId: string | Types.ObjectId;
    storeConnectionId?: string | Types.ObjectId;
    actionType: 'SYNC_FAILED' | 'API_ERROR' | 'VALIDATION_ERROR';
    errorMessage: string;
    errorCode?: string;
    marketplace?: string;
    apiEndpoint?: string;
    httpStatus?: number;
    stackTrace?: string;
  }): Promise<IProductHistory> {
    const actionTitles = {
      'SYNC_FAILED': 'Sync Failed',
      'API_ERROR': 'API Error',
      'VALIDATION_ERROR': 'Validation Error'
    };

    const description = params.marketplace
      ? `${actionTitles[params.actionType]} for ${params.marketplace}: ${params.errorMessage}`
      : `${actionTitles[params.actionType]}: ${params.errorMessage}`;

    return await this.createHistory({
      workspaceId: params.workspaceId,
      userId: params.userId,
      productId: params.productId,
      storeConnectionId: params.storeConnectionId,
      actionType: params.actionType,
      actionSource: 'SYSTEM',
      title: actionTitles[params.actionType],
      description,
      metadata: {
        errorMessage: params.errorMessage,
        errorCode: params.errorCode,
        marketplace: params.marketplace,
        apiEndpoint: params.apiEndpoint,
        httpStatus: params.httpStatus,
        stackTrace: params.stackTrace
      }
    });
  }

  // Bulk operation helpers
  static async createBulkOperationHistory(params: {
    workspaceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    productId: string | Types.ObjectId;
    actionType: 'BULK_SYNC' | 'AI_BULK_SCAN_STARTED' | 'AI_BULK_SCAN_COMPLETED';
    batchId: string;
    recordsTotal?: number;
    recordsProcessed?: number;
    parentHistoryId?: string | Types.ObjectId;
  }): Promise<IProductHistory> {
    const actionTitles = {
      'BULK_SYNC': 'Bulk Sync',
      'AI_BULK_SCAN_STARTED': 'AI Bulk Scan Started',
      'AI_BULK_SCAN_COMPLETED': 'AI Bulk Scan Completed'
    };

    const description = params.recordsTotal 
      ? `${actionTitles[params.actionType]} - Processing ${params.recordsProcessed || 0}/${params.recordsTotal} products`
      : actionTitles[params.actionType];

    return await this.createHistory({
      workspaceId: params.workspaceId,
      userId: params.userId,
      productId: params.productId,
      actionType: params.actionType,
      actionSource: 'BULK_OPERATION',
      title: actionTitles[params.actionType],
      description,
      metadata: {
        recordsTotal: params.recordsTotal,
        recordsProcessed: params.recordsProcessed
      },
      relatedBatchId: params.batchId,
      parentHistoryId: params.parentHistoryId
    });
  }
}

export default ProductHistoryService;