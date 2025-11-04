import {
  MarketplaceSyncJobData,
  ProductBatchJobData,
  JobType,
  JobPriority,
} from '@/common/types/jobTypes';
import { ProductSyncFilters, DEFAULT_SYNC_FILTERS } from '@/common/types/syncFilters';
import { applyVtexFilters } from '@/common/utils/vtexFilters';
import rabbitMQService from '@/common/services/rabbitMQService';
import Job from '@/common/models/Job';
import JobHistory from '@/common/models/JobHistory';
// import { marketplaceService } from '@/marketplaces/services/marketplaces';
import StoreConnection from '@/stores/models/StoreConnection';
import Product from '@/products/models/Product';
import ProductHistoryService from '@/products/services/ProductHistoryService';
import { VtexService, VtexCompleteProduct } from '@/marketplaces/services/vtexService';
import { ShopifyService, ShopifyCompleteProduct } from '@/marketplaces/services/shopifyService';
import { VtexCredentials, ShopifyCredentials } from '@/marketplaces/services/marketplaceService';
import { PlatformType } from '@/products/models/Product';

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
  static async processMarketplaceSync(job: any): Promise<{
    success: boolean;
    totalProducts: number;
    totalBatches: number;
    message: string;
  }> {
    const { userId, workspaceId, connectionId, marketplace, estimatedProducts, filters } = job.data;

    console.log(`🔄 Starting marketplace sync for user ${userId}, connection ${connectionId}`);
    console.log(`🔍 Filters:`, JSON.stringify(filters, null, 2));

    try {
      // Update job progress to 5% - starting
      await job.progress(5);

      // Get store connection details
      const connection = await StoreConnection.findOne({
        _id: connectionId,
        workspaceId: workspaceId
      });

      if (!connection) {
        throw new Error(`Store connection ${connectionId} not found`);
      }

      // Check if connection matches the requested marketplace
      if (connection.marketplaceType !== marketplace || !connection.isActive) {
        throw new Error(`Marketplace ${marketplace} not found or inactive`);
      }

      await job.progress(10);

      // Get early estimate of product count
      console.log(`📊 Getting estimated product count from ${marketplace}...`);
      let estimatedTotal: number | null = 0;

      try {
        if (marketplace.toLowerCase() === 'vtex') {
          // VTEX API doesn't support filter-aware estimates
          // Filters are applied post-fetch after getting complete product data
          // Skip early estimate to avoid showing misleading numbers
          console.log('[VTEX] Skipping early estimate - filters applied post-fetch');
          estimatedTotal = null; // Will show "Scanning catalog..." in UI
        } else if (marketplace.toLowerCase() === 'shopify') {
          estimatedTotal = await ShopifyService.getEstimatedProductCount(connection.credentials as ShopifyCredentials, filters);
        }

        if (estimatedTotal) {
          console.log(`📈 Estimated ${estimatedTotal} products to sync`);
        }

        // Store estimated count in parent job metadata
        await Job.findOneAndUpdate(
          { jobId: job.id!.toString() },
          {
            $set: {
              'metadata.estimatedTotal': estimatedTotal,
              'metadata.syncedProducts': 0,
              'metadata.totalProducts': 0,  // Will be updated when we know exact count
              'metadata.phase': 'scanning'  // Indicate we're scanning/filtering
            }
          }
        );
      } catch (error) {
        console.warn(`⚠️ Could not get estimate:`, error);
        // Continue without estimate
      }

      await job.progress(15);

      // Fetch product list from marketplace
      console.log(`📊 Fetching complete product list from ${marketplace}...`);
      const productList = await MarketplaceSyncProcessor.fetchMarketplaceProducts(
        marketplace,
        connection.credentials,
        filters,
        workspaceId,
        userId,
        connectionId
      );

      const totalProducts = productList.length;
      console.log(`📦 Found ${totalProducts} products to sync`);

      // Update parent job with exact total and change status/phase to syncing
      await Job.findOneAndUpdate(
        { jobId: job.id!.toString() },
        {
          $set: {
            'metadata.totalProducts': totalProducts,
            'metadata.syncedProducts': 0,
            'metadata.phase': 'syncing',  // Changed from scanning to syncing
            status: 'processing_batches',
            progress: 0  // Reset to 0 now that we're starting actual product sync
          }
        }
      );

      await job.progress(20);

      // Calculate batches
      const batchSize = MarketplaceSyncProcessor.BATCH_SIZE;
      const totalBatches = Math.ceil(totalProducts / batchSize);

      // Create batch jobs
      const batchJobs: Promise<any>[] = [];

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
          filters,
          parentJobId: job.id!.toString(),
          createdAt: new Date(),
          priority: JobPriority.NORMAL,
        };

        // Add batch job to product-processing queue
        const batchJobPromise = rabbitMQService.addJob<ProductBatchJobData>(
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

      const result = {
        success: true,
        totalProducts,
        totalBatches,
        message: `Created ${totalBatches} batch jobs for ${totalProducts} products`,
      };

      console.log(`✅ Marketplace sync job created batches: ${result.message}`);
      console.log(`⏳ Parent job will remain in 'processing_batches' until all products are synced`);

      return result;

    } catch (error) {
      console.error(`❌ Marketplace sync failed:`, error);
      throw error;
    }
  }

  /**
   * Process a product batch job
   */
  static async processProductBatch(job: any): Promise<{
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
        workspaceId: workspaceId
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

          let savedProduct;

          // For VTEX, check if draft product already exists (created during scanning phase)
          if (marketplace.toLowerCase() === 'vtex') {
            const existingDraft = await Product.findOne({
              workspaceId,
              userId,
              storeConnectionId: connectionId,
              marketplace: 'vtex',
              externalId: productId,
              status: 'DRAFT'
            });

            if (existingDraft) {
              // Draft exists - just update status to ACTIVE (data already complete)
              console.log(`[VTEX Processor] Activating draft product ${productId}`);
              existingDraft.status = 'ACTIVE';
              existingDraft.lastSyncedAt = new Date();
              savedProduct = await existingDraft.save();

              results.push({ externalId: productId, status: 'success' });
              processedCount++;

              // Create history entry
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

              // Update parent job progress (atomic increment)
              try {
                const parentJobId = job.data.parentJobId;
                if (parentJobId) {
                  await Job.findOneAndUpdate(
                    { jobId: parentJobId },
                    { $inc: { 'metadata.syncedProducts': 1 } }
                  );

                  const parentJob = await Job.findOne({ jobId: parentJobId });
                  if (parentJob && parentJob.metadata) {
                    const { syncedProducts = 0, totalProducts = 1 } = parentJob.metadata;
                    const progress = Math.min(100, Math.round((syncedProducts / totalProducts) * 100));

                    await Job.findOneAndUpdate(
                      { jobId: parentJobId },
                      { $set: { progress } }
                    );
                  }
                }
              } catch (error) {
                console.error('Error updating parent job progress:', error);
              }

              continue; // Skip to next product - no need to fetch data again
            }
          }

          // Fetch product details from marketplace (for non-VTEX or if draft doesn't exist)
          const productData = await MarketplaceSyncProcessor.fetchProductDetails(
            marketplace,
            productId,
            connection.credentials
          );

          // Check if product data is valid (null means product has no SKUs or other issues)
          if (!productData) {
            console.warn(`⚠️ Skipping product ${productId}: No SKUs or invalid product data`);
            results.push({
              externalId: productId,
              status: 'failed',
              error: 'Product has no SKUs or invalid data'
            });
            failedCount++;
            continue; // Skip to next product
          }

          // Save or update product in database
          savedProduct = await MarketplaceSyncProcessor.saveProduct(userId, workspaceId, connectionId, marketplace, productData);

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

          // Update parent job progress (atomic increment)
          try {
            const parentJobId = job.data.parentJobId;
            if (parentJobId) {
              // Atomically increment syncedProducts counter
              await Job.findOneAndUpdate(
                { jobId: parentJobId },
                { $inc: { 'metadata.syncedProducts': 1 } }
              );

              // Update parent job progress based on synced count
              const parentJob = await Job.findOne({ jobId: parentJobId });
              if (parentJob && parentJob.metadata) {
                const { syncedProducts = 0, totalProducts = 1 } = parentJob.metadata;
                const progress = Math.min(100, Math.round((syncedProducts / totalProducts) * 100));

                await Job.findOneAndUpdate(
                  { jobId: parentJobId },
                  { $set: { progress } }
                );
              }
            }
          } catch (error) {
            console.warn(`⚠️ Failed to update parent job progress:`, error);
            // Don't fail the batch job if parent update fails
          }

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

      // Check if this is the last batch and mark parent job as completed
      try {
        const parentJobId = job.data.parentJobId;
        if (parentJobId) {
          // Find all child jobs for this parent
          const allChildJobs = await Job.find({ parentJobId });
          const completedChildJobs = allChildJobs.filter(child =>
            child.status === 'completed' || child.status === 'failed'
          );

          console.log(`📊 Parent job progress: ${completedChildJobs.length}/${allChildJobs.length} batches completed`);

          // If all batches are complete, mark parent as completed
          if (completedChildJobs.length === allChildJobs.length) {
            const parentJob = await Job.findOne({ jobId: parentJobId });
            if (parentJob && parentJob.status === 'processing_batches') {
              await Job.findOneAndUpdate(
                { jobId: parentJobId },
                {
                  $set: {
                    status: 'completed',
                    progress: 100,
                    completedAt: new Date()
                  }
                }
              );
              console.log(`✅ All batches completed! Parent job ${parentJobId} marked as completed`);

              // Update StoreConnection lastSync date
              const connectionId = job.data.connectionId;
              if (connectionId) {
                await StoreConnection.findByIdAndUpdate(
                  connectionId,
                  {
                    $set: {
                      lastSync: new Date(),
                      syncStatus: 'completed'
                    }
                  }
                );
                console.log(`✅ Updated lastSync for connection ${connectionId}`);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to check/update parent job completion:`, error);
        // Don't fail the batch job if parent update fails
      }

      return result;

    } catch (error) {
      console.error(`❌ Product batch processing failed:`, error);

      // Update lastSync even on failure to track last attempt
      try {
        const connectionId = job.data.connectionId;
        if (connectionId) {
          await StoreConnection.findByIdAndUpdate(
            connectionId,
            {
              $set: {
                lastSync: new Date(),
                syncStatus: 'failed'
              }
            }
          );
          console.log(`⚠️ Updated lastSync for failed connection ${connectionId}`);
        }
      } catch (updateError) {
        console.warn('Failed to update lastSync on error:', updateError);
      }

      throw error;
    }
  }

  /**
   * Fetch product list from marketplace
   */
  private static async fetchMarketplaceProducts(
    marketplace: string,
    credentials: any,
    filters?: any,
    workspaceId?: string,
    userId?: string,
    connectionId?: string
  ): Promise<Array<{ externalId: string }>> {
    // This would call the actual marketplace APIs
    // For now, we'll simulate with the existing marketplace service
    try {
      switch (marketplace.toLowerCase()) {
        case 'shopify':
          return await MarketplaceSyncProcessor.fetchShopifyProducts(credentials, filters);
        case 'vtex':
          return await MarketplaceSyncProcessor.fetchVtexProducts(credentials, filters, workspaceId, userId, connectionId);
        case 'woocommerce':
          return await MarketplaceSyncProcessor.fetchWooCommerceProducts(credentials, filters);
        case 'mercadolibre':
          return await MarketplaceSyncProcessor.fetchMercadoLibreProducts(credentials, filters);
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
  ): Promise<any | null> {
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
    const externalId = productData.id || productData.externalId;

    // For VTEX, use the platforms-based approach (same as sync system)
    if (marketplace === 'vtex') {
      const vtexPlatform = {
        platform: 'vtex' as PlatformType,
        platformId: externalId,
        platformSku: productData.sku || productData.variants?.[0]?.sku || '',
        platformPrice: productData.price || 0,
        platformInventory: productData.inventory?.quantity || 0,
        platformStatus: productData.isActive ? 'active' : 'draft',
        lastSyncAt: new Date()
      };

      // Find existing product by platform ID
      const existingProduct = await Product.findOne({
        workspaceId: workspaceId,
        'platforms.platformId': externalId
      });

      if (existingProduct) {
        // Update existing product
        const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'vtex');

        if (platformIndex >= 0) {
          existingProduct.platforms[platformIndex] = vtexPlatform;
        } else {
          existingProduct.platforms.push(vtexPlatform);
        }

        // Update product fields
        existingProduct.title = productData.title || productData.name;
        existingProduct.description = productData.description || '';
        existingProduct.price = productData.price || 0;
        existingProduct.compareAtPrice = productData.compareAtPrice;
        existingProduct.sku = productData.sku || '';
        existingProduct.inventory = productData.inventory?.quantity || 0;
        existingProduct.vendor = productData.brand || '';
        existingProduct.productType = productData.category || '';
        existingProduct.images = productData.images || [];
        existingProduct.variants = productData.variants || [];
        existingProduct.status = productData.isActive ? 'ACTIVE' : 'DRAFT';
        existingProduct.lastSyncedAt = new Date();

        await existingProduct.save();
        return existingProduct;

      } else {
        // Create new product
        const newProduct = new Product({
          userId,
          workspaceId,
          storeConnectionId: connectionId,
          title: productData.title || productData.name,
          description: productData.description || '',
          price: productData.price || 0,
          compareAtPrice: productData.compareAtPrice,
          currency: productData.currency || 'BRL',
          sku: productData.sku || '',
          inventory: productData.inventory?.quantity || 0,
          vendor: productData.brand || '',
          productType: productData.category || '',
          images: productData.images || [],
          variants: productData.variants || [],
          platforms: [vtexPlatform],
          status: productData.isActive ? 'ACTIVE' : 'DRAFT',
          marketplace: 'vtex',
          externalId: externalId,
          lastSyncedAt: new Date()
        });

        await newProduct.save();
        return newProduct;
      }
    }

    // For Shopify, use the platforms-based approach (same as saveShopifyProduct)
    if (marketplace === 'shopify') {
      const shopifyPlatform = {
        platform: 'shopify' as PlatformType,
        platformId: externalId,
        platformSku: productData.handle,
        platformPrice: productData.price || 0,
        platformInventory: productData.inventory?.quantity || 0,
        platformStatus: productData.status,
        lastSyncAt: new Date()
      };

      // Find existing product by Shopify ID or title
      const existingProduct = await Product.findOne({
        workspaceId: workspaceId,
        $or: [
          { shopifyId: externalId },
          { 'platforms.platformId': externalId },
          { title: productData.title, storeConnectionId: connectionId }
        ]
      });

      if (existingProduct) {
        // Update existing product with ALL data from Shopify
        const platformIndex = existingProduct.platforms.findIndex((p: any) => p.platform === 'shopify');

        if (platformIndex >= 0) {
          existingProduct.platforms[platformIndex] = shopifyPlatform;
        } else {
          existingProduct.platforms.push(shopifyPlatform);
        }

        // Update ALL fields from Shopify (source of truth)
        existingProduct.title = productData.title;
        existingProduct.description = productData.description || '';
        existingProduct.price = productData.price || 0;
        existingProduct.compareAtPrice = productData.variants[0]?.compareAtPrice;
        existingProduct.sku = productData.handle;
        existingProduct.inventory = productData.inventory?.quantity || 0;
        existingProduct.vendor = productData.vendor || '';
        existingProduct.productType = productData.productType || '';
        existingProduct.tags = productData.tags || [];
        existingProduct.images = productData.images || [];  // Already transformed with shopifyId, url, altText
        existingProduct.variants = productData.variants || [];  // Already transformed with all fields
        existingProduct.status = productData.isActive ? 'active' : 'archived';
        existingProduct.shopifyId = externalId;
        existingProduct.handle = productData.handle;
        existingProduct.shopifyUpdatedAt = new Date(productData.updatedAt);
        existingProduct.lastSyncedAt = new Date();

        await existingProduct.save();
        return existingProduct;

      } else {
        // Create new product
        const newProduct = new Product({
          workspaceId,
          userId,
          storeConnectionId: connectionId,
          title: productData.title,
          description: productData.description || '',
          price: productData.price || 0,
          compareAtPrice: productData.variants[0]?.compareAtPrice,
          sku: productData.handle,
          inventory: productData.inventory?.quantity || 0,
          vendor: productData.vendor || '',
          productType: productData.productType || '',
          tags: productData.tags || [],
          images: productData.images || [],  // Already transformed
          variants: productData.variants || [],  // Already transformed
          platforms: [shopifyPlatform],
          status: 'active',
          shopifyId: externalId,
          handle: productData.handle,
          shopifyCreatedAt: new Date(productData.createdAt),
          shopifyUpdatedAt: new Date(productData.updatedAt),
          // Legacy fields for backward compatibility
          marketplace: 'shopify',
          externalId: externalId,
          stock: productData.inventory?.quantity || 0,
          lastSyncedAt: new Date()
        });

        await newProduct.save();
        return newProduct;
      }
    }

    // Original logic for other marketplaces
    const productDoc = {
      userId,
      workspaceId,
      storeConnectionId: connectionId,
      marketplace,
      externalId: externalId,
      title: productData.title || productData.name,
      description: productData.description || '',
      price: productData.price || 0,
      currency: productData.currency || 'USD',
      imageUrl: productData.image || productData.imageUrl,
      url: productData.url,
      category: productData.category,
      tags: productData.tags || [],
      variants: productData.variants || [],
      inventory: productData.inventory?.quantity || 0,
      seo: {
        metaTitle: productData.seo?.metaTitle || productData.title,
        metaDescription: productData.seo?.metaDescription || productData.description,
        slug: productData.seo?.slug || productData.handle,
      },
      lastSyncedAt: new Date(),
      syncStatus: 'completed' as const,
    };

    const savedProduct = await Product.findOneAndUpdate(
      {
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
  private static async fetchShopifyProducts(
    credentials: ShopifyCredentials,
    filters?: ProductSyncFilters
  ): Promise<Array<{ externalId: string }>> {
    try {
      console.log('[Shopify Processor] Fetching product IDs from Shopify...');

      // Use default filters if none provided
      const appliedFilters = filters || DEFAULT_SYNC_FILTERS;
      console.log('[Shopify Processor] Filters:', JSON.stringify(appliedFilters, null, 2));

      // Fetch product IDs with API-level filtering (no post-filtering needed!)
      const productIds = await ShopifyService.fetchProductIds(credentials, appliedFilters);

      console.log(`[Shopify Processor] Total products fetched: ${productIds.length}`);
      return productIds;

    } catch (error: any) {
      console.error('[Shopify Processor] Error fetching products:', error.message);
      throw new Error(`Failed to fetch Shopify products: ${error.message}`);
    }
  }

  private static async fetchVtexProducts(
    credentials: VtexCredentials,
    filters?: ProductSyncFilters,
    workspaceId?: string,
    userId?: string,
    connectionId?: string
  ): Promise<Array<{ externalId: string }>> {
    try {
      console.log('[VTEX Processor] Fetching product IDs from VTEX...');

      // Use default filters if none provided
      const appliedFilters = filters || DEFAULT_SYNC_FILTERS;
      console.log('[VTEX Processor] Filters:', JSON.stringify(appliedFilters, null, 2));

      const allProductIds: Array<{ externalId: string }> = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 50; // Match sync endpoint
      const maxProducts = 10000; // Safety limit

      while (hasMore && allProductIds.length < maxProducts) {
        const response = await VtexService.fetchProductAndSkuIds(credentials, page, pageSize);

        // Validate that response.data is an array (VTEX API can return null/undefined)
        const responseData = Array.isArray(response.data) ? response.data : [];

        if (responseData.length === 0) {
          hasMore = false;
          break;
        }

        // Fetch complete product data for filtering
        const completeProducts: VtexCompleteProduct[] = [];

        for (const item of responseData) {
          const primarySkuId = item.skuIds[0];

          if (!primarySkuId) {
            console.warn(`[VTEX Processor] Product ${item.productId} has no SKUs, skipping`);
            continue;
          }

          try {
            const productData = await VtexService.fetchCompleteProductData(
              credentials,
              item.productId,
              primarySkuId
            );

            completeProducts.push(productData);
          } catch (error: any) {
            console.error(`[VTEX Processor] Error fetching product ${item.productId}:`, error.message);
            // Continue with other products
          }
        }

        console.log(`[VTEX Processor] Page ${page}: Fetched ${completeProducts.length} complete products`);

        // Apply filters to this batch
        const filteredProducts = applyVtexFilters(completeProducts, appliedFilters);

        // Create draft products immediately if workspace/user/connection provided
        if (workspaceId && userId && connectionId) {
          for (const vtexProduct of filteredProducts) {
            try {
              const { product, sku, pricing, inventory } = vtexProduct;

              // Create draft product with all available data
              await Product.create({
                workspaceId,
                userId,
                storeConnectionId: connectionId,
                title: product.Name || sku.ProductName,
                description: product.Description || product.DescriptionShort || '',
                price: MarketplaceSyncProcessor.calculateVtexPrice(pricing),
                compareAtPrice: pricing?.listPrice || undefined,
                currency: 'BRL',
                sku: sku.AlternateIds?.RefId || product.RefId || '',
                inventory: MarketplaceSyncProcessor.calculateVtexInventory(inventory),
                vendor: sku.BrandName || '',
                productType: product.CategoryId?.toString() || '',
                images: MarketplaceSyncProcessor.extractVtexImages(sku),
                variants: [{
                  id: sku.Id.toString(),
                  title: sku.NameComplete || sku.SkuName,
                  sku: sku.AlternateIds?.RefId || product.RefId || '',
                  price: MarketplaceSyncProcessor.calculateVtexPrice(pricing),
                  compareAtPrice: pricing?.listPrice || undefined,
                  inventory: MarketplaceSyncProcessor.calculateVtexInventory(inventory),
                  barcode: sku.AlternateIds?.Ean || undefined,
                  weight: sku.RealDimension?.realWeight || sku.Dimension?.weight || undefined,
                  isActive: sku.IsActive
                }],
                platforms: [{
                  platform: 'vtex' as PlatformType,
                  platformId: product.Id.toString(),
                  platformSku: sku.Id.toString(),
                  platformPrice: MarketplaceSyncProcessor.calculateVtexPrice(pricing),
                  platformInventory: MarketplaceSyncProcessor.calculateVtexInventory(inventory),
                  platformStatus: product.IsActive && sku.IsActive ? 'active' : 'draft',
                  lastSyncAt: new Date()
                }],
                status: 'DRAFT', // Mark as draft during scanning phase
                marketplace: 'vtex',
                externalId: product.Id.toString(),
                lastSyncedAt: new Date()
              });

              console.log(`[VTEX Processor] Created draft product ${product.Id}`);
            } catch (error: any) {
              console.error(`[VTEX Processor] Failed to create draft for ${vtexProduct.product.Id}:`, error.message);
              // Continue with other products
            }
          }
        }

        // Extract product IDs from filtered products
        const productIds = filteredProducts.map(item => ({
          externalId: item.product.Id.toString()
        }));

        allProductIds.push(...productIds);

        console.log(`[VTEX Processor] Page ${page}: ${productIds.length} products passed filters (Total so far: ${allProductIds.length})`);

        // Check if there are more pages
        hasMore = responseData.length === pageSize;
        page++;

        // Safety limit to avoid infinite loops
        if (page > 200) {
          console.warn('[VTEX Processor] Reached max page limit (200)');
          break;
        }
      }

      console.log(`[VTEX Processor] Total filtered products: ${allProductIds.length}`);
      return allProductIds;

    } catch (error: any) {
      console.error('[VTEX Processor] Error fetching products:', error.message);
      throw new Error(`Failed to fetch VTEX products: ${error.message}`);
    }
  }

  private static async fetchWooCommerceProducts(
    credentials: any,
    filters?: ProductSyncFilters
  ): Promise<Array<{ externalId: string }>> {
    // Simulate WooCommerce API call
    // TODO: Implement filters for WooCommerce
    const mockProducts = [];
    for (let i = 1; i <= 75; i++) {
      mockProducts.push({ externalId: `woo_product_${i}` });
    }
    return mockProducts;
  }

  private static async fetchMercadoLibreProducts(
    credentials: any,
    filters?: ProductSyncFilters
  ): Promise<Array<{ externalId: string }>> {
    // Simulate MercadoLibre API call
    // TODO: Implement filters for MercadoLibre
    const mockProducts = [];
    for (let i = 1; i <= 25; i++) {
      mockProducts.push({ externalId: `ml_product_${i}` });
    }
    return mockProducts;
  }

  /**
   * Marketplace-specific product detail fetchers
   */
  private static async fetchShopifyProductDetails(productId: string, credentials: ShopifyCredentials): Promise<any> {
    try {
      console.log(`[Shopify Processor] Fetching details for product ${productId}...`);

      // Fetch complete product data using ShopifyService
      const completeData = await ShopifyService.fetchCompleteProductData(
        credentials,
        productId
      );

      // Transform to internal product format
      return MarketplaceSyncProcessor.transformShopifyProductData(completeData);

    } catch (error: any) {
      console.error(`[Shopify Processor] Error fetching product ${productId}:`, error.message);
      throw new Error(`Failed to fetch Shopify product ${productId}: ${error.message}`);
    }
  }

  /**
   * Transform Shopify product data to internal format
   */
  private static transformShopifyProductData(shopifyProduct: ShopifyCompleteProduct): any {
    // Calculate total inventory from all variants
    const totalInventory = shopifyProduct.variants.reduce(
      (sum, variant) => sum + variant.inventoryQuantity,
      0
    );

    // Get price from first variant (Shopify products must have at least one variant)
    const primaryVariant = shopifyProduct.variants[0];
    const price = primaryVariant ? parseFloat(primaryVariant.price) : 0;

    return {
      id: shopifyProduct.id,
      title: shopifyProduct.title,
      description: shopifyProduct.description,
      price: price,
      currency: 'USD', // Shopify doesn't return currency in this query, assume USD
      // Transform images to array of objects with metadata (matches saveShopifyProduct format)
      images: shopifyProduct.images.map(img => ({
        shopifyId: img.id,
        url: img.url,
        altText: img.altText || ''
      })),
      url: `https://store.myshopify.com/products/${shopifyProduct.handle}`,
      handle: shopifyProduct.handle,
      category: shopifyProduct.productType,
      vendor: shopifyProduct.vendor,
      productType: shopifyProduct.productType,
      tags: shopifyProduct.tags,
      status: shopifyProduct.status,
      // Transform variants with all required fields (matches saveShopifyProduct format)
      variants: shopifyProduct.variants.map(variant => ({
        id: variant.id,
        shopifyId: variant.id,  // Add shopifyId for consistency
        title: variant.title,
        price: variant.price || '0',  // Keep as string for consistency
        compareAtPrice: variant.compareAtPrice || undefined,
        sku: variant.sku || '',
        inventory: variant.inventoryQuantity || 0,  // Add inventory field
        inventoryQuantity: variant.inventoryQuantity || 0,
        taxable: variant.taxable
      })),
      inventory: {
        quantity: totalInventory,
        inStock: totalInventory > 0
      },
      // Add Shopify-specific tracking fields
      shopifyId: shopifyProduct.id,
      shopifyCreatedAt: shopifyProduct.createdAt,
      shopifyUpdatedAt: shopifyProduct.updatedAt,
      isActive: shopifyProduct.status === 'ACTIVE',
      createdAt: shopifyProduct.createdAt,
      updatedAt: shopifyProduct.updatedAt
    };
  }

  private static async fetchVtexProductDetails(productId: string, credentials: VtexCredentials): Promise<any | null> {
    try {
      console.log(`[VTEX Processor] Fetching details for product ${productId}...`);

      // Fetch product and SKU IDs first to get the primary SKU
      const productIdsResponse = await VtexService.fetchProductAndSkuIds(credentials, 1, 100);

      // Validate that response.data is an array (VTEX API can return null/undefined)
      const responseData = Array.isArray(productIdsResponse.data) ? productIdsResponse.data : [];

      // Find the product in the response
      const productData = responseData.find(item => item.productId.toString() === productId);

      if (!productData || !productData.skuIds || productData.skuIds.length === 0) {
        console.warn(`[VTEX Processor] Product ${productId} has no SKUs, skipping`);
        return null; // Return null instead of throwing
      }

      // Use the first SKU
      const primarySkuId = productData.skuIds[0];

      // Fetch complete product data with pricing and inventory
      const completeData = await VtexService.fetchCompleteProductData(
        credentials,
        parseInt(productId),
        primarySkuId
      );

      // Transform to format expected by saveProduct()
      return MarketplaceSyncProcessor.transformVtexProductData(completeData);

    } catch (error: any) {
      console.error(`[VTEX Processor] Error fetching product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Transform VTEX complete product data to processor format
   */
  private static transformVtexProductData(vtexProduct: VtexCompleteProduct): any {
    const { product, sku, pricing, inventory } = vtexProduct;

    // Calculate price
    let price = 0;
    let compareAtPrice = 0;
    let cost = 0;

    if (pricing) {
      if (pricing.fixedPrices && pricing.fixedPrices.length > 0) {
        price = pricing.fixedPrices[0].value;
        compareAtPrice = pricing.fixedPrices[0].listPrice || pricing.listPrice || 0;
      } else {
        price = pricing.basePrice;
        compareAtPrice = pricing.listPrice || 0;
      }
      cost = pricing.costPrice || 0;
    }

    // Calculate inventory
    let totalInventory = 0;
    if (inventory && inventory.balance) {
      totalInventory = inventory.balance.reduce((total, warehouse) => {
        if (warehouse.hasUnlimitedQuantity) {
          return 999999;
        }
        return total + (warehouse.availableQuantity || warehouse.totalQuantity || 0);
      }, 0);
    }

    // Extract images
    const images = (sku.Images?.map(img => ({
      url: img.ImageUrl,
      altText: img.ImageName || ''
    })) || []).filter(img => img.url);

    // Fallback to single ImageUrl if no images array
    if (images.length === 0 && sku.ImageUrl) {
      images.push({
        url: sku.ImageUrl,
        altText: sku.NameComplete || ''
      });
    }

    // Build variants array (VTEX SKUs as variants)
    const variants = [{
      id: sku.Id.toString(),
      title: sku.NameComplete || sku.SkuName,
      sku: sku.AlternateIds?.RefId || product.RefId || '',
      price: price,
      compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
      inventory: totalInventory,
      barcode: sku.AlternateIds?.Ean || undefined,
      weight: sku.RealDimension?.realWeight || sku.Dimension?.weight || undefined,
      isActive: sku.IsActive
    }];

    return {
      id: product.Id.toString(),
      externalId: product.Id.toString(),
      title: product.Name || sku.ProductName,
      name: product.Name || sku.ProductName,
      description: product.Description || product.DescriptionShort || '',
      price: price,
      compareAtPrice: compareAtPrice > price ? compareAtPrice : undefined,
      cost: cost,
      currency: 'BRL', // TODO: Detect from store settings
      category: product.CategoryId?.toString() || '',
      brand: sku.BrandName || '',
      brandId: sku.BrandId || product.BrandId?.toString() || '',
      sku: sku.AlternateIds?.RefId || product.RefId || '',
      tags: [],
      images: images,
      variants: variants,
      inventory: {
        quantity: totalInventory,
        inStock: totalInventory > 0
      },
      url: `https://vtexcommercestable.com.br/p/${product.Id}`,
      handle: product.LinkId || product.Id.toString(),
      isActive: product.IsActive && sku.IsActive,
      seo: {
        metaTitle: product.Title || product.Name,
        metaDescription: product.MetaTagDescription || product.DescriptionShort,
        slug: product.LinkId
      }
    };
  }

  /**
   * Helper: Calculate VTEX price from pricing data
   */
  private static calculateVtexPrice(pricing: any): number {
    if (!pricing) return 0;

    if (pricing.fixedPrices && pricing.fixedPrices.length > 0) {
      return pricing.fixedPrices[0].value;
    }
    return pricing.basePrice || 0;
  }

  /**
   * Helper: Calculate VTEX inventory from balance data
   */
  private static calculateVtexInventory(inventory: any): number {
    if (!inventory || !inventory.balance) return 0;

    return inventory.balance.reduce((total: number, warehouse: any) => {
      if (warehouse.hasUnlimitedQuantity) return 999999;
      return total + (warehouse.availableQuantity || warehouse.totalQuantity || 0);
    }, 0);
  }

  /**
   * Helper: Extract VTEX images
   */
  private static extractVtexImages(sku: any): any[] {
    const images = (sku.Images?.map((img: any) => ({
      url: img.ImageUrl,
      altText: img.ImageName || ''
    })) || []).filter((img: any) => img.url);

    // Fallback to single ImageUrl
    if (images.length === 0 && sku.ImageUrl) {
      images.push({
        url: sku.ImageUrl,
        altText: sku.NameComplete || ''
      });
    }

    return images;
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