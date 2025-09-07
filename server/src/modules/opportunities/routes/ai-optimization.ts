import express, { Response } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest } from '@/common/types/express';
import { 
  JobType, 
  JobPriority, 
  AIOptimizationJobData 
} from '@/common/types/jobTypes';
import rabbitMQService from '@/common/services/rabbitMQService';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';

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

    // If marketplace is specified, validate it has products and check for running scans
    if (marketplace) {
      const ProductModel = (await import('@/products/models/Product')).default;
      const ProductHistory = (await import('@/products/models/ProductHistory')).default;
      
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


      // Check for active or waiting scans for this marketplace
      const runningJobs = await Job.find({
        userId,
        workspaceId,
        jobType: JobType.AI_OPTIMIZATION_SCAN,
        'data.filters.marketplace': marketplace,
        status: { $in: ['queued', 'processing'] }
      }).limit(1);

      if (runningJobs.length > 0) {
        const jobStatus = runningJobs[0].status === 'queued' ? 'waiting' : 'active';
        return res.status(409).json({
          success: false,
          message: `A scan is already ${jobStatus} for marketplace "${marketplace}". Please wait for it to complete before starting a new scan.`,
          data: {
            existingJobId: runningJobs[0].jobId,
            status: jobStatus
          }
        });
      }

      // Get all products for this marketplace that match user filters
      const allProducts = await ProductModel.find({
        userId,
        workspaceId,
        marketplace,
        lastSyncedAt: { $exists: true }, // Only include synced products
        ...(createdAfter && { createdAt: { $gte: new Date(createdAfter) } })
      }).select('_id').lean();

      // Apply description length filters if specified
      let filteredProducts = allProducts;
      if (minDescriptionLength || maxDescriptionLength) {
        const productFilters: any = { 
          _id: { $in: allProducts.map(p => p._id) },
          userId,
          workspaceId,
          marketplace
        };
        
        const descConditions: any[] = [];
        if (minDescriptionLength) {
          descConditions.push({ $gte: [{ $strLenCP: "$description" }, minDescriptionLength] });
        }
        if (maxDescriptionLength) {
          descConditions.push({ $lte: [{ $strLenCP: "$description" }, maxDescriptionLength] });
        }
        productFilters.$expr = { $and: descConditions };
        
        filteredProducts = await ProductModel.find(productFilters).select('_id').lean();
      }

      // Check scan limits for each product (max 2 scans per 24 hours)
      const { ProductHistoryService } = await import('@/products/services/ProductHistoryService');
      const productIds = filteredProducts.map(p => p._id.toString());
      const limitCheckResult = await ProductHistoryService.getProductsWithinScanLimit(
        productIds,
        workspaceId
      );

      const availableProductCount = limitCheckResult.availableProducts.length;
      const blockedProductCount = limitCheckResult.blockedProducts.length;

      if (availableProductCount === 0) {
        const allProductsBlocked = blockedProductCount === filteredProducts.length && filteredProducts.length > 0;
        
        return res.status(400).json({
          success: false,
          message: allProductsBlocked
            ? `All ${filteredProducts.length} products in marketplace "${marketplace}" have reached their daily scan limit (2 scans per 24 hours). Please try again later.`
            : `No products match the specified filters for marketplace "${marketplace}".`,
          data: {
            totalProducts: filteredProducts.length,
            blockedProducts: blockedProductCount,
            availableForScan: availableProductCount,
            nextAvailableAt: blockedProductCount > 0 ? limitCheckResult.blockedProducts[0].nextAvailableAt : null
          }
        });
      }

    }

    // Create AI optimization scan job
    const scanJobData: AIOptimizationJobData = {
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

    const job = await rabbitMQService.addJob(
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
        jobId: job.jobId,
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
 * GET /api/opportunities/ai/marketplace-availability
 * Check which marketplaces are available for AI scanning
 */
router.get('/marketplace-availability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    const ProductHistory = (await import('@/products/models/ProductHistory')).default;
    const { ProductCountService } = await import('@/products/services/productCountService');

    // Use the unified product count service to get marketplace counts
    const marketplaceCounts = await ProductCountService.getProductCountsByMarketplace(workspaceId);

    // Convert to the format expected by the rest of the function
    const marketplacesWithProducts = marketplaceCounts.map(mc => ({
      _id: mc.marketplace,
      totalProducts: mc.totalProducts,
      lastCreated: mc.lastCreated
    }));
    
    // Check for running jobs
    const userJobs = await Job.find({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      status: { $in: ['queued', 'processing'] }
    });
    
    const runningScans = userJobs.reduce((acc: any, job) => {
      if (job.data.filters?.marketplace) {
        acc[job.data.filters.marketplace] = {
          jobId: job.jobId,
          status: job.status === 'processing' ? 'active' : 'waiting',
          startedAt: job.startedAt || job.createdAt
        };
      }
      return acc;
    }, {});

    // Check for recent scans (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const marketplaceAvailability = await Promise.all(
      marketplacesWithProducts.map(async (mp) => {
        const marketplace = mp._id;
        
        // Check if marketplace has 0 products
        if (mp.totalProducts === 0) {
          return {
            marketplace,
            totalProducts: 0,
            available: false,
            reason: 'no_products',
            recentlyScanned: 0,
            availableProducts: 0
          };
        }
        
        // Check if there's a running scan
        if (runningScans[marketplace]) {
          return {
            marketplace,
            totalProducts: mp.totalProducts,
            available: false,
            reason: 'scan_in_progress',
            runningScan: runningScans[marketplace]
          };
        }

        // Get all products for this marketplace that need optimization (same criteria as scan processor)
        const Product = (await import('@/products/models/Product')).default;
        
        // Apply the same optimization criteria as the scan processor
        const optimizationQuery = {
          userId,
          workspaceId,
          marketplace,
          lastSyncedAt: { $exists: true }, // Only include synced products
          $or: [
            { description: { $exists: false } },
            { description: '' },
            { description: { $regex: /^.{0,50}$/ } }, // Very short descriptions
            {
              $and: [
                { description: { $exists: true } },
                { description: { $not: { $regex: /[.!?].*[.!?]/ } } } // No proper sentences
              ]
            }
          ]
        };
        
        const marketplaceProducts = await Product.find(optimizationQuery).select('_id').lean();

        // Check scan limits for each product (max 2 scans per 24 hours)
        const { ProductHistoryService } = await import('@/products/services/ProductHistoryService');
        const productIds = marketplaceProducts.map(p => p._id.toString());
        const limitCheckResult = await ProductHistoryService.getProductsWithinScanLimit(
          productIds,
          workspaceId
        );

        const availableProductCount = limitCheckResult.availableProducts.length;
        const blockedProductCount = limitCheckResult.blockedProducts.length;
        const allProductsBlocked = blockedProductCount === marketplaceProducts.length && marketplaceProducts.length > 0;

        return {
          marketplace,
          totalProducts: marketplaceProducts.length,
          recentlyScanned: blockedProductCount, // Products that hit scan limit
          availableProducts: availableProductCount,
          available: availableProductCount > 0,
          reason: allProductsBlocked ? 'cooldown_24h' : availableProductCount === 0 ? 'no_products_match' : null,
          cooldownEndsAt: allProductsBlocked && limitCheckResult.blockedProducts.length > 0 
            ? limitCheckResult.blockedProducts[0].nextAvailableAt?.toISOString() || null
            : null,
          blockedProducts: limitCheckResult.blockedProducts // Include blocked product details for debugging
        };
      })
    );

    res.json({
      success: true,
      data: {
        marketplaces: marketplaceAvailability,
        summary: {
          total: marketplaceAvailability.length,
          available: marketplaceAvailability.filter(m => m.available).length,
          runningScans: Object.keys(runningScans).length,
          onCooldown: marketplaceAvailability.filter(m => m.reason === 'cooldown_24h').length
        }
      }
    });

  } catch (error: any) {
    console.error('Error checking marketplace availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check marketplace availability',
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
    const userId = req.user!._id.toString();
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required'
      });
    }
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get job status from MongoDB
    const job = await Job.findOne({ jobId });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Verify job belongs to this user and workspace
    if (job.userId !== userId || job.workspaceId !== workspaceId) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Calculate ETA based on progress
    let eta = 'Calculating...';
    if (typeof job.progress === 'number' && job.progress > 0) {
      const remainingProgress = 100 - job.progress;
      const timeElapsed = job.startedAt 
        ? Date.now() - new Date(job.startedAt).getTime()
        : 0;
      
      if (timeElapsed > 0) {
        const timePerPercent = timeElapsed / job.progress;
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

    if (typeof job.progress === 'object') {
      progressData = job.progress as any;
    } else if (typeof job.progress === 'number') {
      progressData = {
        current: job.progress,
        total: 100,
        percentage: job.progress,
      };
    }

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

    // Get the job from MongoDB
    const job = await Job.findOne({ jobId });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify job belongs to user
    if (job.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this job'
      });
    }

    // Get product history entries for this job
    const ProductHistory = (await import('@/products/models/ProductHistory')).default;
    const ProductModel = (await import('@/products/models/Product')).default;
    
    // Get child batch jobs first to find all related job IDs
    const childBatchJobs = await Job.find({
      'data.parentJobId': jobId,
      jobType: JobType.AI_DESCRIPTION_BATCH
    });
    
    // Get all related job IDs (main job + child batch jobs)
    const relatedJobIds = [jobId, ...childBatchJobs.map(j => j.jobId)];
    
    // Get only products that were actually eligible for scanning (i.e., included in batch jobs)
    // Extract product IDs from all child batch jobs
    const batchProductIds = childBatchJobs.reduce((acc: string[], batchJob: any) => {
      if (batchJob.data.productIds) {
        acc.push(...batchJob.data.productIds);
      }
      return acc;
    }, []);
    
    // Remove duplicates from batch product IDs
    const uniqueProductIds = [...new Set(batchProductIds)];
    
    // Get products that were actually eligible and included in batch processing
    const allScanProducts = uniqueProductIds.length > 0 
      ? await ProductModel.find({ _id: { $in: uniqueProductIds } })
          .select('title externalId marketplace images description createdAt')
          .lean()
      : []; // If no products were eligible, return empty array
    
    
    // Find history entries for products that were processed
    const historyEntries = await ProductHistory.find({
      workspaceId,
      relatedJobId: { $in: relatedJobIds },
      actionType: { $in: ['AI_OPTIMIZATION_GENERATED', 'AI_BULK_SCAN_STARTED', 'AI_BULK_SCAN_COMPLETED'] }
    })
    .populate('productId', 'title externalId marketplace images description')
    .sort({ createdAt: 1 })
    .lean();
    

    // Get product IDs from both scan results and history
    const allProductIds = allScanProducts.map(p => p._id);
    const historyProductIds = historyEntries.map(entry => entry.productId?._id).filter(Boolean);
    
    
    // Get AI-generated opportunities for description suggestions with prompts
    const OpportunityModel = (await import('@/opportunities/models/Opportunity')).default;
    const aiOpportunities = await OpportunityModel.find({
      workspaceId,
      productId: { $in: allProductIds },
      category: 'description'
    }).lean();
    

    // Map child batch jobs to response format (already retrieved above)
    const batchJobs = childBatchJobs.map(j => ({
      id: j.id,
      status: j.completedAt ? 'completed' : j.startedAt ? 'active' : 'waiting',
      batchNumber: j.data.batchNumber,
      totalBatches: j.data.totalBatches,
      productCount: j.data.productIds?.length || 0,
      progress: j.progress,
      result: j.result,
      failedReason: j.lastError,
      createdAt: j.createdAt,
      finishedOn: j.completedAt
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

    // Build product list from only products that were eligible and included in batch processing
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
          name: job.jobType,
          status: job.completedAt ? 'completed' : job.startedAt ? 'active' : 'waiting',
          data: job.data,
          result: job.result,
          progress: job.progress,
          createdAt: job.createdAt,
          processedOn: job.startedAt,
          finishedOn: job.completedAt,
          failedReason: job.lastError
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
    const workspaceId = req.headers['x-workspace-id'] as string;
    const { status, limit = 10, offset = 0 } = req.query;
    
    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required'
      });
    }

    // Get job history for this user from MongoDB
    let query: any = {
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN
    };
    
    console.log('🔍 AI Jobs Query:', JSON.stringify({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      headerWorkspace: req.headers['x-workspace-id']
    }));
    
    // Apply status filter
    if (status) {
      if (status === 'waiting') {
        query.status = 'queued';
      } else if (status === 'active') {
        query.status = 'processing';
      } else {
        query.status = status;
      }
    }
    
    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset));
    
    console.log(`🔍 Found ${jobs.length} AI jobs`);
    
    const formattedJobs = jobs.map(job => ({
      id: job.jobId,
      status: job.status === 'queued' ? 'waiting' : job.status === 'processing' ? 'active' : job.status,
      data: job.data,
      createdAt: job.createdAt,
      progress: job.progress,
      processedOn: job.startedAt,
      finishedOn: job.completedAt,
      result: job.result,
      failedReason: job.lastError
    }));

    // Get total count for pagination
    const total = await Job.countDocuments(query);

    res.json({
      success: true,
      data: {
        jobs: formattedJobs,
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: (Number(offset) + Number(limit)) < total,
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

/**
 * GET /api/opportunities/ai/statistics
 * Get AI optimization statistics for dashboard
 */
router.get('/statistics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const workspaceId = req.workspace!._id.toString();

    // Get total scans count
    const totalScans = await Job.countDocuments({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN
    });

    // Get completed scans count
    const completedScans = await Job.countDocuments({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      status: 'completed'
    });

    // Get running/queued scans count
    const activeScans = await Job.countDocuments({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      status: { $in: ['queued', 'processing'] }
    });

    // Get recent scans (last 30 days) with aggregated results
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentJobs = await Job.find({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      createdAt: { $gte: thirtyDaysAgo }
    }).select('result createdAt status').lean();

    // Calculate total products processed in last 30 days
    const totalProductsProcessed = recentJobs
      .filter(job => job.status === 'completed' && job.result?.totalProducts)
      .reduce((sum, job) => sum + (job.result.totalProducts || 0), 0);

    // Get most recent scan
    const lastScan = await Job.findOne({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN
    }).sort({ createdAt: -1 }).select('createdAt status result').lean();

    // Get scan distribution by status for pie chart (using Racky brand colors)
    const statusDistribution = [
      { name: 'Completed', value: completedScans, color: '#18d2c0' }, // Racky teal
      { name: 'Active', value: activeScans, color: '#f5ca0b' },        // Racky yellow
      { name: 'Failed', value: totalScans - completedScans - activeScans, color: '#856dff' } // Racky purple
    ].filter(item => item.value > 0);

    // Get scan trend for last 6 months (monthly aggregation)
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    const scanTrendJobs = await Job.find({
      userId,
      workspaceId,
      jobType: JobType.AI_OPTIMIZATION_SCAN,
      createdAt: { $gte: sixMonthsAgo }
    }).select('createdAt').lean();

    // Group by month for trend chart
    const monthlyScans: { [key: string]: number } = {};
    scanTrendJobs.forEach(job => {
      const monthKey = job.createdAt.toISOString().slice(0, 7); // YYYY-MM format
      monthlyScans[monthKey] = (monthlyScans[monthKey] || 0) + 1;
    });

    const scanTrend = Object.entries(monthlyScans)
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())
      .slice(-6); // Last 6 months

    // Build response
    const statistics = {
      metrics: {
        totalScans,
        completedScans,
        activeScans,
        totalProductsProcessed,
        successRate: totalScans > 0 ? Math.round((completedScans / totalScans) * 100) : 0,
        lastScanAt: lastScan?.createdAt || null,
        lastScanStatus: lastScan?.status || null
      },
      charts: {
        statusDistribution,
        scanTrend: scanTrend.length > 0 ? scanTrend : [
          { month: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), count: 0 }
        ]
      }
    };

    res.json({
      success: true,
      data: statistics
    });

  } catch (error: any) {
    console.error('Error getting AI optimization statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI optimization statistics',
      error: error.message
    });
  }
});

export default router;