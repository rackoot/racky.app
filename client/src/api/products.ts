import { apiGet, apiPost } from './client'
import { ENDPOINTS } from './config'
import { PaginationResponse } from './types'

// Import existing product types
export interface Product {
  id?: string
  _id?: string
  title: string
  description: string
  price: number
  compareAtPrice?: number
  inventory: number
  vendor: string
  productType: string
  tags: string[]
  images: Array<{
    url: string
    altText?: string
  }>
  status: string
  shopifyId: string
  handle: string
  createdAt: string
  updatedAt: string
  marketplace?: string
  isMarketplaceConnected?: boolean
  marketplaceUrl?: string
  variants?: Array<{
    id: string;
    title: string;
    price: number;
    compareAtPrice?: number;
    sku?: string;
    inventory: number;
    weight?: number;
    weightUnit?: string;
  }>;
}

export interface ProductsResponse {
  products: Product[];
  pagination: PaginationResponse;
  filters: {
    marketplaces: Array<{
      marketplace: string;
      count: number;
    }>;
  };
}

export interface ProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  marketplace?: string;
  store?: string; // Store connection ID
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
}

export const productsApi = {
  /**
   * Get all products for a user with pagination and filtering
   */
  async getAllProducts(query: ProductsQuery = {}): Promise<ProductsResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString());
      }
    });
    
    const url = `${ENDPOINTS.PRODUCTS.LIST}?${searchParams.toString()}`
    return apiGet<ProductsResponse>(url)
  },

  /**
   * Get products for a specific store connection
   */
  async getStoreProducts(connectionId: string): Promise<Product[]> {
    return apiGet<Product[]>(ENDPOINTS.PRODUCTS.STORE_PRODUCTS(connectionId))
  },

  /**
   * Sync products from a marketplace
   */
  async syncProducts(connectionId: string, force: boolean = false): Promise<any> {
    return apiPost<any>(ENDPOINTS.PRODUCTS.SYNC(connectionId), { force })
  },

  /**
   * Check if products exist for a connection
   */
  async hasProducts(connectionId: string): Promise<{ hasProducts: boolean; count: number }> {
    return apiGet<{ hasProducts: boolean; count: number }>(ENDPOINTS.PRODUCTS.STORE_COUNT(connectionId))
  },

  /**
   * Get single product by ID
   */
  async getProductById(id: string): Promise<any> {
    return apiGet<any>(ENDPOINTS.PRODUCTS.GET(id))
  },
}