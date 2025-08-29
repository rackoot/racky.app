import { Job } from 'bull';
import queueService, {
  MarketplaceSyncJobData,
  ProductBatchJobData,
  JobType,
  JobPriority,
} from '@/common/services/queueService';
// import { marketplaceService } from '@/marketplaces/services/marketplaces';
import StoreConnection from '@/stores/models/StoreConnection';
import Product from '@/products/models/Product';
import ProductHistoryService from '@/products/services/ProductHistoryService';

/**
 * Marketplace Sync Processor
 * Handles high-level marketplace synchronization by breaking it into batches
 */
export class MarketplaceSyncProcessor {
  private static readonly BATCH_SIZE = 75; // Process 75 products per batch
  private static readonly MAX_CONCURRENT_BATCHES = 3; // Process 3 batches concurrently per user

  /**
   * Process a marketplace sync job
   */
  static async processMarketplaceSync(job: Job<MarketplaceSyncJobData>): Promise<{
    success: boolean;
    totalProducts: number;
    totalBatches: number;
    message: string;
  }> {
    const { userId, workspaceId, connectionId, marketplace, estimatedProducts } = job.data;
    
    console.log(`🔄 Starting marketplace sync for user ${userId}, connection ${connectionId}`);
    
    try {
      // Update job progress
      await job.progress(10);

      // Get store connection details
      const connection = await StoreConnection.findOne({
        _id: connectionId,
        userId: userId
      });

      if (!connection) {
        throw new Error(`Store connection ${connectionId} not found`);
      }

      // Check if connection matches the requested marketplace
      if (connection.marketplaceType !== marketplace || !connection.isActive) {
        throw new Error(`Marketplace ${marketplace} not found or inactive`);
      }

      await job.progress(20);

      // Fetch product list from marketplace
      console.log(`📊 Fetching product list from ${marketplace}...`);
      const productList = await MarketplaceSyncProcessor.fetchMarketplaceProducts(
        marketplace,
        connection.credentials
      );

      const totalProducts = productList.length;
      console.log(`📦 Found ${totalProducts} products to sync`);

      await job.progress(30);

      // Calculate batches
      const batchSize = MarketplaceSyncProcessor.BATCH_SIZE;
      const totalBatches = Math.ceil(totalProducts / batchSize);

      // Create batch jobs
      const batchJobs: Promise<Job<ProductBatchJobData>>[] = [];
      
      for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
        const startIndex = batchNumber * batchSize;
        const endIndex = Math.min(startIndex + batchSize, totalProducts);
        const batchProducts = productList.slice(startIndex, endIndex);

        const batchJobData: ProductBatchJobData = {
          userId,
          workspaceId,
          connectionId,
          marketplace,
          productIds: batchProducts.map(p => p.externalId),
          batchNumber: batchNumber + 1,
          totalBatches,
          parentJobId: job.id!.toString(),
          createdAt: new Date(),
          priority: JobPriority.NORMAL,
        };

        // Add batch job to product-processing queue
        const batchJobPromise = queueService.addJob<ProductBatchJobData>(
          'product-processing',
          JobType.PRODUCT_BATCH,
          batchJobData,
          {
            priority: JobPriority.NORMAL,
            attempts: 3,
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
        message: `Created ${totalBatches} batch jobs for ${totalProducts} products`,
      };

      console.log(`✅ Marketplace sync job completed: ${result.message}`);
      return result;

    } catch (error) {
      console.error(`❌ Marketplace sync failed:`, error);
      throw error;
    }
  }

  /**
   * Process a product batch job
   */
  static async processProductBatch(job: Job<ProductBatchJobData>): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    products: Array<{ externalId: string; status: 'success' | 'failed'; error?: string }>;
  }> {
    const { 
      userId, 
      workspaceId, 
      connectionId, 
      marketplace, 
      productIds, 
      batchNumber, 
      totalBatches 
    } = job.data;

    console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${productIds.length} products)`);

    try {
      // Get store connection
      const connection = await StoreConnection.findOne({
        _id: connectionId,
        userId: userId
      });

      if (!connection) {
        throw new Error(`Store connection ${connectionId} not found`);
      }

      // Check if connection matches the requested marketplace
      if (connection.marketplaceType !== marketplace) {
        throw new Error(`Marketplace ${marketplace} not found`);
      }

      const results: Array<{ externalId: string; status: 'success' | 'failed'; error?: string }> = [];
      let processedCount = 0;
      let failedCount = 0;

      // Process products in this batch
      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i];
        
        try {
          // Update progress
          const progressPercentage = Math.round((i / productIds.length) * 100);
          await job.progress(progressPercentage);

          // Fetch product details from marketplace
          const productData = await MarketplaceSyncProcessor.fetchProductDetails(
            marketplace,
            productId,
            connection.credentials
          );

          // Save or update product in database
          const savedProduct = await MarketplaceSyncProcessor.saveProduct(userId, workspaceId, connectionId, marketplace, productData);

          // Create history entry for successful sync
          await ProductHistoryService.createSyncHistory({
            workspaceId,
            userId,
            productId: savedProduct._id.toString(),
            storeConnectionId: connectionId,
            actionType: 'SYNC_FROM_MARKETPLACE',
            marketplace,
            syncDirection: 'FROM_MARKETPLACE',
            jobId: job.id!.toString(),
            batchId: `batch_${batchNumber}`
          });

          results.push({ externalId: productId, status: 'success' });
          processedCount++;

        } catch (error) {
          console.error(`❌ Failed to process product ${productId}:`, error);
          
          // Try to find the product to create error history
          const existingProduct = await Product.findOne({
            userId,
            workspaceId,
            marketplace,
            externalId: productId
          });

          if (existingProduct) {
            await ProductHistoryService.createErrorHistory({
              workspaceId,
              userId,
              productId: existingProduct._id.toString(),
              storeConnectionId: connectionId,
              actionType: 'SYNC_FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown sync error',
              marketplace
            });
          }
          
          results.push({ 
            externalId: productId, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failedCount++;
        }

        // Add small delay to respect rate limits
        await MarketplaceSyncProcessor.delay(100);
      }

      await job.progress(100);

      const result = {
        success: true,
        processedCount,
        failedCount,
        products: results,
      };

      console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${processedCount} success, ${failedCount} failed`);
      return result;

    } catch (error) {
      console.error(`❌ Product batch processing failed:`, error);
      throw error;
    }
  }

  /**
   * Fetch product list from marketplace
   */
  private static async fetchMarketplaceProducts(
    marketplace: string, 
    credentials: any
  ): Promise<Array<{ externalId: string }>> {
    // This would call the actual marketplace APIs
    // For now, we'll simulate with the existing marketplace service
    try {
      switch (marketplace.toLowerCase()) {
        case 'shopify':
          return await MarketplaceSyncProcessor.fetchShopifyProducts(credentials);
        case 'vtex':
          return await MarketplaceSyncProcessor.fetchVtexProducts(credentials);
        case 'woocommerce':
          return await MarketplaceSyncProcessor.fetchWooCommerceProducts(credentials);
        case 'mercadolibre':
          return await MarketplaceSyncProcessor.fetchMercadoLibreProducts(credentials);
        default:
          throw new Error(`Marketplace ${marketplace} not supported for batch sync`);
      }
    } catch (error) {
      console.error(`Error fetching products from ${marketplace}:`, error);
      throw error;
    }
  }

  /**
   * Fetch product details from marketplace
   */
  private static async fetchProductDetails(
    marketplace: string,
    productId: string,
    credentials: any
  ): Promise<any> {
    // This would fetch detailed product information
    // For now, we'll use existing marketplace service calls
    try {
      switch (marketplace.toLowerCase()) {
        case 'shopify':
          return await MarketplaceSyncProcessor.fetchShopifyProductDetails(productId, credentials);
        case 'vtex':
          return await MarketplaceSyncProcessor.fetchVtexProductDetails(productId, credentials);
        default:
          throw new Error(`Product details fetch not implemented for ${marketplace}`);
      }
    } catch (error) {
      console.error(`Error fetching product ${productId} from ${marketplace}:`, error);
      throw error;
    }
  }

  /**
   * Save product to database
   */
  private static async saveProduct(
    userId: string,
    workspaceId: string,
    connectionId: string,
    marketplace: string,
    productData: any
  ): Promise<any> {
    // Convert marketplace data to our product schema
    const productDoc = {
      userId,
      workspaceId,
      connectionId,
      marketplace,
      externalId: productData.id || productData.externalId,
      name: productData.title || productData.name,
      description: productData.description || '',
      price: productData.price || 0,
      currency: productData.currency || 'USD',
      imageUrl: productData.image || productData.imageUrl,
      url: productData.url,
      category: productData.category,
      tags: productData.tags || [],
      variants: productData.variants || [],
      inventory: {
        quantity: productData.inventory?.quantity || 0,
        inStock: productData.inventory?.inStock || false,
      },
      seo: {
        metaTitle: productData.seo?.metaTitle || productData.title,
        metaDescription: productData.seo?.metaDescription || productData.description,
        slug: productData.seo?.slug || productData.handle,
      },
      lastSyncedAt: new Date(),
      syncStatus: 'completed' as const,
    };

    // Use upsert to create or update
    const savedProduct = await Product.findOneAndUpdate(
      {
        userId,
        workspaceId,
        marketplace,
        externalId: productDoc.externalId,
      },
      productDoc,
      {
        upsert: true,
        new: true,
      }
    );

    return savedProduct;
  }

  /**
   * Marketplace-specific product list fetchers
   */
  private static async fetchShopifyProducts(credentials: any): Promise<Array<{ externalId: string }>> {
    // Simulate Shopify API call
    // In real implementation, this would call Shopify's products API
    const mockProducts = [];
    for (let i = 1; i <= 100; i++) {
      mockProducts.push({ externalId: `shopify_product_${i}` });
    }
    return mockProducts;
  }

  private static async fetchVtexProducts(credentials: any): Promise<Array<{ externalId: string }>> {
    // Simulate VTEX API call
    const mockProducts = [];
    for (let i = 1; i <= 50; i++) {
      mockProducts.push({ externalId: `vtex_product_${i}` });
    }
    return mockProducts;
  }

  private static async fetchWooCommerceProducts(credentials: any): Promise<Array<{ externalId: string }>> {
    // Simulate WooCommerce API call
    const mockProducts = [];
    for (let i = 1; i <= 75; i++) {
      mockProducts.push({ externalId: `woo_product_${i}` });
    }
    return mockProducts;
  }

  private static async fetchMercadoLibreProducts(credentials: any): Promise<Array<{ externalId: string }>> {
    // Simulate MercadoLibre API call
    const mockProducts = [];
    for (let i = 1; i <= 25; i++) {
      mockProducts.push({ externalId: `ml_product_${i}` });
    }
    return mockProducts;
  }

  /**
   * Marketplace-specific product detail fetchers
   */
  private static async fetchShopifyProductDetails(productId: string, credentials: any): Promise<any> {
    // Mock Shopify product details
    return {
      id: productId,
      title: `Shopify Product ${productId}`,
      description: `Description for ${productId}`,
      price: Math.random() * 100,
      currency: 'USD',
      image: `https://example.com/images/${productId}.jpg`,
      url: `https://store.myshopify.com/products/${productId}`,
      handle: productId.toLowerCase().replace(/_/g, '-'),
      category: 'Electronics',
      tags: ['shopify', 'product'],
      variants: [],
      inventory: {
        quantity: Math.floor(Math.random() * 100),
        inStock: true,
      },
    };
  }

  private static async fetchVtexProductDetails(productId: string, credentials: any): Promise<any> {
    // Mock VTEX product details
    return {
      id: productId,
      name: `VTEX Product ${productId}`,
      description: `Description for ${productId}`,
      price: Math.random() * 200,
      currency: 'USD',
      imageUrl: `https://example.com/images/${productId}.jpg`,
      url: `https://store.vtexcommercestable.com.br/p/${productId}`,
      category: 'Fashion',
      tags: ['vtex', 'product'],
    };
  }

  /**
   * Utility function to add delay
   */
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Job processor function for Bull queue
 */
export const processMarketplaceSync = MarketplaceSyncProcessor.processMarketplaceSync.bind(MarketplaceSyncProcessor);
export const processProductBatch = MarketplaceSyncProcessor.processProductBatch.bind(MarketplaceSyncProcessor);