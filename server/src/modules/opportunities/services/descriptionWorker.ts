import Product from '@/products/models/Product';
import aiService from './aiService';
import ProductHistoryService from '@/products/services/ProductHistoryService';

export interface AIDescriptionJob {
  productId: string;
  workspaceId: string;
  userId: string;
  marketplace: string;
  batchId?: string;
  totalInBatch?: number;
  currentIndex?: number;
}

/**
 * Process a single AI description generation job
 */
export async function processAIDescriptionJob(job: { id: string; data: AIDescriptionJob; progress: (value: number) => Promise<void> }): Promise<void> {
  const { productId, workspaceId, userId, marketplace, totalInBatch, currentIndex } = job.data;

  console.log(`[Worker] Processing AI description for product ${productId} (${currentIndex}/${totalInBatch || '?'})`);

  try {
    // Find the product
    const product = await Product.findOne({ _id: productId, workspaceId });

    if (!product) {
      console.error(`[Worker] Product not found: ${productId}`);
      return;
    }

    // Mark cachedDescription as pending (if not already)
    const existingCached = product.cachedDescriptions?.find(
      (cached: any) => cached.platform === marketplace
    );

    if (!existingCached) {
      // Create a processing entry with empty content
      product.cachedDescriptions = product.cachedDescriptions || [];
      product.cachedDescriptions.push({
        platform: marketplace as any,
        content: '',
        confidence: 0,
        keywords: [],
        tokens: 0,
        createdAt: new Date(),
        status: 'processing'
      });
      await product.save();
    } else if (existingCached.status !== 'processing') {
      // Update status to processing
      existingCached.status = 'processing';
      existingCached.content = '';
      await product.save();
    }

    // Create history entry for generation start
    const historyEntry = await ProductHistoryService.createAIOptimizationHistory({
      workspaceId: workspaceId.toString(),
      userId: userId.toString(),
      productId,
      actionType: 'AI_OPTIMIZATION_GENERATED',
      marketplace,
      aiModel: 'gpt-3.5-turbo',
      originalContent: product.description || ''
    });

    // Generate AI description
    const productData = {
      title: product.title,
      description: product.description,
      price: product.price || 0,
      marketplace: product.marketplace || marketplace,
      inventory: product.inventory,
      sku: product.sku,
      productType: product.productType,
      images: product.images?.map((img: any) => img.url),
      tags: product.tags
    };

    const result = await aiService.generateProductDescription(productData);

    // Update product with generated description
    const cachedIndex = product.cachedDescriptions?.findIndex(
      (cached: any) => cached.platform === marketplace
    );

    if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
      // Update existing cached description
      product.cachedDescriptions[cachedIndex] = {
        platform: marketplace as any,
        content: result.description,
        confidence: result.confidence,
        keywords: extractKeywords(result.description, product.tags || []),
        tokens: result.tokens,
        createdAt: new Date(),
        status: 'pending' // Keep as pending until user accepts/rejects
      };
    } else {
      // Add new cached description
      product.cachedDescriptions = product.cachedDescriptions || [];
      product.cachedDescriptions.push({
        platform: marketplace as any,
        content: result.description,
        confidence: result.confidence,
        keywords: extractKeywords(result.description, product.tags || []),
        tokens: result.tokens,
        createdAt: new Date(),
        status: 'pending'
      });
    }

    await product.save();

    // Update history with success
    await ProductHistoryService.markCompleted(
      historyEntry._id.toString(),
      'SUCCESS',
      {
        confidence: result.confidence,
        tokensUsed: result.tokens,
        newContent: result.description,
        keywords: extractKeywords(result.description, product.tags || [])
      }
    );

    console.log(`✅ [Worker] AI description generated for product ${productId}`);

  } catch (error: any) {
    console.error(`❌ [Worker] Failed to generate AI description for product ${productId}:`, error);

    // Update product with error status
    try {
      const product = await Product.findOne({ _id: productId, workspaceId });
      if (product) {
        const cachedIndex = product.cachedDescriptions?.findIndex(
          (cached: any) => cached.platform === marketplace
        );

        if (cachedIndex !== undefined && cachedIndex >= 0 && product.cachedDescriptions) {
          product.cachedDescriptions[cachedIndex].status = 'rejected';
          product.cachedDescriptions[cachedIndex].content = `Error: ${error.message}`;
          await product.save();
        }
      }
    } catch (updateError) {
      console.error('Failed to update product with error status:', updateError);
    }

    // Log error to history
    await ProductHistoryService.createErrorHistory({
      workspaceId: workspaceId.toString(),
      userId: userId.toString(),
      productId,
      actionType: 'SYNC_FAILED', // Use valid action type
      errorMessage: error.message,
      marketplace
    });
  }
}

/**
 * Extract keywords from content
 */
function extractKeywords(content: string, existingTags: string[] = []): string[] {
  const words = content.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);

  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const keywords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);

  return [...new Set([...existingTags, ...keywords])].slice(0, 15);
}
