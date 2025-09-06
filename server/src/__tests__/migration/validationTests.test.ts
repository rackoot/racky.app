import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MigrationValidator } from '../../../scripts/validate-queue-migration.js';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
import QueueHealth from '@/common/models/QueueHealth';
import { JobType, JobPriority } from '@/common/services/queueService';

// Mock axios for RabbitMQ API calls
const mockAxios = {
  get: jest.fn()
};

jest.unstable_mockModule('axios', () => ({
  default: mockAxios
}));

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/racky-test';
process.env.RABBITMQ_MGMT_URL = 'http://localhost:15672';
process.env.RABBITMQ_USER = 'racky';
process.env.RABBITMQ_PASS = 'racky123';
process.env.BACKEND_URL = 'http://localhost:5000';

describe('Migration Validation Tests', () => {
  let mongoServer: MongoMemoryServer;
  let validator: MigrationValidator;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Override MongoDB URI for testing
    process.env.MONGODB_URI = mongoUri;
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    validator = new MigrationValidator();
    
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI!);
    await mongoose.connection.db.dropDatabase();
  });

  afterEach(async () => {
    await mongoose.disconnect();
  });

  describe('MongoDB Validation', () => {
    it('should validate MongoDB connection and collections', async () => {
      await validator.validateMongoDB();

      expect(validator.results.mongodb.status).toBe('success');
      expect(validator.results.mongodb.details).toContainEqual(
        expect.stringContaining('MongoDB connection successful')
      );
      expect(validator.results.mongodb.details).toContainEqual(
        expect.stringContaining('Collection "jobs" ready')
      );
      expect(validator.results.mongodb.details).toContainEqual(
        expect.stringContaining('Collection "jobhistories" ready')
      );
      expect(validator.results.mongodb.details).toContainEqual(
        expect.stringContaining('Collection "queuehealths" ready')
      );
    });

    it('should test CRUD operations on job collections', async () => {
      await validator.validateMongoDB();

      const details = validator.results.mongodb.details.join(' ');
      expect(details).toContain('Basic CRUD operations working');
    });

    it('should handle MongoDB connection failures', async () => {
      // Disconnect to simulate connection failure
      await mongoose.disconnect();
      
      // Override MongoDB URI with invalid URI
      const originalUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://invalid:27017/invalid';
      
      const failValidator = new MigrationValidator();
      await failValidator.validateMongoDB();

      expect(failValidator.results.mongodb.status).toBe('failed');
      expect(failValidator.results.mongodb.details).toContainEqual(
        expect.stringContaining('MongoDB validation failed')
      );

      // Restore original URI
      process.env.MONGODB_URI = originalUri;
    });
  });

  describe('RabbitMQ Validation', () => {
    it('should validate RabbitMQ management API connectivity', async () => {
      // Mock successful RabbitMQ API responses
      mockAxios.get
        .mockResolvedValueOnce({
          data: { rabbitmq_version: '3.13.0' }
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'racky.sync.exchange' },
            { name: 'racky.products.exchange' },
            { name: 'racky.ai.exchange' },
            { name: 'racky.updates.exchange' },
            { name: 'racky.dlx' }
          ]
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'sync.marketplace' },
            { name: 'products.batch' },
            { name: 'products.individual' },
            { name: 'ai.scan' },
            { name: 'ai.batch' },
            { name: 'updates.batch' },
            { name: 'racky.failed' }
          ]
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'connection-1', state: 'running' }
          ]
        });

      await validator.validateRabbitMQ();

      expect(validator.results.rabbitmq.status).toBe('success');
      expect(validator.results.rabbitmq.details).toContainEqual(
        expect.stringContaining('RabbitMQ Management API accessible')
      );
      expect(validator.results.rabbitmq.details).toContainEqual(
        expect.stringContaining('RabbitMQ version: 3.13.0')
      );
      
      // Check all required exchanges
      const requiredExchanges = [
        'racky.sync.exchange',
        'racky.products.exchange', 
        'racky.ai.exchange',
        'racky.updates.exchange',
        'racky.dlx'
      ];

      requiredExchanges.forEach(exchange => {
        expect(validator.results.rabbitmq.details).toContainEqual(
          expect.stringContaining(`Exchange "${exchange}" exists`)
        );
      });

      // Check all required queues
      const requiredQueues = [
        'sync.marketplace',
        'products.batch',
        'products.individual',
        'ai.scan',
        'ai.batch',
        'updates.batch',
        'racky.failed'
      ];

      requiredQueues.forEach(queue => {
        expect(validator.results.rabbitmq.details).toContainEqual(
          expect.stringContaining(`Queue "${queue}" exists`)
        );
      });
    });

    it('should handle missing RabbitMQ exchanges and queues', async () => {
      // Mock responses with missing exchanges and queues
      mockAxios.get
        .mockResolvedValueOnce({
          data: { rabbitmq_version: '3.13.0' }
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'racky.sync.exchange' }
            // Missing other exchanges
          ]
        })
        .mockResolvedValueOnce({
          data: [
            { name: 'sync.marketplace' }
            // Missing other queues
          ]
        })
        .mockResolvedValueOnce({
          data: []
        });

      await validator.validateRabbitMQ();

      expect(validator.results.rabbitmq.status).toBe('success');
      expect(validator.results.rabbitmq.details).toContainEqual(
        expect.stringContaining('Exchange "racky.products.exchange" missing')
      );
      expect(validator.results.rabbitmq.details).toContainEqual(
        expect.stringContaining('Queue "products.batch" missing')
      );
    });

    it('should handle RabbitMQ connectivity failures', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection refused'));

      await validator.validateRabbitMQ();

      expect(validator.results.rabbitmq.status).toBe('failed');
      expect(validator.results.rabbitmq.details).toContainEqual(
        expect.stringContaining('RabbitMQ validation failed: Connection refused')
      );
    });
  });

  describe('Application Integration Validation', () => {
    it('should validate health endpoint integration', async () => {
      // Mock successful health endpoint response
      mockAxios.get
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              overall: 'healthy',
              services: {
                rabbitmq: { status: 'healthy' },
                database: { status: 'healthy' }
              }
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { jobs: [], total: 0 }
          }
        });

      await validator.validateApplication();

      expect(validator.results.application.status).toBe('success');
      expect(validator.results.application.details).toContainEqual(
        expect.stringContaining('Health endpoint responding')
      );
      expect(validator.results.application.details).toContainEqual(
        expect.stringContaining('Overall system health: healthy')
      );
      expect(validator.results.application.details).toContainEqual(
        expect.stringContaining('RabbitMQ integration: healthy')
      );
    });

    it('should handle application endpoint failures', async () => {
      mockAxios.get.mockRejectedValue(new Error('Service unavailable'));

      await validator.validateApplication();

      expect(validator.results.application.status).toBe('failed');
      expect(validator.results.application.details).toContainEqual(
        expect.stringContaining('Application validation failed: Service unavailable')
      );
    });
  });

  describe('Performance Validation', () => {
    it('should validate database performance with job data', async () => {
      // Create test job data for performance testing
      const testJobs = [];
      for (let i = 0; i < 100; i++) {
        testJobs.push({
          jobId: `perf-test-${i}`,
          jobType: JobType.MARKETPLACE_SYNC,
          queueName: 'sync.marketplace',
          routingKey: 'sync.marketplace.normal',
          userId: `user-${i % 10}`,
          workspaceId: `workspace-${i % 5}`,
          data: { test: true, index: i },
          status: i % 4 === 0 ? 'completed' : i % 4 === 1 ? 'processing' : i % 4 === 2 ? 'failed' : 'queued',
          progress: i % 4 === 0 ? 100 : Math.floor(Math.random() * 100),
          attempts: 0,
          maxAttempts: 3,
          priority: JobPriority.NORMAL,
          createdAt: new Date(Date.now() - i * 1000)
        });
      }

      await Job.create(testJobs);

      // Create queue health records
      await QueueHealth.create([
        {
          queueName: 'sync.marketplace',
          isHealthy: true,
          metrics: {
            waiting: 10,
            active: 2,
            completed: 50,
            failed: 5,
            processingRate: 12.5,
            averageWaitTime: 250,
            errorRate: 0.1
          },
          timestamp: new Date()
        },
        {
          queueName: 'products.batch',
          isHealthy: true,
          metrics: {
            waiting: 5,
            active: 1,
            completed: 30,
            failed: 2,
            processingRate: 8.3,
            averageWaitTime: 180,
            errorRate: 0.05
          },
          timestamp: new Date()
        }
      ]);

      // Create job history records
      const historyRecords = testJobs.slice(0, 20).map((job, index) => ({
        jobId: job.jobId,
        workspaceId: job.workspaceId,
        event: index % 3 === 0 ? 'created' : index % 3 === 1 ? 'started' : 'completed',
        timestamp: new Date(Date.now() - index * 2000),
        metadata: { test: true }
      }));

      await JobHistory.create(historyRecords);

      await validator.validatePerformance();

      expect(validator.results.performance.status).toBe('success');
      expect(validator.results.performance.details).toContainEqual(
        expect.stringMatching(/Database query performance: \d+ms/)
      );
      expect(validator.results.performance.details).toContainEqual(
        expect.stringContaining('Queue health records: 2')
      );
      expect(validator.results.performance.details).toContainEqual(
        expect.stringContaining('Job history records: 20')
      );
    });

    it('should detect slow database performance', async () => {
      // Mock slow database query by adding delay
      const originalFind = mongoose.connection.db.collection;
      mongoose.connection.db.collection = jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            toArray: jest.fn().mockImplementation(() => {
              return new Promise(resolve => {
                setTimeout(() => resolve([]), 1500); // 1.5 second delay
              });
            })
          })
        }),
        countDocuments: jest.fn().mockResolvedValue(0)
      });

      await validator.validatePerformance();

      expect(validator.results.performance.details).toContainEqual(
        expect.stringContaining('Database queries are slow (>1s)')
      );

      // Restore original method
      mongoose.connection.db.collection = originalFind;
    });
  });

  describe('Complete Migration Report', () => {
    it('should generate comprehensive migration report', async () => {
      // Mock all successful validations
      mockAxios.get
        .mockResolvedValueOnce({ data: { rabbitmq_version: '3.13.0' } })
        .mockResolvedValueOnce({ data: [] }) // exchanges
        .mockResolvedValueOnce({ data: [] }) // queues  
        .mockResolvedValueOnce({ data: [] }) // connections
        .mockResolvedValueOnce({ 
          data: { 
            success: true, 
            data: { 
              overall: 'healthy',
              services: {
                rabbitmq: { status: 'healthy' },
                database: { status: 'healthy' }
              }
            }
          } 
        })
        .mockResolvedValueOnce({ data: { success: true } });

      // Run all validations
      await validator.validateMongoDB();
      await validator.validateRabbitMQ();
      await validator.validateApplication();  
      await validator.validatePerformance();

      const isValid = await validator.generateReport();

      // Verify report generation
      expect(typeof isValid).toBe('boolean');
      
      // Check that results were populated
      expect(validator.results.mongodb.status).toMatch(/success|failed/);
      expect(validator.results.rabbitmq.status).toMatch(/success|failed/);
      expect(validator.results.application.status).toMatch(/success|failed/);
      expect(validator.results.performance.status).toMatch(/success|failed/);

      // Verify report was saved to database
      const reports = await mongoose.connection.db.collection('migrationreports').find({}).toArray();
      expect(reports.length).toBe(1);
      expect(reports[0].type).toBe('validation');
      expect(reports[0]).toHaveProperty('results');
      expect(reports[0]).toHaveProperty('overallStatus');
    });

    it('should handle partial validation failures', async () => {
      // Simulate MongoDB success but RabbitMQ failure
      mockAxios.get.mockRejectedValue(new Error('RabbitMQ unavailable'));

      await validator.validateMongoDB();
      await validator.validateRabbitMQ();

      expect(validator.results.mongodb.status).toBe('success');
      expect(validator.results.rabbitmq.status).toBe('failed');

      const isValid = await validator.generateReport();
      expect(isValid).toBe(false);
    });
  });

  describe('Migration Status Emoji Helper', () => {
    it('should return correct emojis for different statuses', () => {
      expect(validator.getStatusEmoji('success')).toBe('✅');
      expect(validator.getStatusEmoji('failed')).toBe('❌');
      expect(validator.getStatusEmoji('pending')).toBe('⏳');
      expect(validator.getStatusEmoji('unknown')).toBe('❓');
    });
  });
});