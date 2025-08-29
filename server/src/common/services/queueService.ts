import Bull, { Queue, Job, ProcessCallbackFunction, QueueOptions } from 'bull';
import getEnv from '@/common/config/env';

// Job types for type safety
export enum JobType {
  MARKETPLACE_SYNC = 'MARKETPLACE_SYNC',
  PRODUCT_BATCH = 'PRODUCT_BATCH', 
  PRODUCT_INDIVIDUAL = 'PRODUCT_INDIVIDUAL',
  AI_OPTIMIZATION_SCAN = 'AI_OPTIMIZATION_SCAN',
  AI_DESCRIPTION_BATCH = 'AI_DESCRIPTION_BATCH',
  AI_DESCRIPTION_INDIVIDUAL = 'AI_DESCRIPTION_INDIVIDUAL',
  MARKETPLACE_UPDATE_BATCH = 'MARKETPLACE_UPDATE_BATCH',
  MARKETPLACE_UPDATE_INDIVIDUAL = 'MARKETPLACE_UPDATE_INDIVIDUAL',
  MARKETPLACE_UPDATE_RETRY = 'MARKETPLACE_UPDATE_RETRY'
}

// Job priorities
export enum JobPriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 1,
  CRITICAL = 0
}

// Job data interfaces
export interface MarketplaceSyncJobData extends BaseJobData {
  connectionId: string;
  marketplace: string;
  estimatedProducts: number;
  batchSize: number;
}

export interface ProductBatchJobData extends BaseJobData {
  connectionId: string;
  marketplace: string;
  productIds: string[];
  batchNumber: number;
  totalBatches: number;
  parentJobId: string;
}

export interface ProductIndividualJobData extends BaseJobData {
  connectionId: string;
  marketplace: string;
  productId: string;
  parentJobId?: string;
}

export interface AIOptimizationScanJobData extends BaseJobData {
  filters?: {
    marketplace?: string;
    minDescriptionLength?: number;
    maxDescriptionLength?: number;
    createdAfter?: Date;
  };
}

export interface AIDescriptionBatchJobData extends BaseJobData {
  productIds: string[];
  marketplace: string;
  batchNumber: number;
  totalBatches: number;
  parentJobId: string;
}

// Base job data that all jobs inherit
export interface BaseJobData {
  userId: string;
  workspaceId: string;
  createdAt: Date;
  priority: JobPriority;
}

// Queue configuration
const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  redis: {
    port: 6379,
    host: '127.0.0.1',
    connectTimeout: 60000,
    lazyConnect: true,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
  settings: {
    stalledInterval: 30 * 1000, // 30 seconds
    retryProcessDelay: 5 * 1000, // 5 seconds
  }
};

/**
 * Queue Service - Centralized queue management
 */
class QueueService {
  private queues: Map<string, Queue> = new Map();
  private isInitialized = false;

  /**
   * Initialize the queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️  Queue service already initialized');
      return;
    }

    const env = getEnv();
    console.log('🚀 Initializing Queue Service...');

    // Parse Redis URL
    const redisUrl = new URL(env.REDIS_URL);
    const redisConfig = {
      port: parseInt(redisUrl.port) || 6379,
      host: redisUrl.hostname || 'localhost',
      connectTimeout: 60000,
      lazyConnect: false, // Changed to false to connect immediately
    };

    // Update default options with environment-specific Redis config
    const queueOptions: QueueOptions = {
      ...DEFAULT_QUEUE_OPTIONS,
      redis: redisConfig,
    };

    // Initialize queues for different job types
    const queueNames = [
      'marketplace-sync',    // High-level marketplace sync jobs
      'product-processing', // Product batch and individual jobs
      'ai-optimization',    // AI-related jobs
      'marketplace-updates' // Marketplace update jobs
    ];

    try {
      const queuePromises = [];
      
      for (const queueName of queueNames) {
        const queue = new Bull(queueName, queueOptions);
        this.queues.set(queueName, queue);

        // Set up queue event listeners
        this.setupQueueEvents(queue, queueName);
        
        // Wait for queue to be ready
        queuePromises.push(
          new Promise((resolve) => {
            queue.on('ready', () => resolve(queueName));
            // Add timeout in case ready event doesn't fire
            setTimeout(() => resolve(queueName), 2000);
          })
        );
      }
      
      // Wait for all queues to be ready
      await Promise.all(queuePromises);

      console.log('✅ Queue service initialized with Redis:', `${redisConfig.host}:${redisConfig.port}`);
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize queue service:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for a queue
   */
  private setupQueueEvents(queue: Queue, queueName: string): void {
    queue.on('ready', () => {
      console.log(`📊 Queue "${queueName}" is ready`);
    });

    queue.on('error', (error) => {
      console.error(`❌ Queue "${queueName}" error:`, error);
    });

    queue.on('failed', (job: Job, err: Error) => {
      console.error(`❌ Job ${job.id} in queue "${queueName}" failed:`, err.message);
    });

    queue.on('completed', (job: Job) => {
      console.log(`✅ Job ${job.id} in queue "${queueName}" completed`);
    });

    queue.on('stalled', (job: Job) => {
      console.warn(`⚠️  Job ${job.id} in queue "${queueName}" stalled`);
    });
  }

  /**
   * Get a queue by name
   */
  getQueue(queueName: string): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" not found. Available queues: ${Array.from(this.queues.keys()).join(', ')}`);
    }
    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T extends BaseJobData>(
    queueName: string,
    jobType: JobType,
    jobData: T,
    options?: {
      priority?: JobPriority;
      delay?: number;
      attempts?: number;
      backoff?: Bull.BackoffOptions;
    }
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    
    const jobOptions: Bull.JobOptions = {
      priority: options?.priority || JobPriority.NORMAL,
      delay: options?.delay,
      attempts: options?.attempts,
      backoff: options?.backoff,
    };

    // Add metadata to job data
    const enhancedJobData = {
      ...jobData,
      createdAt: new Date(),
      priority: options?.priority || JobPriority.NORMAL,
    };

    const job = await queue.add(jobType, enhancedJobData, jobOptions);
    console.log(`📝 Added job ${job.id} (${jobType}) to queue "${queueName}"`);
    
    return job;
  }

  /**
   * Process jobs in a queue
   */
  process<T extends BaseJobData>(
    queueName: string,
    jobType: JobType,
    concurrency: number,
    processor: ProcessCallbackFunction<T>
  ): void {
    const queue = this.getQueue(queueName);
    queue.process(jobType, concurrency, processor);
    console.log(`🔄 Processing "${jobType}" jobs in queue "${queueName}" with concurrency: ${concurrency}`);
  }

  /**
   * Get job status and progress
   */
  async getJobStatus(queueName: string, jobId: string): Promise<{
    status: string;
    progress: number | object;
    data: any;
    result?: any;
    failedReason?: string;
    finishedOn?: Date;
    processedOn?: Date;
  } | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      status: await job.getState(),
      progress: job.progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(), 
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    console.log(`⏸️  Queue "${queueName}" paused`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    console.log(`▶️  Queue "${queueName}" resumed`);
  }

  /**
   * Clean up old jobs
   */
  async cleanQueue(queueName: string, grace: number = 24 * 60 * 60 * 1000): Promise<void> {
    const queue = this.getQueue(queueName);
    
    const results = await Promise.all([
      queue.clean(grace, 'completed'),
      queue.clean(grace, 'failed'),
    ]);
    
    console.log(`🧹 Cleaned queue "${queueName}": ${results[0]} completed, ${results[1]} failed jobs removed`);
  }

  /**
   * Shut down all queues
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down queue service...');
    
    const shutdownPromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.close();
        console.log(`✅ Queue "${name}" shut down`);
      } catch (error) {
        console.error(`❌ Error shutting down queue "${name}":`, error);
      }
    });

    await Promise.all(shutdownPromises);
    this.queues.clear();
    this.isInitialized = false;
    console.log('✅ Queue service shut down complete');
  }
}

// Export singleton instance
export const queueService = new QueueService();
export default queueService;