const API_BASE = 'http://localhost:5000/api';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

export interface Product {
  id: string
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
}

export const productsService = {
  // Get all products for a user
  async getAllProducts(): Promise<Product[]> {
    const response = await fetch(`${API_BASE}/products`, {
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
  async syncProducts(connectionId: string, marketplaceId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/products/sync/${connectionId}/${marketplaceId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync products');
    }
    
    return response.json();
  }
};