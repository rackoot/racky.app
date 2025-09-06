import { jest } from '@jest/globals';
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
  consume: jest.fn().mockResolvedValue({}),
  ack: jest.fn(),
  nack: jest.fn(),
  cancel: jest.fn().mockResolvedValue({}),
  close: jest.fn().mockResolvedValue(undefined),
  prefetch: jest.fn().mockResolvedValue(undefined)
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn()
};

// Mock the amqplib module
jest.unstable_mockModule('amqplib', () => ({
  connect: jest.fn().mockResolvedValue(mockConnection)
}));

// Mock mongoose models
jest.mock('@/common/models/Job', () => ({
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn()
  }
}));

jest.mock('@/common/models/JobHistory', () => ({
  default: {
    createEvent: jest.fn().mockResolvedValue({ _id: 'history-id' })
  }
}));

// Mock environment config
jest.mock('@/common/config/env', () => ({
  default: () => ({
    RABBITMQ_URL: 'amqp://test:test@localhost:5672/test'
  })
}));

describe('RabbitMQService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await rabbitMQService.initialize();
      
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(1);
      expect(mockChannel.assertExchange).toHaveBeenCalledTimes(5); // 5 exchanges
      expect(mockChannel.assertQueue).toHaveBeenCalledTimes(7); // 7 queues
    });

    it('should setup connection event handlers', async () => {
      await rabbitMQService.initialize();
      
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await rabbitMQService.initialize();
      jest.clearAllMocks();
      
      await rabbitMQService.initialize();
      
      expect(mockConnection.createChannel).not.toHaveBeenCalled();
    });
  });

  describe('job publishing', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
      jest.clearAllMocks();
    });

    it('should publish job successfully', async () => {
      const mockJob = { _id: 'job-id', jobId: 'test-job-123' };
      (Job.create as jest.Mock).mockResolvedValue(mockJob);

      const jobData = {
        userId: 'user123',
        workspaceId: 'workspace123',
        connectionId: 'connection123',
        marketplace: 'shopify',
        createdAt: new Date(),
        priority: JobPriority.NORMAL
      };

      const result = await rabbitMQService.addJob(
        'marketplace-sync',
        JobType.MARKETPLACE_SYNC,
        jobData
      );

      expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({
        jobId: expect.any(String),
        jobType: JobType.MARKETPLACE_SYNC,
        queueName: 'sync.marketplace',
        userId: 'user123',
        workspaceId: 'workspace123',
        status: 'queued'
      }));

      expect(JobHistory.createEvent).toHaveBeenCalledWith(
        expect.any(String),
        'workspace123',
        'created',
        expect.any(Object)
      );

      expect(mockChannel.publish).toHaveBeenCalledWith(
        'racky.sync.exchange',
        'sync.marketplace.normal',
        expect.any(Buffer),
        expect.objectContaining({
          persistent: true,
          priority: 5
        })
      );

      expect(result.jobId).toBe('test-job-123');
    });

    it('should handle job publishing failure', async () => {
      mockChannel.publish.mockReturnValue(false);

      const jobData = {
        userId: 'user123',
        workspaceId: 'workspace123',
        createdAt: new Date(),
        priority: JobPriority.NORMAL
      };

      await expect(
        rabbitMQService.addJob('marketplace-sync', JobType.MARKETPLACE_SYNC, jobData)
      ).rejects.toThrow('Failed to publish message to RabbitMQ');
    });

    it('should map job types to correct queues', async () => {
      (Job.create as jest.Mock).mockResolvedValue({ _id: 'job-id', jobId: 'test-job-123' });

      const testCases = [
        { queueName: 'marketplace-sync', jobType: JobType.MARKETPLACE_SYNC, expectedQueue: 'sync.marketplace' },
        { queueName: 'product-processing', jobType: JobType.PRODUCT_BATCH, expectedQueue: 'products.batch' },
        { queueName: 'ai-optimization', jobType: JobType.AI_OPTIMIZATION_SCAN, expectedQueue: 'ai.scan' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        await rabbitMQService.addJob(testCase.queueName, testCase.jobType, {
          userId: 'user123',
          workspaceId: 'workspace123',
          createdAt: new Date(),
          priority: JobPriority.NORMAL
        });

        expect(Job.create).toHaveBeenCalledWith(expect.objectContaining({
          queueName: testCase.expectedQueue
        }));
      }
    });
  });

  describe('job status retrieval', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should get job status successfully', async () => {
      const mockJob = {
        jobId: 'test-job-123',
        status: 'completed',
        progress: 100,
        data: { test: true },
        result: { success: true },
        lastError: null,
        completedAt: new Date(),
        startedAt: new Date()
      };

      (Job.findOne as jest.Mock).mockResolvedValue(mockJob);

      const result = await rabbitMQService.getJobStatus('marketplace-sync', 'test-job-123');

      expect(Job.findOne).toHaveBeenCalledWith({ jobId: 'test-job-123' });
      expect(result).toEqual({
        status: 'completed',
        progress: 100,
        data: { test: true },
        result: { success: true },
        failedReason: null,
        finishedOn: mockJob.completedAt,
        processedOn: mockJob.startedAt
      });
    });

    it('should return null for non-existent job', async () => {
      (Job.findOne as jest.Mock).mockResolvedValue(null);

      const result = await rabbitMQService.getJobStatus('marketplace-sync', 'non-existent-job');

      expect(result).toBeNull();
    });
  });

  describe('queue statistics', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
    });

    it('should get queue statistics successfully', async () => {
      (Job.countDocuments as jest.Mock)
        .mockResolvedValueOnce(5)  // waiting
        .mockResolvedValueOnce(2)  // active
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(3); // failed

      const result = await rabbitMQService.getQueueStats('marketplace-sync');

      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 0
      });
    });

    it('should handle queue statistics errors gracefully', async () => {
      (Job.countDocuments as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await rabbitMQService.getQueueStats('marketplace-sync');

      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      });
    });
  });

  describe('job processing', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
      jest.clearAllMocks();
    });

    it('should register job processor', () => {
      const mockProcessor = jest.fn();
      
      rabbitMQService.process(
        'marketplace-sync',
        JobType.MARKETPLACE_SYNC,
        1,
        mockProcessor
      );

      expect(mockChannel.consume).toHaveBeenCalledWith(
        'sync.marketplace',
        expect.any(Function),
        { consumerTag: 'sync.marketplace-MARKETPLACE_SYNC-0' }
      );
    });
  });

  describe('queue management', () => {
    beforeEach(async () => {
      await rabbitMQService.initialize();
      jest.clearAllMocks();
    });

    it('should pause queue by cancelling consumers', async () => {
      // First setup a consumer
      rabbitMQService.process('marketplace-sync', JobType.MARKETPLACE_SYNC, 1, jest.fn());
      jest.clearAllMocks();

      await rabbitMQService.pauseQueue('sync.marketplace');

      expect(mockChannel.cancel).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await rabbitMQService.initialize();
      
      await rabbitMQService.shutdown();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should handle shutdown errors', async () => {
      await rabbitMQService.initialize();
      mockChannel.close.mockRejectedValue(new Error('Close error'));

      // Should not throw
      await rabbitMQService.shutdown();

      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle initialization failure', async () => {
      const amqp = await import('amqplib');
      (amqp.connect as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(rabbitMQService.shutdown()).resolves.not.toThrow();
      
      await expect(rabbitMQService.initialize()).rejects.toThrow('Connection failed');
    });
  });
});