import rabbitMQService from '@/common/services/rabbitMQService';
import { JobType } from '@/common/types/jobTypes';
import { processMarketplaceSync, processProductBatch } from './processors/marketplaceSyncProcessor';
import { processAIOptimizationScan, processAIDescriptionBatch } from './processors/aiOptimizationProcessor';
import { processMarketplaceUpdateJob } from './processors/marketplaceUpdateProcessor';
import { rabbitMQMonitoringService } from '@/common/services/rabbitMQMonitoringService';
import { processAIDescriptionJob } from '@/opportunities/services/descriptionWorker';

/**
 * Set up all RabbitMQ job processors
 * This function registers all job processors with their respective queues
 */
export function setupRabbitMQJobProcessors(): void {
  console.log('🔧 Setting up RabbitMQ job processors...');

  try {
    // Marketplace sync jobs - high level orchestration
    rabbitMQService.process(
      'marketplace-sync',
      JobType.MARKETPLACE_SYNC,
      1, // Process one marketplace sync at a time
      processMarketplaceSync as any
    );

    // Product batch processing - concurrent batches
    rabbitMQService.process(
      'product-processing',
      JobType.PRODUCT_BATCH,
      3, // Process up to 3 batches concurrently
      processProductBatch as any
    );

    // Individual product processing - high concurrency
    rabbitMQService.process(
      'product-processing',
      JobType.PRODUCT_INDIVIDUAL,
      5, // Process up to 5 individual products concurrently
      (async (job: any) => {
        // Placeholder for individual product processing
        console.log(`Processing individual product: ${job.data.productId}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, productId: job.data.productId };
      }) as any
    );

    // AI Optimization jobs - real implementations
    rabbitMQService.process(
      'ai-optimization',
      JobType.AI_OPTIMIZATION_SCAN,
      1, // One scan at a time
      processAIOptimizationScan as any
    );

    rabbitMQService.process(
      'ai-optimization',
      JobType.AI_DESCRIPTION_BATCH,
      2, // Two AI batches concurrently
      processAIDescriptionBatch as any
    );

    // Marketplace update jobs
    rabbitMQService.process(
      'marketplace-updates',
      JobType.MARKETPLACE_UPDATE_BATCH,
      2, // Two update batches concurrently
      async (job: any) => {
        console.log(`Processing marketplace update batch: ${job.data.productIds?.length || 0} products`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true, updatedCount: job.data.productIds?.length || 0 };
      }
    );

    // Individual marketplace update jobs
    rabbitMQService.process(
      'marketplace-update',
      JobType.MARKETPLACE_UPDATE,
      3, // Process up to 3 individual marketplace updates concurrently
      processMarketplaceUpdateJob as any
    );

    // AI description generation jobs - individual descriptions
    rabbitMQService.process(
      'ai-description',
      JobType.AI_DESCRIPTION_GENERATION,
      3, // Process up to 3 description generations concurrently
      processAIDescriptionJob as any
    );

    console.log('✅ RabbitMQ job processors set up successfully');

  } catch (error) {
    console.error('❌ Failed to set up RabbitMQ job processors:', error);
    throw error;
  }
}

/**
 * Health check for RabbitMQ job processors
 */
export async function getRabbitMQJobProcessorHealth(): Promise<{
  queues: Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed?: number;
  }>;
  totalJobs: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  management: {
    accessible: boolean;
    version?: string;
    uptime?: number;
  };
}> {
  const queueNames = ['sync.marketplace', 'products.batch', 'ai.scan', 'ai.batch'];
  const queues: Record<string, any> = {};
  const totals = { waiting: 0, active: 0, completed: 0, failed: 0 };

  for (const queueName of queueNames) {
    try {
      const stats = await rabbitMQService.getQueueStats(queueName);
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

  // Check RabbitMQ management API accessibility
  const management = {
    accessible: false,
    version: undefined,
    uptime: undefined
  };

  try {
    const isAccessible = await rabbitMQMonitoringService.isManagementApiAccessible();
    management.accessible = isAccessible;
    
    if (isAccessible) {
      const overallHealth = await rabbitMQMonitoringService.getOverallHealth();
      management.version = overallHealth.version;
      management.uptime = overallHealth.uptime;
    }
  } catch (error) {
    console.error('Error checking RabbitMQ management API:', error);
  }

  return {
    queues,
    totalJobs: totals,
    management
  };
}