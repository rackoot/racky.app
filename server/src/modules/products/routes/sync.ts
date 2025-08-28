import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect, requireWorkspace } from '@/common/middleware/auth';
import queueService, { 
  JobType, 
  JobPriority, 
  MarketplaceSyncJobData 
} from '@/common/services/queueService';
import { getJobProcessorHealth } from '@/jobs/jobSetup';
import StoreConnection from '@/stores/models/StoreConnection';

const router = express.Router();

// Validation schemas
const startSyncSchema = Joi.object({
  connectionId: Joi.string().required(),
  marketplace: Joi.string().required(),
  estimatedProducts: Joi.number().integer().min(1).default(1000),
  batchSize: Joi.number().integer().min(10).max(200).default(75),
});

interface StartSyncRequestBody {
  connectionId: string;
  marketplace: string;
  estimatedProducts?: number;
  batchSize?: number;
}

/**
 * POST /api/products/sync/start
 * Start a marketplace sync job - returns immediately with job ID
 */
router.post('/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = startSyncSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { connectionId, marketplace, estimatedProducts = 1000, batchSize = 75 } = req.body;
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    // Verify connection exists and belongs to user
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      userId: userId,
      marketplaceType: marketplace,
      isActive: true
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found or inactive'
      });
    }

    // Create marketplace sync job
    const syncJobData: MarketplaceSyncJobData = {
      userId,
      workspaceId,
      connectionId,
      marketplace,
      estimatedProducts,
      batchSize,
      createdAt: new Date(),
      priority: JobPriority.NORMAL,
    };

    const job = await queueService.addJob(
      'marketplace-sync',
      JobType.MARKETPLACE_SYNC,
      syncJobData,
      {
        priority: JobPriority.NORMAL,
        attempts: 3,
      }
    );

    // Estimate completion time (rough calculation)
    const estimatedMinutes = Math.ceil(estimatedProducts / (batchSize * 3)); // Assuming 3 batches process concurrently
    const estimatedTime = estimatedMinutes > 60 
      ? `${Math.ceil(estimatedMinutes / 60)} hours`
      : `${estimatedMinutes} minutes`;

    res.json({
      success: true,
      message: 'Sync job started successfully',
      data: {
        jobId: job.id!.toString(),
        estimatedProducts,
        batchSize,
        estimatedTime,
        status: 'queued',
        createdAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Error starting sync job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start sync job',
      error: error.message
    });
  }
});

/**
 * GET /api/products/sync/status/:jobId
 * Get sync job status and progress
 */
router.get('/status/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }

    // Get job status from marketplace-sync queue
    const jobStatus = await queueService.getJobStatus('marketplace-sync', jobId);

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Calculate ETA based on progress
    let eta = 'Calculating...';
    if (typeof jobStatus.progress === 'number' && jobStatus.progress > 0) {
      const remainingProgress = 100 - jobStatus.progress;
      const timeElapsed = jobStatus.processedOn 
        ? Date.now() - new Date(jobStatus.processedOn).getTime()
        : 0;
      
      if (timeElapsed > 0) {
        const timePerPercent = timeElapsed / jobStatus.progress;
        const remainingTime = (remainingProgress * timePerPercent) / 1000; // Convert to seconds
        
        if (remainingTime > 3600) {
          eta = `${Math.ceil(remainingTime / 3600)} hours remaining`;
        } else if (remainingTime > 60) {
          eta = `${Math.ceil(remainingTime / 60)} minutes remaining`;
        } else {
          eta = `${Math.ceil(remainingTime)} seconds remaining`;
        }
      }
    }

    // Format progress data
    let progressData = {
      current: 0,
      total: 100,
      percentage: 0,
    };

    if (typeof jobStatus.progress === 'object') {
      progressData = jobStatus.progress as any;
    } else if (typeof jobStatus.progress === 'number') {
      progressData = {
        current: jobStatus.progress,
        total: 100,
        percentage: jobStatus.progress,
      };
    }

    res.json({
      success: true,
      data: {
        jobId,
        status: jobStatus.status,
        progress: progressData,
        eta,
        result: jobStatus.result,
        failedReason: jobStatus.failedReason,
        createdAt: jobStatus.data.createdAt,
        processedOn: jobStatus.processedOn,
        finishedOn: jobStatus.finishedOn,
      }
    });

  } catch (error: any) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message
    });
  }
});

/**
 * GET /api/products/sync/health
 * Get overall queue health and statistics
 */
router.get('/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const health = await getJobProcessorHealth();

    res.json({
      success: true,
      data: {
        queues: health.queues,
        summary: {
          totalWaiting: health.totalJobs.waiting,
          totalActive: health.totalJobs.active,
          totalCompleted: health.totalJobs.completed,
          totalFailed: health.totalJobs.failed,
        },
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Error getting queue health:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get queue health',
      error: error.message
    });
  }
});

/**
 * GET /api/products/sync/jobs
 * Get user's sync jobs with optional filtering
 */
router.get('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const { status, limit = 10, offset = 0 } = req.query;

    // Get queue statistics for this user's jobs
    const marketplaceQueue = queueService.getQueue('marketplace-sync');
    
    // Get different job types based on status filter
    let jobs: any[] = [];
    
    if (!status || status === 'waiting') {
      const waitingJobs = await marketplaceQueue.getWaiting();
      const userJobs = waitingJobs.filter(job => job.data.userId === userId);
      jobs.push(...userJobs.map(job => ({
        id: job.id,
        status: 'waiting',
        data: job.data,
        createdAt: job.timestamp,
        progress: job.progress,
      })));
    }
    
    if (!status || status === 'active') {
      const activeJobs = await marketplaceQueue.getActive();
      const userJobs = activeJobs.filter(job => job.data.userId === userId);
      jobs.push(...userJobs.map(job => ({
        id: job.id,
        status: 'active',
        data: job.data,
        createdAt: job.timestamp,
        progress: job.progress,
        processedOn: job.processedOn,
      })));
    }
    
    if (!status || status === 'completed') {
      const completedJobs = await marketplaceQueue.getCompleted();
      const userJobs = completedJobs.filter(job => job.data.userId === userId);
      jobs.push(...userJobs.map(job => ({
        id: job.id,
        status: 'completed',
        data: job.data,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        result: job.returnvalue,
      })));
    }
    
    if (!status || status === 'failed') {
      const failedJobs = await marketplaceQueue.getFailed();
      const userJobs = failedJobs.filter(job => job.data.userId === userId);
      jobs.push(...userJobs.map(job => ({
        id: job.id,
        status: 'failed',
        data: job.data,
        createdAt: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
      })));
    }

    // Sort by creation date (newest first)
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const paginatedJobs = jobs.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      data: {
        jobs: paginatedJobs,
        total: jobs.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < jobs.length,
      }
    });

  } catch (error: any) {
    console.error('Error getting sync jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync jobs',
      error: error.message
    });
  }
});

export default router;