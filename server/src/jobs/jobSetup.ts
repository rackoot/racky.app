// Legacy Bull.js job setup - DEPRECATED
// Use rabbitMQJobSetup.ts instead
import { 
  JobType,
  MarketplaceSyncJobData,
  ProductBatchJobData,
  ProductIndividualJobData,
  AIOptimizationJobData,
  AIDescriptionBatchJobData
} from '@/common/types/jobTypes';
import { processMarketplaceSync, processProductBatch } from './processors/marketplaceSyncProcessor';
import { processAIOptimizationScan, processAIDescriptionBatch } from './processors/aiOptimizationProcessor';

/**
 * Set up all job processors
 * This function registers all job processors with their respective queues
 */
export function setupJobProcessors(): void {
  console.log('🚨 DEPRECATED: Legacy Bull.js job setup called. Use rabbitMQJobSetup.ts instead.');
  console.log('🔧 Skipping legacy job processor setup...');
}

/**
 * Health check for job processors
 */
export async function getJobProcessorHealth(): Promise<{
  queues: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }>;
  totalJobs: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}> {
  console.log('🚨 DEPRECATED: Legacy Bull.js health check called. Use RabbitMQ monitoring instead.');
  
  return {
    queues: {},
    totalJobs: { waiting: 0, active: 0, completed: 0, failed: 0 },
  };
}