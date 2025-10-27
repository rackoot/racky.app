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
import { VtexCredentials } from '@/marketplaces/services/marketplaceService';
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
      // Update job progress
      await job.progress(10);

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

      await job.progress(20);

      // Fetch product list from marketplace
      console.log(`📊 Fetching product list from ${marketplace}...`);
      const productList = await MarketplaceSyncProcessor.fetchMarketplaceProducts(
        marketplace,
        connection.credentials,
        filters
      );

      const totalProducts = productList.length;
      console.log(`📦 Found ${totalProducts} products to sync`);

      await job.progress(30);

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
    credentials: any,
    filters?: any
  ): Promise<Array<{ externalId: string }>> {
    // This would call the actual marketplace APIs
    // For now, we'll simulate with the existing marketplace service
    try {
      switch (marketplace.toLowerCase()) {
        case 'shopify':
          return await MarketplaceSyncProcessor.fetchShopifyProducts(credentials, filters);
        case 'vtex':
          return await MarketplaceSyncProcessor.fetchVtexProducts(credentials, filters);
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
    credentials: any,
    filters?: ProductSyncFilters
  ): Promise<Array<{ externalId: string }>> {
    // Simulate Shopify API call
    // In real implementation, this would call Shopify's products API
    // TODO: Implement filters for Shopify
    const mockProducts = [];
    for (let i = 1; i <= 100; i++) {
      mockProducts.push({ externalId: `shopify_product_${i}` });
    }
    return mockProducts;
  }

  private static async fetchVtexProducts(
    credentials: VtexCredentials,
    filters?: ProductSyncFilters
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

  private static async fetchVtexProductDetails(productId: string, credentials: VtexCredentials): Promise<any> {
    try {
      console.log(`[VTEX Processor] Fetching details for product ${productId}...`);

      // Fetch product and SKU IDs first to get the primary SKU
      const productIdsResponse = await VtexService.fetchProductAndSkuIds(credentials, 1, 100);

      // Validate that response.data is an array (VTEX API can return null/undefined)
      const responseData = Array.isArray(productIdsResponse.data) ? productIdsResponse.data : [];

      // Find the product in the response
      const productData = responseData.find(item => item.productId.toString() === productId);

      if (!productData || !productData.skuIds || productData.skuIds.length === 0) {
        throw new Error(`Product ${productId} has no SKUs`);
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