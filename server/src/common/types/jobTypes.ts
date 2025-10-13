export enum JobType {
  MARKETPLACE_SYNC = 'marketplace-sync',
  PRODUCT_BATCH = 'product-batch',
  PRODUCT_INDIVIDUAL = 'product-individual',
  AI_OPTIMIZATION_SCAN = 'ai-optimization-scan',
  AI_DESCRIPTION_BATCH = 'ai-description-batch',
  AI_DESCRIPTION_GENERATION = 'ai-description-generation',
  MARKETPLACE_UPDATE_BATCH = 'marketplace-update-batch',
  MARKETPLACE_UPDATE = 'marketplace-update'
}

export enum JobPriority {
  LOW = 10,
  NORMAL = 0,
  HIGH = -10,
  CRITICAL = -20
}

// Job data interfaces
export interface MarketplaceSyncJobData {
  userId: string;
  workspaceId: string;
  connectionId: string;
  marketplace: string;
  estimatedProducts: number;
  batchSize: number;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface ProductBatchJobData {
  userId: string;
  workspaceId: string;
  connectionId: string;
  marketplace: string;
  productIds: string[];
  parentJobId: string;
  batchNumber: number;
  totalBatches: number;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface ProductIndividualJobData {
  userId: string;
  workspaceId: string;
  productId: string;
  marketplace: string;
  connectionId: string;
  parentJobId: string;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface AIOptimizationJobData {
  userId: string;
  workspaceId: string;
  connectionId?: string;
  marketplace?: string;
  productIds?: string[];
  estimatedProducts?: number;
  batchSize?: number;
  filters?: {
    marketplace?: string;
    minDescriptionLength?: number;
    maxDescriptionLength?: number;
    createdAfter?: Date;
  };
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface AIDescriptionBatchJobData {
  userId: string;
  workspaceId: string;
  productIds: string[];
  marketplace?: string;
  parentJobId: string;
  batchNumber: number;
  totalBatches: number;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface MarketplaceUpdateBatchJobData {
  userId: string;
  workspaceId: string;
  productIds: string[];
  marketplace: string;
  connectionId: string;
  updateType: 'inventory' | 'price' | 'description' | 'images';
  parentJobId?: string;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface MarketplaceUpdateJobData {
  userId: string;
  workspaceId: string;
  productId: string;
  description: string;
  marketplace: string;
  connectionId: string;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

export interface AIDescriptionGenerationJobData {
  userId: string;
  workspaceId: string;
  productId: string;
  marketplace: string;
  createdAt: Date;
  priority: JobPriority;
  metadata?: Record<string, any>;
}

// Union type for all job data
export type JobData =
  | MarketplaceSyncJobData
  | ProductBatchJobData
  | ProductIndividualJobData
  | AIOptimizationJobData
  | AIDescriptionBatchJobData
  | AIDescriptionGenerationJobData
  | MarketplaceUpdateBatchJobData
  | MarketplaceUpdateJobData;