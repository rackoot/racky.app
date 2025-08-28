import queueService, { 
  JobType,
  MarketplaceSyncJobData,
  ProductBatchJobData,
  ProductIndividualJobData,
  AIOptimizationScanJobData,
  AIDescriptionBatchJobData
} from '@/common/services/queueService';
import { Job } from 'bull';
import { processMarketplaceSync, processProductBatch } from './processors/marketplaceSyncProcessor';
import { processAIOptimizationScan, processAIDescriptionBatch } from './processors/aiOptimizationProcessor';

/**
 * Set up all job processors
 * This function registers all job processors with their respective queues
 */
export function setupJobProcessors(): void {
  console.log('🔧 Setting up job processors...');

  try {
    // Marketplace sync jobs - high level orchestration
    queueService.process(
      'marketplace-sync',
      JobType.MARKETPLACE_SYNC,
      1, // Process one marketplace sync at a time
      processMarketplaceSync as any
    );

    // Product batch processing - concurrent batches
    queueService.process(
      'product-processing',
      JobType.PRODUCT_BATCH,
      3, // Process up to 3 batches concurrently
      processProductBatch as any
    );

    // Individual product processing - high concurrency
    queueService.process(
      'product-processing',
      JobType.PRODUCT_INDIVIDUAL,
      5, // Process up to 5 individual products concurrently
      (async (job: Job<ProductIndividualJobData>) => {
        // Placeholder for individual product processing
        console.log(`Processing individual product: ${job.data.productId}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, productId: job.data.productId };
      }) as any
    );

    // AI Optimization jobs - real implementations
    queueService.process(
      'ai-optimization',
      JobType.AI_OPTIMIZATION_SCAN,
      1, // One scan at a time
      processAIOptimizationScan as any
    );

    queueService.process(
      'ai-optimization',
      JobType.AI_DESCRIPTION_BATCH,
      2, // Two AI batches concurrently
      processAIDescriptionBatch as any
    );

    // Marketplace update jobs (placeholders for now)
    queueService.process(
      'marketplace-updates',
      JobType.MARKETPLACE_UPDATE_BATCH,
      2, // Two update batches concurrently
      async (job: Job<any>) => {
        console.log(`Processing marketplace update batch: ${job.data.productIds?.length || 0} products`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true, updatedCount: job.data.productIds?.length || 0 };
      }
    );

    console.log('✅ Job processors set up successfully');

  } catch (error) {
    console.error('❌ Failed to set up job processors:', error);
    throw error;
  }
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
  const queueNames = ['marketplace-sync', 'product-processing', 'ai-optimization', 'marketplace-updates'];
  const queues: Record<string, any> = {};
  const totals = { waiting: 0, active: 0, completed: 0, failed: 0 };

  for (const queueName of queueNames) {
    try {
      const stats = await queueService.getQueueStats(queueName);
      queues[queueName] = stats;
      
      totals.waiting += stats.waiting;
      totals.active += stats.active;
      totals.completed += stats.completed;
      totals.failed += stats.failed;
    } catch (error) {
      console.error(`Error getting stats for queue ${queueName}:`, error);
      queues[queueName] = { error: 'Failed to get stats' };
    }
  }

  return {
    queues,
    totalJobs: totals,
  };
}