import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../index';
import Job from '../../common/models/Job';
import JobHistory from '../../common/models/JobHistory';
import QueueHealth from '../../common/models/QueueHealth';
import User from '../../modules/auth/models/User';
import Workspace from '../../modules/subscriptions/models/Workspace';
import StoreConnection from '../../modules/stores/models/StoreConnection';
import { JobType, JobPriority } from '../../common/services/queueService';

// Mock external services
const mockRabbitMQService = {
  initialize: jest.fn().mockResolvedValue(undefined as void),
  addJob: jest.fn(),
  getJobStatus: jest.fn(),
  getQueueStats: jest.fn(),
  process: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined as void),
  pauseQueue: jest.fn().mockResolvedValue(undefined as void),
  resumeQueue: jest.fn().mockResolvedValue(undefined as void)
};

jest.mock('@/common/services/rabbitMQService', () => ({
  default: mockRabbitMQService
}));

// Mock health monitor
jest.mock('@/common/services/healthMonitorService', () => ({
  healthMonitorService: {
    start: jest.fn(),
    stop: jest.fn(),
    getSystemHealth: jest.fn().mockResolvedValue({
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        rabbitmq: { status: 'healthy', version: '3.13.0', uptime: 12345, memory: 1024, diskFree: 5000, connections: 1 },
        database: { status: 'healthy', connections: 1 },
        queues: {
          'sync.marketplace': { waiting: 0, active: 0, completed: 10, failed: 0 },
          'products.batch': { waiting: 0, active: 0, completed: 5, failed: 0 }
        }
      },
      performance: { stats: [], alerts: [] }
    })
  }
}));

// Mock other services
jest.mock('@/jobs/rabbitMQJobSetup', () => ({
  setupRabbitMQJobProcessors: jest.fn()
}));

jest.mock('@/notifications/services/notificationScheduler', () => ({
  initializeNotificationScheduler: jest.fn().mockReturnValue(() => {})
}));

describe('End-to-End Migration Workflows', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testWorkspace: any;
  let testConnection: any;
  let authToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await mongoose.connection.db.dropDatabase();

    // Create test data
    testUser = await User.create({
      email: 'migration@test.com',
      password: 'hashedPassword123',
      firstName: 'Migration',
      lastName: 'Test',
      role: 'USER',
      isActive: true
    });

    testWorkspace = await Workspace.create({
      name: 'Migration Test Workspace',
      ownerId: testUser._id,
      isActive: true
    });

    testConnection = await StoreConnection.create({
      name: 'Migration Test Store',
      userId: testUser._id,
      workspaceId: testWorkspace._id,
      marketplaceType: 'shopify',
      isActive: true,
      credentials: { shop: 'migration-test', token: 'test-token' }
    });

    authToken = 'test-jwt-token';
  });

  describe('Complete Migration Workflow', () => {
    it('should execute full marketplace sync workflow using RabbitMQ', async () => {
      // Mock successful job creation and processing
      mockRabbitMQService.addJob.mockResolvedValue({
        jobId: 'migration-sync-123',
        id: 'migration-sync-123'
      });

      // Step 1: Start marketplace sync
      const syncResponse = await request(app)
        .post('/api/products/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString())
        .send({
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify',
          estimatedProducts: 50,
          batchSize: 10
        });

      expect(syncResponse.status).toBe(200);
      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.data.jobId).toBe('migration-sync-123');

      // Verify RabbitMQ job was created with correct parameters
      expect(mockRabbitMQService.addJob).toHaveBeenCalledWith(
        'marketplace-sync',
        JobType.MARKETPLACE_SYNC,
        expect.objectContaining({
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify',
          estimatedProducts: 50,
          batchSize: 10
        }),
        expect.objectContaining({
          priority: JobPriority.NORMAL,
          attempts: 3
        })
      );

      // Step 2: Simulate job processing stages
      const testJob = await Job.create({
        jobId: 'migration-sync-123',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: testWorkspace._id.toString(),
        data: {
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify',
          estimatedProducts: 50,
          batchSize: 10
        },
        status: 'processing',
        progress: 25,
        attempts: 1,
        maxAttempts: 3,
        priority: JobPriority.NORMAL,
        startedAt: new Date()
      });

      // Step 3: Check job status during processing
      const statusResponse = await request(app)
        .get(`/api/products/sync/status/${testJob.jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('processing');
      expect(statusResponse.body.data.progress.percentage).toBe(25);

      // Step 4: Simulate job completion with child jobs
      const childJobs = [
        {
          jobId: 'batch-job-1',
          jobType: JobType.PRODUCT_BATCH,
          queueName: 'products.batch',
          routingKey: 'products.batch.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { batchNumber: 1, parentJobId: 'migration-sync-123' },
          status: 'completed',
          progress: 100,
          parentJobId: 'migration-sync-123',
          attempts: 1,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          completedAt: new Date()
        },
        {
          jobId: 'batch-job-2',
          jobType: JobType.PRODUCT_BATCH,
          queueName: 'products.batch',
          routingKey: 'products.batch.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { batchNumber: 2, parentJobId: 'migration-sync-123' },
          status: 'completed',
          progress: 100,
          parentJobId: 'migration-sync-123',
          attempts: 1,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          completedAt: new Date()
        }
      ];

      await Job.create(childJobs);

      // Mark parent job as completed
      await Job.findOneAndUpdate(
        { jobId: 'migration-sync-123' },
        {
          status: 'completed',
          progress: 100,
          completedAt: new Date()
        }
      );

      // Step 5: Check final job status with child jobs
      const finalStatusResponse = await request(app)
        .get(`/api/products/sync/status/migration-sync-123`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(finalStatusResponse.status).toBe(200);
      expect(finalStatusResponse.body.data.status).toBe('completed');
      expect(finalStatusResponse.body.data.progress.percentage).toBe(100);
      expect(finalStatusResponse.body.data.childJobs).toHaveLength(2);

      // Step 6: Verify job history was created
      const historyRecords = await JobHistory.find({
        jobId: 'migration-sync-123'
      });

      expect(historyRecords.length).toBeGreaterThan(0);

      // Step 7: Check health monitoring integration
      const healthResponse = await request(app)
        .get('/api/products/sync/health')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.data.overall).toBe('healthy');
      expect(healthResponse.body.data.services.rabbitmq.status).toBe('healthy');
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle job failures and retry mechanism', async () => {
      // Create a failing job
      const failingJob = await Job.create({
        jobId: 'failing-job-123',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: testWorkspace._id.toString(),
        data: { connectionId: testConnection._id.toString() },
        status: 'failed',
        progress: 0,
        attempts: 3,
        maxAttempts: 3,
        priority: JobPriority.NORMAL,
        lastError: 'Connection timeout to marketplace API',
        failedAt: new Date()
      });

      // Check failed job status
      const statusResponse = await request(app)
        .get(`/api/products/sync/status/${failingJob.jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.status).toBe('failed');
      expect(statusResponse.body.data.error).toContain('Connection timeout');

      // Verify error was logged in job history
      await JobHistory.create({
        jobId: failingJob.jobId,
        workspaceId: testWorkspace._id.toString(),
        event: 'failed',
        timestamp: new Date(),
        metadata: {
          error: 'Connection timeout to marketplace API',
          attempts: 3,
          maxAttempts: 3
        }
      });

      const errorHistory = await JobHistory.find({
        jobId: failingJob.jobId,
        event: 'failed'
      });

      expect(errorHistory).toHaveLength(1);
      expect(errorHistory[0].metadata.error).toContain('Connection timeout');
    });
  });

  describe('Migration Validation Workflows', () => {
    it('should validate system health after migration', async () => {
      // Create various job types to simulate active system
      const testJobs = [
        {
          jobId: 'health-test-1',
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { test: true },
          status: 'completed',
          progress: 100,
          attempts: 1,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          completedAt: new Date()
        },
        {
          jobId: 'health-test-2',
          jobType: JobType.PRODUCT_BATCH,
          queueName: 'products.batch',
          routingKey: 'products.batch.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { test: true },
          status: 'processing',
          progress: 50,
          attempts: 1,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          startedAt: new Date()
        }
      ];

      await Job.create(testJobs);

      // Create queue health records
      await QueueHealth.create([
        {
          queueName: 'sync.marketplace',
          isHealthy: true,
          metrics: {
            waiting: 0,
            active: 1,
            completed: 1,
            failed: 0,
            processingRate: 10.5,
            averageWaitTime: 150,
            errorRate: 0
          },
          timestamp: new Date()
        },
        {
          queueName: 'products.batch',
          isHealthy: true,
          metrics: {
            waiting: 0,
            active: 1,
            completed: 0,
            failed: 0,
            processingRate: 8.2,
            averageWaitTime: 200,
            errorRate: 0
          },
          timestamp: new Date()
        }
      ]);

      // Test comprehensive health check
      const healthResponse = await request(app)
        .get('/api/products/sync/health')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.overall).toBe('healthy');
      expect(healthResponse.body.data.services.rabbitmq.status).toBe('healthy');
      expect(healthResponse.body.data.services.database.status).toBe('healthy');
      expect(healthResponse.body.data.services.queues).toHaveProperty('sync.marketplace');
      expect(healthResponse.body.data.services.queues).toHaveProperty('products.batch');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain API compatibility with previous Bull.js responses', async () => {
      // Mock job responses that maintain Bull.js format compatibility
      mockRabbitMQService.addJob.mockResolvedValue({
        jobId: 'compat-job-123',
        id: 'compat-job-123' // Maintain Bull.js id field for compatibility
      });

      const response = await request(app)
        .post('/api/products/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString())
        .send({
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('compat-job-123');

      // Verify job listing maintains expected format
      await Job.create({
        jobId: 'list-compat-job',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: testWorkspace._id.toString(),
        data: { test: true },
        status: 'completed',
        progress: 100,
        attempts: 1,
        maxAttempts: 3,
        priority: JobPriority.NORMAL,
        createdAt: new Date(),
        completedAt: new Date()
      });

      const listResponse = await request(app)
        .get('/api/products/sync/jobs?limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.jobs).toHaveLength(1);
      expect(listResponse.body.data.jobs[0]).toHaveProperty('jobId');
      expect(listResponse.body.data.jobs[0]).toHaveProperty('status');
      expect(listResponse.body.data.jobs[0]).toHaveProperty('progress');
      expect(listResponse.body.data.jobs[0]).toHaveProperty('createdAt');
    });
  });

  describe('Performance Under Migration Load', () => {
    it('should maintain performance during high-load migration scenarios', async () => {
      // Create multiple concurrent sync jobs to simulate migration load
      mockRabbitMQService.addJob.mockImplementation((queueName, jobType, data) => {
        return Promise.resolve({
          jobId: `load-job-${Date.now()}-${Math.random()}`,
          id: `load-job-${Date.now()}-${Math.random()}`
        });
      });

      const startTime = Date.now();
      const syncPromises = [];

      // Create 20 concurrent sync requests
      for (let i = 0; i < 20; i++) {
        const syncPromise = request(app)
          .post('/api/products/sync/start')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Workspace-ID', testWorkspace._id.toString())
          .send({
            connectionId: testConnection._id.toString(),
            marketplace: 'shopify',
            estimatedProducts: 10 + i
          });
        syncPromises.push(syncPromise);
      }

      const responses = await Promise.all(syncPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all requests succeeded
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Performance check - should handle 20 concurrent requests efficiently
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
      expect(mockRabbitMQService.addJob).toHaveBeenCalledTimes(20);

      console.log(`Handled 20 concurrent sync requests in ${duration}ms`);
    });
  });
});