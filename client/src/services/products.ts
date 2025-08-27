// Re-export productsApi as productsService for backward compatibility
export { productsApi as productsService } from '@/api'

// Export types for backward compatibility  
export type { Product, ProductsResponse, ProductsQuery } from '@/api/products'