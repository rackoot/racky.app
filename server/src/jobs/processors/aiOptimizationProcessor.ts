import {
  AIOptimizationJobData,
  AIDescriptionBatchJobData,
  JobType,
  JobPriority,
} from '@/common/types/jobTypes';
import rabbitMQService from '@/common/services/rabbitMQService';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
import Product from '@/products/models/Product';
import Opportunity from '@/opportunities/models/Opportunity';
import aiService from '@/opportunities/services/aiService';
import ProductHistoryService from '@/products/services/ProductHistoryService';

/**
 * AI Optimization Processor
 * Handles AI-powered product optimization and description generation
 */
export class AIOptimizationProcessor {
  private static readonly BATCH_SIZE = 20; // Process 20 products per AI batch
  private static readonly MAX_CONCURRENT_AI_JOBS = 2; // Limit concurrent AI calls

  /**
   * Process an AI optimization scan job
   * Finds products that need optimization and creates batch jobs
   */
  static async processAIOptimizationScan(job: any): Promise<{
    success: boolean;
    totalProducts: number;
    totalBatches: number;
    message: string;
    blockedProducts?: Array<{
      productId: string;
      scansInWindow: number;
      nextAvailableAt?: Date;
    }>;
  }> {
    const { userId, workspaceId, filters } = job.data;
    
    console.log(`🤖 Starting AI optimization scan for user ${userId}, workspace ${workspaceId}`);
    
    try {
      // Update job progress
      await job.progress(10);

      // Build query for products needing optimization
      const query: any = {
        userId,
        workspaceId,
        // Only process products that have been synced
        lastSyncedAt: { $exists: true },
      };

      // Apply filters if provided
      if (filters?.marketplace) {
        query.marketplace = filters.marketplace;
      }

      if (filters?.createdAfter) {
        query.createdAt = { $gte: filters.createdAfter };
      }

      // Find products that need description optimization
      const optimizationQuery = {
        ...query,
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

      if (filters?.minDescriptionLength || filters?.maxDescriptionLength) {
        const descLengthQuery: any = {};
        if (filters.minDescriptionLength) {
          descLengthQuery.$gte = filters.minDescriptionLength;
        }
        if (filters.maxDescriptionLength) {
          descLengthQuery.$lte = filters.maxDescriptionLength;
        }
        optimizationQuery.description = {
          ...optimizationQuery.description,
          $regex: new RegExp(`^.{${descLengthQuery.$gte || 0},${descLengthQuery.$lte || 1000}}$`)
        };
      }

      await job.progress(30);

      // Get products needing optimization
      const productsNeedingOptimization = await Product.find(optimizationQuery)
        .select('_id externalId title description marketplace price inventory tags')
        .limit(1000) // Limit to prevent overwhelming scans
        .lean();

      console.log(`📊 Found ${productsNeedingOptimization.length} products needing optimization, checking scan limits...`);

      await job.progress(40);

      // Filter products by scan limit (max 2 scans per product per 24 hours)
      const productIds = productsNeedingOptimization.map(p => p._id.toString());
      const limitCheckResult = await ProductHistoryService.getProductsWithinScanLimit(
        productIds,
        workspaceId
      );

      // Filter to only products that can be scanned
      const eligibleProducts = productsNeedingOptimization.filter(product => 
        limitCheckResult.availableProducts.includes(product._id.toString())
      );

      const totalProducts = eligibleProducts.length;
      const blockedCount = limitCheckResult.blockedProducts.length;

      console.log(`📊 ${totalProducts} products eligible for scanning, ${blockedCount} products on cooldown`);

      if (totalProducts === 0) {
        return {
          success: true,
          totalProducts: 0,
          totalBatches: 0,
          message: blockedCount > 0 
            ? `All ${blockedCount} matching products have reached their daily scan limit (2 scans per 24 hours). Please try again later.`
            : 'No products found that need AI optimization and are within scan limits.',
          blockedProducts: limitCheckResult.blockedProducts
        };
      }

      // Create bulk scan history entries for each eligible product
      const bulkHistoryPromises = eligibleProducts.map(product => 
        ProductHistoryService.createBulkOperationHistory({
          workspaceId,
          userId,
          productId: product._id.toString(),
          actionType: 'AI_BULK_SCAN_STARTED',
          batchId: job.id!.toString(),
          recordsTotal: totalProducts,
          recordsProcessed: 0
        })
      );
      
      await Promise.all(bulkHistoryPromises);

      await job.progress(50);

      // Calculate batches
      const batchSize = AIOptimizationProcessor.BATCH_SIZE;
      const totalBatches = Math.ceil(totalProducts / batchSize);

      // Create batch jobs
      const batchJobs: Promise<any>[] = [];
      
      for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
        const startIndex = batchNumber * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalProducts);
        const batchProducts = eligibleProducts.slice(startIndex, endIndex);

        const batchJobData: AIDescriptionBatchJobData = {
          userId,
          workspaceId,
          productIds: batchProducts.map(p => p._id.toString()),
          marketplace: filters?.marketplace || 'all',
          batchNumber: batchNumber + 1,
          totalBatches,
          parentJobId: job.id!.toString(),
          createdAt: new Date(),
          priority: JobPriority.NORMAL,
        };

        // Add batch job to ai-optimization queue
        const batchJobPromise = rabbitMQService.addJob<AIDescriptionBatchJobData>(
          'ai-optimization',
          JobType.AI_DESCRIPTION_BATCH,
          batchJobData,
          {
            priority: JobPriority.NORMAL,
            attempts: 2, // AI calls can be flaky
            delay: batchNumber * 5000, // 5-second delay between batches to respect rate limits
          }
        );

        batchJobs.push(batchJobPromise as any);
      }

      // Wait for all batch jobs to be created
      await Promise.all(batchJobs);
      
      // Mark bulk scan as STARTED (not completed yet)
      const completionHistoryPromises = eligibleProducts.map(product => 
        ProductHistoryService.createBulkOperationHistory({
          workspaceId,
          userId,
          productId: product._id.toString(),
          actionType: 'AI_BULK_SCAN_STARTED',
          batchId: job.id!.toString(),
          recordsTotal: totalProducts,
          recordsProcessed: 0  // No records processed yet
        })
      );
      
      await Promise.all(completionHistoryPromises);
      
      // Don't mark as 100% - leave at 90% to show batches are processing
      await job.progress(90);

      const result = {
        success: true,
        totalProducts,
        totalBatches,
        message: blockedCount > 0 
          ? `Created ${totalBatches} AI batch jobs for ${totalProducts} products. ${blockedCount} products skipped (daily scan limit reached).`
          : `Created ${totalBatches} AI batch jobs for ${totalProducts} products`,
        status: 'processing_batches',  // Indicate batches are still running
        blockedProducts: limitCheckResult.blockedProducts
      };

      console.log(`🔄 AI optimization scan initiated: ${result.message}`);
      return result;

    } catch (error) {
      console.error(`❌ AI optimization scan failed:`, error);
      throw error;
    }
  }

  /**
   * Process an AI description batch job
   * Generates AI-powered descriptions and opportunities for a batch of products
   */
  static async processAIDescriptionBatch(job: any): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    products: Array<{ productId: string; status: 'success' | 'failed'; error?: string }>;
  }> {
    const { 
      userId, 
      workspaceId, 
      productIds, 
      marketplace, 
      batchNumber, 
      totalBatches,
      parentJobId 
    } = job.data;

    console.log(`🤖 Processing AI batch ${batchNumber}/${totalBatches} (${productIds.length} products)`);

    try {
      // Get products with full data
      const products = await Product.find({
        _id: { $in: productIds },
        userId,
        workspaceId,
      }).lean();

      if (products.length === 0) {
        throw new Error('No products found for AI processing');
      }

      const results: Array<{ productId: string; status: 'success' | 'failed'; error?: string }> = [];
      let processedCount = 0;
      let failedCount = 0;

      // Process products one by one (AI calls are sequential to respect rate limits)
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          // Update progress
          const progressPercentage = Math.round((i / products.length) * 100);
          await job.progress(progressPercentage);

          // Double-check scan limits before processing (safety measure)
          const limitCheck = await ProductHistoryService.checkProductScanLimit(
            product._id.toString(),
            workspaceId
          );

          if (!limitCheck.canScan) {
            console.log(`⏭️ Skipping product ${product._id} - scan limit reached (${limitCheck.scansInWindow}/2 scans in 24h)`);
            results.push({ 
              productId: product._id.toString(), 
              status: 'failed', 
              error: `Product has reached daily scan limit (${limitCheck.scansInWindow}/2 scans in 24 hours)`
            });
            failedCount++;
            continue;
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

          // Create history entry for AI optimization generation
          const generationHistory = await ProductHistoryService.createAIOptimizationHistory({
            workspaceId,
            userId,
            productId: product._id.toString(),
            actionType: 'AI_OPTIMIZATION_GENERATED',
            marketplace: product.marketplace,
            aiModel: 'gpt-3.5-turbo', // This should come from the AI service
            originalContent: product.description || '',
            jobId: job.id!.toString()
          });

          // Generate AI opportunities AND description
          console.log(`🤖 Generating AI opportunities for product: ${product.title}`);
          const [opportunities, descriptionResult] = await Promise.all([
            aiService.generateProductOpportunities(aiProduct, [product.marketplace]),
            aiService.generateProductDescription(aiProduct)
          ]);

          // Update history with results
          await ProductHistoryService.markCompleted(
            generationHistory._id.toString(),
            'SUCCESS',
            {
              confidence: descriptionResult.confidence,
              tokensUsed: descriptionResult.tokens
            }
          );

          // Save opportunities to database
          for (const oppData of opportunities) {
            // Check if opportunity already exists
            const existingOpportunity = await Opportunity.findOne({
              userId,
              workspaceId,
              productId: product._id,
              category: oppData.category,
              title: oppData.title,
            });

            if (!existingOpportunity) {
              const opportunity = new Opportunity({
                userId,
                workspaceId,
                productId: product._id,
                title: oppData.title,
                description: oppData.description,
                category: oppData.category,
                marketplace: product.marketplace || 'shopify',
                priority: oppData.priority,
                potentialImpact: oppData.potentialImpact,
                actionRequired: oppData.actionRequired,
                status: 'open',
                confidence: oppData.confidence || 0.8,
                aiGenerated: true,
                aiMetadata: oppData.aiMetadata,
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              await opportunity.save();
            }
          }

          // Save the generated description as a special "description" opportunity
          // First, remove any existing description opportunities for this product to avoid duplicates
          await Opportunity.deleteMany({
            userId,
            workspaceId,
            productId: product._id,
            category: 'description',
            aiGenerated: true
          });

          const descriptionOpportunity = new Opportunity({
            userId,
            workspaceId,
            productId: product._id,
            title: "AI-Generated Product Description",
            description: descriptionResult.description, // This is the ACTUAL generated description
            category: 'description',
            marketplace: product.marketplace || 'shopify',
            priority: 'high',
            potentialImpact: { revenue: 0, percentage: 30 },
            actionRequired: "Review and apply the generated description",
            status: 'open',
            confidence: descriptionResult.confidence,
            aiGenerated: true,
            aiMetadata: {
              model: descriptionResult.model,
              prompt: descriptionResult.prompt,
              tokens: descriptionResult.tokens,
              confidence: descriptionResult.confidence
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await descriptionOpportunity.save();

          // Update product's last sync timestamp
          await Product.findByIdAndUpdate(product._id, {
            $set: {
              lastSyncedAt: new Date(),
            }
          });

          results.push({ productId: product._id.toString(), status: 'success' });
          processedCount++;

        } catch (error) {
          console.error(`❌ Failed to process AI for product ${product._id}:`, error);
          
          // Create error history entry
          await ProductHistoryService.createErrorHistory({
            workspaceId,
            userId,
            productId: product._id.toString(),
            actionType: 'API_ERROR',
            errorMessage: error instanceof Error ? error.message : 'Unknown AI processing error',
            marketplace: product.marketplace,
            apiEndpoint: 'openai/chat/completions'
          });
          
          results.push({ 
            productId: product._id.toString(), 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }

        // Add delay between AI calls to respect rate limits
        if (i < products.length - 1) {
          await AIOptimizationProcessor.delay(2000); // 2-second delay between products
        }
      }

      await job.progress(100);

      const result = {
        success: true,
        processedCount,
        failedCount,
        products: results,
      };

      console.log(`✅ AI batch ${batchNumber}/${totalBatches} completed: ${processedCount} success, ${failedCount} failed`);
      
      // Check if all sibling batches are complete
      if (parentJobId) {
        const siblingJobs = await Job.find({
          'data.parentJobId': parentJobId,
          jobType: JobType.AI_DESCRIPTION_BATCH
        });
        
        const allComplete = siblingJobs.every(j => j.status === 'completed' || j.status === 'failed');
        
        if (allComplete) {
          // Update parent job to completed
          const parentJob = await Job.findOne({ jobId: parentJobId });
          if (parentJob && parentJob.status !== 'completed') {
            await parentJob.markCompleted({
              message: 'All batch jobs completed',
              totalBatches: siblingJobs.length,
              completedBatches: siblingJobs.filter(j => j.status === 'completed').length,
              failedBatches: siblingJobs.filter(j => j.status === 'failed').length
            });
            console.log(`✅ Parent job ${parentJobId} marked as completed`);
          }
        }
      }
      
      return result;

    } catch (error) {
      console.error(`❌ AI description batch processing failed:`, error);
      throw error;
    }
  }

  /**
   * Utility function to add delay
   */
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Job processor functions for Bull queue
 */
export const processAIOptimizationScan = AIOptimizationProcessor.processAIOptimizationScan.bind(AIOptimizationProcessor);
export const processAIDescriptionBatch = AIOptimizationProcessor.processAIDescriptionBatch.bind(AIOptimizationProcessor);