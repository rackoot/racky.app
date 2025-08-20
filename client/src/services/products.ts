const API_BASE = 'http://localhost:5000/api';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

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
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
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

export const productsService = {
  // Get all products for a user with pagination and filtering
  async getAllProducts(query: ProductsQuery = {}): Promise<ProductsResponse> {
    const searchParams = new URLSearchParams();
    
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, value.toString());
      }
    });
    
    const response = await fetch(`${API_BASE}/products?${searchParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch products');
    }
    
    const data = await response.json();
    return data.data;
  },

  // Get products for a specific store connection
  async getStoreProducts(connectionId: string): Promise<Product[]> {
    const response = await fetch(`${API_BASE}/products/store/${connectionId}`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch store products');
    }
    
    const data = await response.json();
    return data.data;
  },

  // Sync products from a marketplace
  async syncProducts(connectionId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/products/sync/${connectionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync products');
    }
    
    return response.json();
  },

  // Get single product by ID
  async getProductById(id: string): Promise<any> {
    const response = await fetch(`${API_BASE}/products/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch product');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch product');
    }

    return data.data;
  }
};