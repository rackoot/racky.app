import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '@/index';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
import User from '@/auth/models/User';
import Workspace from '@/subscriptions/models/Workspace';
import StoreConnection from '@/stores/models/StoreConnection';
import { JobType, JobPriority } from '@/common/services/queueService';

// Mock RabbitMQ service
const mockRabbitMQService = {
  initialize: jest.fn().mockResolvedValue(undefined),
  addJob: jest.fn(),
  getJobStatus: jest.fn(),
  getQueueStats: jest.fn(),
  process: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined)
};

jest.mock('@/common/services/rabbitMQService', () => ({
  default: mockRabbitMQService
}));

// Mock health monitor service
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
        queues: {}
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

describe('Job Processing Integration', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let testWorkspace: any;
  let testConnection: any;
  let authToken: string;

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Clear database
    await mongoose.connection.db.dropDatabase();

    // Create test user and workspace
    testUser = await User.create({
      email: 'test@example.com',
      password: 'hashedPassword123',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      isActive: true
    });

    testWorkspace = await Workspace.create({
      name: 'Test Workspace',
      ownerId: testUser._id,
      isActive: true
    });

    testConnection = await StoreConnection.create({
      name: 'Test Store',
      userId: testUser._id,
      workspaceId: testWorkspace._id,
      marketplaceType: 'shopify',
      isActive: true,
      credentials: { shop: 'test-shop', token: 'test-token' }
    });

    // Generate auth token (simplified for testing)
    authToken = 'test-jwt-token';
  });

  describe('Job Creation Flow', () => {
    it('should create marketplace sync job successfully', async () => {
      mockRabbitMQService.addJob.mockResolvedValue({
        jobId: 'test-job-123',
        id: 'test-job-123'
      });

      const response = await request(app)
        .post('/api/products/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString())
        .send({
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify',
          estimatedProducts: 100,
          batchSize: 25
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBe('test-job-123');

      expect(mockRabbitMQService.addJob).toHaveBeenCalledWith(
        'marketplace-sync',
        JobType.MARKETPLACE_SYNC,
        expect.objectContaining({
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify',
          estimatedProducts: 100,
          batchSize: 25
        }),
        expect.objectContaining({
          priority: JobPriority.NORMAL,
          attempts: 3
        })
      );
    });

    it('should validate connection ownership', async () => {
      // Create another user's connection
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'hashedPassword123',
        firstName: 'Other',
        lastName: 'User',
        role: 'USER',
        isActive: true
      });

      const otherConnection = await StoreConnection.create({
        name: 'Other Store',
        userId: otherUser._id,
        workspaceId: testWorkspace._id,
        marketplaceType: 'shopify',
        isActive: true,
        credentials: { shop: 'other-shop', token: 'other-token' }
      });

      const response = await request(app)
        .post('/api/products/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString())
        .send({
          connectionId: otherConnection._id.toString(),
          marketplace: 'shopify'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(mockRabbitMQService.addJob).not.toHaveBeenCalled();
    });
  });

  describe('Job Status Tracking', () => {
    it('should get job status from MongoDB', async () => {
      const testJob = await Job.create({
        jobId: 'test-job-123',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: testWorkspace._id.toString(),
        data: { marketplace: 'shopify' },
        status: 'processing',
        progress: 75,
        attempts: 1,
        maxAttempts: 3,
        priority: JobPriority.NORMAL,
        startedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/products/sync/status/${testJob.jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        jobId: 'test-job-123',
        status: 'processing',
        progress: {
          current: 75,
          total: 100,
          percentage: 75
        }
      });
    });

    it('should calculate progress from child jobs', async () => {
      const parentJob = await Job.create({
        jobId: 'parent-job-123',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: testWorkspace._id.toString(),
        data: { marketplace: 'shopify' },
        status: 'processing',
        progress: 0,
        attempts: 0,
        maxAttempts: 3,
        priority: JobPriority.NORMAL
      });

      // Create child jobs
      await Job.create([
        {
          jobId: 'child-job-1',
          jobType: JobType.PRODUCT_BATCH,
          queueName: 'products.batch',
          routingKey: 'products.batch.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { batchNumber: 1 },
          status: 'completed',
          progress: 100,
          parentJobId: 'parent-job-123',
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL
        },
        {
          jobId: 'child-job-2',
          jobType: JobType.PRODUCT_BATCH,
          queueName: 'products.batch',
          routingKey: 'products.batch.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { batchNumber: 2 },
          status: 'processing',
          progress: 50,
          parentJobId: 'parent-job-123',
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL
        }
      ]);

      const response = await request(app)
        .get(`/api/products/sync/status/parent-job-123`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.data.progress.percentage).toBe(75); // (100 + 50) / 2
      expect(response.body.data.childJobs).toHaveLength(2);
    });

    it('should enforce workspace isolation for job status', async () => {
      const otherWorkspace = await Workspace.create({
        name: 'Other Workspace',
        ownerId: testUser._id,
        isActive: true
      });

      await Job.create({
        jobId: 'other-workspace-job',
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        routingKey: 'sync.marketplace.normal',
        userId: testUser._id.toString(),
        workspaceId: otherWorkspace._id.toString(),
        data: { marketplace: 'shopify' },
        status: 'completed',
        progress: 100,
        attempts: 0,
        maxAttempts: 3,
        priority: JobPriority.NORMAL
      });

      const response = await request(app)
        .get('/api/products/sync/status/other-workspace-job')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Job Listing', () => {
    it('should list user jobs with pagination', async () => {
      // Create test jobs
      const jobs = [];
      for (let i = 0; i < 15; i++) {
        jobs.push({
          jobId: `test-job-${i}`,
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { marketplace: 'shopify', batchNumber: i },
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'processing' : 'queued',
          progress: i % 3 === 0 ? 100 : i % 3 === 1 ? 50 : 0,
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          createdAt: new Date(Date.now() - i * 1000) // Spread creation times
        });
      }
      await Job.create(jobs);

      const response = await request(app)
        .get('/api/products/sync/jobs?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toHaveLength(10);
      expect(response.body.data.total).toBe(15);
      expect(response.body.data.hasMore).toBe(true);

      // Verify jobs are sorted by creation date (newest first)
      const jobCreationTimes = response.body.data.jobs.map((job: any) => new Date(job.createdAt).getTime());
      for (let i = 1; i < jobCreationTimes.length; i++) {
        expect(jobCreationTimes[i]).toBeLessThanOrEqual(jobCreationTimes[i - 1]);
      }
    });

    it('should filter jobs by status', async () => {
      await Job.create([
        {
          jobId: 'completed-job',
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { marketplace: 'shopify' },
          status: 'completed',
          progress: 100,
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL
        },
        {
          jobId: 'processing-job',
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: testUser._id.toString(),
          workspaceId: testWorkspace._id.toString(),
          data: { marketplace: 'shopify' },
          status: 'processing',
          progress: 50,
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL
        }
      ]);

      const response = await request(app)
        .get('/api/products/sync/jobs?status=completed')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.data.jobs).toHaveLength(1);
      expect(response.body.data.jobs[0].status).toBe('completed');
    });
  });

  describe('Health Monitoring', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/products/sync/health')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBe('healthy');
      expect(response.body.data.services.rabbitmq.status).toBe('healthy');
      expect(response.body.data.services.database.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle RabbitMQ service failures', async () => {
      mockRabbitMQService.addJob.mockRejectedValue(new Error('RabbitMQ connection failed'));

      const response = await request(app)
        .post('/api/products/sync/start')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString())
        .send({
          connectionId: testConnection._id.toString(),
          marketplace: 'shopify'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to start sync job');
    });

    it('should handle invalid job IDs', async () => {
      const response = await request(app)
        .get('/api/products/sync/status/invalid-job-id')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Workspace-ID', testWorkspace._id.toString());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Job not found');
    });
  });
});