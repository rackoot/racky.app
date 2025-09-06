import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import rabbitMQService from '@/common/services/rabbitMQService';
import { JobType, JobPriority } from '@/common/services/queueService';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';

// Mock amqplib
const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue({}),
  assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
  bindQueue: jest.fn().mockResolvedValue({}),
  publish: jest.fn().mockReturnValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  prefetch: jest.fn().mockResolvedValue(undefined)
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

jest.unstable_mockModule('amqplib', () => ({
  connect: jest.fn().mockResolvedValue(mockConnection)
}));

// Mock models
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

interface PerformanceMetrics {
  operationType: string;
  totalOperations: number;
  totalTime: number;
  averageTime: number;
  throughput: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    increase: number;
  };
}

describe('Performance Benchmarks: RabbitMQ vs Previous System', () => {
  let mongoServer: MongoMemoryServer;
  let performanceResults: PerformanceMetrics[] = [];

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

    // Output performance summary
    console.log('\n=== RABBITMQ PERFORMANCE BENCHMARK RESULTS ===');
    performanceResults.forEach(result => {
      console.log(`\n${result.operationType}:`);
      console.log(`  Total Operations: ${result.totalOperations}`);
      console.log(`  Total Time: ${result.totalTime}ms`);
      console.log(`  Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${result.throughput.toFixed(2)} ops/sec`);
      console.log(`  Memory Increase: ${(result.memoryUsage.increase / 1024 / 1024).toFixed(2)}MB`);
    });
    console.log('\n===============================================\n');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await mongoose.connection.db.dropDatabase();
  });

  function measurePerformance<T>(
    operationType: string,
    totalOperations: number,
    operation: () => Promise<T>
  ): Promise<{ results: T[]; metrics: PerformanceMetrics }> {
    return new Promise(async (resolve) => {
      const memoryBefore = process.memoryUsage();
      const startTime = Date.now();
      const results: T[] = [];

      for (let i = 0; i < totalOperations; i++) {
        try {
          const result = await operation();
          results.push(result);
        } catch (error) {
          // Log error but continue with benchmark
          console.warn(`Operation ${i} failed:`, error);
        }
      }

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const totalTime = endTime - startTime;

      const metrics: PerformanceMetrics = {
        operationType,
        totalOperations,
        totalTime,
        averageTime: totalTime / totalOperations,
        throughput: (totalOperations / totalTime) * 1000,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          increase: memoryAfter.heapUsed - memoryBefore.heapUsed
        }
      };

      performanceResults.push(metrics);
      resolve({ results, metrics });
    });
  }

  describe('Job Creation Performance', () => {
    it('should benchmark bulk job creation', async () => {
      let jobCounter = 0;
      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({
          _id: `bench-job-${jobCounter}`,
          jobId: `benchmark-${jobCounter}`,
          status: 'queued'
        });
      });

      const { results, metrics } = await measurePerformance(
        'Bulk Job Creation (100 jobs)',
        100,
        async () => {
          return rabbitMQService.addJob(
            'marketplace-sync',
            JobType.MARKETPLACE_SYNC,
            {
              userId: 'benchmark-user',
              workspaceId: 'benchmark-workspace',
              marketplace: 'shopify',
              createdAt: new Date(),
              priority: JobPriority.NORMAL
            }
          );
        }
      );

      expect(results).toHaveLength(100);
      expect(metrics.averageTime).toBeLessThan(50); // Less than 50ms per job
      expect(metrics.throughput).toBeGreaterThan(20); // More than 20 jobs/sec
      expect(mockChannel.publish).toHaveBeenCalledTimes(100);
    });

    it('should benchmark concurrent job creation', async () => {
      let jobCounter = 0;
      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({
          _id: `concurrent-job-${jobCounter}`,
          jobId: `concurrent-${jobCounter}`,
          status: 'queued'
        });
      });

      const concurrentOperations = 50;
      const memoryBefore = process.memoryUsage();
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentOperations }, (_, i) =>
        rabbitMQService.addJob(
          'product-processing',
          JobType.PRODUCT_BATCH,
          {
            userId: `user-${i % 5}`,
            workspaceId: `workspace-${i % 3}`,
            batchNumber: i,
            createdAt: new Date(),
            priority: JobPriority.NORMAL
          }
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();

      const totalTime = endTime - startTime;
      const metrics: PerformanceMetrics = {
        operationType: 'Concurrent Job Creation (50 jobs)',
        totalOperations: concurrentOperations,
        totalTime,
        averageTime: totalTime / concurrentOperations,
        throughput: (concurrentOperations / totalTime) * 1000,
        memoryUsage: {
          before: memoryBefore,
          after: memoryAfter,
          increase: memoryAfter.heapUsed - memoryBefore.heapUsed
        }
      };

      performanceResults.push(metrics);

      expect(results).toHaveLength(concurrentOperations);
      expect(metrics.totalTime).toBeLessThan(5000); // Less than 5 seconds
      expect(metrics.throughput).toBeGreaterThan(10); // More than 10 jobs/sec
    });
  });

  describe('Job Status Query Performance', () => {
    it('should benchmark job status retrieval', async () => {
      // Pre-populate database with test jobs
      const testJobs = [];
      for (let i = 0; i < 500; i++) {
        testJobs.push({
          jobId: `status-test-${i}`,
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: 'status-user',
          workspaceId: 'status-workspace',
          data: { index: i },
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'processing' : 'queued',
          progress: i % 3 === 0 ? 100 : Math.floor(Math.random() * 100),
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          createdAt: new Date(Date.now() - i * 1000)
        });
      }
      await Job.create(testJobs);

      const { results, metrics } = await measurePerformance(
        'Job Status Queries (100 queries)',
        100,
        async () => {
          const jobIndex = Math.floor(Math.random() * 500);
          return rabbitMQService.getJobStatus('marketplace-sync', `status-test-${jobIndex}`);
        }
      );

      const successfulQueries = results.filter(result => result !== null);
      expect(successfulQueries.length).toBeGreaterThan(80); // At least 80% success rate
      expect(metrics.averageTime).toBeLessThan(20); // Less than 20ms per query
      expect(metrics.throughput).toBeGreaterThan(50); // More than 50 queries/sec
    });

    it('should benchmark queue statistics calculation', async () => {
      // Create jobs with various statuses for statistics
      const statusDistribution = {
        queued: 100,
        processing: 50,
        completed: 300,
        failed: 25
      };

      const testJobs = [];
      Object.entries(statusDistribution).forEach(([status, count]) => {
        for (let i = 0; i < count; i++) {
          testJobs.push({
            jobId: `stats-${status}-${i}`,
            jobType: JobType.MARKETPLACE_SYNC,
            queueName: 'sync.marketplace',
            routingKey: 'sync.marketplace.normal',
            userId: 'stats-user',
            workspaceId: 'stats-workspace',
            data: { status, index: i },
            status: status as any,
            progress: status === 'completed' ? 100 : Math.floor(Math.random() * 100),
            attempts: 0,
            maxAttempts: 3,
            priority: JobPriority.NORMAL,
            createdAt: new Date()
          });
        }
      });

      await Job.create(testJobs);

      const { results, metrics } = await measurePerformance(
        'Queue Statistics (50 calculations)',
        50,
        async () => {
          return rabbitMQService.getQueueStats('marketplace-sync');
        }
      );

      // Verify statistics accuracy
      results.forEach(stats => {
        expect(stats.waiting).toBe(statusDistribution.queued);
        expect(stats.active).toBe(statusDistribution.processing);
        expect(stats.completed).toBe(statusDistribution.completed);
        expect(stats.failed).toBe(statusDistribution.failed);
      });

      expect(metrics.averageTime).toBeLessThan(100); // Less than 100ms per calculation
      expect(metrics.throughput).toBeGreaterThan(10); // More than 10 calculations/sec
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should benchmark memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      let jobCounter = 0;

      (Job.create as jest.Mock) = jest.fn().mockImplementation(() => {
        jobCounter++;
        return Promise.resolve({
          _id: `memory-${jobCounter}`,
          jobId: `memory-job-${jobCounter}`,
          status: 'queued'
        });
      });

      // Simulate sustained load over multiple batches
      const batchSize = 50;
      const totalBatches = 10;
      const memorySnapshots: NodeJS.MemoryUsage[] = [initialMemory];

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const promise = rabbitMQService.addJob(
            'ai-optimization',
            JobType.AI_OPTIMIZATION_SCAN,
            {
              userId: `memory-user-${batch}`,
              workspaceId: `memory-workspace-${batch}`,
              productId: `product-${batch * batchSize + i}`,
              scanType: 'full',
              createdAt: new Date(),
              priority: JobPriority.NORMAL
            }
          );
          batchPromises.push(promise);
        }

        await Promise.all(batchPromises);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        memorySnapshots.push(process.memoryUsage());
      }

      const finalMemory = memorySnapshots[memorySnapshots.length - 1];
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerJob = totalMemoryIncrease / (batchSize * totalBatches);

      // Memory usage should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total
      expect(memoryPerJob).toBeLessThan(200 * 1024); // Less than 200KB per job
      expect(jobCounter).toBe(batchSize * totalBatches);

      console.log(`Memory usage: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB for ${jobCounter} jobs`);
      console.log(`Memory per job: ${(memoryPerJob / 1024).toFixed(2)}KB`);
    });
  });

  describe('Database Operation Performance', () => {
    it('should benchmark MongoDB job persistence performance', async () => {
      const { metrics } = await measurePerformance(
        'MongoDB Job Persistence (200 inserts)',
        200,
        async () => {
          const jobData = {
            jobId: `db-perf-${Date.now()}-${Math.random()}`,
            jobType: JobType.MARKETPLACE_SYNC,
            queueName: 'sync.marketplace',
            routingKey: 'sync.marketplace.normal',
            userId: 'db-perf-user',
            workspaceId: 'db-perf-workspace',
            data: {
              marketplace: 'shopify',
              products: Array.from({ length: 10 }, (_, i) => ({
                id: `product-${i}`,
                name: `Product ${i}`,
                price: Math.random() * 100
              }))
            },
            status: 'queued' as const,
            progress: 0,
            attempts: 0,
            maxAttempts: 3,
            priority: JobPriority.NORMAL,
            createdAt: new Date()
          };

          return Job.create(jobData);
        }
      );

      expect(metrics.averageTime).toBeLessThan(25); // Less than 25ms per insert
      expect(metrics.throughput).toBeGreaterThan(40); // More than 40 inserts/sec

      // Verify all jobs were created
      const jobCount = await Job.countDocuments({ userId: 'db-perf-user' });
      expect(jobCount).toBe(200);
    });

    it('should benchmark complex job queries with filtering and sorting', async () => {
      // Create test data with various statuses and timestamps
      const testJobs = [];
      const statuses = ['queued', 'processing', 'completed', 'failed'] as const;
      
      for (let i = 0; i < 1000; i++) {
        testJobs.push({
          jobId: `query-perf-${i}`,
          jobType: i % 2 === 0 ? JobType.MARKETPLACE_SYNC : JobType.PRODUCT_BATCH,
          queueName: i % 2 === 0 ? 'sync.marketplace' : 'products.batch',
          routingKey: i % 2 === 0 ? 'sync.marketplace.normal' : 'products.batch.normal',
          userId: `user-${i % 10}`,
          workspaceId: `workspace-${i % 5}`,
          data: { queryIndex: i },
          status: statuses[i % 4],
          progress: Math.floor(Math.random() * 100),
          attempts: 0,
          maxAttempts: 3,
          priority: i % 3 === 0 ? JobPriority.HIGH : JobPriority.NORMAL,
          createdAt: new Date(Date.now() - i * 10000) // Spread over time
        });
      }

      await Job.create(testJobs);

      const { metrics } = await measurePerformance(
        'Complex Job Queries (100 queries)',
        100,
        async () => {
          const randomUserId = `user-${Math.floor(Math.random() * 10)}`;
          const randomWorkspaceId = `workspace-${Math.floor(Math.random() * 5)}`;
          
          return Job.find({
            userId: randomUserId,
            workspaceId: randomWorkspaceId,
            status: { $in: ['processing', 'completed'] }
          })
          .sort({ createdAt: -1 })
          .limit(50)
          .exec();
        }
      );

      expect(metrics.averageTime).toBeLessThan(50); // Less than 50ms per complex query
      expect(metrics.throughput).toBeGreaterThan(20); // More than 20 queries/sec
    });
  });

  describe('Comparison with Baseline Performance', () => {
    it('should establish performance baselines for system comparison', () => {
      const baselineMetrics = performanceResults.reduce((acc, metric) => {
        acc[metric.operationType] = {
          averageTime: metric.averageTime,
          throughput: metric.throughput,
          memoryEfficiency: metric.memoryUsage.increase / metric.totalOperations
        };
        return acc;
      }, {} as Record<string, any>);

      // Define acceptable performance thresholds
      const performanceThresholds = {
        'Bulk Job Creation (100 jobs)': { maxAvgTime: 50, minThroughput: 20 },
        'Concurrent Job Creation (50 jobs)': { maxTotalTime: 5000, minThroughput: 10 },
        'Job Status Queries (100 queries)': { maxAvgTime: 20, minThroughput: 50 },
        'Queue Statistics (50 calculations)': { maxAvgTime: 100, minThroughput: 10 },
        'MongoDB Job Persistence (200 inserts)': { maxAvgTime: 25, minThroughput: 40 },
        'Complex Job Queries (100 queries)': { maxAvgTime: 50, minThroughput: 20 }
      };

      Object.entries(performanceThresholds).forEach(([operation, thresholds]) => {
        const metrics = baselineMetrics[operation];
        if (metrics) {
          if (thresholds.maxAvgTime) {
            expect(metrics.averageTime).toBeLessThan(thresholds.maxAvgTime);
          }
          if (thresholds.minThroughput) {
            expect(metrics.throughput).toBeGreaterThan(thresholds.minThroughput);
          }
        }
      });

      // Log performance summary
      console.log('\nPerformance Baseline Established:');
      Object.entries(baselineMetrics).forEach(([operation, metrics]) => {
        console.log(`${operation}: ${metrics.averageTime.toFixed(2)}ms avg, ${metrics.throughput.toFixed(2)} ops/sec`);
      });
    });
  });
});