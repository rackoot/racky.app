import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import { protect, requireWorkspace } from '@/common/middleware/auth';
import {
  JobType,
  JobPriority,
  MarketplaceSyncJobData
} from '@/common/types/jobTypes';
import { ProductSyncFilters } from '@/common/types/syncFilters';
import rabbitMQService from '@/common/services/rabbitMQService';
import { healthMonitorService } from '@/common/services/healthMonitorService';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
import StoreConnection from '@/stores/models/StoreConnection';

const router = express.Router();

// Validation schemas
const startSyncSchema = Joi.object({
  connectionId: Joi.string().required(),
  marketplace: Joi.string().required(),
  estimatedProducts: Joi.number().integer().min(1).default(1000),
  batchSize: Joi.number().integer().min(10).max(200).default(75),
  filters: Joi.object({
    includeActive: Joi.boolean().default(true),
    includeInactive: Joi.boolean().default(false),
    categoryIds: Joi.array().items(Joi.string()).allow(null).default(null),
    brandIds: Joi.array().items(Joi.string()).allow(null).default(null),
  }).optional(),
});

interface StartSyncRequestBody {
  connectionId: string;
  marketplace: string;
  estimatedProducts?: number;
  batchSize?: number;
  filters?: ProductSyncFilters;
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

    const { connectionId, marketplace, estimatedProducts = 1000, batchSize = 75, filters } = req.body;
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    // Verify connection exists and belongs to workspace
    const connection = await StoreConnection.findOne({
      _id: connectionId,
      workspaceId: req.workspace!._id
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Store connection not found'
      });
    }

    // Verify connection is active
    if (!connection.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Store connection is not active'
      });
    }

    // Verify marketplace type matches
    if (connection.marketplaceType !== marketplace) {
      return res.status(400).json({
        success: false,
        message: `Marketplace type mismatch. Connection is for ${connection.marketplaceType}, but ${marketplace} was requested.`
      });
    }

    // Check for existing active jobs for this connection
    const existingJob = await Job.findOne({
      workspaceId: req.workspace!._id.toString(),
      'data.connectionId': connectionId,
      jobType: JobType.MARKETPLACE_SYNC,
      status: { $in: ['queued', 'processing'] }
    }).sort({ createdAt: -1 });

    if (existingJob) {
      return res.status(409).json({
        success: false,
        message: 'A sync job is already in progress for this connection',
        data: {
          existingJobId: existingJob.jobId,
          status: existingJob.status,
          progress: existingJob.progress,
          createdAt: existingJob.createdAt
        }
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
      filters,
      createdAt: new Date(),
      priority: JobPriority.NORMAL,
    };

    const job = await rabbitMQService.addJob(
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
        jobId: job.jobId,
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

    // Get job from MongoDB with workspace validation
    const job = await Job.findOne({ 
      jobId,
      workspaceId: req.workspace!._id.toString()
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Get child jobs if this is a parent job
    const childJobs = await Job.find({
      parentJobId: jobId,
      workspaceId: req.workspace!._id.toString()
    });

    // Extract metadata for product counts
    const metadata = job.metadata || {};
    const estimatedTotal = metadata.estimatedTotal || 0;
    const totalProducts = metadata.totalProducts || 0;
    const syncedProducts = metadata.syncedProducts || 0;

    // Use job.progress directly (now product-based)
    const overallProgress = job.progress;

    // Calculate ETA based on progress
    let eta = 'Calculating...';
    if (overallProgress > 0 && job.startedAt) {
      const remainingProgress = 100 - overallProgress;
      const timeElapsed = Date.now() - job.startedAt.getTime();

      if (timeElapsed > 0) {
        const timePerPercent = timeElapsed / overallProgress;
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

    // Format progress data with product counts
    const progressData = {
      current: overallProgress,
      total: 100,
      percentage: overallProgress,
      // Product-based progress information
      estimatedTotal,           // Early estimate from first API call
      totalProducts,            // Exact count after fetching all IDs
      syncedProducts,           // Number of products synced so far
    };

    res.json({
      success: true,
      data: {
        jobId,
        status: job.status,
        progress: progressData,
        eta,
        result: job.result,
        failedReason: job.lastError,
        createdAt: job.createdAt,
        processedOn: job.startedAt,
        finishedOn: job.completedAt,
        childJobs: childJobs.length > 0 ? childJobs.map(child => ({
          jobId: child.jobId,
          status: child.status,
          progress: child.progress,
          jobType: child.jobType
        })) : undefined
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
    const systemHealth = await healthMonitorService.getSystemHealth();

    res.json({
      success: true,
      data: {
        overall: systemHealth.overall,
        services: systemHealth.services,
        performance: systemHealth.performance,
        timestamp: systemHealth.timestamp,
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
    const workspaceId = req.workspace!._id.toString();
    const { status, limit = 10, offset = 0 } = req.query;

    // Build query filter
    const filter: any = { 
      userId, 
      workspaceId,
      jobType: { $in: [JobType.MARKETPLACE_SYNC, JobType.PRODUCT_BATCH] } // Sync-related jobs
    };
    
    if (status && status !== 'all') {
      if (status === 'waiting') {
        filter.status = 'queued';
      } else if (status === 'active') {
        filter.status = 'processing';
      } else {
        filter.status = status;
      }
    }

    // Get jobs with pagination from MongoDB
    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .select('jobId jobType status progress createdAt startedAt completedAt result lastError data parentJobId')
        .lean(),
      Job.countDocuments(filter)
    ]);

    // Format jobs for API response
    const formattedJobs = jobs.map(job => ({
      id: job.jobId,
      jobId: job.jobId,
      type: job.jobType,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      processedOn: job.startedAt,
      finishedOn: job.completedAt,
      result: job.result,
      failedReason: job.lastError,
      data: {
        marketplace: job.data.marketplace,
        connectionId: job.data.connectionId,
        estimatedProducts: job.data.estimatedProducts,
        batchSize: job.data.batchSize
      },
      isParent: !job.parentJobId
    }));

    res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
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