import type { Marketplace, TestConnectionResponse, ConnectMarketplaceRequest, MarketplaceCredentials } from '@/types/marketplace';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  const workspaceId = localStorage.getItem('currentWorkspaceId');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...(workspaceId && { 'X-Workspace-ID': workspaceId })
  };
};

export const marketplaceService = {
  // Get all available marketplaces
  async getMarketplaces(): Promise<Marketplace[]> {
    const response = await fetch(`/api/marketplaces`, {
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
    const response = await fetch(`/api/marketplaces/status`, {
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
    const headers = getAuthHeaders();
    console.log('Testing connection with headers:', headers);
    console.log('Request URL:', `/api/marketplaces/test`);
    
    const response = await fetch(`/api/marketplaces/test`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, credentials }),
    });
    
    console.log('Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      console.error('API Error:', error);
      throw new Error(error.message || `Connection test failed (HTTP ${response.status})`);
    }
    
    return response.json();
  },

  // Connect marketplace to existing store
  async connectToStore(request: ConnectMarketplaceRequest): Promise<any> {
    const response = await fetch(`/api/marketplaces/connect`, {
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
    const response = await fetch(`/api/marketplaces/create-store`, {
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
  async testExistingConnection(connectionId: string): Promise<any> {
    const response = await fetch(`/api/marketplaces/${connectionId}/test`, {
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
  async toggleMarketplaceStatus(connectionId: string): Promise<any> {
    const response = await fetch(`/api/marketplaces/${connectionId}/toggle`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle marketplace status');
    }
    
    return response.json();
  },

  // Disconnect marketplace from store
  async disconnectMarketplace(connectionId: string, deleteProducts: boolean = false): Promise<any> {
    const response = await fetch(`/api/connections/${connectionId}?deleteProducts=${deleteProducts}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to disconnect marketplace');
    }
    
    return response.json();
  }
};