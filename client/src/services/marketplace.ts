import type { Marketplace, TestConnectionResponse, ConnectMarketplaceRequest, MarketplaceCredentials } from '@/types/marketplace';

const API_BASE = 'http://localhost:5000/api';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

export const marketplaceService = {
  // Get all available marketplaces
  async getMarketplaces(): Promise<Marketplace[]> {
    const response = await fetch(`${API_BASE}/marketplaces`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch marketplaces');
    }
    
    const data = await response.json();
    return data.data;
  },

  // Get marketplace status (connected/disconnected)
  async getMarketplaceStatus(): Promise<Marketplace[]> {
    const response = await fetch(`${API_BASE}/marketplaces/status`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch marketplace status');
    }
    
    const data = await response.json();
    return data.data;
  },

  // Test marketplace connection
  async testConnection(type: string, credentials: MarketplaceCredentials): Promise<TestConnectionResponse> {
    const response = await fetch(`${API_BASE}/marketplaces/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, credentials }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Connection test failed');
    }
    
    return response.json();
  },

  // Connect marketplace to existing store
  async connectToStore(request: ConnectMarketplaceRequest): Promise<any> {
    const response = await fetch(`${API_BASE}/marketplaces/connect`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to connect marketplace');
    }
    
    return response.json();
  },

  // Create new store with marketplace
  async createStoreWithMarketplace(request: ConnectMarketplaceRequest): Promise<any> {
    const response = await fetch(`${API_BASE}/marketplaces/create-store`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create store connection');
    }
    
    return response.json();
  },

  // Test existing marketplace connection
  async testExistingConnection(connectionId: string, marketplaceId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/marketplaces/${connectionId}/${marketplaceId}/test`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Connection test failed');
    }
    
    return response.json();
  },

  // Toggle marketplace status
  async toggleMarketplaceStatus(connectionId: string, marketplaceId: string): Promise<any> {
    const response = await fetch(`${API_BASE}/marketplaces/${connectionId}/${marketplaceId}/toggle`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle marketplace status');
    }
    
    return response.json();
  }
};