import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import rabbitMQService from '@/common/services/rabbitMQService';
import { JobType, JobPriority } from '@/common/services/queueService';
import Job from '@/common/models/Job';

// Mock amqplib for load testing
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue({}),
  assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
  bindQueue: jest.fn().mockResolvedValue({}),
  publish: jest.fn().mockReturnValue(true),
  prefetch: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined)
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

jest.unstable_mockModule('amqplib', () => ({
  connect: jest.fn().mockResolvedValue(mockConnection)
}));

// Mock other dependencies
jest.mock('@/common/models/JobHistory', () => ({
  default: {
    createEvent: jest.fn().mockResolvedValue({ _id: 'history-id' })
  }
}));

jest.mock('@/common/config/env', () => ({
  default: () => ({
    RABBITMQ_URL: 'amqp://test:test@localhost:5672/test'
  })
}));

describe('RabbitMQ Load Testing', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    await rabbitMQService.initialize();
  });

  afterAll(async () => {
    await rabbitMQService.shutdown();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await mongoose.connection.db.dropDatabase();
  });

  describe('High Volume Job Creation', () => {
    it('should handle 100 concurrent job submissions', async () => {
      const jobPromises = [];
      const startTime = Date.now();

      // Mock successful job creation
      let jobCounter = 0;
      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({
          _id: `job-${jobCounter}`,
          jobId: `test-job-${jobCounter}`,
          status: 'queued'
        });
      });

      // Create 100 concurrent jobs
      for (let i = 0; i < 100; i++) {
        const jobPromise = rabbitMQService.addJob(
          'marketplace-sync',
          JobType.MARKETPLACE_SYNC,
          {
            userId: `user-${i % 10}`, // 10 different users
            workspaceId: `workspace-${i % 5}`, // 5 different workspaces
            marketplace: 'shopify',
            batchNumber: i,
            createdAt: new Date(),
            priority: JobPriority.NORMAL
          }
        );
        jobPromises.push(jobPromise);
      }

      const results = await Promise.all(jobPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all jobs were created successfully
      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result.jobId).toBe(`test-job-${index + 1}`);
      });

      // Verify performance metrics
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockChannel.publish).toHaveBeenCalledTimes(100);
      expect(Job.create).toHaveBeenCalledTimes(100);

      console.log(`Created 100 jobs in ${duration}ms (avg: ${duration / 100}ms per job)`);
    }, 10000);

    it('should handle rapid job status queries', async () => {
      // Create test jobs
      const testJobs = [];
      for (let i = 0; i < 50; i++) {
        testJobs.push({
          jobId: `query-test-${i}`,
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: `user-${i % 5}`,
          workspaceId: `workspace-${i % 3}`,
          data: { batchNumber: i },
          status: i % 2 === 0 ? 'completed' : 'processing',
          progress: i % 2 === 0 ? 100 : Math.floor(Math.random() * 100),
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          createdAt: new Date()
        });
      }
      await Job.create(testJobs);

      const startTime = Date.now();
      const queryPromises = [];

      // Query all jobs concurrently
      for (let i = 0; i < 50; i++) {
        const queryPromise = rabbitMQService.getJobStatus('marketplace-sync', `query-test-${i}`);
        queryPromises.push(queryPromise);
      }

      const results = await Promise.all(queryPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all queries returned results
      expect(results).toHaveLength(50);
      results.forEach((result, index) => {
        expect(result).not.toBeNull();
        expect(result?.status).toMatch(/completed|processing/);
      });

      // Performance check
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds

      console.log(`Queried 50 job statuses in ${duration}ms (avg: ${duration / 50}ms per query)`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during continuous job processing', async () => {
      const initialMemory = process.memoryUsage();
      let jobCounter = 0;

      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({
          _id: `memory-test-${jobCounter}`,
          jobId: `memory-job-${jobCounter}`,
          status: 'queued'
        });
      });

      // Create jobs in batches to simulate continuous processing
      for (let batch = 0; batch < 10; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < 20; i++) {
          const jobPromise = rabbitMQService.addJob(
            'product-processing',
            JobType.PRODUCT_BATCH,
            {
              userId: 'memory-test-user',
              workspaceId: 'memory-test-workspace',
              batchNumber: batch * 20 + i,
              createdAt: new Date(),
              priority: JobPriority.NORMAL
            }
          );
          batchPromises.push(jobPromise);
        }

        await Promise.all(batchPromises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 50MB for 200 jobs)
      expect(memoryIncreaseMB).toBeLessThan(50);
      expect(jobCounter).toBe(200);

      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for ${jobCounter} jobs`);
    });
  });

  describe('Error Resilience Under Load', () => {
    it('should handle partial failures gracefully', async () => {
      let successCount = 0;
      let failCount = 0;

      // Mock intermittent failures
      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        const shouldFail = Math.random() < 0.2; // 20% failure rate
        if (shouldFail) {
          return Promise.reject(new Error('Database connection lost'));
        }
        successCount++;
        return Promise.resolve({
          _id: `resilience-${successCount}`,
          jobId: `resilience-job-${successCount}`,
          status: 'queued'
        });
      });

      const jobPromises = [];
      for (let i = 0; i < 100; i++) {
        const jobPromise = rabbitMQService.addJob(
          'ai-optimization',
          JobType.AI_OPTIMIZATION_SCAN,
          {
            userId: `resilience-user-${i % 3}`,
            workspaceId: `resilience-workspace-${i % 2}`,
            productId: `product-${i}`,
            createdAt: new Date(),
            priority: JobPriority.NORMAL
          }
        ).catch(error => {
          failCount++;
          return { error: error.message };
        });
        jobPromises.push(jobPromise);
      }

      const results = await Promise.all(jobPromises);
      
      // Verify that some jobs succeeded and some failed
      const successfulJobs = results.filter(result => result && !result.error);
      const failedJobs = results.filter(result => result && result.error);

      expect(successfulJobs.length).toBeGreaterThan(0);
      expect(failedJobs.length).toBeGreaterThan(0);
      expect(successfulJobs.length + failedJobs.length).toBe(100);

      console.log(`Resilience test: ${successfulJobs.length} succeeded, ${failedJobs.length} failed`);
    });
  });

  describe('Queue Statistics Performance', () => {
    it('should efficiently calculate statistics for large datasets', async () => {
      // Create a large number of jobs with different statuses
      const testJobs = [];
      for (let i = 0; i < 1000; i++) {
        const status = ['queued', 'processing', 'completed', 'failed'][i % 4] as any;
        testJobs.push({
          jobId: `stats-job-${i}`,
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: 'stats-user',
          workspaceId: 'stats-workspace',
          data: { index: i },
          status,
          progress: status === 'completed' ? 100 : Math.floor(Math.random() * 100),
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          createdAt: new Date()
        });
      }

      await Job.create(testJobs);

      const startTime = Date.now();
      const stats = await rabbitMQService.getQueueStats('marketplace-sync');
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify statistics are calculated correctly
      expect(stats.waiting + stats.active + stats.completed + stats.failed).toBe(1000);
      expect(stats.completed).toBe(250); // Every 4th job is completed
      expect(stats.failed).toBe(250); // Every 4th job is failed

      // Performance check - should be fast even with 1000 jobs
      expect(duration).toBeLessThan(1000); // Less than 1 second

      console.log(`Queue statistics for 1000 jobs calculated in ${duration}ms`);
    });
  });
});