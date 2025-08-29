/**
 * Product Count Service
 * Unified service for counting products by different criteria
 */

interface ProductCountByMarketplace {
  marketplace: string;
  totalProducts: number;
  lastCreated: Date | null;
}

interface ProductCountByStore {
  storeConnectionId: string;
  marketplace: string;
  totalProducts: number;
  lastCreated: Date | null;
}

export class ProductCountService {
  
  /**
   * Get product counts by marketplace for a workspace
   * Uses store connections to determine marketplace types
   */
  static async getProductCountsByMarketplace(workspaceId: string): Promise<ProductCountByMarketplace[]> {
    const { default: Product } = await import('../models/Product');
    const { default: StoreConnection } = await import('@/stores/models/StoreConnection');

    // Get all store connections for this workspace
    const storeConnections = await StoreConnection.find({ workspaceId });
    
    const marketplaceCounts: { [marketplace: string]: ProductCountByMarketplace } = {};
    
    // For each store connection, count products
    for (const connection of storeConnections) {
      const connectionId = connection._id.toString();
      const marketplace = (connection as any).marketplaceType;
      
      if (!marketplace) continue;
      
      // Count products for this store connection
      const products = await Product.find({ 
        workspaceId,
        storeConnectionId: connectionId 
      }).sort({ createdAt: -1 });
      
      const productCount = products.length;
      const lastCreated = products.length > 0 ? products[0].createdAt : null;
      
      // Accumulate counts by marketplace type
      if (marketplaceCounts[marketplace]) {
        marketplaceCounts[marketplace].totalProducts += productCount;
        // Keep the most recent creation date
        if (lastCreated && (!marketplaceCounts[marketplace].lastCreated || lastCreated > marketplaceCounts[marketplace].lastCreated)) {
          marketplaceCounts[marketplace].lastCreated = lastCreated;
        }
      } else {
        marketplaceCounts[marketplace] = {
          marketplace,
          totalProducts: productCount,
          lastCreated
        };
      }
    }
    
    return Object.values(marketplaceCounts);
  }
  
  /**
   * Get product counts by store connection for a workspace
   */
  static async getProductCountsByStore(workspaceId: string): Promise<ProductCountByStore[]> {
    const { default: Product } = await import('../models/Product');
    const { default: StoreConnection } = await import('@/stores/models/StoreConnection');

    // Get all store connections for this workspace
    const storeConnections = await StoreConnection.find({ workspaceId });
    
    const storeCounts: ProductCountByStore[] = [];
    
    // For each store connection, count products
    for (const connection of storeConnections) {
      const connectionId = connection._id.toString();
      const marketplace = (connection as any).marketplaceType || 'unknown';
      
      // Count products for this store connection
      const products = await Product.find({ 
        workspaceId,
        storeConnectionId: connectionId 
      }).sort({ createdAt: -1 });
      
      const productCount = products.length;
      const lastCreated = products.length > 0 ? products[0].createdAt : null;
      
      storeCounts.push({
        storeConnectionId: connectionId,
        marketplace,
        totalProducts: productCount,
        lastCreated
      });
    }
    
    return storeCounts;
  }
  
  /**
   * Get total product count for a workspace
   */
  static async getTotalProductCount(workspaceId: string): Promise<number> {
    const { default: Product } = await import('../models/Product');
    
    return await Product.countDocuments({ workspaceId });
  }
  
  /**
   * Get product count for a specific store connection
   */
  static async getProductCountForStore(workspaceId: string, storeConnectionId: string): Promise<number> {
    const { default: Product } = await import('../models/Product');
    
    return await Product.countDocuments({ 
      workspaceId,
      storeConnectionId 
    });
  }
}

export default ProductCountService;