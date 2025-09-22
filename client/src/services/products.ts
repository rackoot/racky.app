// Re-export productsApi as productsService for backward compatibility
export { productsApi as productsService } from '@/api'

// Export utility functions
export { getMarketplaceProductUrl } from '@/api/products'

// Export types for backward compatibility
export type { Product, ProductsResponse, ProductsQuery } from '@/api/products'