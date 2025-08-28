import { Job } from 'bull';
import {
  AIOptimizationScanJobData,
  AIDescriptionBatchJobData,
  queueService,
  JobType,
  JobPriority,
} from '@/common/services/queueService';
import Product from '@/products/models/Product';
import Opportunity from '@/opportunities/models/Opportunity';
import aiService from '@/opportunities/services/aiService';

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
  static async processAIOptimizationScan(job: Job<AIOptimizationScanJobData>): Promise<{
    success: boolean;
    totalProducts: number;
    totalBatches: number;
    message: string;
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

      const totalProducts = productsNeedingOptimization.length;
      console.log(`📊 Found ${totalProducts} products needing AI optimization`);

      await job.progress(50);

      // Calculate batches
      const batchSize = this.BATCH_SIZE;
      const totalBatches = Math.ceil(totalProducts / batchSize);

      // Create batch jobs
      const batchJobs: Promise<Job<AIDescriptionBatchJobData>>[] = [];
      
      for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
        const startIndex = batchNumber * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalProducts);
        const batchProducts = productsNeedingOptimization.slice(startIndex, endIndex);

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
        const batchJobPromise = queueService.addJob<AIDescriptionBatchJobData>(
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
      
      await job.progress(100);

      const result = {
        success: true,
        totalProducts,
        totalBatches,
        message: `Created ${totalBatches} AI batch jobs for ${totalProducts} products`,
      };

      console.log(`✅ AI optimization scan completed: ${result.message}`);
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
  static async processAIDescriptionBatch(job: Job<AIDescriptionBatchJobData>): Promise<{
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
      totalBatches 
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

          // Generate AI opportunities (includes description improvements)
          console.log(`🤖 Generating AI opportunities for product: ${product.title}`);
          const opportunities = await aiService.generateProductOpportunities(aiProduct, [product.marketplace]);

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
                marketplace: oppData.marketplace,
                priority: oppData.priority,
                potentialImpact: oppData.potentialImpact,
                actionRequired: oppData.actionRequired,
                status: 'active',
                confidence: oppData.confidence || 0.8,
                aiGenerated: true,
                aiMetadata: oppData.aiMetadata,
                createdAt: new Date(),
                updatedAt: new Date(),
              });

              await opportunity.save();
            }
          }

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
          results.push({ 
            productId: product._id.toString(), 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }

        // Add delay between AI calls to respect rate limits
        if (i < products.length - 1) {
          await this.delay(2000); // 2-second delay between products
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
export const processAIOptimizationScan = AIOptimizationProcessor.processAIOptimizationScan;
export const processAIDescriptionBatch = AIOptimizationProcessor.processAIDescriptionBatch;