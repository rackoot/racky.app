import { MarketplaceUpdateJobData } from '../../common/types/jobTypes';
import Product from '../../modules/products/models/Product';
import StoreConnection from '../../modules/stores/models/StoreConnection';
import { updateProductDescriptionInMarketplace } from '../../modules/products/services/marketplaceUpdateService';
import ProductHistoryService from '../../modules/products/services/ProductHistoryService';

/**
 * Processor for individual marketplace update jobs
 * Updates product descriptions in external marketplaces via their APIs
 */
export async function processMarketplaceUpdateJob(jobData: MarketplaceUpdateJobData) {
  console.log(`[MarketplaceUpdate] Processing job for product ${jobData.productId} in ${jobData.marketplace}`);
  
  try {
    // Find the product
    const product = await Product.findById(jobData.productId);
    if (!product) {
      throw new Error(`Product ${jobData.productId} not found`);
    }

    // Find the store connection
    const storeConnection = await StoreConnection.findById(jobData.connectionId);
    if (!storeConnection) {
      throw new Error(`Store connection ${jobData.connectionId} not found`);
    }

    // Verify workspace access
    if (product.workspaceId.toString() !== jobData.workspaceId) {
      throw new Error('Product does not belong to the specified workspace');
    }

    if (storeConnection.workspaceId.toString() !== jobData.workspaceId) {
      throw new Error('Store connection does not belong to the specified workspace');
    }

    console.log(`[MarketplaceUpdate] Updating ${product.title} description in ${jobData.marketplace}`);

    // Set product status to updating
    product.updateStatus = 'updating';
    product.lastUpdateAttempt = new Date();
    await product.save();

    // Update description in marketplace
    const updateResult = await updateProductDescriptionInMarketplace(
      jobData.marketplace,
      product,
      jobData.description,
      storeConnection
    );

    // Create history entry
    if (updateResult.success) {
      // Set product status to completed
      product.updateStatus = 'completed';
      product.updateError = undefined;
      await product.save();

      await ProductHistoryService.createProductUpdateHistory({
        workspaceId: jobData.workspaceId,
        userId: jobData.userId,
        productId: jobData.productId,
        actionType: 'DESCRIPTION_UPDATED',
        fieldChanged: 'description',
        oldValue: product.description,
        newValue: jobData.description,
        marketplace: jobData.marketplace
      });

      console.log(`[MarketplaceUpdate] Successfully updated ${product.title} in ${jobData.marketplace}`);
    } else {
      // Set product status to failed
      product.updateStatus = 'failed';
      product.updateError = updateResult.message;
      await product.save();

      // Log error in history
      await ProductHistoryService.createErrorHistory({
        workspaceId: jobData.workspaceId,
        userId: jobData.userId,
        productId: jobData.productId,
        actionType: 'SYNC_FAILED',
        errorMessage: updateResult.message,
        marketplace: jobData.marketplace
      });

      console.error(`[MarketplaceUpdate] Failed to update ${product.title} in ${jobData.marketplace}: ${updateResult.message}`);
      throw new Error(`Marketplace update failed: ${updateResult.message}`);
    }

    return {
      success: true,
      productId: jobData.productId,
      marketplace: jobData.marketplace,
      message: 'Product description updated successfully'
    };

  } catch (error: any) {
    console.error(`[MarketplaceUpdate] Error processing job:`, error);
    
    // Try to log error in history if we have enough info
    try {
      await ProductHistoryService.createErrorHistory({
        workspaceId: jobData.workspaceId,
        userId: jobData.userId,
        productId: jobData.productId,
        actionType: 'SYNC_FAILED',
        errorMessage: error.message,
        marketplace: jobData.marketplace
      });
    } catch (historyError) {
      console.error(`[MarketplaceUpdate] Failed to log error in history:`, historyError);
    }

    throw error;
  }
}