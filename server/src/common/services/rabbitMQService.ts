import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import getEnv from '@/common/config/env';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
import { JobType, JobPriority } from '@/common/types/jobTypes';

export interface JobOptions {
  priority?: JobPriority;
  delay?: number;
  attempts?: number;
}

export interface JobStatus {
  status: string;
  progress: number | object;
  data: any;
  result?: any;
  failedReason?: string;
  finishedOn?: Date;
  processedOn?: Date;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * RabbitMQ Service - Replacement for Bull.js/Redis queue system
 * Provides job publishing, consumption, and management using RabbitMQ
 */
class RabbitMQService {
  private connection: any = null;
  private channel: any = null;
  private isInitialized = false;
  private consumers: Map<string, any> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000;

  // Queue mapping from Bull.js naming to RabbitMQ queues
  private readonly queueMapping = {
    'marketplace-sync': 'sync.marketplace',
    'product-processing': {
      [JobType.PRODUCT_BATCH]: 'products.batch',
      [JobType.PRODUCT_INDIVIDUAL]: 'products.individual'
    },
    'ai-optimization': {
      [JobType.AI_OPTIMIZATION_SCAN]: 'ai.scan',
      [JobType.AI_DESCRIPTION_BATCH]: 'ai.batch'
    },
    'marketplace-updates': 'updates.batch',
    'marketplace-update': 'updates.individual'
  };

  // Exchange mapping
  private readonly exchangeMapping = {
    'sync.marketplace': 'racky.sync.exchange',
    'products.batch': 'racky.products.exchange',
    'products.individual': 'racky.products.exchange',
    'ai.scan': 'racky.ai.exchange',
    'ai.batch': 'racky.ai.exchange',
    'updates.batch': 'racky.updates.exchange',
    'updates.individual': 'racky.updates.exchange'
  };

  /**
   * Initialize RabbitMQ connection and channel
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️  RabbitMQ service already initialized');
      return;
    }

    const env = getEnv();
    console.log('🚀 Initializing RabbitMQ Service...');

    try {
      // Connect to RabbitMQ
      const rabbitmqUrl = env.RABBITMQ_URL || 'amqp://localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Set up connection event handlers
      this.setupConnectionHandlers();

      // Set prefetch count for fair dispatching
      await this.channel.prefetch(1);

      // Setup exchanges and queues
      await this.setupExchangesAndQueues();

      console.log('✅ RabbitMQ service initialized successfully');
      this.isInitialized = true;
      this.reconnectAttempts = 0;

    } catch (error) {
      console.error('❌ Failed to initialize RabbitMQ service:', error);
      console.log('⚠️  Service will continue without RabbitMQ queue system');
      await this.handleConnectionError(error);
      // Don't throw error to allow server to continue
      return;
    }
  }

  /**
   * Set up connection event handlers for reconnection
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('error', (error) => {
      console.error('❌ RabbitMQ connection error:', error);
      this.handleConnectionError(error);
    });

    this.connection.on('close', () => {
      console.warn('⚠️  RabbitMQ connection closed');
      this.isInitialized = false;
      this.connection = null;
      this.channel = null;
      this.scheduleReconnection();
    });
  }

  /**
   * Handle connection errors with exponential backoff reconnection
   */
  private async handleConnectionError(error: any): Promise<void> {
    this.isInitialized = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnection();
    } else {
      console.error('❌ Max reconnection attempts reached. Manual intervention required.');
      throw new Error('RabbitMQ connection failed permanently');
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        console.error('❌ Reconnection attempt failed:', error);
      }
    }, delay);
  }

  /**
   * Set up exchanges, queues, and bindings
   */
  private async setupExchangesAndQueues(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    // Create exchanges
    const exchanges = [
      'racky.sync.exchange',
      'racky.products.exchange',
      'racky.ai.exchange',
      'racky.updates.exchange',
      'racky.dlx' // Dead letter exchange
    ];

    for (const exchange of exchanges) {
      const type = exchange === 'racky.dlx' ? 'direct' : 'topic';
      await this.channel.assertExchange(exchange, type, { durable: true });
    }

    // Create queues with dead letter configuration
    const queues = [
      'sync.marketplace',
      'products.batch',
      'products.individual',
      'ai.scan',
      'ai.batch',
      'updates.batch',
      'racky.failed' // Dead letter queue
    ];

    for (const queueName of queues) {
      const queueOptions: any = { durable: true };
      
      if (queueName !== 'racky.failed') {
        queueOptions.arguments = {
          'x-dead-letter-exchange': 'racky.dlx',
          'x-dead-letter-routing-key': 'failed',
          'x-max-priority': 10
        };
      }
      
      await this.channel.assertQueue(queueName, queueOptions);
    }

    // Bind queues to exchanges
    const bindings = [
      { exchange: 'racky.sync.exchange', queue: 'sync.marketplace', routingKey: 'sync.marketplace.#' },
      { exchange: 'racky.products.exchange', queue: 'products.batch', routingKey: 'products.batch.#' },
      { exchange: 'racky.products.exchange', queue: 'products.individual', routingKey: 'products.individual.#' },
      { exchange: 'racky.ai.exchange', queue: 'ai.scan', routingKey: 'ai.scan.#' },
      { exchange: 'racky.ai.exchange', queue: 'ai.batch', routingKey: 'ai.batch.#' },
      { exchange: 'racky.updates.exchange', queue: 'updates.batch', routingKey: 'updates.batch.#' },
      { exchange: 'racky.dlx', queue: 'racky.failed', routingKey: 'failed' }
    ];

    for (const binding of bindings) {
      await this.channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
    }
  }

  /**
   * Add a job to a queue (mirrors Bull.js addJob interface)
   */
  async addJob<T>(
    queueName: string,
    jobType: JobType,
    jobData: T,
    options: JobOptions = {}
  ): Promise<any> {
    if (!this.isInitialized || !this.channel) {
      console.log('⚠️  RabbitMQ not available, returning mock job response');
      // Return a mock job object when RabbitMQ is not available
      return {
        id: `mock-${Date.now()}`,
        data: jobData,
        opts: options,
        timestamp: new Date(),
        status: 'queued',
        // Add mock methods that job processing code might call
        markCompleted: () => Promise.resolve(),
        markFailed: () => Promise.resolve(),
        updateProgress: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        retry: () => Promise.resolve()
      };
    }

    const jobId = uuidv4();
    const rabbitMQQueue = this.mapBullQueueToRabbitMQ(queueName, jobType);
    const exchange = this.exchangeMapping[rabbitMQQueue];
    const routingKey = this.generateRoutingKey(rabbitMQQueue, options.priority || JobPriority.NORMAL);

    if (!exchange) {
      throw new Error(`No exchange mapping found for queue: ${rabbitMQQueue}`);
    }

    try {
      // Create job document in MongoDB
      const job = await Job.create({
        jobId,
        jobType,
        queueName: rabbitMQQueue,
        routingKey,
        userId: (jobData as any).userId,
        workspaceId: (jobData as any).workspaceId,
        data: jobData,
        status: 'queued',
        progress: 0,
        attempts: 0,
        maxAttempts: options.attempts || 3,
        priority: options.priority || JobPriority.NORMAL,
        metadata: {
          originalQueueName: queueName,
          createdVia: 'rabbitmq'
        }
      });

      // Create job history entry
      await JobHistory.createEvent(jobId, (jobData as any).workspaceId, 'created', {
        metadata: { queueName: rabbitMQQueue, jobType }
      });

      // Prepare message
      const message = {
        jobId,
        jobType,
        data: jobData,
        metadata: {
          attempts: 0,
          priority: options.priority || JobPriority.NORMAL,
          createdAt: new Date(),
          parentJobId: (jobData as any).parentJobId,
          workspaceId: (jobData as any).workspaceId
        },
        progress: 0
      };

      // Publish to RabbitMQ
      const publishOptions: amqp.Options.Publish = {
        persistent: true,
        priority: this.mapPriorityToRabbitMQ(options.priority || JobPriority.NORMAL),
        timestamp: Date.now()
      };

      if (options.delay && options.delay > 0) {
        publishOptions.expiration = options.delay.toString();
      }

      const published = this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        publishOptions
      );

      if (!published) {
        throw new Error('Failed to publish message to RabbitMQ');
      }

      console.log(`📝 Added job ${jobId} (${jobType}) to queue "${rabbitMQQueue}"`);
      
      return {
        id: jobId,
        jobId,
        data: jobData
      };

    } catch (error) {
      console.error(`❌ Failed to add job to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Get job status (mirrors Bull.js getJobStatus interface)
   */
  async getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null> {
    try {
      const job = await Job.findOne({ jobId });
      
      if (!job) {
        return null;
      }

      return {
        status: job.status,
        progress: job.progress,
        data: job.data,
        result: job.result,
        failedReason: job.lastError,
        finishedOn: job.completedAt,
        processedOn: job.startedAt
      };
    } catch (error) {
      console.error(`❌ Failed to get job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Get queue statistics (mirrors Bull.js getQueueStats interface)
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const rabbitMQQueue = this.mapBullQueueToRabbitMQ(queueName);
    
    try {
      // Get stats from MongoDB (more accurate for our use case)
      const [waiting, active, completed, failed] = await Promise.all([
        Job.countDocuments({ queueName: rabbitMQQueue, status: 'queued' }),
        Job.countDocuments({ queueName: rabbitMQQueue, status: 'processing' }),
        Job.countDocuments({ queueName: rabbitMQQueue, status: 'completed' }),
        Job.countDocuments({ queueName: rabbitMQQueue, status: 'failed' })
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed: 0 // Not directly supported in current implementation
      };
    } catch (error) {
      console.error(`❌ Failed to get queue stats for ${queueName}:`, error);
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  }

  /**
   * Process jobs from a queue
   */
  process<T>(
    queueName: string,
    jobType: JobType,
    concurrency: number,
    processor: (job: any) => Promise<any>
  ): void {
    const rabbitMQQueue = this.mapBullQueueToRabbitMQ(queueName, jobType);
    
    if (!this.channel) {
      throw new Error('RabbitMQ service not initialized');
    }

    console.log(`🔄 Setting up processor for "${jobType}" in queue "${rabbitMQQueue}" with concurrency: ${concurrency}`);

    // Start multiple consumers for concurrency
    for (let i = 0; i < concurrency; i++) {
      this.startConsumer(rabbitMQQueue, jobType, processor, i);
    }
  }

  /**
   * Start a consumer for a specific queue
   */
  private async startConsumer(
    queueName: string,
    jobType: JobType,
    processor: (job: any) => Promise<any>,
    consumerIndex: number
  ): Promise<void> {
    if (!this.channel) return;

    try {
      const consumerTag = `${queueName}-${jobType}-${consumerIndex}`;
      
      await this.channel.consume(queueName, async (message) => {
        if (!message) return;

        const content = JSON.parse(message.content.toString());
        const { jobId, data } = content;

        console.log(`🔄 Processing job ${jobId} (${jobType}) in consumer ${consumerIndex}`);

        try {
          // Update job status to processing
          const job = await Job.findOneAndUpdate(
            { jobId },
            { 
              $set: { 
                status: 'processing',
                startedAt: new Date()
              }
            },
            { new: true }
          );

          if (!job) {
            console.error(`❌ Job ${jobId} not found in database`);
            this.channel?.nack(message, false, false);
            return;
          }

          // Calculate queue wait time
          const queueWaitTime = Date.now() - job.createdAt.getTime();
          await job.updateOne({ queueWaitTime });

          // Create processing history entry
          await JobHistory.createEvent(jobId, job.workspaceId, 'started', {
            queueWaitTime,
            attempt: job.attempts + 1
          });

          // Create processor-compatible job object
          const processorJob = {
            id: jobId,
            data,
            progress: async (progressValue: number) => {
              await Job.findOneAndUpdate(
                { jobId },
                { $set: { progress: Math.min(100, Math.max(0, progressValue)) } }
              );
              
              await JobHistory.createEvent(jobId, job.workspaceId, 'progress', {
                progress: progressValue
              });
            }
          };

          // Process the job
          const result = await processor(processorJob);

          // Check if job should remain in processing state
          if (result && result.status === 'processing_batches') {
            // Don't mark as completed - job should remain processing
            console.log(`🔄 Job ${jobId} is waiting for batch completion`);
          } else {
            // Mark job as completed normally
            await job.markCompleted(result);
          }
          
          if (result && result.status === 'processing_batches') {
            await JobHistory.createEvent(jobId, job.workspaceId, 'batch_initiated', {
              metadata: { result }
            });
          } else {
            await JobHistory.createEvent(jobId, job.workspaceId, 'completed', {
              processingTime: job.processingTime,
              metadata: { result }
            });
          }

          // Acknowledge message
          this.channel?.ack(message);
          
          console.log(`✅ Job ${jobId} completed successfully`);

        } catch (error) {
          console.error(`❌ Job ${jobId} failed:`, error);
          
          // Update job failure info
          const job = await Job.findOne({ jobId });
          if (job) {
            await job.incrementAttempts();
            
            if (job.attempts >= job.maxAttempts) {
              // Max attempts reached, mark as failed
              await job.markFailed(error instanceof Error ? error.message : 'Unknown error');
              
              await JobHistory.createEvent(jobId, job.workspaceId, 'failed', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                attempt: job.attempts
              });
              
              // Dead letter - reject without requeue
              this.channel?.nack(message, false, false);
            } else {
              // Retry - reject with requeue
              await JobHistory.createEvent(jobId, job.workspaceId, 'retry', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                attempt: job.attempts
              });
              
              this.channel?.nack(message, false, true);
            }
          } else {
            // Job not found, reject without requeue
            this.channel?.nack(message, false, false);
          }
        }
      }, { consumerTag });

      this.consumers.set(consumerTag, { queueName, jobType, consumerIndex });
      
    } catch (error) {
      console.error(`❌ Failed to start consumer for ${queueName}:`, error);
    }
  }

  /**
   * Map Bull.js queue names to RabbitMQ queue names
   */
  private mapBullQueueToRabbitMQ(queueName: string, jobType?: JobType): string {
    const mapping = this.queueMapping[queueName];
    
    if (typeof mapping === 'string') {
      return mapping;
    } else if (mapping && jobType) {
      return mapping[jobType] || 'products.batch';
    }
    
    // Default fallback
    return 'products.batch';
  }

  /**
   * Generate routing key based on queue and priority
   */
  private generateRoutingKey(queueName: string, priority: JobPriority): string {
    const priorityName = this.mapPriorityToString(priority);
    return `${queueName.replace('.', '.')}.${priorityName}`;
  }

  /**
   * Map JobPriority enum to RabbitMQ priority (0-255)
   */
  private mapPriorityToRabbitMQ(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.CRITICAL: return 10;
      case JobPriority.HIGH: return 8;
      case JobPriority.NORMAL: return 5;
      case JobPriority.LOW: return 2;
      default: return 5;
    }
  }

  /**
   * Map JobPriority enum to string
   */
  private mapPriorityToString(priority: JobPriority): string {
    switch (priority) {
      case JobPriority.CRITICAL: return 'critical';
      case JobPriority.HIGH: return 'high';
      case JobPriority.NORMAL: return 'normal';
      case JobPriority.LOW: return 'low';
      default: return 'normal';
    }
  }

  /**
   * Pause a queue (stop consuming)
   */
  async pauseQueue(queueName: string): Promise<void> {
    // Cancel consumers for this queue
    for (const [consumerTag, consumer] of this.consumers) {
      if (consumer.queueName === queueName) {
        try {
          await this.channel?.cancel(consumerTag);
          this.consumers.delete(consumerTag);
          console.log(`⏸️  Paused consumer ${consumerTag} for queue "${queueName}"`);
        } catch (error) {
          console.error(`❌ Failed to pause consumer ${consumerTag}:`, error);
        }
      }
    }
  }

  /**
   * Resume a queue (restart consuming)
   */
  async resumeQueue(queueName: string): Promise<void> {
    // This would require re-registering processors
    console.log(`▶️  Queue "${queueName}" resume requested - processors need to be re-registered`);
  }

  /**
   * Shutdown RabbitMQ service
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down RabbitMQ service...');
    
    try {
      // Cancel all consumers
      for (const consumerTag of this.consumers.keys()) {
        await this.channel?.cancel(consumerTag);
      }
      this.consumers.clear();
      
      // Close channel and connection
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      this.isInitialized = false;
      console.log('✅ RabbitMQ service shutdown complete');
      
    } catch (error) {
      console.error('❌ Error during RabbitMQ shutdown:', error);
    }
  }
}

// Export singleton instance
export const rabbitMQService = new RabbitMQService();
export default rabbitMQService;