import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import queueService, { 
  JobType, 
  JobPriority, 
  AIOptimizationScanJobData 
} from '@/common/services/queueService';

const router = express.Router();

// Validation schemas
const startAIScanSchema = Joi.object({
  marketplace: Joi.string().optional(),
  minDescriptionLength: Joi.number().integer().min(0).optional(),
  maxDescriptionLength: Joi.number().integer().min(1).optional(),
  createdAfter: Joi.date().optional(),
});

interface StartAIScanRequestBody {
  marketplace?: string;
  minDescriptionLength?: number;
  maxDescriptionLength?: number;
  createdAfter?: Date;
}

/**
 * POST /api/opportunities/ai/scan
 * Start an AI optimization scan job - returns immediately with job ID
 */
router.post('/scan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { error } = startAIScanSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { marketplace, minDescriptionLength, maxDescriptionLength, createdAfter } = req.body;
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    // Create AI optimization scan job
    const scanJobData: AIOptimizationScanJobData = {
      userId,
      workspaceId,
      filters: {
        marketplace,
        minDescriptionLength,
        maxDescriptionLength,
        createdAfter,
      },
      createdAt: new Date(),
      priority: JobPriority.NORMAL,
    };

    const job = await queueService.addJob(
      'ai-optimization',
      JobType.AI_OPTIMIZATION_SCAN,
      scanJobData,
      {
        priority: JobPriority.NORMAL,
        attempts: 2,
      }
    );

    res.json({
      success: true,
      message: 'AI optimization scan started successfully',
      data: {
        jobId: job.id!.toString(),
        status: 'queued',
        filters: scanJobData.filters,
        createdAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('Error starting AI optimization scan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start AI optimization scan',
      error: error.message
    });
  }
});

/**
 * GET /api/opportunities/ai/status/:jobId
 * Get AI optimization job status and progress
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

    // Get job status from ai-optimization queue
    const jobStatus = await queueService.getJobStatus('ai-optimization', jobId);

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
    console.error('Error getting AI optimization status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI optimization status',
      error: error.message
    });
  }
});

/**
 * GET /api/opportunities/ai/jobs
 * Get user's AI optimization jobs with optional filtering
 */
router.get('/jobs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const { status, limit = 10, offset = 0 } = req.query;

    // Get queue statistics for this user's jobs
    const aiQueue = queueService.getQueue('ai-optimization');
    
    // Get different job types based on status filter
    let jobs: any[] = [];
    
    if (!status || status === 'waiting') {
      const waitingJobs = await aiQueue.getWaiting();
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
      const activeJobs = await aiQueue.getActive();
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
      const completedJobs = await aiQueue.getCompleted();
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
      const failedJobs = await aiQueue.getFailed();
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
    console.error('Error getting AI optimization jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI optimization jobs',
      error: error.message
    });
  }
});

export default router;