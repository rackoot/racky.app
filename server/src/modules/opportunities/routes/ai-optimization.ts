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
 * GET /api/opportunities/ai/job/:jobId/details
 * Get detailed information about a specific AI optimization job including products processed
 */
router.get('/job/:jobId/details', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();
    const { jobId } = req.params;

    // Get the job from the queue
    const aiQueue = queueService.getQueue('ai-optimization');
    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify job belongs to user
    if (job.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this job'
      });
    }

    // Get product history entries for this job
    const ProductHistory = (await import('@/products/models/ProductHistory')).default;
    const Product = (await import('@/products/models/Product')).default;
    
    // Find all products that were part of this scan
    const historyEntries = await ProductHistory.find({
      workspaceId,
      relatedJobId: jobId,
      actionType: { $in: ['AI_OPTIMIZATION_GENERATED', 'AI_BULK_SCAN_STARTED', 'AI_BULK_SCAN_COMPLETED'] }
    })
    .populate('productId', 'title externalId marketplace images')
    .sort({ createdAt: 1 })
    .lean();

    // Get child batch jobs if this is a scan job
    let batchJobs: any[] = [];
    if (job.name === 'AI_OPTIMIZATION_SCAN' && job.returnvalue) {
      // Find batch jobs created by this scan
      const allJobs = await aiQueue.getJobs(['completed', 'failed', 'active', 'waiting']);
      batchJobs = allJobs
        .filter(j => j.data.parentJobId === jobId && j.name === 'AI_DESCRIPTION_BATCH')
        .map(j => ({
          id: j.id,
          status: j.finishedOn ? 'completed' : j.processedOn ? 'active' : 'waiting',
          batchNumber: j.data.batchNumber,
          totalBatches: j.data.totalBatches,
          productCount: j.data.productIds?.length || 0,
          progress: j.progress,
          result: j.returnvalue,
          failedReason: j.failedReason,
          createdAt: j.timestamp,
          finishedOn: j.finishedOn
        }));
    }

    // Group products by status
    const products = historyEntries.reduce((acc: any, entry: any) => {
      if (!entry.productId) return acc;
      
      const productKey = entry.productId._id.toString();
      if (!acc[productKey]) {
        acc[productKey] = {
          id: entry.productId._id,
          title: entry.productId.title,
          externalId: entry.productId.externalId,
          marketplace: entry.productId.marketplace,
          image: entry.productId.images?.[0]?.url,
          status: 'pending',
          actions: []
        };
      }

      // Update status based on action
      if (entry.actionType === 'AI_OPTIMIZATION_GENERATED') {
        acc[productKey].status = entry.actionStatus === 'SUCCESS' ? 'optimized' : 'failed';
        acc[productKey].optimizedAt = entry.completedAt;
      }

      acc[productKey].actions.push({
        type: entry.actionType,
        status: entry.actionStatus,
        createdAt: entry.createdAt,
        completedAt: entry.completedAt
      });

      return acc;
    }, {});

    const productList = Object.values(products) as any[];

    res.json({
      success: true,
      data: {
        job: {
          id: job.id,
          name: job.name,
          status: job.finishedOn ? 'completed' : job.processedOn ? 'active' : 'waiting',
          data: job.data,
          result: job.returnvalue,
          progress: job.progress,
          createdAt: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason
        },
        batches: batchJobs,
        products: productList,
        summary: {
          totalProducts: productList.length,
          optimized: productList.filter(p => p.status === 'optimized').length,
          failed: productList.filter(p => p.status === 'failed').length,
          pending: productList.filter(p => p.status === 'pending').length
        }
      }
    });

  } catch (error: any) {
    console.error('Error getting job details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job details',
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