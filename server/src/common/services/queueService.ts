// Legacy queueService - DEPRECATED
// This file only exports types for backward compatibility
// All job processing now uses RabbitMQ via rabbitMQService.ts

// Re-export types from the new location
export { 
  JobType, 
  JobPriority,
  MarketplaceSyncJobData,
  ProductBatchJobData,
  ProductIndividualJobData,
  AIOptimizationJobData,
  AIDescriptionBatchJobData,
  MarketplaceUpdateBatchJobData
} from '../types/jobTypes';

// Export a placeholder object to prevent import errors
export default {
  JobType: {} as any,
  JobPriority: {} as any
};