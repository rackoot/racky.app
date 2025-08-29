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

    // If marketplace is specified, validate it has products
    if (marketplace) {
      const ProductModel = (await import('@/products/models/Product')).default;
      
      const productCount = await ProductModel.countDocuments({
        workspaceId,
        marketplace
      });

      if (productCount === 0) {
        return res.status(400).json({
          success: false,
          message: `No products found for marketplace "${marketplace}". Cannot start AI scan for empty marketplace.`
        });
      }

      console.log(`Validated marketplace "${marketplace}" has ${productCount} products`);
    }

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
    const ProductModel = (await import('@/products/models/Product')).default;
    
    // Get child batch jobs first to find all related job IDs
    const allJobs = await aiQueue.getJobs(['completed', 'failed', 'active', 'waiting']);
    const childBatchJobs = allJobs.filter(j => j.data.parentJobId === jobId && j.name === 'AI_DESCRIPTION_BATCH');
    
    // Get all related job IDs (main job + child batch jobs)
    const relatedJobIds = [jobId, ...childBatchJobs.map(j => j.id!.toString())];
    console.log(`Looking for history entries with job IDs: ${relatedJobIds.join(', ')}`);
    
    // Get ALL products that match the scan filters, not just those with history entries
    let scanFilters: any = { workspaceId };
    
    if (job.data.filters) {
      if (job.data.filters.marketplace) {
        scanFilters.marketplace = job.data.filters.marketplace;
      }
      if (job.data.filters.createdAfter) {
        scanFilters.createdAt = { $gte: new Date(job.data.filters.createdAfter) };
      }
      // Add description length filters if needed
      if (job.data.filters.minDescriptionLength || job.data.filters.maxDescriptionLength) {
        const descConditions: any = {};
        if (job.data.filters.minDescriptionLength) {
          descConditions.$gte = job.data.filters.minDescriptionLength;
        }
        if (job.data.filters.maxDescriptionLength) {
          descConditions.$lte = job.data.filters.maxDescriptionLength;
        }
        scanFilters.$expr = {
          $and: [
            { $gte: [{ $strLenCP: "$description" }, job.data.filters.minDescriptionLength || 0] },
            ...(job.data.filters.maxDescriptionLength ? [{ $lte: [{ $strLenCP: "$description" }, job.data.filters.maxDescriptionLength] }] : [])
          ]
        };
      }
    }
    
    console.log('Scan filters:', JSON.stringify(scanFilters));
    
    // Get all products that should be part of this scan
    const allScanProducts = await ProductModel.find(scanFilters)
      .select('title externalId marketplace images description createdAt')
      .lean();
    
    console.log(`Found ${allScanProducts.length} products matching scan criteria`);
    
    // Find history entries for products that were processed
    const historyEntries = await ProductHistory.find({
      workspaceId,
      relatedJobId: { $in: relatedJobIds },
      actionType: { $in: ['AI_OPTIMIZATION_GENERATED', 'AI_BULK_SCAN_STARTED', 'AI_BULK_SCAN_COMPLETED'] }
    })
    .populate('productId', 'title externalId marketplace images description')
    .sort({ createdAt: 1 })
    .lean();
    
    console.log(`Found ${historyEntries.length} history entries for jobs ${relatedJobIds.join(', ')}`);

    // Get product IDs from both scan results and history
    const allProductIds = allScanProducts.map(p => p._id);
    const historyProductIds = historyEntries.map(entry => entry.productId?._id).filter(Boolean);
    
    console.log(`All scan product IDs: ${allProductIds.map(id => id.toString()).join(', ')}`);
    console.log(`History product IDs: ${historyProductIds.map(id => id.toString()).join(', ')}`);
    
    // Get AI-generated opportunities for description suggestions with prompts
    const OpportunityModel = (await import('@/opportunities/models/Opportunity')).default;
    const aiOpportunities = await OpportunityModel.find({
      workspaceId,
      productId: { $in: allProductIds },
      category: 'description'
    }).lean();
    
    console.log(`Found ${aiOpportunities.length} AI description opportunities`);

    // Map child batch jobs to response format (already retrieved above)
    const batchJobs = childBatchJobs.map(j => ({
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

    // Create maps for AI opportunities data (description and prompt)
    const aiOpportunityMap = aiOpportunities.reduce((acc: any, opportunity: any) => {
      const productKey = opportunity.productId.toString();
      acc[productKey] = {
        description: opportunity.description,
        prompt: opportunity.aiMetadata?.prompt || '',
        confidence: opportunity.aiMetadata?.confidence || 0.8,
        model: opportunity.aiMetadata?.model || 'gpt-3.5-turbo'
      };
      return acc;
    }, {});
    
    // Create a map for history entries
    const historyMap = historyEntries.reduce((acc: any, entry: any) => {
      if (!entry.productId) return acc;
      
      const productKey = entry.productId._id.toString();
      if (!acc[productKey]) {
        acc[productKey] = [];
      }
      acc[productKey].push(entry);
      return acc;
    }, {});

    // Build product list from ALL scanned products, not just those with history
    const products = allScanProducts.map((product: any) => {
      const productKey = product._id.toString();
      const productHistory = historyMap[productKey] || [];
      const aiData = aiOpportunityMap[productKey];
      
      // Determine product status based on history and opportunities
      let status = 'pending'; // Default status for products in queue
      let optimizedAt = null;
      let failedReason = null;
      
      // Check if product has been processed
      const generationEntry = productHistory.find((entry: any) => entry.actionType === 'AI_OPTIMIZATION_GENERATED');
      if (generationEntry) {
        if (generationEntry.actionStatus === 'SUCCESS') {
          status = aiData ? 'optimized' : 'failed';
          optimizedAt = generationEntry.completedAt;
        } else {
          status = 'failed';
          failedReason = generationEntry.metadata?.errorMessage || 'AI generation failed';
        }
      } else if (productHistory.length > 0) {
        // Product is in processing if it has scan history but no generation result yet
        status = 'processing';
      }
      
      return {
        id: product._id,
        title: product.title,
        externalId: product.externalId,
        marketplace: product.marketplace,
        image: product.images?.[0]?.url,
        status,
        optimizedAt,
        failedReason,
        descriptions: {
          original: product.description || '',
          current: product.description || '',
          aiGenerated: aiData?.description || '',
          wasModified: false, // We'll calculate this if needed
          aiPrompt: aiData?.prompt || '' // Include AI prompt
        },
        aiMetadata: aiData ? {
          model: aiData.model,
          confidence: aiData.confidence,
          prompt: aiData.prompt
        } : null,
        actions: productHistory.map((entry: any) => ({
          type: entry.actionType,
          status: entry.actionStatus,
          createdAt: entry.createdAt,
          completedAt: entry.completedAt,
          metadata: entry.metadata
        }))
      };
    });

    const productList = products;

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
          processing: productList.filter(p => p.status === 'processing').length,
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


/**
 * POST /api/opportunities/ai/regenerate/:productId
 * Regenerate AI suggestion for a product
 */
router.post('/regenerate/:productId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();
    const { productId } = req.params;

    // Import required models and services
    const ProductModel = (await import('@/products/models/Product')).default;
    const aiService = (await import('@/opportunities/services/aiService')).default;
    const ProductHistoryService = (await import('@/products/services/ProductHistoryService')).default;

    // Get the product
    const product = await ProductModel.findOne({
      _id: productId,
      userId,
      workspaceId
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Convert to AI service format
    const aiProduct = {
      title: product.title,
      description: product.description || '',
      price: product.price || 0,
      marketplace: product.marketplace || 'unknown',
      inventory: product.inventory || 0,
      sku: product.sku || product.externalId,
      productType: product.productType || product.category,
      images: product.images && product.images.length > 0 ? product.images.map(img => img.url) : [],
      tags: product.tags || [],
    };

    // Create history entry for regeneration attempt
    const regenerationHistory = await ProductHistoryService.createAIOptimizationHistory({
      workspaceId,
      userId,
      productId: productId,
      actionType: 'AI_OPTIMIZATION_GENERATED',
      marketplace: product.marketplace,
      aiModel: 'gpt-3.5-turbo',
      originalContent: product.description || '',
      jobId: `regenerate-${Date.now()}`
    });

    // Generate new AI opportunities
    const opportunities = await aiService.generateProductOpportunities(aiProduct, [product.marketplace]);

    // Update history with results
    await ProductHistoryService.markCompleted(
      regenerationHistory._id.toString(),
      'SUCCESS',
      {
        confidence: opportunities.length > 0 ? opportunities[0].confidence : 0.8,
        tokensUsed: opportunities[0]?.aiMetadata?.tokens || 0,
        newContent: opportunities.find(o => o.category === 'description')?.description || ''
      }
    );

    res.json({
      success: true,
      message: 'AI suggestion regenerated successfully',
      data: {
        productId,
        suggestions: opportunities.filter(o => o.category === 'description')
      }
    });

  } catch (error: any) {
    console.error('Error regenerating AI suggestion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate AI suggestion',
      error: error.message
    });
  }
});

export default router;